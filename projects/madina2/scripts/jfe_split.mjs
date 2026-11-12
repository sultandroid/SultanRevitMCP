// Madina 2 JF-E split (user, 12 Nov 2026): the 2 oak joint strips become 2 instances of one strip family (mark JF-E, qty 2),
// one at each arch joint. Same strip: 113 x 60 oak, 20 proud of the pegboards, R20 front corners, +0.700..+1.871, 4 mm packer.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import { AX, fitToSolids, setDoc } from "file:///C:/Users/user/samaya-revit-standards/tools/fitlib.mjs";
const D = { document: "Madina2_ARCH_01" }; setDoc(D.document);
const RFT = String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Generic Model.rft`;
const DIR = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Revit Files/Rfa";
const OLD = 1437676, FAM = "Madina2 East Pegboard Joint Strip JF-E";
const mat = async (n) => (await call("query_elements", { ...D, category: "Materials", parameter_name: "Name", parameter_value: n, limit: 20 })).elements.find((e) => e.name === n)?.id;
const OAK = await mat("Solid Oak - Display Arch Front"), PK = await mat("FR MDF Packer 4");
const old = await call("get_element", { ...D, element_id: OLD }), note = old.parameters.find((p) => p.name === "Comments").value;
const Z0 = 700, Z1 = 1871, XF = 6236, XB = 6296, R = 20, N = 8;
const outline = (a, b) => { const p = [{ x: XB, y: a }, { x: XB, y: b }];
  for (let i = 0; i <= N; i++) { const t = (Math.PI / 2) * (i / N); p.push({ x: XF + R - R * Math.sin(t), y: b - R + R * Math.cos(t) }); }
  for (let i = 0; i <= N; i++) { const t = (Math.PI / 2) * (i / N); p.push({ x: XF + R - R * Math.cos(t), y: a + R - R * Math.sin(t) }); }
  return p.map((q) => ({ x: +q.x.toFixed(3), y: +q.y.toFixed(3), z: Z0 })); };
const ext = (profile, m) => ({ profile, direction: { x: 0, y: 0, z: 1 }, length_mm: Z1 - Z0, material_id: m });
const box = (x0, x1, y0, y1) => [{ x: x0, y: y0, z: Z0 }, { x: x1, y: y0, z: Z0 }, { x: x1, y: y1, z: Z0 }, { x: x0, y: y1, z: Z0 }];
const strip = (a, b) => [ext(outline(a, b), OAK), ext(box(6296, 6300, a + 10, b - 10), PK)];
const sol1 = strip(2081, 2194), sol2 = strip(3397, 3510);
await call("delete_elements", { ...D, element_ids: [OLD] });
const ds = (await call("create_direct_shape", { ...D, category: "OST_GenericModel", name: FAM, solids: sol1 })).id;
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const r1 = await call("make_unit_family", { ...D, template_path: RFT, family_name: FAM, save_dir: DIR, level_id: lv, mark: "JF-E", element_ids: [ds] });
const fit = async (id, sol) => { const f = await fitToSolids(id, sol); if (f && AX.some((a) => Math.abs(f.drift[a]) > 0.05)) await call("move_elements", { ...D, element_ids: [id], dx_mm: -f.drift.x, dy_mm: -f.drift.y, dz_mm: -f.drift.z }); return (await fitToSolids(id, sol))?.drift; };
console.log("strip 1", r1.id, JSON.stringify(await fit(r1.id, sol1)));
const typeId = (await call("get_element", { ...D, element_id: r1.id })).type_id ?? (await call("list_element_types", { ...D, category: "OST_GenericModel" })).types.find((t) => t.family === FAM).id;
const g1 = await call("get_element", { ...D, element_id: r1.id });
const p2 = await call("place_family_instance", { ...D, family_type_id: typeId, location: { x: g1.location.point.x, y: g1.location.point.y + 1316, z: g1.location.point.z }, level_id: lv });
const id2 = p2.id ?? p2.element_id;
console.log("strip 2", id2, JSON.stringify(await fit(id2, sol2)));
const c = "Solid oak joint strip (match arch oak) in the gap between the east pegboards at an arch joint, 113 wide x 60 deep, 20 proud of the pegboard face, front corners R20, +0.700 to the shelf ES-1 underside +1.871, glued onto a 4 mm FR MDF packer on BK-E. 2 No. (one per arch joint, split as separate units, user 12 Nov 2026).";
for (const id of [r1.id, id2]) { for (const [k, v] of [["Mark", "JF-E"], ["Comments", c], ["SF_PhaseStatus", "New"], ["SF_Maturity", "Fabrication"]]) await call("set_parameter", { ...D, element_id: id, parameter_name: k, value: v }).catch(() => {});
  console.log(id, JSON.stringify((await call("get_element", { ...D, element_id: id })).bounding_box)); }
console.log("old note was:", note.slice(0, 80));
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-30));
