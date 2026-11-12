import { call as raw } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import { writeFileSync } from "node:fs";
const call = (n, a = {}) => raw(n, { document: "Madina2_ARCH_01", ...a });
const fams = new Map();
for (const cat of ["OST_Casework", "OST_GenericModel", "OST_Furniture", "OST_SpecialityEquipment"]) {
  let off = 0; for (;;) { const q = await call("query_elements", { category: cat, limit: 500, offset: off }).catch(() => ({ elements: [], returned: 0, total: 0 }));
    for (const e of q.elements) if (e.family?.startsWith("Madina2") && !/^Madina2 HW /.test(e.family)) { const f = fams.get(e.family) ?? { family: e.family, cat, ids: [] }; f.ids.push(e.id); fams.set(e.family, f); }
    off += q.returned; if (!q.returned || off >= q.total) break; }
}
const out = [];
for (const f of fams.values()) {
  const g = await call("get_element", { element_id: f.ids[0] });
  const pv = (n) => g.parameters.find((p) => p.name === n)?.value;
  if (/Existing|Demolish/i.test(pv("SF_PhaseStatus") ?? "")) continue;
  const fi = await call("inspect_family", { element_id: f.ids[0] });
  const parts = fi.items.filter((i) => /FreeForm|Extrusion/.test(i.class) && i.min).map((i) => ({ m: i.material ?? "Unassigned", d: [i.max.x - i.min.x, i.max.y - i.min.y, i.max.z - i.min.z].map((v) => Math.round(v * 10) / 10) }));
  const bb = parts.reduce((a, p, k) => a, null);
  out.push({ family: f.family, cat: f.cat, qty: f.ids.length, mark: pv("Mark"), comments: (pv("Comments") ?? "").slice(0, 300), size: g.bounding_box ? [g.bounding_box.max.x - g.bounding_box.min.x, g.bounding_box.max.y - g.bounding_box.min.y, g.bounding_box.max.z - g.bounding_box.min.z].map(Math.round) : null, parts });
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(out.length, "unit types,", out.reduce((a, u) => a + u.qty, 0), "units");
console.log(out.map((u) => `${u.qty} x ${u.family}`).join("\n"));
