import { call as raw } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs"; import fs from "node:fs";
const call = (n, a = {}) => raw(n, { document: "Madina2_ARCH_01", ...a });
const boms = JSON.parse(fs.readFileSync("p_boms.json")).slice(1), OUT = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Odoo BOM/Photos";
fs.mkdirSync(OUT, { recursive: true });
const byMark = async (m) => { for (const c of ["OST_Casework", "OST_GenericModel", "OST_Furniture", "OST_SpecialityEquipment"]) { const q = (await call("query_elements", { category: c, parameter_name: "Mark", parameter_value: m, limit: 10 }).catch(() => ({ elements: [] }))).elements; for (const e of q) { const g = await call("get_element", { element_id: e.id }); if (g.parameters.find((p) => p.name === "Mark")?.value === m) return g; } } return null; };
const RC = { x: 3300, y: 2900 }, done = new Set(), made = [];
for (const [ref, pcode, , , marks] of boms) {
  if (done.has(pcode)) continue; done.add(pcode);
  const els = []; for (const m of marks.split(/ \+ |, /)) { const g = await byMark(m.trim()); if (g) els.push(g); }
  if (!els.length) { console.log("no elements", pcode, marks); continue; }
  const b = { min: { x: 1e9, y: 1e9, z: 1e9 }, max: { x: -1e9, y: -1e9, z: -1e9 } };
  for (const g of els) for (const k of ["x", "y", "z"]) { b.min[k] = Math.min(b.min[k], g.bounding_box.min[k]); b.max[k] = Math.max(b.max[k], g.bounding_box.max[k]); }
  const c = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 };
  let dx = RC.x - c.x, dy = RC.y - c.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const ex = dx - dy * 0.6, ey = dy + dx * 0.6, D = 20000;   // room side, turned 30 deg for a 3/4 view
  const name = "PHOTO " + pcode;
  const old = (await call("list_views", {})).views.filter((v) => v.name === name).map((v) => v.id); if (old.length) await call("delete_elements", { element_ids: old });
  const v = (await call("create_3d_view", { name, eye: { x: c.x + ex * D, y: c.y + ey * D, z: c.z + D * 0.55 }, target: c, box_min: { x: b.min.x - 30, y: b.min.y - 30, z: b.min.z - 30 }, box_max: { x: b.max.x + 30, y: b.max.y + 30, z: b.max.z + 30 } })).id;
  await call("isolate_in_view", { view_id: v, element_ids: els.map((g) => g.id) }).catch((e) => console.log("iso", e.message.slice(0, 80)));
  await call("set_view_display", { view_id: v, style: "Realistic" }).catch(() => call("set_view_display", { view_id: v, style: "Shaded" }).catch(() => {}));
  await call("fit_view_crop_to_model", { view_id: v, margin_mm: 100 }).catch(() => {});
  const r = await call("export_view_image", { view_id: v, pixel_size: 1600 });
  const f = `${OUT}/${pcode}.png`; fs.writeFileSync(f, Buffer.from(r.data_base64, "base64")); made.push([pcode, f, v]); console.log(pcode, els.length, "els ->", f.split("/").pop());
}
fs.writeFileSync("photos.json", JSON.stringify(made));
