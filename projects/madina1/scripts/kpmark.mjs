// Key plan: mark every unit a sheet covers, at its real position in the model.
import { call } from "./rvt.mjs";
export async function markUnits(view, re) {
  const all = []; for (let o = 0; ; o += 1000) { const q = (await call("query_elements", { category: "OST_Furniture", limit: 1000, offset: o })).elements; all.push(...q); if (q.length < 1000) break; }
  all.push(...(await call("query_elements", { category: "OST_Casework", limit: 1000 })).elements);
  all.push(...(await call("query_elements", { category: "OST_GenericModel", limit: 1000 })).elements);
  const hits = all.filter((e) => re.test(e.name));
  if (!hits.length) throw new Error("key plan: no units match " + re);
  for (const e of hits) {
    const b = (await call("get_element", { element_id: e.id })).bounding_box;
    await call("create_swatch", { view_id: view, min: { x: b.min.x, y: b.min.y, z: 0 }, max: { x: b.max.x, y: b.max.y, z: 0 }, color: { r: 200, g: 30, b: 30 } });
  }
  console.log("key plan marks", hits.length, hits.map((e) => e.name.replace("Madina ", "")).join(", "));
}
