// Madina 2 tray edge: TF-1 was a 50 x 200 wood frame round the C02 tray opening (571928). User 12 Nov 2026: "this inside
// grills frames to be 8 mm egger only and this will fixed on site after coordinated with gybsum board work".
// Now: 8 mm EGGER H1145 ST10 (the approved oak the CF-1 veneer matches) lining the inner face of the gypsum tray edge, 200 high
// (+3.000..+3.200), with the same grille openings in the middle of each side (1170 x 120, z +3.040..+3.160) left open for
// the AC grilles. Glued + pinned to the gypsum edge ON SITE, after the gypsum board work is finished and checked.
// New family "Madina2 Tray Edge Lining TF-1" (Generic Models, cut in sections), mark "Tray Edge Lining"; TF-1 deleted.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" };
const FAM = "Madina2 Tray Edge Lining TF-1", MARK = "Tray Edge Lining";
const DIR = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Revit Files/Rfa";
const RFT = String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Generic Model.rft`;
const mat = (await call("ensure_material", { ...D, name: "EGGER 8 H1145 ST10 Natural Bardolino Oak", color: { r: 186, g: 146, b: 98 }, exact_color: true })).id;
const up = { x: 0, y: 0, z: 1 };
const box = (x0, y0, z0, x1, y1, z1) => ({ profile: [{ x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x0, y: y1, z: z0 }], direction: up, length_mm: z1 - z0, material_id: mat });
const X0 = 1700, X1 = 4940, Y0 = 1560, Y1 = 4150, Z0 = 3000, Z1 = 3200, T = 8, G0 = 3040, G1 = 3160;
const S = [];
// south / north: full height 0..1035 and 2205..3240, strips over and under the grille 1035..2205 (TF-1 layout)
for (const [y0, y1] of [[Y0, Y0 + T], [Y1 - T, Y1]]) {
  S.push(box(X0, y0, Z0, X0 + 1035, y1, Z1), box(X0 + 2205, y0, Z0, X1, y1, Z1));
  S.push(box(X0 + 1035, y0, Z0, X0 + 2205, y1, G0), box(X0 + 1035, y0, G1, X0 + 2205, y1, Z1));
}
// west / east between them: full 8..710 and 1880..2582, strips 710..1880
for (const [x0, x1] of [[X0, X0 + T], [X1 - T, X1]]) {
  S.push(box(x0, Y0 + T, Z0, x1, Y0 + 710, Z1), box(x0, Y0 + 1880, Z0, x1, Y1 - T, Z1));
  S.push(box(x0, Y0 + 710, Z0, x1, Y0 + 1880, G0), box(x0, Y0 + 710, G1, x1, Y0 + 1880, Z1));
}
const old = [571928, ...(await call("query_elements", { ...D, parameter_name: "Mark", parameter_value: MARK })).elements.filter((e) => /Tray Edge Lining/.test(e.name)).map((e) => e.id)];
await call("delete_elements", { ...D, element_ids: old }).catch((e) => console.log("del", e.message.slice(0, 80)));
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const ds = (await call("create_direct_shape", { ...D, category: "OST_GenericModel", name: FAM, solids: S })).id;
const r = await call("make_unit_family", { ...D, template_path: RFT, family_name: FAM, save_dir: DIR, level_id: lv, mark: MARK, element_ids: [ds] });
await call("set_parameter", { ...D, element_id: r.id, parameter_name: "Comments", value:
  "Tray edge lining (user 12 Nov 2026): 8 mm EGGER H1145 ST10 Natural Bardolino Oak on the inner face of the gypsum tray edge round the C02 tray, 200 high +3.000..+3.200, outline 3240 x 2590; grille openings 1170 x 120 (+3.040..+3.160) in the middle of each side for the AC grilles. FIXED ON SITE: glued + pinned to the gypsum edge after the gypsum board work is finished and checked; cut to the built gypsum. Replaces the 50 x 200 Tray Wood Frame TF-1." });
console.log("tray lining", r.id, S.length, "boards; deleted", old);
