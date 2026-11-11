// Samaya Factory open shelf unit with decorative pegboard (factory standard, user 11 Nov 2026; replaces the Madina 1
// steel-plate / lit-peg system). Pure geometry: no Revit calls. Use it from any project script, then make_unit_family.
//
// Build-up from the back of the unit (x = 0) to the room:
//   FR MDF 18 | EGGER 8 face in the project colour = 26, ONE piece, decorative: Ø21 holes at 50 pitch, grid centred, plain
//   border with no holes at least 100 from every edge (to the hole edge). The holes can take small accessories only.
//   NO steel plates, NO angles, NO shelf pegs through the board.
//   Two side panels EGGER 18 (project shelf decor), from the back of the board to the shelf front, full height, set inside the
//   clear opening. Shelves stand on Ø5 shelf pins, System 32 (two rows of holes 37 from the front and 37 from the board face,
//   32 pitch), 4 pins per shelf; shelves 1 mm clear of each side.
//   Shelves: double 18 EGGER (36), PVC 2 front edge, LED in a 12 x 10 groove 15 behind the front.
//   Lower panel (same 26 build-up, plain) under the pegboard.
//
// Local frame: x from the back (0) to the front, y along the unit (y0..y1 = the clear opening), z up. Pass world(x, y, z)
// -> {x, y, z} and the unit directions (dirX: back -> front, dirZ: up) in world terms. Returns { parts, info }.
// Each solid has matKey (see MATERIALS) instead of material_id: map it before create_direct_shape.
export const MATERIALS = {
  egger: ["EGGER 8 Pegboard Face Approved Oak", 150, 110, 75],
  fr: ["FR MDF 18 Pegboard Core", 150, 120, 95],
  side: ["EGGER Shelf 18 Approved Decor", 196, 160, 120],
  pin: ["Shelf Pin Steel Nickel", 190, 190, 195],
  shelf: ["EGGER Shelf 18 Approved Decor", 196, 160, 120],
  pvc: ["PVC Edge 2 mm Matching", 138, 100, 68],
  led: ["LED Strip Warm White", 255, 214, 140],
};
export const SPEC = { FR: 18, EG: 8, HOLE_R: 10.5, PITCH: 50, LOWER: 140, BORDER: 100, SIDE: 18, PIN_R: 2.5, PIN_OUT: 8, PIN_IN: 37, SYS: 32, CLR: 1, PVC: 2, G0: 15, GW: 12, GH: 10, SHELF: 36 };

export function pegboardSystem({ y0, y1, z0, z1, front, shelves = 3, world, dirX, dirZ }) {
  const S = SPEC, xFR = 0, xEG = S.FR, xFace = S.FR + S.EG;                                   // 0, 18, 26
  const parts = [], add = (name, solids) => parts.push({ name, solids });
  const sy0 = y0 + S.SIDE, sy1 = y1 - S.SIDE, C = (y0 + y1) / 2;                            // between the sides
  const yz = (pts, x0, len, matKey, holes) => ({ profile: pts.map(([y, z]) => world(x0, y, z)), ...(holes ? { holes: holes.map((h) => h.map(([y, z]) => world(x0, y, z))) } : {}), direction: dirX, length_mm: len, matKey });
  const rect = (a, b, c, d) => [[a, c], [b, c], [b, d], [a, d]];
  const circ = (cy, cz, r, n = 6) => Array.from({ length: n }, (_, k) => { const t = ((k + 0.5) * 2 * Math.PI) / n; return [cy + r * Math.cos(t), cz + r * Math.sin(t)]; });
  const B = S.BORDER + S.HOLE_R;
  const cols = []; for (let k = 0; 25 + 50 * k <= (sy1 - sy0) / 2 - B; k++) cols.push(C - 25 - 50 * k, C + 25 + 50 * k);
  cols.sort((a, b) => a - b);
  const zL0 = z0, zL1 = z0 + S.LOWER, zP0 = zL1 + 3, zP1 = z1;
  const rows = []; for (let z = zP0 + 27.5; z <= zP1 - B; z += S.PITCH) if (z >= zP0 + B) rows.push(z);
  const holes = rows.flatMap((z) => cols.map((c) => circ(c, z, S.HOLE_R)));
  add("Pegboard EGGER", [yz(rect(sy0, sy1, zP0, zP1), xEG, S.EG, "egger", holes)]);
  add("Pegboard FR MDF", [yz(rect(sy0, sy1, zP0, zP1), xFR, S.FR, "fr", holes)]);
  add("Lower Panel EGGER", [yz(rect(sy0, sy1, zL0, zL1), xEG, S.EG, "egger")]);
  add("Lower Panel FR MDF", [yz(rect(sy0, sy1, zL0, zL1), xFR, S.FR, "fr")]);
  // side panels, back of the board to the shelf front, full height
  const box = (xa, xb, ya, yb, za, zb, matKey) => ({ profile: [[xa, ya], [xb, ya], [xb, yb], [xa, yb]].map(([x, y]) => world(x, y, za)), direction: dirZ, length_mm: zb - za, matKey });
  add("Sides", [box(0, front, y0, sy0, z0, z1, "side"), box(0, front, sy1, y1, z0, z1, "side")]);
  // shelves evenly spread over the pegboard height, on System 32 positions
  const span = zP1 - zP0, tops = Array.from({ length: shelves }, (_, i) => Math.round((zP0 + (span * (i + 1)) / (shelves + 1)) / S.SYS) * S.SYS);
  const ya = sy0 + S.CLR, yb = sy1 - S.CLR, sx0 = xFace, sx1 = front - S.PVC;
  const bar = (x0, x1, za, zb, matKey, y_a = ya, y_b = yb) => ({ profile: [[x0, y_a], [x1, y_a], [x1, y_b], [x0, y_b]].map(([x, y]) => world(x, y, za)), direction: dirZ, length_mm: zb - za, matKey });
  const pins = [];
  tops.forEach((top, i) => {
    const low = top - S.SHELF, mid = top - 18, g1 = sx1 - S.G0, g0 = g1 - S.GW;
    add(`Shelf ${i + 1}`, [bar(sx0, sx1, mid, top, "shelf"), bar(sx0, g0, low, mid, "shelf"), bar(g1, sx1, low, mid, "shelf"), bar(g0, g1, low + S.GH, mid, "shelf"), bar(sx1, front, low, top, "pvc")]);
    add(`Shelf ${i + 1} LED`, [bar(g0, g1, low, low + S.GH, "led", ya + 5, yb - 5)]);
    for (const x of [front - S.PIN_IN, xFace + S.PIN_IN]) for (const [yF, len] of [[sy0, S.PIN_OUT], [sy1 - S.PIN_OUT, S.PIN_OUT]]) {
      const ring = circ(x, low - S.PIN_R, S.PIN_R, 8).map(([xx, zz]) => world(xx, yF, zz));
      pins.push({ profile: ring, direction: dirAlong(world), length_mm: len, matKey: "pin" });
    }
  });
  add("Shelf Pins", pins);
  return { parts, info: { cols: cols.length, rows: rows.length, holes: cols.length * rows.length, tops, faceX: xFace, pegboardZ: [zP0, zP1], shelfWidth: yb - ya } };
}
// unit y direction in world terms, from two world() points
function dirAlong(world) { const a = world(0, 0, 0), b = world(0, 1, 0); return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }; }
