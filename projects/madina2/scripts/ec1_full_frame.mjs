// Madina 2 E-C1: full-length SHS 40x40x2 steel frame (user 11 Nov 2026: "full counter structure" -> full steel frame).
// Family coords: x 0 = room face (doors x 20-38), x 630 back; y 20-3820 with end panels 20-38 / 3802-3820; z up.
// The sink bay frame (y 3169-3802) from ec1_sink.mjs stays; this adds the rest and refits the MR boards round it.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" }, id = 391666;
const MR = "EGGER White Carcass 18 MR", MRB = "EGGER White Back 8 MR", ST = "SHS 40x40x2 Steel Approved", FT = "Adjustable Leg Steel 50";
const B = (x0, y0, z0, x1, y1, z1, material) => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, material });
const fi = await call("inspect_family", { ...D, element_id: id });
const near = (a, b) => Math.abs(a - b) < 1.5;
const is = (i, m, x0, x1, z0, z1) => i.material === m && near(i.min.x, x0) && near(i.max.x, x1) && (z0 == null || (near(i.min.z, z0) && near(i.max.z, z1)));
const del = fi.items.filter((i) =>
  (is(i, MR, 38, 630, 50, 68) && i.max.y < 3200) ||               // bottom board (sat where the bottom ring goes)
  (is(i, MR, 38, 544, 68, 662)) ||                                 // 5 dividers
  (is(i, MR, 58, 544, 356, 374) && i.max.y < 3200) ||             // 4 shelves
  (is(i, MRB, 544, 552) && i.max.y < 3200) ||                     // inner back
  (near(i.min.x, 40) && near(i.max.x, 490)) || (near(i.min.x, 40) && near(i.max.x, 58)) || (near(i.min.x, 472) && near(i.max.x, 490))); // drawer boxes
console.log("delete", del.length, "(expect 1 + 5 + 4 + 1 + 15 = 26)");
if (del.length !== 26) throw new Error("unexpected part count, stop");
const add = [];
// frame: posts (front x 75-115, back x 540-580) at the left end and mid-run; rings z 50-90 and 640-680; cross rails
const PY = [[38, 78], [1791, 1831]];
for (const [a, b] of PY) add.push(B(75, a, 50, 115, b, 640, ST), B(540, a, 50, 580, b, 640, ST));
for (const [z0, z1] of [[50, 90], [640, 680]]) {
  add.push(B(75, 78, z0, 115, 1791, z1, ST), B(75, 1831, z0, 115, 3182, z1, ST));   // front rails up to the sink bay front post
  add.push(B(540, 78, z0, 580, 1791, z1, ST), B(540, 1831, z0, 580, 3169, z1, ST)); // back rails up to the sink bay back post
  for (const [a, b] of PY) add.push(B(115, a, z0, 540, b, z1, ST));                  // cross rails
}
for (const [a, b] of PY) add.push(B(101, a + 7, 0, 126, b - 8, 50, FT), B(545, a + 5, 0, 575, b - 5, 50, FT)); // legs (front on tabs)
// MR bottom board on the rings, z 90-108, notched round the posts
add.push(B(38, 38, 90, 75, 78, 108, MR), B(115, 38, 90, 540, 78, 108, MR), B(38, 78, 90, 580, 1791, 108, MR),
  B(38, 1791, 90, 75, 1831, 108, MR), B(115, 1791, 90, 540, 1831, 108, MR), B(38, 1831, 90, 580, 3169, 108, MR));
// dividers stand on the board, stop 8 short of the new inner back and under the top ring
for (const y of [511, 1171, 1831, 2491, 3151]) add.push(B(38, y, 108, 532, y + 18, 640, MR));
// inner back in front of the back posts (pipe void behind), board to top ring
add.push(B(532, 38, 108, 540, 3151, 640, MRB));
// shelves, bay 3 notched round the mid front post
for (const [a, b] of [[530, 1170], [1850, 2490], [2510, 3150]]) add.push(B(58, a, 356, 532, b, 374, MR));
add.push(B(58, 1190, 356, 532, 1791, 374, MR), B(115, 1791, 356, 532, 1830, 374, MR));
// drawer boxes 40 narrower (clear the left end post by 13), lowest box above the board
for (const [zb, zs, zt] of [[112, 120, 233], [275, 283, 425], [485, 493, 635]]) add.push(
  B(40, 91, zb, 490, 498, zb + 8, MRB), B(40, 91, zs, 490, 109, zt, MR), B(40, 480, zs, 490, 498, zt, MR),
  B(40, 109, zs, 58, 480, zt, MR), B(472, 109, zs, 490, 480, zt, MR));
const r = await call("edit_family_solids", { ...D, element_id: id, delete_form_ids: del.map((i) => i.id), add });
console.log("deleted", r.deleted, "added", r.added.length);
// Second pass (as built): grommets moved 87 toward the front (x 470-530, in front of the back top rail, cables up through
// the cupboard), back end legs and sink-end legs shifted 3-3.5 mm clear of the kick returns.
