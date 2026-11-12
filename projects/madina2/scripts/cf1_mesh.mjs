// Madina 2 centre ceiling field inside CF-1 (user 12 Nov 2026: "model the steel mesh net that will hold the rattan inside
// and the artificial plants follow the design"). Design Rev-02 Renders 1 + 3: black welded grid in the centre field inside the
// oak frame, artificial bougainvillea (pink / magenta, some green) hanging through it 0.3..0.8 m.
//  1. "Madina2 Ceiling Flower Mesh FM-1" (mark "Ceiling Flower Mesh"): black powder-coated welded mesh 4 mm wire @ 100,
//     top flush +3.200 under the rattan, on a 25x25x3 angle frame screwed to the frame's inner sides; 2 cross bars 40x8 on
//     edge, each hung on 2 M8 rods to the slab soffit +3.70. The rattan weave lies on the mesh.
//  2. The artificial plants are NOT modelled (user 12 Nov 2026): outline + note on sheet A-2702 only.
// Each family is placed by make_unit_family and checked by direct probes (fitToSolids misreads thin/mixed solids: CF-1
// hangers 12 Nov 2026 moved 42.5 / 25.5 the wrong way).
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" };
const DIR = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Revit Files/Rfa";
const RFT = String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Generic Model.rft`;
const blk = (await call("ensure_material", { ...D, name: "Steel Powder Coated Black RAL 9005", color: { r: 30, g: 30, b: 30 } })).id;
const galv = (await call("ensure_material", { ...D, name: "Steel Galvanised", color: { r: 170, g: 175, b: 180 } })).id;
const up = { x: 0, y: 0, z: 1 };
const box = (x0, y0, z0, x1, y1, z1, m) => ({ profile: [{ x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x0, y: y1, z: z0 }], direction: up, length_mm: z1 - z0, material_id: m });
const oct = (cx, cy, z0, r, h, m, n = 8) => ({ profile: Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((2 * Math.PI * i) / n), y: cy + r * Math.sin((2 * Math.PI * i) / n), z: z0 })), direction: up, length_mm: h, material_id: m });
// opening inside CF-1 (outline 2130..4510 x 1990..3720, members 100)
const X0 = 2230, X1 = 4410, Y0 = 2090, Y1 = 3620, TOPZ = 3140, SLAB = 3700;   // top +3.140 (user 12 Nov 2026): ~60 gap under the rattan panel (+3.2015) to tie the plants
const mesh = [];
// angle 25x25x3: vertical leg against the inner side face, horizontal leg at the top inward
for (const [a, b, c, d] of [[X0, Y0, X1, Y0 + 3], [X0, Y1 - 3, X1, Y1], [X0, Y0, X0 + 3, Y1], [X1 - 3, Y0, X1, Y1]]) mesh.push(box(a, b, TOPZ - 33, c, d, TOPZ - 8, blk));
for (const [a, b, c, d] of [[X0, Y0, X1, Y0 + 25], [X0, Y1 - 25, X1, Y1], [X0, Y0, X0 + 25, Y1], [X1 - 25, Y0, X1, Y1]]) mesh.push(box(a, b, TOPZ - 11, c, d, TOPZ - 8, blk));
// welded mesh 4 wire @ 100: wires along x on the bottom layer, along y on top, top of mesh = TOPZ
for (let y = Y0 + 65; y < Y1 - 20; y += 100) mesh.push(box(X0 + 3, y - 2, TOPZ - 8, X1 - 3, y + 2, TOPZ - 4, blk));
for (let x = X0 + 40; x < X1 - 20; x += 100) mesh.push(box(x - 2, Y0 + 3, TOPZ - 4, x + 2, Y1 - 3, TOPZ, blk));
// 2 cross bars 30x8 on edge (bottom +3.102, above the box soffit line) under the mesh, between the angles, each on 2 M8 rods to the slab
const BX = [2940, 3700], BY = [2600, 3110];   // under the SHS cross members of the Ceiling Steel Frame
for (const x of BX) {
  mesh.push(box(x - 4, Y0 + 28, TOPZ - 38, x + 4, Y1 - 28, TOPZ - 8, blk));
  for (const y of BY) mesh.push(box(x - 4, y - 4, TOPZ - 38, x + 4, y + 4, 3264.5, galv));   // M8 rod up through the rattan panel and the SHS cross member
}
// remove the earlier mesh and the modelled flowers (user 12 Nov 2026: "dont model the artificial plant ... outline annotation only")
for (const mk of ["Ceiling Flower Mesh", "Ceiling Flowers"]) { const o = (await call("query_elements", { ...D, parameter_name: "Mark", parameter_value: mk })).elements.filter((e) => /Flower/.test(e.name)).map((e) => e.id); if (o.length) await call("delete_elements", { ...D, element_ids: o }); }
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
async function build(fam, mark, cat, sols, comment) {
  const ds = (await call("create_direct_shape", { ...D, category: cat, name: fam, solids: sols })).id;
  const r = await call("make_unit_family", { ...D, template_path: RFT, family_name: fam, save_dir: DIR, level_id: lv, mark, element_ids: [ds] });
  await call("set_parameter", { ...D, element_id: r.id, parameter_name: "Comments", value: comment });
  return r.id;
}
const meshId = await build("Madina2 Ceiling Flower Mesh FM-1", "Ceiling Flower Mesh", "OST_GenericModel", mesh,
  "Steel mesh in the centre field inside the Ceiling Wood Frame CF-1 (user 12 Nov 2026, design Rev-02 renders): welded mesh 4 mm wire @ 100 x 100, black powder coat RAL 9005, 2180 x 1530, top +3.140, ~60 below the Ceiling Rattan Panel: the artificial flowers are tied in that gap and hang through the mesh. Frame of angle 25x25x3 black, screwed to the inner side boards of CF-1 @ 300 (4.2 x 25 screws); 2 cross bars flat 30x8 on edge at x 2940 / 3700, each hung on 2 M8 rods through the rattan panel to the SHS cross members of the Ceiling Steel Frame. Made in 1 piece or 2 halves for the door; weight ~25 kg + flowers.");
console.log("mesh", meshId, mesh.length, "solids");
