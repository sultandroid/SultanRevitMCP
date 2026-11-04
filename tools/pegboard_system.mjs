// Samaya Factory pegboard system (the Madina 1 standard): geometry for one open shelf unit's back, shelves and pegs,
// as create_direct_shape solids. Pure geometry: no Revit calls. Use it from any project script, then make_unit_family.
//
// Build-up from the back of the unit (x = 0) to the room:
//   rear steel plate 2 (2 halves) | 30 space (wiring) | front steel plate 2 (2 halves) | FR MDF 18 | EGGER 8 face  = 60
//   The wood board (FR MDF + EGGER, 26) is ONE piece, drilled together with the plates: Ø21 holes at 50 pitch, grid centred.
//   2 mm steel angles fixed to the sides carry the plates. The plates are split at the centre (5 mm gap): the two halves are
//   the low-voltage poles that feed the lit shelves through the pegs (brass strips on live pegs and in the shelf grooves;
//   electrical engineer's review and a tested sample required).
//   Removable lower panel (same 26 build-up, 3 rows of vent holes) under the pegboard, for access to the wiring.
//   Pegs hardwood: Ø25 under the shelf (360 long, top 9 mm into the shelf), Ø20 shank through the board to the rear plate. 4 per shelf.
//   Shelves: double 18 EGGER (36), PVC 2 front edge, LED in a 12 x 10 groove 15 behind the front, fixed positions on hole rows.
//
// Local frame: x from the back (0) to the front, y along the unit, z up. Pass world(x, y, z) -> {x, y, z} and the two unit
// directions (dirX: back -> front, dirZ: up) in world terms. Returns { parts: [{ name, solids }], info }.
// Each solid has matKey (see MATERIALS) instead of material_id: map it before create_direct_shape.
export const MATERIALS = {
  egger: ["EGGER 8 Pegboard Face Approved Oak", 150, 110, 75],
  fr: ["FR MDF 18 Pegboard Core", 150, 120, 95],
  metal: ["Steel Plate 2 mm Black", 35, 35, 35],
  peg: ["Hardwood Peg", 170, 125, 80],
  shelf: ["EGGER Shelf 18 Approved Decor", 196, 160, 120],
  pvc: ["PVC Edge 2 mm Matching", 138, 100, 68],
  led: ["LED Strip Warm White", 255, 214, 140],
};
export const SPEC = { PLATE: 2, SPACE: 30, FR: 18, EG: 8, HOLE_R: 10.5, PITCH: 50, LOWER: 140, PEG_R: 12.5, SHANK_R: 10, PEG_LEN: 360, ANGLE: 2, GAP: 5, PVC: 2, G0: 15, GW: 12, GH: 10, SHELF: 36 };

export function pegboardSystem({ y0, y1, z0, z1, front, shelves = 3, world, dirX, dirZ }) {
  const S = SPEC, xRP = 0, xFP = S.PLATE + S.SPACE, xFR = xFP + S.PLATE, xEG = xFR + S.FR, xFace = xEG + S.EG; // 0, 32, 34, 52, 60
  const parts = [], add = (name, solids) => parts.push({ name, solids });
  const C = (y0 + y1) / 2, py0 = y0 + S.ANGLE, py1 = y1 - S.ANGLE;                 // board between the angles
  // y-z prism extruded along x (dirX)
  const yz = (pts, x0, len, matKey, holes) => ({ profile: pts.map(([y, z]) => world(x0, y, z)), ...(holes ? { holes: holes.map((h) => h.map(([y, z]) => world(x0, y, z))) } : {}), direction: dirX, length_mm: len, matKey });
  const rect = (a, b, c, d) => [[a, c], [b, c], [b, d], [a, d]];
  const circ = (cy, cz, r, n = 8) => Array.from({ length: n }, (_, k) => { const t = ((k + 0.5) * 2 * Math.PI) / n; return [cy + r * Math.cos(t), cz + r * Math.sin(t)]; });
  // hole grid: columns centred (±25, ±75, ...), border ≥ 45 to the board edge; rows 27.5 above the board bottom, 50 pitch
  const cols = []; for (let k = 0; 25 + 50 * k <= (py1 - py0) / 2 - 45; k++) cols.push(C - 25 - 50 * k, C + 25 + 50 * k);
  cols.sort((a, b) => a - b);
  const zL0 = z0 + 3, zL1 = z0 + S.LOWER, zP0 = zL1 + 3, zP1 = z1;                    // lower panel, pegboard
  const rows = []; for (let z = zP0 + 27.5; z <= zP1 - 25; z += S.PITCH) rows.push(z);
  const vents = [zL1 - 120, zL1 - 70, zL1 - 20].filter((z) => z > zL0 + 15);              // as Madina 1: 3 rows, 50 apart
  const holesAt = (zs, side = 0) => zs.flatMap((z) => cols.filter((c) => side === 0 || (c - C) * side > 0).map((c) => circ(c, z, S.HOLE_R)));
  // wood pegboard, one piece, and the lower panel
  add("Pegboard EGGER", [yz(rect(py0, py1, zP0, zP1), xEG, S.EG, "egger", holesAt(rows))]);
  add("Pegboard FR MDF", [yz(rect(py0, py1, zP0, zP1), xFR, S.FR, "fr", holesAt(rows))]);
  add("Lower Panel EGGER", [yz(rect(py0, py1, zL0, zL1), xEG, S.EG, "egger", holesAt(vents))]);
  add("Lower Panel FR MDF", [yz(rect(py0, py1, zL0, zL1), xFR, S.FR, "fr", holesAt(vents))]);
  // steel plates in two halves (front on the back of the board, rear at the back), and the side angles
  for (const [nm, x] of [["Front Plate", xFP], ["Rear Plate", xRP]]) {
    add(nm + " Left", [yz(rect(py0, C - S.GAP / 2, z0 + 3, zP1), x, S.PLATE, "metal", holesAt(rows, -1))]);
    add(nm + " Right", [yz(rect(C + S.GAP / 2, py1, z0 + 3, zP1), x, S.PLATE, "metal", holesAt(rows, 1))]);
  }
  add("Steel Angles", [yz(rect(y0, y0 + S.ANGLE, z0, zP1), xRP, xFP + S.PLATE, "metal"), yz(rect(y1 - S.ANGLE, y1, z0, zP1), xRP, xFP + S.PLATE, "metal")]);
  // shelves on hole rows, evenly spread: peg centre on a row, shelf top = peg centre + 39.5
  const n = shelves, pick = Array.from({ length: n }, (_, i) => rows[Math.round(((i + 1) * (rows.length - 1)) / (n + 1))]);
  const tops = pick.map((r) => r + 39.5);
  const pegCols = [cols.find((c) => c > C + 50) ?? C + 75, cols.filter((c) => c < py1 - 120).at(-1)].flatMap((c) => [c, 2 * C - c]);
  const sy0 = py0 + 2, sy1 = py1 - 2, sx0 = xFace, sx1 = front - S.PVC; // shelf between the angles, back on the board face
  const bar = (x0, x1, z0b, z1b, matKey, ya = sy0, yb = sy1) => ({ profile: [[x0, ya], [x1, ya], [x1, yb], [x0, yb]].map(([x, y]) => world(x, y, z0b)), direction: dirZ, length_mm: z1b - z0b, matKey });
  const pegs = [], leds = [];
  tops.forEach((top, i) => {
    const low = top - S.SHELF, mid = top - 18, g1 = sx1 - S.G0, g0 = g1 - S.GW;
    add(`Shelf ${i + 1}`, [bar(sx0, sx1, mid, top, "shelf"), bar(sx0, g0, low, mid, "shelf"), bar(g1, sx1, low, mid, "shelf"), bar(g0, g1, low + S.GH, mid, "shelf"), bar(sx1, front, low, top, "pvc")]);
    add(`Shelf ${i + 1} LED`, [bar(g0, g1, low, low + S.GH, "led", sy0 + 5, sy1 - 5)]);
    leds.push(sy1 - sy0 - 10);
    const cz = top - S.SHELF + 9 - S.PEG_R;
    for (const c of pegCols) {
      pegs.push(yz(circ(c, cz, S.PEG_R, 16), xFace, S.PEG_LEN, "peg"));
      pegs.push(yz(circ(c, cz, S.SHANK_R, 16), xRP + S.PLATE, xFace - xRP - S.PLATE, "peg"));
    }
  });
  add("Pegs", pegs);
  return { parts, info: { cols: cols.length, rows: rows.length, holes: cols.length * rows.length, tops, pegCols, ledMm: leds, faceX: xFace, pegboardZ: [zP0, zP1], lowerZ: [zL0, zL1] } };
}
