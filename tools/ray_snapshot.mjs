// Before/after placement check for family edits (mitre, split, reload): proves nothing moved.
// First run: rays through the boards of every instance whose family matches --family (a regular expression), recording
// per ray the extent (first and last face) hit on elements whose name matches it. Second run with --compare: the SAME
// rays (read from the file) are fired again and any extent that changed by more than 0.5 mm is listed.
// Extents, not every face: a mitre or a split adds internal faces but must not move an outside face.
//
// usage: node tools/ray_snapshot.mjs --doc <title> --family <regex> --out <file.json>
//        node tools/ray_snapshot.mjs --doc <title> --compare <file.json>
import { call } from "./rvt.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? null : process.argv[i + 1]; };
const DOC = arg("doc"), D = { document: DOC }, AX = ["x", "y", "z"];
const rot = (p, deg) => { const t = (deg * Math.PI) / 180; return { x: p.x * Math.cos(t) - p.y * Math.sin(t), y: p.x * Math.sin(t) + p.y * Math.cos(t), z: p.z }; };

async function fire(rays, re) {
  const out = [];
  for (const r of rays) {
    const origin = { ...r.c, [r.a]: r.c[r.a] - 8000 }, direction = { x: 0, y: 0, z: 0, [r.a]: 1 };
    const res = await call("probe_ray", { ...D, origin, direction, max_distance_mm: 16000, limit: 60 });
    const h = res.hits.filter((x) => re.test(x.name)).map((x) => x.point[r.a]);
    out.push(h.length ? [Math.round(Math.min(...h) * 10) / 10, Math.round(Math.max(...h) * 10) / 10] : null);
  }
  return out;
}

if (arg("compare")) {
  const S = JSON.parse(readFileSync(arg("compare"), "utf8"));
  const now = await fire(S.rays, new RegExp(S.family));
  let bad = 0;
  S.rays.forEach((r, i) => {
    const a = S.hits[i], b = now[i];
    if (!a && !b) return;
    if (!a || !b || Math.abs(a[0] - b[0]) > 0.5 || Math.abs(a[1] - b[1]) > 0.5) { bad++; console.log("DIFF", r.a, JSON.stringify(r.c), JSON.stringify(a), "->", JSON.stringify(b)); }
  });
  console.log(`${S.rays.length} rays, ${S.hits.filter(Boolean).length} with hits before; ${bad} changed`);
  process.exit(bad ? 2 : 0);
}

const FAM = arg("family"), OUT = arg("out"), re = new RegExp(FAM);
const insts = [];
for (let off = 0; ; ) {
  const r = await call("query_elements", { ...D, parameter_name: "Family", parameter_value: " ", limit: 500, offset: off });
  insts.push(...r.elements.filter((e) => e.family && re.test(e.family) && e.location?.point));
  off += r.returned; if (off >= r.total || !r.returned) break;
}
const rays = [], famCache = new Map();
for (const e of insts) {
  if (!famCache.has(e.family)) { try { famCache.set(e.family, (await call("inspect_family", { ...D, element_id: e.id })).items.filter((i) => i.material)); } catch { famCache.set(e.family, []); } }
  const items = famCache.get(e.family).slice().sort((p, q) => AX.reduce((v, a) => v * (q.max[a] - q.min[a]), 1) - AX.reduce((v, a) => v * (p.max[a] - p.min[a]), 1)).slice(0, 8);
  for (const i of items) {
    const lc = { x: (i.min.x + i.max.x) / 2, y: (i.min.y + i.max.y) / 2, z: (i.min.z + i.max.z) / 2 }, q = rot(lc, e.location.rotation_deg ?? 0);
    const c = { x: e.location.point.x + q.x, y: e.location.point.y + q.y, z: e.location.point.z + q.z };
    for (const a of AX) rays.push({ a, c });
  }
}
const hits = await fire(rays, re);
writeFileSync(OUT, JSON.stringify({ doc: DOC, family: FAM, rays, hits }));
console.log(`${insts.length} instances, ${rays.length} rays, ${hits.filter(Boolean).length} with hits -> ${OUT}`);
