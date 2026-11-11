// Madina 2 ST-E2 (1370526): rear end 13 mm back (+y) so the rear posts' front face sits at world y 4978, 18 behind FL-A's
// rear board (y 4960) for one 18 softwood batten (user via the Madina 2 sheets session, 11 Nov 2026: "Rear: 18 behind").
// Family coords = world - (5700, 726). Joint shelf plates stay. Room behind checked: east wall at world y 5160, window 5640.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" }, id = 1370526, d = 13, ST = "SHS 40x40x2 Steel Approved", BP = "Steel Base Plate 8 Approved";
const fi = await call("inspect_family", { ...D, element_id: id });
const F = fi.items.filter((i) => i.class === "FreeFormElement");
const r0 = (v) => Math.round(v), at = (i) => [i.min.x, i.min.y, i.min.z, i.max.x, i.max.y, i.max.z].map(r0).join(",");
const pick = (s) => { const f = F.filter((i) => at(i) === s); if (f.length !== 1) throw new Error("not found once: " + s); return f[0]; };
const moveIds = ["30,4239,8,70,4279,2920", "70,4239,2880,618,4279,2920", "50,4239,56,638,4279,2884", "618,4239,48,658,4279,2880"].map((s) => pick(s).id);
const del = ["0,4209,0,100,4309,8", "608,4209,0,658,4309,8", "30,70,2780,70,4239,2820", "30,70,2880,70,4239,2920",
  "618,30,8,658,4279,48", "618,30,1480,658,4279,1520", "618,30,2880,658,4279,2920"].map((s) => pick(s));
const B = (x0, y0, z0, x1, y1, z1, material) => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, material });
// The two diagonals stay: the back diagonal foot still lands on the (longer) bottom back rail and the top brace end on the
// top chord. The bridge build in Revit (074721) cannot extrude a profile along a direction, so they are not rebuilt.
// a 40x40 bar between two centre points (needs a newer bridge build), as a profile extruded along the bar
const bar = (S, E) => {
  const v = [E[0] - S[0], E[1] - S[1], E[2] - S[2]], L = Math.hypot(...v), u = v.map((c) => c / L);
  const a = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  let n1 = cr(u, a); const l1 = Math.hypot(...n1); n1 = n1.map((c) => c / l1); const n2 = cr(u, n1);
  const pt = (s, t) => ({ x: S[0] + 20 * (s * n1[0] + t * n2[0]), y: S[1] + 20 * (s * n1[1] + t * n2[1]), z: S[2] + 20 * (s * n1[2] + t * n2[2]) });
  return { profile: [pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1)], direction: { x: u[0], y: u[1], z: u[2] }, length_mm: L, material: ST };
};
const add = [
  B(0, 4252, 0, 100, 4352, 8, BP), B(608, 4252, 0, 658, 4352, 8, BP),            // base plates, post on the front edge
  B(30, 70, 2780, 70, 4252, 2820, ST), B(30, 70, 2880, 70, 4252, 2920, ST),       // truss chords to the moved end
  B(618, 30, 8, 658, 4292, 48, ST), B(618, 30, 1480, 658, 4292, 1520, ST), B(618, 30, 2880, 658, 4292, 2920, ST), // back rails
];
const r = await call("edit_family_solids", { ...D, element_id: id, delete_form_ids: del.map((i) => i.id), add, move: [{ ids: moveIds, dx_mm: 0, dy_mm: d, dz_mm: 0 }] });
console.log("deleted", r.deleted, "added", r.added.length);
const g = await call("get_element", { ...D, element_id: id }); console.log(JSON.stringify(g.bounding_box));
