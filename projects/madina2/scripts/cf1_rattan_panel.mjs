// Madina 2 centre ceiling: rattan-faced panel under the steel frame (user 12 Nov 2026: "add cladding on the steel frame inside
// 8 mm venner mdf and pasted on it rattan before the net there is space between the net and the cladding to fix the
// artificial plants"). Inside the CF-1 opening (frame inner faces x 2230..4410, y 2090..3620): 8 FR MDF oak veneer screwed up
// into the SHS grid (self-drilling screws @ 300, heads then covered), natural rattan weave ~3 mm pasted on its underside.
// Underside +3.2015. Two sheets, joint on the SHS middle member y 2855 (a 2440 x 1220 sheet does not cover 2176 x 1526).
// The flower mesh hangs lower (cf1_mesh.mjs, top +3.140) -> ~60 gap between the net and the panel to tie the plants.
// The C02 tray ceiling element still runs over this field: its sketch must be cut by hand (the bridge cannot open a ceiling).
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" };
const FAM = "Madina2 Ceiling Rattan Panel CF-1", MARK = "Ceiling Rattan Panel";
const DIR = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Revit Files/Rfa";
const RFT = String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Generic Model.rft`;
const mdf = (await call("ensure_material", { ...D, name: "FR MDF 8 Oak Veneer", color: { r: 196, g: 160, b: 112 } })).id;
const rat = (await call("ensure_material", { ...D, name: "Natural Rattan Weave 3", color: { r: 200, g: 170, b: 120 } })).id;
const up = { x: 0, y: 0, z: 1 };
const box = (x0, y0, z0, x1, y1, z1, m) => ({ profile: [{ x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x0, y: y1, z: z0 }], direction: up, length_mm: z1 - z0, material_id: m });
const SHS = 3212.5, X0 = 2232, X1 = 4408;
const S = [];
for (const [y0, y1] of [[2092, 2854], [2856, 3618]]) { S.push(box(X0, y0, SHS - 8, X1, y1, SHS, mdf)); S.push(box(X0, y0, SHS - 11, X1, y1, SHS - 8, rat)); }
const old = (await call("query_elements", { ...D, parameter_name: "Mark", parameter_value: MARK })).elements.filter((e) => /Rattan Panel/.test(e.name)).map((e) => e.id);
if (old.length) await call("delete_elements", { ...D, element_ids: old });
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const ds = (await call("create_direct_shape", { ...D, category: "OST_GenericModel", name: FAM, solids: S })).id;
const r = await call("make_unit_family", { ...D, template_path: RFT, family_name: FAM, save_dir: DIR, level_id: lv, mark: MARK, element_ids: [ds] });
await call("set_parameter", { ...D, element_id: r.id, parameter_name: "Comments", value:
  "Centre field ceiling inside the Ceiling Wood Frame (user 12 Nov 2026): 8 FR MDF oak veneer, 2 sheets 2176 x 762 / 762, joint on the SHS middle member, screwed up into the Ceiling Steel Frame with self-drilling screws @ 300, natural rattan weave ~3 mm pasted on the underside (covers the screw heads). Underside +3.2015. Flower mesh below at +3.140: ~60 gap to tie the artificial plants. The C02 tray board does not run over this field." });
// note on the C02 ceiling element
const c02 = 363999, g = await call("get_element", { ...D, element_id: c02 });
const cm = g.parameters.find((p) => p.name === "Comments")?.value ?? "";
if (!/CENTRE FIELD OPEN/.test(cm)) await call("set_parameter", { ...D, element_id: c02, parameter_name: "Comments", value: "CENTRE FIELD OPEN 2176 x 1526 (x 2232..4408, y 2092..3618): board here replaced by the Ceiling Rattan Panel under the steel frame - cut this sketch by hand. | " + cm });
console.log("rattan panel", r.id, "removed", old);
