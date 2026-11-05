// Madina 1 Keel Option 2: strip cladding round the typical arches recut to the keel line (rise 560, R 400, apex +2.960).
// Same build-up as k_strips.mjs (20 mm strips at ~40 pitch d 50..65, 5 mm backing d 65..70, 6 mm bent closure round the ring),
// plus an 18 mm support board on top (d 70..170, +2.982..+3.000) fixed to the ceiling framing. No box behind.
// One family per type: SC-A side run with 2 arches (W master, E copy rotated 180), SC-B rear run with 1 arch (RL master, RR copy).
// Usage: node k_sc_cladding.mjs plan | build
import { call } from "./rvt.mjs"; import { readFileSync, writeFileSync, existsSync } from "node:fs";
const mode = process.argv[2] ?? "plan", DOC = "Madina1_ARCH_02_Keel-Option2", LOG = "dwg/sc_log.json";
const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : {}, save = () => writeFileSync(LOG, JSON.stringify(log, null, 1));
const SET = 50, RIB = 15, BACK = 5, W = 20, PITCH = 40, TOP = 3000, B = 6, Z0 = 1984, SUP = 100, ST = 18;
const APEX = 2960, RISE = 560, R = 400;
const RUNS = [
  { id: "W", type: "A", u0: 780, u1: 4730, world: (u, d, z) => ({ x: 875 - d, y: u, z }), dirD: { x: -1, y: 0, z: 0 }, marks: ["W-A1", "W-A2"], along: "y" },
  { id: "RL", type: "B", u0: 1011, u1: 2335, world: (u, d, z) => ({ x: u, y: 4820 + d, z }), dirD: { x: 0, y: 1, z: 0 }, marks: ["RL-A1"], along: "x" },
];
const rd = (v) => Math.round(v * 100) / 100;
const clean = (pts) => { const o = []; for (const p of pts.map(([u, z]) => [rd(u), rd(z)])) if (!o.length || Math.hypot(p[0] - o[o.length - 1][0], p[1] - o[o.length - 1][1]) >= 1) o.push(p); while (o.length > 3 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 1) o.pop(); return o; };
const poly = (w, pts, d0, d1, m) => ({ profile: clean(pts).map(([u, z]) => w.world(u, d0, z)), direction: w.dirD, length_mm: d1 - d0, m });
const layout = (a, b) => { const n = Math.max(2, Math.round((b - a + W) / PITCH)), step = (b - a - W) / (n - 1), o = []; for (let i = 0; i < n; i++) o.push([a + i * step, a + i * step + W]); return o; };
// Keel line set out by e from the unit's outer face (e > 0 outward), springing on side sg up to the axis (same as m_keel.mjs keelSide with k = -e).
function side(a, b, e, sg) {
  const Wd = b - a, zs = APEX - RISE, t = Math.atan2(RISE, Wd / 2 - R) + Math.acos(R / Math.hypot(Wd / 2 - R, RISE)), r = R + e, n = 48, L = [];
  for (let i = 0; i <= n; i++) { const g = Math.PI - (i * (Math.PI - t)) / n; L.push([a + R + r * Math.cos(g), zs + r * Math.sin(g)]); }
  const [pu, pz] = L[L.length - 1], end = [(a + b) / 2, pz + (((a + b) / 2 - pu) / Math.sin(t)) * -Math.cos(t)]; if (Math.hypot(end[0] - pu, end[1] - pz) > 0.5) L.push(end);
  return sg < 0 ? L : L.map(([u, z]) => [a + b - u, z]);
}
const line = (a, b, e) => [...side(a, b, e, -1), ...side(a, b, e, 1).slice(0, -1).reverse()];
const zAt = (L, u) => { for (let i = 1; i < L.length; i++) { const [u0, z0] = L[i - 1], [u1, z1] = L[i]; if ((u - u0) * (u - u1) <= 0 && u1 !== u0) return z0 + ((u - u0) / (u1 - u0)) * (z1 - z0); } return -Infinity; };

const arches = {};
for (const e of (await call("query_elements", { category: "OST_Casework", limit: 500 })).elements.filter((q) => q.family === "Madina Arch Typical A")) {
  const g = await call("get_element", { element_id: e.id }); arches[g.parameters.find((q) => q.name === "Mark")?.value] = g.bounding_box;
}
const ctr = (m, k) => (arches[m].min[k] + arches[m].max[k]) / 2;
const plans = RUNS.map((w) => {
  const k = w.along, hs = w.marks.map((m) => ({ a: arches[m].min[k], b: arches[m].max[k] })).sort((p, q) => p.a - q.a);
  const ribs = [], bands = [], backs = [], zB = Z0 + B, low = (u, v) => poly(w, [[u, zB], [v, zB], [v, TOP], [u, TOP]], SET, SET + RIB, "grey");
  let cur = w.u0, curB = w.u0, apexB = 0;
  for (const h of hs) {
    const left = h.a - B, right = h.b + B, outer = line(h.a, h.b, B);
    apexB = Math.max(apexB, ...outer.map((p) => p[1]));
    for (const [u, v] of layout(cur, left)) ribs.push(low(u, v));
    for (const [u, v] of layout(left, right)) {
      const zu = Math.max(zAt(outer, Math.max(u, left)), zB), zv = Math.max(zAt(outer, Math.min(v, right)), zB);
      const inner = outer.filter((p) => p[0] > u && p[0] < v).map((p) => [p[0], Math.max(p[1], zB)]);
      ribs.push(poly(w, [[u, zu], ...inner, [v, zv], [v, TOP], [u, TOP]], SET, SET + RIB, "grey"));
    }
    const oL = side(h.a, h.b, B, -1), oR = side(h.a, h.b, B, 1), iL = side(h.a, h.b, 0, -1), iR = side(h.a, h.b, 0, 1);
    bands.push(poly(w, [[left, Z0], ...oL, ...oR.slice(0, -1).reverse(), [right, Z0], [h.b, Z0], ...iR, ...iL.slice(0, -1).reverse(), [h.a, Z0]], SET, SET + RIB + BACK, "trim"));
    if (left > cur) bands.push(poly(w, [[cur, Z0], [left, Z0], [left, zB], [cur, zB]], SET, SET + RIB + BACK, "trim"));
    if (h.a > curB) backs.push(poly(w, [[curB, Z0], [h.a, Z0], [h.a, TOP], [curB, TOP]], SET + RIB, SET + RIB + BACK, "grey"));
    backs.push(poly(w, [...line(h.a, h.b, 0), [h.b, TOP], [h.a, TOP]], SET + RIB, SET + RIB + BACK, "grey"));
    cur = right; curB = h.b;
  }
  for (const [u, v] of layout(cur, w.u1)) ribs.push(low(u, v));
  if (cur < w.u1) bands.push(poly(w, [[cur, Z0], [w.u1, Z0], [w.u1, zB], [cur, zB]], SET, SET + RIB + BACK, "trim"));
  if (curB < w.u1) backs.push(poly(w, [[curB, Z0], [w.u1, Z0], [w.u1, TOP], [curB, TOP]], SET + RIB, SET + RIB + BACK, "grey"));
  const d0 = SET + RIB + BACK, sup = { profile: [[w.u0, d0], [w.u1, d0], [w.u1, d0 + SUP], [w.u0, d0 + SUP]].map(([u, d]) => w.world(u, d, TOP - ST)), direction: { x: 0, y: 0, z: 1 }, length_mm: ST, m: "sup" };
  if (apexB > TOP - ST - 5) throw new Error(`${w.id} closure apex ${apexB} hits the support board`);
  return { w, hs, solids: [...ribs, ...backs, ...bands, sup], apexB, n: [ribs.length, backs.length, bands.length] };
});
for (const p of plans) console.log(p.w.id, "arches", p.hs.map((h) => `${h.a.toFixed(1)}-${h.b.toFixed(1)}`).join(" "), "strips/backing/closure", p.n.join("/"), "closure apex", p.apexB.toFixed(1));
const cW = ["W-A1", "W-A2"].map((m) => ctr(m, "y")), cE = ["E-A1", "E-A2"].map((m) => ctr(m, "y")), cRL = ctr("RL-A1", "x"), cRR = ctr("RR-A1", "x");
console.log("W centres", cW.map((v) => v.toFixed(1)), "E centres", cE.map((v) => v.toFixed(1)), "W offsets from u1", cW.map((c) => (4730 - c).toFixed(1)), "E offsets from 740", cE.map((c) => (c - 740).toFixed(1)), "RR-RL", (cRR - cRL).toFixed(1));
if (mode === "plan") process.exit(0);

if ((await call("get_project_info")).title !== DOC) throw new Error("wrong document");
const FFL = (await call("list_levels")).levels.find((l) => Math.abs(l.elevation_mm) < 1).id;
const DIR = String.raw`C:\Users\user\OneDrive - SAMAYA INVESTMENT\Samaya\Technical Office\Bim Unit\Knowledge Econmic City_ShopFit projects\Madina 1\Revit Files\Rfa\Keel Option 2`;
const RFT = String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Generic Model.rft`;
const M = { grey: (await call("ensure_material", { name: "Strip Cladding MDF HPL Light Grey", color: { r: 214, g: 209, b: 198 } })).id, trim: (await call("ensure_material", { name: "Strip Closure Bent Trim (type to confirm)", color: { r: 188, g: 182, b: 170 } })).id, sup: (await call("ensure_material", { name: "Softwood Support 18", color: { r: 200, g: 170, b: 120 } })).id };
const NOTE = { A: "Strip cladding SC-A, side wall run with two typical arches (keel option 2: rise 560, R 400, apex +2.960). 20 mm strips about 40 pitch on 5 mm backing, from the low bay cap +1.984 to the +3.000 ceiling, cut to the keel line and ending on a 6 mm bent closure trim round each arch ring, so no gap shows. 18 x 100 support board on top behind the backing, fixed to the ceiling framing. No box behind. 3950 long.",
  B: "Strip cladding SC-B, rear wall run with one typical arch (keel option 2: rise 560, R 400, apex +2.960). 20 mm strips about 40 pitch on 5 mm backing, from the low bay cap +1.984 to the +3.000 ceiling, cut to the keel line and ending on a 6 mm bent closure trim round the arch ring, so no gap shows. 18 x 100 support board on top behind the backing, fixed to the ceiling framing. No box behind. 1324 long." };
log.types ||= {}; log.placed ||= {};
for (const p of plans) {
  const t = p.w.type, mark = `SC-${t}1`; if (log.types[t]) continue;
  const ds = (await call("create_direct_shape", { category: "OST_GenericModel", name: `Madina Arch Strip Cladding SC-${t}`, comments: NOTE[t], solids: p.solids.map(({ m, ...s }) => ({ ...s, material_id: M[m] })) })).id;
  const r = await call("make_unit_family", { template_path: RFT, family_name: `Madina Arch Strip Cladding SC-${t}`, save_dir: DIR, level_id: FFL, mark, comments: NOTE[t], element_ids: [ds] });
  log.types[t] = { type_id: r.type_id, origin: r.origin_mm, master: r.id }; log.placed[mark] = r.id; save(); console.log(t, "family", r.family, "origin", r.origin_mm.map((v) => v.toFixed(1)), "id", r.id);
}
// Copies. E: W family turned 180 about its origin (W wall-side, low-y corner); the turned origin is E's wall-side, high-y corner,
// set so the arch axes match E's (W axis offsets from the run's high end equal E's from its low end, to 2 mm).
const oA = log.types.A.origin, oB = log.types.B.origin;
const offW = cW.map((c) => c - oA[1]), eY = (cE[0] + offW[1] + cE[1] + offW[0]) / 2;
const copies = [
  ["SC-A2", "A", { x: 5905 + (875 - oA[0]), y: eY, z: oA[2] }, 180],
  ["SC-B2", "B", { x: oB[0] + (cRR - cRL), y: oB[1], z: oB[2] }, 0],
];
for (const [mark, t, loc, rot] of copies) {
  if (log.placed[mark]) continue;
  const r = await call("place_family_instance", { family_type_id: log.types[t].type_id, location: loc, level_id: FFL, rotation_deg: rot });
  await call("set_parameter", { element_id: r.id, parameter_name: "Mark", value: mark });
  await call("set_parameter", { element_id: r.id, parameter_name: "Comments", value: NOTE[t] });
  log.placed[mark] = r.id; save(); console.log(mark, r.id);
}
for (const [m, id] of Object.entries(log.placed)) { const g = await call("get_element", { element_id: id }).catch(() => null); if (!g) { console.log(m, "MISSING", id); continue; } const b = g.bounding_box, Rn = (v) => v.toFixed(1); console.log(m, id, "x", Rn(b.min.x), Rn(b.max.x), "y", Rn(b.min.y), Rn(b.max.y), "z", Rn(b.min.z), Rn(b.max.z)); }
