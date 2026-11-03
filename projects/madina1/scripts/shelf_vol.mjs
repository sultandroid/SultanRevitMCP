// Open shelf display volume per unit, measured by rays in the model: clear heights between shelves, inner width side to side, depth front to back panel.
import { writeFileSync } from "node:fs";
import { call } from "./rvt.mjs";
const i = await call("get_project_info"); if (i.title !== "Madina1_ARCH_02") throw new Error(i.title);
const all = [...(await call("query_elements", { category: "OST_Furniture", limit: 1000 })).elements, ...(await call("query_elements", { category: "OST_Casework", limit: 1000 })).elements, ...(await call("query_elements", { category: "OST_GenericModel", limit: 1000 })).elements].filter((e) => /^Madina (Low Bay (W|E|RL|RR)-L\d|Arch Typical A)$/.test(e.name));
const ray = async (o, d, max = 3000) => (await call("probe_ray", { origin: o, direction: d, max_distance_mm: max, limit: 40 })).hits ?? [];
const out = [];
for (const e of all) {
  const g = await call("get_element", { element_id: e.id }), b = g.bounding_box, mk = g.parameters.find((p) => p.name === "Mark")?.value || e.name;
  const side = b.max.y > 4800 && b.min.y > 4700 ? "R" : b.max.x < 1500 ? "W" : "E";
  // Frame: u along the run, into the wall from the front face.
  const F = side === "W" ? { u: [0, 1, 0], into: [-1, 0, 0], front: b.max.x, mid: (b.min.y + b.max.y) / 2 } : side === "E" ? { u: [0, 1, 0], into: [1, 0, 0], front: b.min.x, mid: (b.min.y + b.max.y) / 2 } : { u: [1, 0, 0], into: [0, 1, 0], front: b.min.y, mid: (b.min.x + b.max.x) / 2 };
  const depthAll = side === "R" ? b.max.y - b.min.y : b.max.x - b.min.x;
  const P = (u, d, z) => side === "R" ? { x: u, y: F.front + d, z } : { x: F.front + F.into[0] * d, y: u, z };
  const dir = (v) => ({ x: v[0], y: v[1], z: v[2] });
  const mine = (h) => (h.name || "") === e.name;
  // Shelves: a vertical ray through the middle, 200 mm in from the front.
  const zs = (await ray(P(F.mid, 200, b.min.z + 2), dir([0, 0, 1]), b.max.z - b.min.z)).filter(mine).map((h) => Math.round(b.min.z + 2 + h.distance_mm)).sort((a, c) => a - c);
  const solids = []; for (let k = 0; k + 1 < zs.length; k += 2) solids.push([zs[k], zs[k + 1]]);
  const gaps = []; if (solids.length && solids[0][0] - b.min.z > 120) gaps.push([Math.round(b.min.z), solids[0][0]]); // the space on the top below the first shelf
  for (let k = 0; k + 1 < solids.length; k++) { const h = solids[k + 1][0] - solids[k][1]; if (h > 120) gaps.push([solids[k][1], solids[k + 1][0]]); }
  const rows = [];
  for (const [z0, z1] of gaps) {
    const zm = (z0 + z1) / 2;
    const left = (await ray(P(F.mid, 200, zm), dir(F.u.map((x) => -x)), 1500)).filter(mine)[0], right = (await ray(P(F.mid, 200, zm), dir(F.u), 1500)).filter(mine)[0];
    const back = (await ray(P(F.mid, -20, zm), dir(F.into), depthAll + 100)).filter(mine);
    const w = (left?.distance_mm ?? 0) + (right?.distance_mm ?? 0), d = back.length ? back.find((h) => h.distance_mm > 60)?.distance_mm - 20 : 0, h = z1 - z0;
    if (d >= 150) rows.push({ z0, h, w: Math.round(w), d: Math.round(d), v: (w * d * h) / 1e9 }); // skip shallow backing spaces such as inside the arch head
  }
  const v = rows.reduce((a, r) => a + r.v, 0);
  out.push({ mark: mk, side, spaces: rows.length, w: rows[0]?.w, d: rows[0]?.d, hs: rows.map((r) => r.h).join("/"), v });
  console.log(mk, side, rows.length, "spaces", JSON.stringify(rows.map((r) => [r.w, r.d, r.h])), "m3", v.toFixed(3));
}
writeFileSync("dwg/shelf_vol.json", JSON.stringify(out, null, 1));
