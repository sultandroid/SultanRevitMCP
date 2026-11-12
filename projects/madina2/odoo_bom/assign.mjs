import { call as raw } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs"; import fs from "node:fs";
const call = (n, a = {}) => raw(n, { document: "Madina2_ARCH_01", ...a });
const inst = [];
for (const cat of ["OST_Casework", "OST_GenericModel"]) { let off = 0; for (;;) { const q = await call("query_elements", { category: cat, limit: 500, offset: off });
  for (const e of q.elements) if (/Arch Unit|Back Legs|Arch Back Panel|L Fascia/.test(e.family ?? "")) { const g = await call("get_element", { element_id: e.id }); inst.push({ id: e.id, fam: e.family.replace(/^Madina2 /, ""), mark: g.parameters.find((p) => p.name === "Mark")?.value, b: g.bounding_box }); }
  off += q.returned; if (!q.returned || off >= q.total) break; } }
const arches = inst.filter((i) => /Arch Unit/.test(i.fam) && !/Back Legs/.test(i.fam));
const ov = (a, b) => Math.max(0, Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x)) * Math.max(0, Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y));
const out = {};
for (const i of inst.filter((i) => !arches.includes(i))) { const best = arches.map((a) => [a, ov(a.b, i.b)]).sort((p, q) => q[1] - p[1])[0]; out[i.id] = best[1] > 0 ? best[0].id : null;
  console.log(i.mark.padEnd(10), i.fam.padEnd(32), "->", best[1] > 0 ? best[0].mark + " " + best[0].fam : "NONE", Math.round(best[1] / 1e4)); }
fs.writeFileSync("assign.json", JSON.stringify({ inst, out }));
