// Painted parts meet on 45 degree mitres (factory rule, user 11 Nov 2026: "any painted part should be connected on 45
// degree to reduce any crack in paint in future"). See standards/sultan-standards.json joinery.painted_corners and
// skills/samaya-revit/references/joinery-practice.md "Finishes and fixings".
//
// Rebuilds unit families whose painted boards meet square at an OUTSIDE corner (overlapping like a face + soffit, or
// butting like a drop board under a soffit) so both boards are cut on the 45 degree diagonal from the outer corner to the
// inner corner. The family is reloaded under its own name, so every instance updates; every instance is measured with rays
// before and after and moved back by any drift (make_unit_family with the Casework template shifts the origin 44.7 mm), so
// nothing moves in the model. Tested 11 Nov 2026 on Madina 2 LF-A..E: 289 faces on 221 rays identical to the hand-checked
// result, including a mirrored instance.
//
// Limits: reads each solid as its bounding box, so use it on families built from flat boards only (it refuses sweeps,
// revolves and blends). Inside corners and T-joints are left alone. Check the result with probe_ray or a section.
//
// --split (user, 11 Nov 2026, "think as a carpenter"): an L part is NOT made or fitted in one piece. The full-height
// vertical board(s) become the OUTSIDE family "<family>-F Outside" and the rest (soffit, drop boards) the INSIDE family
// "<family>-S Inside"; they meet on the same 45 degree mitre as a site joint. Each new pair is placed exactly where the old
// instance was (measured with rays), marks get -F / -S, and the old instance is deleted.
//
// --material <regex>: the finish to treat as painted when its name does not say so (e.g. "Skirting Black").
// --frame <regex> [--rail 30]: a skirting/plinth modelled as one solid block of that material is rebuilt as a frame of
//   four rails (front, back, sides; rail thick, the block's height) whose outside corners are then mitred: how a
//   carpenter makes a plinth (user, 11 Nov 2026, Madina 2 plinths).
//
// usage: node tools/mitre_painted.mjs --doc <title> --family <text in family name> --save-dir <folder for the .rfa> [--dry] [--split]
//        [--material <regex>] [--frame <regex> --rail <mm>]
import { call } from "./rvt.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const DOC = arg("doc"), FAM = arg("family"), DIR = arg("save-dir"), DRY = process.argv.includes("--dry"), SPLIT = process.argv.includes("--split");
if (!DOC || !FAM || (!DIR && !DRY)) { console.error("usage: --doc <title> --family <text> --save-dir <folder> [--dry]"); process.exit(1); }
const D = { document: DOC }, TOL = 0.6, OFF = { x: 300000, y: 300000, z: 0 };
const PAINT_RE = /paint|\bRAL\b|lacquer/i;   // painted finishes only; EGGER U/H/F codes are laminate, not paint
const METAL = /steel|metal|alumin|iron|brass|stainless/i;   // welded and ground, not glued: the rule is for wood and MDF
const MAT_RE = arg("material") ? new RegExp(arg("material"), "i") : null;
const FRAME_RE = arg("frame") ? new RegExp(arg("frame"), "i") : null, RAIL = Number(arg("rail", 30));
const PAINT = { test: (m) => (PAINT_RE.test(m) || (MAT_RE && MAT_RE.test(m))) && !METAL.test(m) };
const AX = ["x", "y", "z"];
const eq = (a, b) => Math.abs(a - b) < TOL;
const TEMPLATES = {
  Casework: String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Casework.rft`,
  "Generic Models": String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Generic Model.rft`,
  Furniture: String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Furniture.rft`,
};

// ---- 1. instances grouped by family ----------------------------------------------------------------------------------
const found = [];
for (let off = 0; ; ) {
  const r = await call("query_elements", { ...D, parameter_name: "Family", parameter_value: FAM, limit: 500, offset: off });
  found.push(...r.elements.filter((e) => e.family && e.family.includes(FAM)));
  off += r.returned; if (off >= r.total || !r.returned) break;
}
const fams = new Map();
for (const e of found) { if (!fams.has(e.family)) fams.set(e.family, []); fams.get(e.family).push(e); }
const matId = new Map();
const materialId = async (name) => {
  if (!matId.has(name)) {
    const q = await call("query_elements", { ...D, category: "Materials", parameter_name: "Name", parameter_value: name, limit: 50 });
    const m = q.elements.find((e) => e.name === name);
    if (!m) throw new Error(`material not found: ${name}`);
    matId.set(name, m.id);
  }
  return matId.get(name);
};
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;

// ---- 2. per family: boards, corners, cuts -----------------------------------------------------------------------------
const solidMin = (items) => {
  const s = items.filter((i) => i.material && /Extrusion|FreeForm|Blend|Sweep|Revolution/.test(i.class));
  return { x: Math.min(...s.map((i) => i.min.x)), y: Math.min(...s.map((i) => i.min.y)), z: Math.min(...s.map((i) => i.min.z)) };
};
for (const [family, insts] of fams) {
  const ref = insts[0];
  let inf; try { inf = await call("inspect_family", { ...D, element_id: ref.id }); } catch { continue; }
  const solids = inf.items.filter((i) => i.material && /Extrusion|FreeForm|Blend|Sweep|Revolution/.test(i.class));
  if (solids.some((i) => /Blend|Sweep|Revolution/.test(i.class))) { console.log(`SKIP ${family}: has sweeps/revolves/blends, not a flat-board family`); continue; }
  const B0 = solids.map((i) => ({ lo: { ...i.min }, hi: { ...i.max } }));      // as it stands, for the guard
  let B = solids.map((i) => ({ mat: i.material, lo: { ...i.min }, hi: { ...i.max }, cuts: [] }));
  if (FRAME_RE) {                                   // solid skirting block -> four rails
    let nf = 0;
    B = B.flatMap((b) => {
      const dx = b.hi.x - b.lo.x, dy = b.hi.y - b.lo.y, dz = b.hi.z - b.lo.z;
      if (!FRAME_RE.test(b.mat) || dz > 150 || dx < 3 * RAIL || dy < 3 * RAIL || Math.min(dx, dy) <= dz) return [b];
      nf++;
      const r = (lo, hi) => ({ mat: b.mat, lo: { ...b.lo, ...lo }, hi: { ...b.hi, ...hi }, cuts: [] });
      return [r({}, { y: b.lo.y + RAIL }), r({ y: b.hi.y - RAIL }, {}), r({}, { x: b.lo.x + RAIL }), r({ x: b.hi.x - RAIL }, {})].map((x) => ({ ...x, framed: true }));
    });
    if (nf) console.log(`${family}: ${nf} solid skirting block(s) made into ${RAIL} mm rail frames`);
  }
  B.forEach((b, k) => { b.k = k; });
  for (const b of B) { const d = AX.map((a) => b.hi[a] - b.lo[a]); b.thin = AX[d.indexOf(Math.min(...d))]; b.t = Math.min(...d); b.lo0 = { ...b.lo }; b.hi0 = { ...b.hi }; }
  const done = new Set(); let n = 0;
  for (const A of B) for (const Bb of B) {
    if (A === Bb || A.thin === Bb.thin || !PAINT.test(A.mat) || !PAINT.test(Bb.mat)) continue;
    const key = [A.k, Bb.k].sort().join("-"); if (done.has(key)) continue;
    const u = A.thin, v = Bb.thin, w = AX.find((a) => a !== u && a !== v);
    // A's thickness sits at one end of B (in u)
    const uEnd = eq(A.lo[u], Bb.lo[u]) ? "lo" : eq(A.hi[u], Bb.hi[u]) ? "hi" : null;
    if (!uEnd || A.lo[u] < Bb.lo[u] - TOL || A.hi[u] > Bb.hi[u] + TOL) continue;
    // B's thickness sits at one end of A (in v): overlapping, or butting (then A is extended into B)
    let vEnd = null;
    if (Bb.lo[v] >= A.lo[v] - TOL && Bb.hi[v] <= A.hi[v] + TOL) vEnd = eq(Bb.lo[v], A.lo[v]) ? "lo" : eq(Bb.hi[v], A.hi[v]) ? "hi" : null;
    else if (eq(A.hi[v], Bb.lo[v])) { A.hi[v] = Bb.hi[v]; vEnd = "hi"; A.extended = true; }
    else if (eq(A.lo[v], Bb.hi[v])) { A.lo[v] = Bb.lo[v]; vEnd = "lo"; A.extended = true; }
    if (!vEnd) continue;
    const w0 = Math.max(A.lo[w], Bb.lo[w]), w1 = Math.min(A.hi[w], Bb.hi[w]);
    if (w1 - w0 < 1) continue;
    const O = { [u]: uEnd === "lo" ? A.lo[u] : A.hi[u], [v]: vEnd === "lo" ? Bb.lo[v] : Bb.hi[v] };
    const I = { [u]: uEnd === "lo" ? A.hi[u] : A.lo[u], [v]: vEnd === "lo" ? Bb.hi[v] : Bb.lo[v] };
    A.cuts.push({ u, v, w, w0, w1, C: { [u]: I[u], [v]: O[v] }, I });
    Bb.cuts.push({ u, v, w, w0, w1, C: { [u]: O[u], [v]: I[v] }, I });
    done.add(key); n++;
    console.log(`${family}: mitre ${A.k}/${Bb.k} along ${w} ${Math.round(w0)}..${Math.round(w1)}, outer corner ${u}=${Math.round(O[u])} ${v}=${Math.round(O[v])}${A.extended ? " (butt joint: board extended into the other)" : ""}`);
  }
  if (!n) { console.log(`${family}: no painted outside corners, unchanged`); continue; }
  // Guard: the boards are read as bounding boxes, so prove they ARE boxes before touching the family. One instance is
  // fitted with rays (also near the board edges) against the boxes as they stand (before the mitre); a curved part such
  // as an arch lunette does not fit and the family is refused.
  const boxSols = B0.map((b) => ({ profile: [[b.lo.x, b.lo.y], [b.hi.x, b.lo.y], [b.hi.x, b.hi.y], [b.lo.x, b.hi.y]].map(([x, y]) => ({ x, y, z: b.lo.z })), direction: { x: 0, y: 0, z: 1 }, length_mm: b.hi.z - b.lo.z }));
  const chk = await fitInstance(ref, boxSols, true);
  if (!chk) { console.log(`SKIP ${family}: rays cannot see an instance (hidden in {3D}); check by hand`); continue; }
  if (chk.res > 1) { console.log(`SKIP ${family}: not flat boards (fit off by ${chk.res.toFixed(1)} mm, curved or shaped parts); mitre by hand`); continue; }
  if (DRY) continue;

  // ---- 3. solids: each board split along its cut axis where cuts start/stop ----------------------------------------
  for (const b of B) {
    const mid = await materialId(b.mat);
    const P = (p) => p;
    b.sol = [];
    const S = b.sol;
    if (!b.cuts.length) {
      S.push({ profile: [[b.lo.x, b.lo.y], [b.hi.x, b.lo.y], [b.hi.x, b.hi.y], [b.lo.x, b.hi.y]].map(([x, y]) => P({ x, y, z: b.lo.z })), direction: { x: 0, y: 0, z: 1 }, length_mm: b.hi.z - b.lo.z, material_id: mid });
      continue;
    }
    const w = b.cuts[0].w, [u, v] = AX.filter((a) => a !== w);
    const cuts = b.cuts.filter((c) => c.w === w);
    if (cuts.length < b.cuts.length) console.log(`  warning: board ${b.k} has cuts in two directions; only those along ${w} applied`);
    const br = [...new Set([b.lo[w], b.hi[w], ...cuts.flatMap((c) => [c.w0, c.w1])].map((x) => Math.round(x * 100) / 100))].filter((x) => x >= b.lo[w] - TOL && x <= b.hi[w] + TOL).sort((p, q) => p - q);
    for (let s = 0; s + 1 < br.length; s++) {
      const a = br[s], c = br[s + 1]; if (c - a < 0.5) continue;
      const m = (a + c) / 2;
      let rect = [{ [u]: b.lo[u], [v]: b.lo[v] }, { [u]: b.hi[u], [v]: b.lo[v] }, { [u]: b.hi[u], [v]: b.hi[v] }, { [u]: b.lo[u], [v]: b.hi[v] }];
      for (const ct of cuts) if (m > ct.w0 && m < ct.w1) {
        const iu = ct.I[u], iv = ct.I[v];
        rect = rect.map((p) => (eq(p[u], ct.C[u]) && eq(p[v], ct.C[v]) ? { [u]: iu, [v]: iv } : p));
      }
      S.push({ profile: rect.map((p) => P({ [u]: p[u], [v]: p[v], [w]: a })), direction: { [w]: 1, ...Object.fromEntries(AX.filter((x) => x !== w).map((x) => [x, 0])) }, length_mm: c - a, material_id: mid });
    }
  }

  const S = B.flatMap((b) => b.sol.map((s) => ({ ...s, profile: s.profile.map((p) => ({ x: p.x + OFF.x, y: p.y + OFF.y, z: p.z + OFF.z })) })));
  if (SPLIT) { await splitFamily(family, insts, B); continue; }

  // ---- 4. reload the family, put every instance back -----------------------------------------------------------------
  // A reload through make_unit_family can move the family origin (a different template, e.g. Generic Model -> Casework,
  // shifts it 44.7 mm along local x) and inspect_family does not show it. Each instance is fitted with rays to its OLD
  // boards before the reload (as placed or mirrored), then to its NEW boards after, and moved by the true difference.
  // (Measuring the same ray before and after is wrong when the ray crosses a changed part: the middle of a skirting
  // block that became a hollow frame read as a 50 mm drop on Madina 2 OSB-1/2, 11 Nov 2026.)
  const NEW_SOLS = B.flatMap((b) => b.sol);
  const pre = new Map();
  for (const e of insts) { const f0 = await fitInstance(e, boxSols); pre.set(e.id, f0 && f0.res <= 1 ? f0.T : null); }
  const cat = ref.category;
  const ds = (await call("create_direct_shape", { ...D, category: cat === "Casework" ? "OST_Casework" : cat === "Furniture" ? "OST_Furniture" : "OST_GenericModel", name: family, solids: S })).id;
  const r = await call("make_unit_family", { ...D, template_path: TEMPLATES[cat] ?? TEMPLATES["Generic Models"], family_name: family, save_dir: DIR, level_id: lv, mark: "TEMP-MITRE", element_ids: [ds] });
  if (!insts.some((e) => e.id === r.id)) await call("delete_elements", { ...D, element_ids: [r.id] });
  for (const e of insts) {
    const T = pre.get(e.id);
    if (!T) { console.log(`  VERIFY ${e.id}: rays could not see it (hidden in {3D}?); check its place by hand`); continue; }
    const want = xform(NEW_SOLS, T), f1 = await fitToSolids(e.id, want);
    if (!f1) { console.log(`  VERIFY ${e.id}: rays could not see it after the reload`); continue; }
    if (AX.some((a) => Math.abs(f1.drift[a]) > 0.05)) await call("move_elements", { ...D, element_ids: [e.id], dx_mm: -f1.drift.x, dy_mm: -f1.drift.y, dz_mm: -f1.drift.z });
    const f2 = await fitToSolids(e.id, want);
    const ok = f2 && AX.every((a) => Math.abs(f2.drift[a]) < 0.2) && f2.res < 0.5;
    console.log(`  ${e.id}: ${ok ? "in place" : "VERIFY placement"} (moved ${AX.map((a) => (-f1.drift[a]).toFixed(1)).join(",")})`);
  }
  console.log(`${family}: rebuilt with ${n} mitre(s), ${S.length} solids; ${insts.length} instance(s) checked in place`);
}

// ---- helpers: measure an instance with rays -----------------------------------------------------------------------------
function vol(b) { return AX.reduce((p, a) => p * (b.hi[a] - b.lo[a]), 1); }
function toWorld(e, p) {                       // approximate: location + rotation (the template offset is what we measure)
  const L = e.location.point, th = ((e.location.rotation_deg ?? 0) * Math.PI) / 180;
  return { x: L.x + p.x * Math.cos(th) - p.y * Math.sin(th), y: L.y + p.x * Math.sin(th) + p.y * Math.cos(th), z: L.z + p.z };
}
async function hitsAlong(id, o, a) {           // first and last hit on element id along world axis a through point o
  const origin = { ...o, [a]: o[a] - 6000 }, dir = { x: 0, y: 0, z: 0, [a]: 1 };
  const r = await call("probe_ray", { ...D, origin, direction: dir, max_distance_mm: 12000, limit: 50, target: "family" });
  const h = r.hits.filter((x) => x.element_id === id).map((x) => x.point[a]);
  return h.length ? { lo: Math.min(...h), hi: Math.max(...h) } : null;
}
async function measure(e, b) {
  const c = toWorld(e, { x: (b.lo.x + b.hi.x) / 2, y: (b.lo.y + b.hi.y) / 2, z: (b.lo.z + b.hi.z) / 2 });
  // the thin axis first (the long ones tolerate the offset); then re-centre on it before the long rays
  const th = ((e.location.rotation_deg ?? 0) % 180 + 180) % 180;
  const tw = b.thin === "z" ? "z" : (th === 90 ? (b.thin === "x" ? "y" : "x") : b.thin);
  const ht = await hitsAlong(e.id, c, tw);
  if (!ht) return null;
  c[tw] = ht.lo + b.t / 2;
  const out = { origin: c, [tw]: ht };
  for (const a of AX.filter((x) => x !== tw)) { const h = await hitsAlong(e.id, c, a); if (!h) return null; out[a] = h; }
  return out;
}
async function remeasure(id, m0) {
  const out = {};
  for (const a of AX) { const h = await hitsAlong(id, m0.origin, a); if (!h) return null; out[a] = h.lo; }
  return out;
}

// ---- split into outside / inside families --------------------------------------------------------------------------
// Placement is fitted, never assumed: every old and new instance is measured with rays against the exact (mitred) solids
// it should have. Old instances are tried as placed, and mirrored in x and in y (Revit mirrors keep a plain rotation
// angle, e.g. a mirror in x reads "180"). A mirrored instance gets its own "... Handed" family, because
// place_family_instance cannot mirror. An instance the rays cannot see is left as it is and reported.
function rotP(p, deg) { const th = (deg * Math.PI) / 180; return { x: p.x * Math.cos(th) - p.y * Math.sin(th), y: p.x * Math.sin(th) + p.y * Math.cos(th), z: p.z }; }
function xform(sols, T) {                        // T: { L, rd, mx, my, off }
  const P = (p) => { const q = rotP({ x: T.mx * p.x, y: T.my * p.y, z: p.z }, T.rd); return { x: T.L.x + q.x + T.off.x, y: T.L.y + q.y + T.off.y, z: T.L.z + q.z + T.off.z }; };
  const Dv = (d) => rotP({ x: T.mx * (d.x ?? 0), y: T.my * (d.y ?? 0), z: d.z ?? 0 }, T.rd);
  return sols.map((s) => ({ ...s, profile: s.profile.map(P), direction: Dv(s.direction) }));
}
function solidInfo(s) {
  const d = s.direction, dax = AX.reduce((a, b) => (Math.abs(d[b] ?? 0) > Math.abs(d[a] ?? 0) ? b : a)), sg = Math.sign(d[dax]);
  const w0 = s.profile[0][dax], w1 = w0 + sg * s.length_mm;
  const c = Object.fromEntries(AX.map((a) => [a, s.profile.reduce((p, q) => p + q[a], 0) / s.profile.length]));
  c[dax] = (w0 + w1) / 2;
  return { dax, wlo: Math.min(w0, w1), whi: Math.max(w0, w1), c, vol: s.length_mm };
}
function inPoly(pts, a, b, pa, pb) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const yi = pts[i][b], yj = pts[j][b];
    if ((yi > pb) !== (yj > pb) && pa < ((pts[j][a] - pts[i][a]) * (pb - yi)) / (yj - yi) + pts[i][a]) ins = !ins;
  }
  return ins;
}
function lineExtent(sols, a, p) {                // exact extent of the solids along world axis a through point p
  let lo = Infinity, hi = -Infinity;
  for (const s of sols) {
    const S = solidInfo(s), others = AX.filter((x) => x !== a);
    if (S.dax === a) { const [u, v] = others; if (inPoly(s.profile, u, v, p[u], p[v])) { lo = Math.min(lo, S.wlo); hi = Math.max(hi, S.whi); } continue; }
    if (p[S.dax] < S.wlo - 0.01 || p[S.dax] > S.whi + 0.01) continue;
    const tt = AX.find((x) => x !== a && x !== S.dax), xs = [];
    for (let i = 0; i < s.profile.length; i++) {
      const P = s.profile[i], Q = s.profile[(i + 1) % s.profile.length];
      if (Math.abs(P[tt] - Q[tt]) < 1e-9) { if (Math.abs(P[tt] - p[tt]) < 1e-6) xs.push(P[a], Q[a]); continue; }
      if ((P[tt] - p[tt]) * (Q[tt] - p[tt]) <= 0) xs.push(P[a] + ((p[tt] - P[tt]) * (Q[a] - P[a])) / (Q[tt] - P[tt]));
    }
    if (xs.length) { lo = Math.min(lo, ...xs); hi = Math.max(hi, ...xs); }
  }
  return lo <= hi ? { lo, hi } : null;
}
async function fitToSolids(id, sols, dense = false) {   // drift of instance id from where sols say it should be
  const big = sols.map((s) => ({ s, S: solidInfo(s) })).sort((p, q) => q.S.vol - p.S.vol).slice(0, dense ? 10 : 6);
  const lines = big.flatMap(({ s, S }) => {
    const out = AX.map((a) => ({ a, c: S.c }));
    if (dense) {                                  // guard: a 5 x 5 grid across each board's face, through its thickness,
      const ext = Object.fromEntries(AX.map((o) => [o, o === S.dax ? [S.wlo, S.whi] : [Math.min(...s.profile.map((p) => p[o])), Math.max(...s.profile.map((p) => p[o]))]]));
      const th = AX.reduce((m, a) => (ext[a][1] - ext[a][0] < ext[m][1] - ext[m][0] ? a : m));   // so a notch or a curve shows
      const [u, v] = AX.filter((x) => x !== th), F = [0.1, 0.3, 0.5, 0.7, 0.9];
      for (const fu of F) for (const fv of F) out.push({ a: th, c: { ...S.c, [u]: ext[u][0] + fu * (ext[u][1] - ext[u][0]), [v]: ext[v][0] + fv * (ext[v][1] - ext[v][0]) } });
    }
    return out;
  });
  let drift = { x: 0, y: 0, z: 0 }, res = Infinity;
  for (let pass = 0; pass < 3; pass++) {
    const vals = { x: [], y: [], z: [] }; let miss = 0;
    for (const { a, c } of lines) {
      const ex = lineExtent(sols, a, c); if (!ex) continue;
      const q = Object.fromEntries(AX.map((x) => [x, c[x] + (x === a ? 0 : drift[x])]));
      const h = await hitsAlong(id, q, a); if (!h) { miss++; continue; }
      vals[a].push(h.lo - ex.lo, h.hi - ex.hi);
    }
    if (!AX.some((a) => vals[a].length)) return null;
    const nd = Object.fromEntries(AX.map((a) => { const v = vals[a].slice().sort((p, q) => p - q); return [a, v.length ? v[Math.floor(v.length / 2)] : drift[a]]; }));
    res = Math.max(...AX.flatMap((a) => vals[a].map((v) => Math.abs(v - nd[a]))));
    if (dense && miss) res = Math.max(res, 999);   // a ray through a board that hits nothing: a hole, notch or curve
    const moved = AX.some((a) => Math.abs(nd[a] - drift[a]) > 0.05); drift = nd;
    if (!moved && pass) break;
  }
  return { drift, res };
}
async function fitInstance(e, sols, dense = false) {    // best of: as placed, mirrored in x, in y, in both
  let best = null;
  for (const [mx, my] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const T = { L: e.location.point, rd: e.location.rotation_deg ?? 0, mx, my, off: { x: 0, y: 0, z: 0 } };
    const f1 = await fitToSolids(e.id, xform(sols, T), dense); if (!f1) continue;
    T.off = f1.drift;
    const f2 = await fitToSolids(e.id, xform(sols, T), dense);
    if (f2 && (!best || f2.res < best.res - 0.01)) best = { T, res: f2.res };
    if (best && best.res < 0.5 && mx === 1 && my === 1) break;
  }
  return best;
}
async function splitFamily(family, insts, B) {
  const H = Math.max(...B.map((b) => b.hi.z)) - Math.min(...B.map((b) => b.lo.z));
  const outer = B.filter((b) => b.thin !== "z" && b.hi.z - b.lo.z >= 0.7 * H), inner = B.filter((b) => !outer.includes(b));
  if (!outer.length || !inner.length) { console.log(`${family}: nothing to split (outside ${outer.length}, inside ${inner.length})`); return; }
  const ALL = B.flatMap((b) => b.sol);
  const info = new Map(), skip = [];
  for (const e of insts) {
    const g = await call("get_element", { ...D, element_id: e.id });
    const par = (n) => g.parameters.find((p) => p.name === n)?.value ?? null;
    const best = await fitInstance(e, ALL);
    if (!best || best.res > 1) { skip.push(e.id); console.log(`  VERIFY ${e.id}: could not fit it with rays (hidden in {3D}, or not this family's shape); left unsplit`); continue; }
    info.set(e.id, { ...best.T, mark: par("Mark") ?? "", comments: par("Comments") ?? "", sf: ["SF_Maturity", "SF_PhaseStatus", "SF_ExistingSource"].map((n) => [n, par(n)]).filter(([, v]) => v) });
    if (best.T.mx !== 1 || best.T.my !== 1) console.log(`  ${e.id}: mirrored instance (${best.T.mx < 0 ? "x" : "y"}), gets a Handed family`);
  }
  if (!info.size) return;
  const cat = insts[0].category;
  const make = async (name, sols, mark) => {
    const ds = (await call("create_direct_shape", { ...D, category: cat === "Casework" ? "OST_Casework" : cat === "Furniture" ? "OST_Furniture" : "OST_GenericModel", name, solids: sols })).id;
    return call("make_unit_family", { ...D, template_path: TEMPLATES[cat] ?? TEMPLATES["Generic Models"], family_name: name, save_dir: DIR, level_id: lv, mark, element_ids: [ds] });
  };
  const fix = async (id, sols, what) => {
    const f = await fitToSolids(id, sols);
    if (!f) { console.log(`  VERIFY ${what} ${id}: rays could not see it`); return; }
    if (AX.some((a) => Math.abs(f.drift[a]) > 0.05)) await call("move_elements", { ...D, element_ids: [id], dx_mm: -f.drift.x, dy_mm: -f.drift.y, dz_mm: -f.drift.z });
    const g = await fitToSolids(id, sols);
    const ok = g && AX.every((a) => Math.abs(g.drift[a]) < 0.2) && g.res < 0.5;
    console.log(`  ${what} ${id}: ${ok ? "in place" : "VERIFY placement"} (moved ${AX.map((a) => (-f.drift[a]).toFixed(1)).join(",")})`);
  };
  const plain = [...info].filter(([, I]) => I.mx === 1 && I.my === 1), handed = [...info].filter(([, I]) => I.mx !== 1 || I.my !== 1);
  for (const [tag, label, group] of [["F", "Outside", outer], ["S", "Inside", inner]]) {
    const name = `${family}-${tag} ${label}`, G = group.flatMap((b) => b.sol);
    const placed = new Map();
    if (plain.length) {
      const [rid, R] = plain[0], WR = xform(G, R);
      const r = await make(name, WR, `${R.mark}-${tag}`);
      await fix(r.id, WR, name); placed.set(rid, r.id);
      const n1 = (await call("get_element", { ...D, element_id: r.id })).location;
      for (const [id, I] of plain.slice(1)) {
        const dr = I.rd - R.rd;
        const k = rotP({ x: R.L.x + R.off.x - n1.point.x, y: R.L.y + R.off.y - n1.point.y, z: 0 }, dr);
        const loc = { x: I.L.x + I.off.x - k.x, y: I.L.y + I.off.y - k.y, z: I.L.z + I.off.z - (R.L.z + R.off.z - n1.point.z) };
        const p = await call("place_family_instance", { ...D, family_type_id: r.type_id, location: loc, rotation_deg: dr + (n1.rotation_deg ?? 0), level_id: lv });
        const nid = p.id ?? p.element_id; await fix(nid, xform(G, I), name); placed.set(id, nid);
      }
    }
    let k = 0;
    for (const [id, I] of handed) {
      const WI = xform(G, I), hn = `${name} Handed${handed.length > 1 ? " " + ++k : ""}`;
      const r = await make(hn, WI, `${I.mark}-${tag}`); await fix(r.id, WI, hn); placed.set(id, r.id);
    }
    for (const [id, nid] of placed) {
      const I = info.get(id);
      await call("set_parameter", { ...D, element_id: nid, parameter_name: "Mark", value: `${I.mark}-${tag}` });
      await call("set_parameter", { ...D, element_id: nid, parameter_name: "Comments", value: `${label.toUpperCase()} part of ${I.mark}, made and fitted separately; meets the other part on a 45 degree site mitre (split, user 11 Nov 2026) | ${I.comments}`.slice(0, 1000) });
      for (const [n, v] of I.sf) await call("set_parameter", { ...D, element_id: nid, parameter_name: n, value: v }).catch(() => {});
    }
    console.log(`${name}: ${group.length} board(s), placed ${placed.size}x: ${[...placed.values()].join(", ")}`);
  }
  const gone = [...info.keys()];
  if (gone.length) await call("delete_elements", { ...D, element_ids: gone });
  console.log(`${family}: split ${gone.join(", ")}${skip.length ? `; left unsplit ${skip.join(", ")}` : ""}`);
}
