// Madina 1 typical arch (keel option 2: 920 wide, apex +2960, rise 560, R 400, springing +2400): CNC / laser DXFs, one part per file,
// 1:1 in mm, part's lower-left at 0,0, closed polylines with true arcs. Geometry as projects/madina1/scripts/m_keel.mjs (opt2).
// Layers: CUT (outline, through), HOLES (through holes), POCKET-<depth> (routed, not through), TEXT (part label, do not cut).
import { mkdirSync, writeFileSync } from "node:fs";
import { Dxf, pt, arcV, rectPath, area, reverse } from "../../../../tools/cnc_dxf.mjs";
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const W = 920, APEX = 2960, RISE = 560, R = 400, SPRING = APEX - RISE, T = 36, SK = 1, PLY_B = 5, MARBLE = 20, SOFFIT = 18;
const QTY = 6; // six typical arches: W-A1, W-A2, E-A1, E-A2, RL-A1, RR-A1
const rows = [], add = (r) => rows.push(r);

// Keel line offset k inward, as an exact path: left arc (centre (R, SPRING), radius R-k) from 180 deg to the tangent angle t,
// a straight tangent to the axis, then mirrored. Returns the half-line meeting points and the apex for building closed paths.
const t = Math.atan2(RISE, W / 2 - R) + Math.acos(R / Math.hypot(W / 2 - R, RISE));
function keel(k) {
  const r = R - k, pL = [R + r * Math.cos(t), SPRING + r * Math.sin(t)];
  const zApex = pL[1] + ((W / 2 - pL[0]) / Math.sin(t)) * -Math.cos(t);
  return { r, start: [R - r, SPRING], pL, apex: [W / 2, zApex] };
}
// Closed path of the keel line at offset k from springing-left, over the apex, down to springing-right (counter-clockwise when closed below).
function keelPath(k) {
  const q = keel(k), L = [], c = [R, SPRING], cR = [W - R, SPRING];
  // right side first (counter-clockwise for an outer boundary): springing right -> right arc up -> straight to apex -> straight down -> left arc down
  L.push(arcV(cR[0], cR[1], q.r, 0, Math.PI - t));
  L.push(pt(W - q.pL[0], q.pL[1]));
  L.push(pt(q.apex[0], q.apex[1]));
  L.push(arcV(c[0], c[1], q.r, t, Math.PI));
  L.push(pt(R - q.r, SPRING));   // left springing: the arc above ends here
  return L;
}
// Rib: ring between the keel offsets kO (outer) and kI (inner), closed at the springing.
function ringPath(kO, kI) {
  const o = keelPath(kO), i = keelPath(kI);
  // outer CCW from right springing up and over to left springing; then across to the inner left springing; inner reversed back to the right.
  return [...o, ...reverse(i).map((v, n, a) => v)];
}

function savePart(name, mat, thk, qty, outline, extra = (d) => {}, note = "") {
  const d = new Dxf(); const cut = d.layer("CUT", 1); d.layer("HOLES", 3); d.layer("TEXT", 8);
  const x0 = Math.min(...outline.map((p) => p.x)), y0 = Math.min(...outline.map((p) => p.y));
  const shift = (p) => ({ ...p, x: p.x - x0, y: p.y - y0 });
  const ol = (area(outline) < 0 ? reverse(outline) : outline).map(shift);
  d.poly(ol, cut); extra(d, x0, y0);
  const w = Math.max(...ol.map((p) => p.x)), h = Math.max(...ol.map((p) => p.y));
  d.text(0, -40, 20, `${name} | ${mat} ${thk} mm | QTY ${qty} | ${Math.round(w)} x ${Math.round(h)}`, "TEXT");
  if (note) d.text(0, -70, 14, note, "TEXT");
  const file = `${name.replace(/[^A-Za-z0-9-]+/g, "_")}.dxf`; d.save(`${OUT}/${file}`);
  add({ file, name, mat, thk, qty, w: Math.round(w), h: Math.round(h), note });
}

// 1. Arch ribs: FR MDF 18, ring 6..30 in from the outer keel line, 3 per arch (front, middle, back).
const kOut = SK + PLY_B, kIn = T - SK - PLY_B;
{   const outer = keelPath(kOut), inner = reverse(keelPath(kIn));
  savePart("ARCH-RIB", "FR MDF", 18, 3 * QTY, [...outer, ...inner], () => {}, `Ring ${kOut} to ${kIn} in from the outer keel line; springing +${SPRING} at the bottom edge. Bending ply and veneer wrap it.`); }

// 2. Head backing (18 MDF) and head marble (20 stone): the arch opening above the marble head, under the inner keel line (k = 36).
function headPath(z) {
  const q = keel(T), r = q.r, c = [R, SPRING];
  const ang = Math.asin(Math.min(1, (z - SPRING) / r));       // where the inner arc reaches height z (arc part below the tangent)
  const uL = c[0] - r * Math.cos(ang), uR = W - uL;
  return [pt(uL, z), pt(uR, z), arcV(W - R, SPRING, r, ang, Math.PI - t), pt(W - q.pL[0], q.pL[1]), pt(q.apex[0], q.apex[1]), arcV(R, SPRING, r, t, Math.PI - ang)].map((v, n) => v);
}
// Fix the arc start points: arcV gives the start vertex on the arc; the first arc must start at (uR, z) which equals its own start.
const Z1 = SPRING + MARBLE, Z2 = Z1 + SOFFIT;
{ const p = headPath(Z2); savePart("ARCH-HEAD-BACKING", "MDF", 18, QTY, [p[0], p[2], p[3], p[4], p[5]], () => {}, `Fills the arch head above +${Z2}, behind the marble; screwed to the ribs.`); }
{ const p = headPath(Z1); savePart("ARCH-HEAD-MARBLE", "Tuscany Travertine", 20, QTY, [p[0], p[2], p[3], p[4], p[5]], () => {}, `Marble head face above +${Z1}. Waterjet. Polish the arch edge.`); }

// 3. Pegboard, lower panel and steel plates: holes Ø21 at 50 pitch, grid centred; 8 columns each side of the centre.
const C = W / 2, u0 = T + 2, u1 = W - T - 2, LOW = 840, BASE = 700, UNDER = SPRING, HR = 10.5, ROW0 = 870.5;
const cols = []; for (let k = 0; k < 8; k++) cols.push(C - 25 - 50 * k, C + 25 + 50 * k); cols.sort((a, b) => a - b);
const pegRows = []; for (let z = ROW0; z <= UNDER - 25; z += 50) pegRows.push(z);
const holes = (us, zs, r) => (d, x0, y0) => { for (const u of us) for (const z of zs) d.circle(u - x0, z - y0, r, "HOLES"); };
savePart("PEGBOARD-EGGER", "EGGER H1113 Brown Kansas Oak", 8, QTY, rectPath(u0, LOW + 3, u1, UNDER), holes(cols, pegRows, HR), `Drill with the FR MDF board as one 26 mm board: ${cols.length * pegRows.length} holes Ø21.`);
savePart("PEGBOARD-FR-MDF", "FR MDF", 18, QTY, rectPath(u0, LOW + 3, u1, UNDER), holes(cols, pegRows, HR));
const vents = [720, 770, 820];
savePart("LOWER-PANEL-EGGER", "EGGER H1113 Brown Kansas Oak", 8, QTY, rectPath(u0, BASE + 3, u1, LOW), holes(cols, vents, HR), "Removable, vents Ø21.");
savePart("LOWER-PANEL-FR-MDF", "FR MDF", 18, QTY, rectPath(u0, BASE + 3, u1, LOW), holes(cols, vents, HR));
// Steel plates 2 mm, pre-galvanised, laser: split 5 mm each side of the centre. Fixing Ø5 x 6 on the outer edge at 300; front plates get a Ø6 terminal hole.
for (const [side, a, b] of [["LEFT", u0, C - 5], ["RIGHT", C + 5, u1]]) {
  const cs = cols.filter((u) => (side === "LEFT" ? u < C : u > C)), outerU = side === "LEFT" ? a + 10 : b - 10, innerU = side === "LEFT" ? b - 20 : a + 20;
  const fix = []; for (let k = 0; k < 6; k++) fix.push(LOW + 3 + 28.5 + 300 * k);
  for (const fr of ["FRONT", "REAR"]) {
    savePart(`PLATE-${fr}-${side}`, "Steel, pre-galvanised", 2, QTY, rectPath(a, LOW + 3, b, UNDER), (d, x0, y0) => {
      holes(cs, pegRows, HR)(d, x0, y0); for (const z of fix) d.circle(outerU - x0, z - y0, 2.5, "HOLES");
      if (fr === "FRONT") d.circle(innerU - x0, LOW + 3 + 20 - y0, 3, "HOLES");
    }, `Laser after galvanising. No paint on the front plates. Fixing Ø5 x 6 at 300; ${fr === "FRONT" ? "terminal Ø6 at the bottom inner corner. " : ""}Check against the 848 opening on the first arch.`);
  }
}
// 4. Shelf (two 18 EGGER layers): outline 840 x 400 with the routing on the underside layer.
{ const L = 840, D = 400;
  savePart("SHELF-LOWER-LAYER", "EGGER H1113 Brown Kansas Oak", 18, 4 * QTY, rectPath(0, 0, L, D), (d) => {
    const pk = d.layer("POCKET-10", 5), pk25 = d.layer("POCKET-12-5", 4);
    d.poly(rectPath(20, 15, 820, 27), pk);                                         // LED channel 12 wide, 10 deep, 15 from the front
    for (const x of [145, 345, 495, 695]) d.poly(rectPath(x - 12.5, 40, x + 12.5, 400), pk25); // peg grooves 25 wide, to the back edge
  }, "Underside layer: LED channel 12x10 (layer POCKET-10), peg grooves 25 wide 12.5 deep (POCKET-12-5). Front edge PVC 2 after gluing.");
  savePart("SHELF-TOP-LAYER", "EGGER H1113 Brown Kansas Oak", 18, 4 * QTY, rectPath(0, 0, L, D), () => {}, "Glued on the lower layer, one edge band across both.");
}
writeFileSync(`${OUT}/_CUT-LIST.csv`, "file,part,material,thickness_mm,qty,width_mm,height_mm,note\n" + rows.map((r) => [r.file, r.name, r.mat, r.thk, r.qty, r.w, r.h, `"${r.note}"`].join(",")).join("\n") + "\n");
console.log(rows.map((r) => `${r.file}  ${r.w}x${r.h}  qty ${r.qty}`).join("\n"));
