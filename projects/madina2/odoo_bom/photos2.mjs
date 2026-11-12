import { call as raw } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs"; import { unit3d } from "file:///C:/Users/user/samaya-revit-standards/tools/view3d.mjs"; import fs from "node:fs";
const call = (n, a = {}) => raw(n, { document: "Madina2_ARCH_01", ...a });
const boms = JSON.parse(fs.readFileSync("p_boms.json")).slice(1), OUT = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Odoo BOM/Photos";
const old = (await call("list_views", {})).views.filter((v) => /^PHOTO /.test(v.name)).map((v) => v.id); if (old.length) await call("delete_elements", { element_ids: old });
const byMark = async (m) => { for (const c of ["OST_Casework", "OST_GenericModel", "OST_Furniture", "OST_SpecialityEquipment"]) { const q = (await call("query_elements", { category: c, parameter_name: "Mark", parameter_value: m, limit: 10 }).catch(() => ({ elements: [] }))).elements; for (const e of q) { const g = await call("get_element", { element_id: e.id }); if (g.parameters.find((p) => p.name === "Mark")?.value === m) return g; } } return null; };
const RC = { x: 3300, y: 2900 }, done = new Set(), made = [];
for (const [ref, pcode, , , marks] of boms) {
  if (done.has(pcode)) continue; done.add(pcode);
  const els = []; for (const m of marks.split(/ \+ |, /)) { const g = await byMark(m.trim()); if (g) els.push(g); }
  const c = els.reduce((a, g) => ({ x: a.x + (g.bounding_box.min.x + g.bounding_box.max.x) / 2 / els.length, y: a.y + (g.bounding_box.min.y + g.bounding_box.max.y) / 2 / els.length }), { x: 0, y: 0 });
  let dx = c.x - RC.x, dy = c.y - RC.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const dir = [dx - dy * 0.5, dy + dx * 0.5, -0.6];   // looking from the room at the unit's face, turned a little
  const r = await unit3d(call, { name: "PHOTO " + pcode, ids: els.map((g) => g.id), style: "Realistic", dir, margin: 20 }).catch(async (e) => { console.log("realistic failed", e.message.slice(0, 80)); return unit3d(call, { name: "PHOTO " + pcode, ids: els.map((g) => g.id), style: "ShadingWithEdges", dir, margin: 20 }); });
  const im = await call("export_view_image", { view_id: r.view, pixel_size: 1600 });
  const f = `${OUT}/${pcode}.png`; fs.writeFileSync(f, Buffer.from(im.data_base64, "base64")); made.push([pcode, f]); console.log(pcode, els.length, "els");
}
fs.writeFileSync("photos.json", JSON.stringify(made));
