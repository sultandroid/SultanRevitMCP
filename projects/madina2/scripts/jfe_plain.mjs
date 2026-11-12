// Madina 2 JF-E (user, 11 Nov 2026): oak joint strips back to full height up to the shelf ES-1 underside (+1.871), not cut
// short for the steel; the 8 mm fin of the ST-E2 shelf bracket (x 5730-6318, +1.817..+1.897) runs to the back post through
// a 10 mm slot in the top 54 mm of each strip. 113 wide x 60 deep, 20 proud of the pegboards, front corners R20, on 4 mm packers.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import { AX, fitToSolids, setDoc } from "file:///C:/Users/user/samaya-revit-standards/tools/fitlib.mjs";
const D = { document: "Madina2_ARCH_01" }; setDoc(D.document);
const RFT = String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Generic Model.rft`;
const DIR = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Revit Files/Rfa";
const FAM = "Madina2 East Pegboard Joint Filler JF-E";
const mat = async (n) => (await call("query_elements", { ...D, category: "Materials", parameter_name: "Name", parameter_value: n, limit: 20 })).elements.find((e) => e.name === n)?.id;
const OAK = await mat("Solid Oak - Display Arch Front"), PK = await mat("FR MDF Packer 4");
const XF = 6236, XB = 6296, R = 20, N = 8, ZA = 700, ZF = 1817, ZT = 1871;
// plan outline from y a to y b; round = which front corners get R20 ("a", "b" or both)
const outline = (a, b, round) => {
  const p = [{ x: XB, y: a }, { x: XB, y: b }];
  if (round.includes("b")) for (let i = 0; i <= N; i++) { const t = (Math.PI / 2) * (i / N); p.push({ x: XF + R - R * Math.sin(t), y: b - R + R * Math.cos(t) }); }
  else p.push({ x: XF, y: b });
  if (round.includes("a")) for (let i = 0; i <= N; i++) { const t = (Math.PI / 2) * (i / N); p.push({ x: XF + R - R * Math.cos(t), y: a + R - R * Math.sin(t) }); }
  else p.push({ x: XF, y: a });
  return p;
};
const ext = (pts, m, z0, z1) => ({ profile: pts.map((q) => ({ x: +q.x.toFixed(3), y: +q.y.toFixed(3), z: z0 })), direction: { x: 0, y: 0, z: 1 }, length_mm: z1 - z0, material_id: m });
const box = (x0, x1, y0, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const sol = [];
for (const [a, b] of [[2081, 2194], [3397, 3510]]) sol.push(ext(outline(a, b, "ab"), OAK, ZA, ZT), ext(box(6296, 6300, a + 10, b - 10), PK, ZA, ZT)); // plain, no fin slot (ST-E2 back to its pre-study design, 12 Nov 2026)
const old = (await call("query_elements", { ...D, parameter_name: "Mark", parameter_value: "JF-E", limit: 10 })).elements.filter((e) => e.family === FAM);
for (const e of old) await call("delete_elements", { ...D, element_ids: [e.id] });
const t = (await call("list_element_types", { ...D, category: "OST_GenericModel" })).types ?? [];
const ty = (t.elements ?? t).find((x) => (x.family ?? x.name) === FAM); if (ty) await call("delete_elements", { ...D, element_ids: [ty.id] });
const ds = (await call("create_direct_shape", { ...D, category: "OST_GenericModel", name: FAM, solids: sol })).id;
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const r = await call("make_unit_family", { ...D, template_path: RFT, family_name: FAM, save_dir: DIR, level_id: lv, mark: "JF-E", element_ids: [ds] });
const f1 = await fitToSolids(r.id, sol);
if (f1 && AX.some((k) => Math.abs(f1.drift[k]) > 0.05)) await call("move_elements", { ...D, element_ids: [r.id], dx_mm: -f1.drift.x, dy_mm: -f1.drift.y, dz_mm: -f1.drift.z });
const f2 = await fitToSolids(r.id, sol);
await call("set_parameter", { ...D, element_id: r.id, parameter_name: "Comments", value: "Solid oak fillers (match arch oak) in the 2 gaps between the east pegboards at the arch joints, 113 wide x 60 deep, 20 proud of the pegboard face, front corners R20, +0.700 to the shelf ES-1 underside +1.871 (user, 11 Nov 2026: full height, not cut short for the steel). Glued onto 4 mm FR MDF packers on BK-E." });
for (const [p, v] of [["SF_PhaseStatus", "New"], ["SF_Maturity", "Fabrication"]]) await call("set_parameter", { ...D, element_id: r.id, parameter_name: p, value: v }).catch(() => {});
const g = await call("get_element", { ...D, element_id: r.id });
console.log("JF-E", r.id, JSON.stringify(f2?.drift), JSON.stringify(g.bounding_box));
const ray = async (o, d) => (await call("probe_ray", { ...D, origin: o, direction: d, target: "family", limit: 6, max_distance_mm: 300 })).hits.map((h) => [Math.round(h.distance_mm ?? h.distance), (h.family ?? h.name ?? "").slice(7, 34)]);
console.log("across slot y at x6270 z1850", JSON.stringify(await ray({ x: 6270, y: 2060, z: 1850 }, { x: 0, y: 1 })));
console.log("down at x6270 y2100", JSON.stringify(await ray({ x: 6270, y: 2100, z: 1880 }, { x: 0, y: 0, z: -1 })));
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-40));
