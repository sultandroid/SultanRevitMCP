// How we make an arch (user, 11 Nov 2026): CNC-cut MDF formers ("nillers") to the arch curve first, then clad them
// with bendable MDF to get the shape. This adds the formers to arch unit families that are modelled as the oak front
// plus an inside and an outside 8 mm skin with an empty cavity between them.
//   - the cavity between the skins is traced with rays every 4 mm at mid depth, floor to apex (exact, any arch shape);
//   - each former is that band, cut flat from 18 mm FR MDF on the CNC, standing square to the depth;
//   - formers sit behind the oak front, at the back end of the skins and evenly between, at most --pitch mm apart;
//   - they go INTO the family (edit_family_solids, direction + profile), so every instance gets them.
// Prints each former's outline size for the cut list. Check with rays afterwards (the script does a quick one).
//
// usage: node tools/arch_formers.mjs --doc <title> --family <regex> [--pitch 200] [--thick 18]
//        [--material "FR MDF 18 CNC Arch Former"] [--dry]
import { call } from "./rvt.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const DOC = arg("doc"), FAM = new RegExp(arg("family")), PITCH = Number(arg("pitch", 200)), TH = Number(arg("thick", 18));
const MAT = arg("material", "FR MDF 18 CNC Arch Former"), DRY = process.argv.includes("--dry"), REPLACE = process.argv.includes("--replace");
const D = { document: DOC }, AX = ["x", "y", "z"];
const rot = (p, deg) => { const t = (deg * Math.PI) / 180; return { x: p.x * Math.cos(t) - p.y * Math.sin(t), y: p.x * Math.sin(t) + p.y * Math.cos(t), z: p.z }; };

const fams = new Map();
for (let off = 0; ; ) {
  const r = await call("query_elements", { ...D, parameter_name: "Family", parameter_value: " ", limit: 500, offset: off });
  for (const e of r.elements) if (e.family && FAM.test(e.family)) { if (!fams.has(e.family)) fams.set(e.family, []); fams.get(e.family).push(e); }
  off += r.returned; if (off >= r.total || !r.returned) break;
}
const hits = async (id, o, axis, sign = 1) => {
  const origin = { ...o, [axis]: o[axis] - sign * 4000 }, direction = { x: 0, y: 0, z: 0, [axis]: sign };
  const r = await call("probe_ray", { ...D, origin, direction, max_distance_mm: 8000, limit: 300 });
  return r.hits.filter((h) => h.element_id === id).map((h) => h.point[axis]);
};
// Ramer-Douglas-Peucker on an open chain of [u,v]
const rdp = (pts, eps) => {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  let im = 0, dm = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L; if (d > dm) { dm = d; im = i; } }
  return dm <= eps ? [a, b] : [...rdp(pts.slice(0, im + 1), eps).slice(0, -1), ...rdp(pts.slice(im), eps)];
};

for (const [family, insts] of fams) {
  const items = (await call("inspect_family", { ...D, element_id: insts[0].id })).items.filter((i) => i.material);
  const oldFormers = items.filter((i) => i.material === MAT).map((i) => i.id);
  if (oldFormers.length && !REPLACE) { console.log(`${family}: already has formers, skipped (use --replace)`); continue; }
  const oak = items.filter((i) => /oak/i.test(i.material)), skins = items.filter((i) => /MDF/i.test(i.material) && !/oak/i.test(i.material) && i.material !== MAT);
  if (!oak.length || skins.length < 2) { console.log(`SKIP ${family}: not an oak front + two MDF skins`); continue; }
  const ob = box(oak), sb = box(skins);
  const d = ["x", "y"].reduce((a, b) => (ob.hi[b] - ob.lo[b] < ob.hi[a] - ob.lo[a] ? b : a));   // depth axis: the oak is thin in it
  const wl = d === "x" ? "y" : "x";
  const outer = skins.reduce((a, b) => (b.max.z > a.max.z ? b : a));
  // the copy to measure: one whose predicted leg the rays really find (a mirrored copy's location is at its other end)
  // ...at a height where BOTH legs exist (an end arch may run one leg on down to the floor), and not a mirrored copy
  // (its hits must fall on location + family coordinates, not on location - family coordinates)
  let e = null, zl = null;
  for (const c of insts) {
    const Lc = c.location.point, rc = c.location.rotation_deg ?? 0;
    const A = (Math.abs(rot({ x: 0, y: 0, z: 0, [wl]: 1 }, rc).x) > 0.5 ? "x" : "y"), sA = Math.sign(rot({ x: 0, y: 0, z: 0, [wl]: 1 }, rc)[A]);
    for (const fz of [0.3, 0.5, 0.7, 0.8, 0.9]) {
      const z0 = sb.lo.z + fz * (sb.hi.z - sb.lo.z);
      const p = rot({ x: 0, y: 0, z: 0, [d]: (sb.lo[d] + sb.hi[d]) / 2, [wl]: (outer.min[wl] + outer.max[wl]) / 2, z: z0 }, rc);
      const h = await hits(c.id, { x: Lc.x + p.x, y: Lc.y + p.y, z: Lc.z + p.z }, A, 1);
      if (h.length < 8) continue;
      const lo = Math.min(...h), hi = Math.max(...h), pl = Lc[A] + sA * outer.min[wl], ph = Lc[A] + sA * outer.max[wl];
      const fits = Math.abs(hi - lo - (outer.max[wl] - outer.min[wl])) < 120 && lo >= Math.min(pl, ph) - 120 && hi <= Math.max(pl, ph) + 120;
      if (fits) { e = c; zl = z0; break; }
    }
    if (e) break;
  }
  if (!e) { console.log(`SKIP ${family}: no copy found where predicted (mirrored?), check by hand`); continue; }
  const L = e.location.point, rd = e.location.rotation_deg ?? 0;
  const toW = (p, off) => { const q = rot(p, rd); return { x: L.x + q.x + off.x, y: L.y + q.y + off.y, z: L.z + q.z + off.z }; };
  const wAx = (a) => (a === "z" ? "z" : Math.abs(rot({ x: 0, y: 0, z: 0, [a]: 1 }, rd).x) > 0.5 ? "x" : "y");     // local axis -> world axis
  const wSg = (a) => (a === "z" ? 1 : Math.sign(rot({ x: 0, y: 0, z: 0, [a]: 1 }, rd)[wAx(a)]));
  // find the template offset: three rays against known faces (outer skin side, front/back end, top)
  const off = { x: 0, y: 0, z: 0 }, dm = (sb.lo[d] + sb.hi[d]) / 2;
  const meas = async (local, la) => {
    const w = toW(local, off), A = wAx(la), sg = wSg(la), h = await hits(e.id, w, A, sg);
    if (!h.length) throw new Error(`${family}: ray along ${la} saw nothing`);
    return sg > 0 ? Math.min(...h) : Math.max(...h);
  };
  let zs = zl;                                                   // lowest height with both legs (straight sides)
  for (let z0 = sb.lo.z + 2; z0 < zl; z0 += 10) {
    const b0 = toW({ [d]: dm, [wl]: (outer.min[wl] + outer.max[wl]) / 2, z: z0 }, off);
    if ((await hits(e.id, b0, wAx(wl), 1)).length >= 8) { zs = z0; break; }
  }
  {
    const pw = { [d]: dm, [wl]: outer.min[wl], z: zs }, A = wAx(wl);
    off[A] = (await meas(pw, wl)) - toW(pw, off)[A];
    const pd = { [d]: Math.min(ob.lo[d], sb.lo[d]), [wl]: outer.min[wl] + 2, z: zs }, B = wAx(d);
    off[B] = (await meas(pd, d)) - toW(pd, off)[B];
    const pz = { [d]: dm, [wl]: (outer.min[wl] + outer.max[wl]) / 2, z: outer.max.z };
    const top = Math.max(...(await hits(e.id, { ...toW(pz, off), z: toW(pz, off).z }, "z", 1)));
    off.z = top - toW(pz, off).z;
  }
  if (process.argv.includes("--debug")) console.log("  DEBUG", e.id, "L", JSON.stringify(L), "off", JSON.stringify(off), "zl", zl);
  const toL = (w) => { const q = rot({ x: w.x - L.x - off.x, y: w.y - L.y - off.y, z: 0 }, -rd); return { x: q.x, y: q.y, z: w.z - L.z - off.z }; };
  // trace the cavity at mid depth, world coordinates along the world width axis
  const Aw = wAx(wl), base = toW({ [d]: dm, [wl]: (outer.min[wl] + outer.max[wl]) / 2, z: 0 }, off);
  const rows = [], legs = [];
  const h0 = (await hits(e.id, { ...base, z: L.z + off.z + zl }, Aw, 1)), W0 = Math.min(...h0), W1 = Math.max(...h0);   // outer faces, both legs
  for (let zl2 = sb.lo.z + 2; zl2 < sb.hi.z; zl2 += 4) {
    const zw = base.z + zl2 - 0 - (sb.lo.z - sb.lo.z);
    const h = [...new Set((await hits(e.id, { ...base, z: L.z + off.z + zl2 }, Aw, 1)).map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b);
    if (h.length < 4) { if (rows.length || legs.length) break; else continue; }
    // one leg only (an end arch's leg running on to the floor): 4 faces close together AND at the arch's outer edge.
    // (Near the apex the top band is narrow too, but it sits in the middle.)
    if (h.length === 4 && h[3] - h[0] < 120 && (h[0] - W0 < 5 || W1 - h[3] < 5)) { legs.push({ z: zl2, a: h[1], b: h[2] }); continue; }
    rows.push({ z: zl2, Lo: h[1], Li: h.length >= 8 ? h[2] : null, Ri: h.length >= 8 ? h[h.length - 3] : null, Ro: h[h.length - 2] });
  }
  // a leg that runs on alone (below the other leg's foot) gets its own straight strip former
  const strips = [];
  for (const g of legs) { const s = strips[strips.length - 1]; if (s && g.z - s.z1 <= 4.5 && Math.abs(g.a - s.a) < 1) s.z1 = g.z; else strips.push({ a: g.a, b: g.b, z0: g.z, z1: g.z }); }
  if (rows.length < 10) { console.log(`SKIP ${family}: cavity not traced (${rows.length} rows)`); continue; }
  // band outline in (world width, local z): outer line up the left, over, down the right; inner line back up and over
  const inner = rows.filter((r) => r.Li != null);
  const chainOut = [...rows.map((r) => [r.Lo, r.z]), ...rows.slice().reverse().map((r) => [r.Ro, r.z])];
  const chainIn = [...inner.slice().reverse().map((r) => [r.Ri, r.z]), ...inner.map((r) => [r.Li, r.z])];
  const leftUp = rdp(rows.map((r) => [r.Lo, r.z]), 0.3), rightDown = rdp(rows.slice().reverse().map((r) => [r.Ro, r.z]), 0.3);
  const rightUpIn = rdp(inner.slice().reverse().map((r) => [r.Ri, r.z]).reverse(), 0.3).reverse(), leftDownIn = rdp(inner.map((r) => [r.Li, r.z]).reverse(), 0.3);
  // the true apex: a vertical ray through the middle gives the underside of the outer skin and the top of the inner skin
  const top = rows[rows.length - 1], cw = (top.Lo + top.Ro) / 2;
  const hv = [...new Set((await hits(e.id, { ...base, [Aw]: cw, z: L.z + off.z + (sb.lo.z + sb.hi.z) / 2 }, "z", 1)).map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b);
  const apexOut = hv.length >= 2 ? hv[hv.length - 2] - L.z - off.z : null, apexIn = hv.length >= 3 ? hv[hv.length - 3] - L.z - off.z : null;
  const topIn = inner[inner.length - 1];
  if (process.argv.includes("--debug")) console.log("  APEX", JSON.stringify({ hv: hv.slice(-4), Lz: L.z, offz: off.z, apexOut, apexIn, topz: top.z, topLo: top.Lo, topRo: top.Ro, topInz: topIn.z, topLi: topIn.Li, topRi: topIn.Ri, cw }));
  const outline = [...leftUp, ...(apexOut > top.z + 0.5 ? [[cw, apexOut]] : []), ...rightDown,
    ...rightUpIn.slice().reverse(), ...(apexIn > topIn.z + 0.5 && apexIn < (apexOut ?? Infinity) ? [[(topIn.Li + topIn.Ri) / 2, apexIn]] : []), ...leftDownIn];
  // former depth positions (local), behind the oak to the back end of the skins
  const oakFront = ob.lo[d] < sb.lo[d] + 1;                       // the oak is on the low-d side
  const c0 = oakFront ? Math.max(ob.hi[d], sb.lo[d]) : sb.lo[d], c1 = oakFront ? sb.hi[d] : Math.min(ob.lo[d], sb.hi[d]);
  const n = Math.max(2, Math.ceil((c1 - c0 - TH) / PITCH) + 1), pos = [];
  for (let k = 0; k < n; k++) pos.push(c0 + ((c1 - c0 - TH) * k) / (n - 1));
  const wid = Math.max(...rows.map((r) => r.Ro)) - Math.min(...rows.map((r) => r.Lo)), hgt = rows[rows.length - 1].z - rows[0].z;
  if (strips.length) console.log(`  + ${strips.length} strip former(s) for a leg running on alone: ${strips.map((s) => Math.round(s.b - s.a) + " x " + Math.round(s.z1 - s.z0 + 4)).join(", ")}`);
  console.log(`${family} (${insts.length} instance${insts.length > 1 ? "s" : ""}): cavity ${Math.round(inner[0].Li - rows[0].Lo)} mm at the legs, former ${Math.round(wid)} x ${Math.round(hgt + 4)} x ${TH}, ${outline.length} outline points, ${n} formers at ${d} ${pos.map((p) => Math.round(p)).join(", ")}`);
  if (process.argv.includes("--debug")) { const k = outline.findIndex((p) => p[1] === Math.max(...outline.map((q) => q[1]))); console.log("  OUTLINE near top", JSON.stringify(outline.slice(Math.max(0, k - 3), k + 4).map((p) => p.map((v) => Math.round(v * 10) / 10)))); console.log("  OUTLINE inner turn", JSON.stringify(outline.slice(leftUp.length + 1 + rightDown.length - 2, leftUp.length + rightDown.length + 4).map((p) => p.map((v) => Math.round(v * 10) / 10)))); }
  if (DRY) continue;
  const shapes = [outline, ...strips.map((s) => [[s.a, s.z0 - 2], [s.b, s.z0 - 2], [s.b, s.z1 + 2], [s.a, s.z1 + 2]])];
  const add = pos.flatMap((p0) => shapes.map((shape) => ({
    material: MAT, direction: { x: 0, y: 0, z: 0, [d]: 1 }, length_mm: TH,
    profile: shape.map(([u, z]) => { const lp = toL({ ...base, [Aw]: u, z: L.z + off.z + z }); return { [wl]: lp[wl], [d]: p0, z }; }),
  })));
  const r = await call("edit_family_solids", { ...D, element_id: e.id, delete_form_ids: oldFormers, add });
  if (oldFormers.length) console.log(`  replaced ${oldFormers.length} old former(s)`);
  // quick check: a ray along the depth through the middle of the left cavity crosses every former
  const mid = rows[Math.floor(rows.length * 0.3)], cwc = (mid.Lo + mid.Li) / 2;
  const hd = await hits(e.id, { ...base, [Aw]: cwc, z: L.z + off.z + mid.z }, wAx(d), 1);
  console.log(`  added ${r.added.length} formers; check ray through the left cavity crosses ${hd.length} faces (want at least ${2 * n})`);
}
function box(list) { return { lo: Object.fromEntries(AX.map((a) => [a, Math.min(...list.map((i) => i.min[a]))])), hi: Object.fromEntries(AX.map((a) => [a, Math.max(...list.map((i) => i.max[a]))])) }; }
