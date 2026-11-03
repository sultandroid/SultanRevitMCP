// Strip cladding, backing and closure on all four walls, cut round the keel arch units as placed (920 wide, top +2960, rise 630, R 610).
// Built in place: strips from +1.990 (low bay cap + 6 mm closure) to the +3.00 ceiling. Replaces the five-centred cut of w_strips.mjs / m_strips.mjs.
// Usage: node k_strips.mjs plan | build
import { writeFileSync } from "node:fs";
import { call } from "./rvt.mjs";

const mode = process.argv[2] ?? "plan";
const SET = 50, RIB = 15, BACK = 5, W = 20, PITCH = 40, TOP = 3000, B = 6, Z0 = 1984;
const APEX = 2960, RISE = 630, R = 610;
const RUNS = [
  { id: "W", u0: 780, u1: 4730, world: (u, d, z) => ({ x: 875 - d, y: u, z }), dirD: { x: -1, y: 0, z: 0 }, marks: ["W-A1", "W-A2"], along: "y" },
  { id: "E", u0: 740, u1: 4690, world: (u, d, z) => ({ x: 5905 + d, y: u, z }), dirD: { x: 1, y: 0, z: 0 }, marks: ["E-A1", "E-A2"], along: "y" },
  { id: "RL", u0: 986, u1: 2310, world: (u, d, z) => ({ x: u, y: 4820 + d, z }), dirD: { x: 0, y: 1, z: 0 }, marks: ["RL-A1"], along: "x" },
  { id: "RR", u0: 4421, u1: 5745, world: (u, d, z) => ({ x: u, y: 4820 + d, z }), dirD: { x: 0, y: 1, z: 0 }, marks: ["RR-A1"], along: "x" },
];
const rd = (v) => Math.round(v * 100) / 100;
// Points closer than 1 mm make edges shorter than Revit's tolerance: drop them, closing edge included.
const clean = (pts) => { const o = []; for (const p of pts.map(([u, z]) => [rd(u), rd(z)])) if (!o.length || Math.hypot(p[0] - o[o.length - 1][0], p[1] - o[o.length - 1][1]) >= 1) o.push(p); while (o.length > 3 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 1) o.pop(); return o; };
const poly = (w, pts, d0, d1) => ({ profile: clean(pts).map(([u, z]) => w.world(u, d0, z)), direction: w.dirD, length_mm: d1 - d0 });
const layout = (a, b) => { const n = Math.max(2, Math.round((b - a + W) / PITCH)), step = (b - a - W) / (n - 1), o = []; for (let i = 0; i < n; i++) o.push([a + i * step, a + i * step + W]); return o; };

// Keel line set out by e from the unit's outer face (e > 0 outward), from the springing on side sg up to the axis.
function side(a, b, e, sg) {
  const Wd = b - a, zs = APEX - RISE, t = Math.atan2(RISE, Wd / 2 - R) + Math.acos(R / Math.hypot(Wd / 2 - R, RISE)), r = R + e, n = 48, L = [];
  for (let i = 0; i <= n; i++) { const g = Math.PI - (i * (Math.PI - t)) / n; L.push([a + R + r * Math.cos(g), zs + r * Math.sin(g)]); }
  const [pu, pz] = L[L.length - 1]; L.push([(a + b) / 2, pz + (((a + b) / 2 - pu) / Math.sin(t)) * -Math.cos(t)]);
  return sg < 0 ? L : L.map(([u, z]) => [a + b - u, z]);
}
const line = (a, b, e) => [...side(a, b, e, -1), ...side(a, b, e, 1).slice(0, -1).reverse()];
const zAt = (L, u) => { for (let i = 1; i < L.length; i++) { const [u0, z0] = L[i - 1], [u1, z1] = L[i]; if ((u - u0) * (u - u1) <= 0 && u1 !== u0) return z0 + ((u - u0) / (u1 - u0)) * (z1 - z0); } return -Infinity; };

const arches = {};
for (const c of ["OST_Casework"]) for (const e of (await call("query_elements", { category: c, limit: 500 })).elements.filter((q) => q.family === "Madina Arch Typical A")) {
  const g = await call("get_element", { element_id: e.id }), m = g.parameters.find((q) => q.name === "Mark")?.value, b = g.bounding_box;
  arches[m] = b;
}
const plans = RUNS.map((w) => {
  const k = w.along;
  const hs = w.marks.map((m) => { const b = arches[m]; if (!b) throw new Error("no arch " + m); return { a: b.min[k], b: b.max[k] }; }).sort((p, q) => p.a - q.a);
  const ribs = [], bands = [], backs = [], zB = Z0 + B, low = (u, v) => poly(w, [[u, zB], [v, zB], [v, TOP], [u, TOP]], SET, SET + RIB);
  let cur = w.u0, curB = w.u0;
  for (const h of hs) {
    const left = h.a - B, right = h.b + B, outer = line(h.a, h.b, B), axis = (h.a + h.b) / 2, apexB = Math.max(...outer.map((p) => p[1]));
    for (const [u, v] of layout(cur, left)) ribs.push(low(u, v));
    for (const [u, v] of layout(left, right)) {
      const zu = Math.max(zAt(outer, Math.max(u, left)), zB), zv = Math.max(zAt(outer, Math.min(v, right)), zB);
      const inner = outer.filter((p) => p[0] > u && p[0] < v).map((p) => [p[0], Math.max(p[1], zB)]);
      ribs.push(poly(w, [[u, zu], ...inner, [v, zv], [v, TOP], [u, TOP]], SET, SET + RIB));
    }
    const oL = side(h.a, h.b, B, -1), oR = side(h.a, h.b, B, 1), iL = side(h.a, h.b, 0, -1), iR = side(h.a, h.b, 0, 1);
    bands.push(poly(w, [[left, Z0], ...oL, ...oR.slice(0, -1).reverse(), [right, Z0], [h.b, Z0], ...iR, ...iL.slice(0, -1).reverse(), [h.a, Z0]], SET, SET + RIB + BACK));
    if (left > cur) bands.push(poly(w, [[cur, Z0], [left, Z0], [left, zB], [cur, zB]], SET, SET + RIB + BACK));
    if (h.a > curB) backs.push(poly(w, [[curB, Z0], [h.a, Z0], [h.a, TOP], [curB, TOP]], SET + RIB, SET + RIB + BACK));
    backs.push(poly(w, [...line(h.a, h.b, 0), [h.b, TOP], [h.a, TOP]], SET + RIB, SET + RIB + BACK));
    cur = right; curB = h.b;
    if (apexB > TOP - 5) throw new Error(`${w.id} closure apex ${apexB} too close to the ceiling`);
  }
  for (const [u, v] of layout(cur, w.u1)) ribs.push(low(u, v));
  if (cur < w.u1) bands.push(poly(w, [[cur, Z0], [w.u1, Z0], [w.u1, zB], [cur, zB]], SET, SET + RIB + BACK));
  if (curB < w.u1) backs.push(poly(w, [[curB, Z0], [w.u1, Z0], [w.u1, TOP], [curB, TOP]], SET + RIB, SET + RIB + BACK));
  return { w, hs, ribs, bands, backs };
});
for (const p of plans) console.log(p.w.id, "arches", p.hs.map((h) => `${Math.round(h.a)}-${Math.round(h.b)}`).join(" "), "strips", p.ribs.length, "backing parts", p.backs.length, "closure parts", p.bands.length);
if (mode === "plan") process.exit(0);

const guard = async () => { const { title } = await call("get_project_info"); if (title !== "Madina1_ARCH_02") throw new Error("Active document is: " + title); };
await guard();
const grey = (await call("ensure_material", { name: "Strip Cladding MDF HPL Light Grey", color: { r: 214, g: 209, b: 198 } })).id, trim = (await call("ensure_material", { name: "Strip Closure Bent Trim (type to confirm)", color: { r: 188, g: 182, b: 170 } })).id;
const ids = {}; for (let o = 0; ; o += 500) { const r = await call("query_elements", { category: "OST_GenericModel", limit: 500, offset: o }); for (const e of r.elements) ids[e.name] = e.id; if (o + 500 >= r.total) break; }
const made = {};
for (const { w, ribs, bands, backs } of plans) {
  for (const [part, mark, comments, solids, m] of [
    ["Strip Cladding", "ST", "20 mm strips evenly spaced in each bay, cut to the keel arch, ending on the 6 mm closure; from the low bay cap to the +3.00 ceiling.", ribs, grey],
    ["Strip Backing", "SB", "5 mm backing behind the strips, from the low bay cap to the ceiling, cut round the keel arches.", backs, grey],
    ["Strip Closure", "SC", "6 mm thick bent closure trim, 20 mm deep, round each keel arch and along the strips' bottom edge. Material and profile to confirm.", bands, trim],
  ]) {
    const name = `${w.id} ${part}`;
    await guard();
    const r = await call("create_direct_shape", { category: "OST_GenericModel", name, comments, solids: solids.map((s) => ({ ...s, material_id: m })) });
    if (ids[name]) await call("delete_elements", { element_ids: [ids[name]] });
    await call("set_parameter", { element_id: r.id, parameter_name: "Mark", value: `${w.id}-${mark}` });
    made[name] = r.id;
  }
  console.log(w.id, "done");
}
writeFileSync("dwg/kstrips.json", JSON.stringify(made));
