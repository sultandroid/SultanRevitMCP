// ST-E2 minimal: shelf plates run to the back posts (x 6318), and BK-E gets a 116 x 90 slot at each arch joint
// for the T bracket (plate + fin, world z 1817..1907). 11 Nov 2026.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" };
// 1. plates
const S = 1370526, gs = await call("get_element", { ...D, element_id: S }), Ls = gs.location.point;
const pl = (await call("inspect_family", { ...D, element_id: S })).items.filter((i) => /Free|Extr/.test(i.class) && Math.round(i.min.z) === 1897);
if (pl.length !== 2) throw new Error("plates " + pl.length);
const P = (x0, y0, z0, x1, y1, z1, material) => ({ min: { x: x0 - Ls.x, y: y0 - Ls.y, z: z0 }, max: { x: x1 - Ls.x, y: y1 - Ls.y, z: z1 }, material });
console.log("plates", JSON.stringify((await call("edit_family_solids", { ...D, element_id: S, delete_form_ids: pl.map((i) => i.id),
  add: [P(5730, 2079, 1897, 6318, 2195, 1907, "Steel Plate 10 Approved"), P(5730, 3396, 1897, 6318, 3512, 1907, "Steel Plate 10 Approved")] })).added));
// 2. BK-E slots (family coords: origin world 6300, 816, 700)
const B = 1339470, M = "FR MDF 18 Raw", z0 = 801, z1 = 1600, s0 = 1117, s1 = 1207;
const bx = (y0, y1, za, zb) => ({ min: { x: 0, y: y0, z: za }, max: { x: 18, y: y1, z: zb }, material: M });
const around = (y0, y1) => [bx(y0, y1, z0, s0), bx(y0, y1, s1, z1)];
const up = (await call("inspect_family", { ...D, element_id: B })).items.filter((i) => /Free|Extr/.test(i.class) && Math.round(i.min.z) === 801);
if (up.length !== 3) throw new Error("upper boards " + up.length);
const add = [bx(0, 1263, z0, z1), ...around(1263, 1321), ...around(1323, 1379), bx(1379, 2580, z0, z1), ...around(2580, 2637), ...around(2639, 2696), bx(2696, 3959, z0, z1)];
console.log("BK-E", JSON.stringify((await call("edit_family_solids", { ...D, element_id: B, delete_form_ids: up.map((i) => i.id), add })).added?.length));
const gb = await call("get_element", { ...D, element_id: B }), c = gb.parameters.find((p) => p.name === "Comments")?.value ?? "";
if (!/slot/.test(c)) await call("set_parameter", { ...D, element_id: B, parameter_name: "Comments", value: c + " | 116 x 90 slot at each arch joint (+1.817..+1.907) for the ST-E2 shelf T brackets, cut on site to the steel (11 Nov 2026)." });
for (const y of [2138, 3454]) { const r = await call("probe_ray", { ...D, origin: { x: 6290, y, z: 1880 }, direction: { x: 1, y: 0 }, target: "family", limit: 6, max_distance_mm: 100 });
  console.log("ray at joint y", y, JSON.stringify(r.hits.map((h) => [Math.round(6290 + (h.distance_mm ?? h.distance)), (h.family ?? "").slice(7, 30)]))); }
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-30));
