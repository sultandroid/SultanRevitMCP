// Madina 2 C02 tray: rattan band around the Ceiling Wood Frame (user 15 Nov 2026: "about the ceiling as per the design should
// have rattan on the ceiling please check the design"). Renders Rev-02 (Render 1 + 3): the tray field between the outer wood
// edge (TF-1 lining) and the CF-1 box frame is rattan weave all round; until now it was only a note on the C02 gypsum ceiling
// (by others), so it was on no fabrication sheet and in no BOM.
// Same build-up as the centre panel (user 12 Nov 2026): 8 FR MDF oak veneer + natural rattan weave ~3 mm pasted under it.
// Fixed under the C02 12.5 board (+3.200): screwed up into the gypsum ceiling furring channels (by others, @ 400 max across the
// band, to be added by the gypsum contractor) with screws @ 300, rattan pasted on site over the screw heads. Underside +3.189.
// Band: inside the TF-1 lining faces x 1708..4932, y 1568..4142, outside the CF-1 frame x 2130..4510, y 1990..3720 (422 wide).
// Pieces in whole cm (rule), 1 mm scribe at each lining face: S + N: 2 x 1610 x 420 each, joint at x 3320; W + E: 1730 x 420
// between the frame lines. 6 pieces = 3 sheets 1220 x 2440 (2 strips of 420 per sheet). No openings (no lights in the band).
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" };
const FAM = "Madina2 Ceiling Rattan Band C02", MARK = "Ceiling Rattan Band";
const DIR = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Revit Files/Rfa";
const RFT = String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Generic Model.rft`;
const mdf = (await call("ensure_material", { ...D, name: "FR MDF 8 Oak Veneer", color: { r: 196, g: 160, b: 112 } })).id;
const rat = (await call("ensure_material", { ...D, name: "Natural Rattan Weave 3", color: { r: 200, g: 170, b: 120 } })).id;
const up = { x: 0, y: 0, z: 1 };
const box = (x0, y0, z0, x1, y1, z1, m) => ({ profile: [{ x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x0, y: y1, z: z0 }], direction: up, length_mm: z1 - z0, material_id: m });
const TOP = 3200;
const P = [
  [1709, 1569, 3319, 1989], [3321, 1569, 4931, 1989],          // south 2 x 1610 x 420
  [1709, 3721, 3319, 4141], [3321, 3721, 4931, 4141],          // north
  [1709, 1990, 2129, 3720], [4511, 1990, 4931, 3720]];         // west / east 420 x 1730
const S = [];
for (const [x0, y0, x1, y1] of P) { S.push(box(x0, y0, TOP - 8, x1, y1, TOP, mdf)); S.push(box(x0, y0, TOP - 11, x1, y1, TOP - 8, rat)); }
const old = (await call("query_elements", { ...D, parameter_name: "Mark", parameter_value: MARK })).elements.filter((e) => /Rattan Band/.test(e.name)).map((e) => e.id);
if (old.length) await call("delete_elements", { ...D, element_ids: old });
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const ds = (await call("create_direct_shape", { ...D, category: "OST_GenericModel", name: FAM, solids: S })).id;
const r = await call("make_unit_family", { ...D, template_path: RFT, family_name: FAM, save_dir: DIR, level_id: lv, mark: MARK, element_ids: [ds] });
await call("set_parameter", { ...D, element_id: r.id, parameter_name: "Comments", value:
  "Rattan band of the C02 tray around the Ceiling Wood Frame (design renders Rev-02; user 15 Nov 2026). 6 panels 8 FR MDF oak veneer: S + N 2 no. 1610 x 420 each (joint x 3320), W + E 1730 x 420; natural rattan weave ~3 mm pasted under. Screwed up through the C02 12.5 board into the furring channels (by the gypsum contractor, @ 400 max across the band) @ 300, rattan pasted over the screw heads on site. Underside +3.189. 1 mm scribe to the TF-1 lining, butt to the CF-1 frame sides. No openings." });
// C02 ceiling note: the board is by others, the rattan is ours now
const c02 = 363999, g = await call("get_element", { ...D, element_id: c02 });
let cm = g.parameters.find((p) => p.name === "Comments")?.value ?? "";
cm = cm.replace(/C02 tray soffit \+3\.20: natural rattan weave panels on 12\.5 board/, "C02 tray soffit +3.20: 12.5 gypsum board (by others) with furring channels @ 400 max across the band; rattan band panels by Samaya (Ceiling Rattan Band) screwed under it");
await call("set_parameter", { ...D, element_id: c02, parameter_name: "Comments", value: cm });
console.log("rattan band", r.id, "removed", old);
