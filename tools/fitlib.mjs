// Ray-fit helpers shared by SultanRevitMCP tools (from tools/mitre_painted.mjs, 11 Nov 2026).
// Solids are { profile: [{x,y,z}...], direction: {x,y,z}, length_mm } in model mm, as create_direct_shape takes them.
//   lineExtent(sols, axis, point)        exact extent of the solids along a world axis through a point
//   fitToSolids(id, sols[, dense])       how far element id sits from where sols say it should be (rays; median)
//   fitInstance(inst, localSols[, dense]) the instance's real transform (as placed or mirrored) and fit residual
// Call setDoc(title) first.
import { call } from "./rvt.mjs";
let D = {};
export const AX = ["x", "y", "z"];
export function setDoc(title) { D = { document: title }; }
export async function hitsAlong(id, o, a) {           // first and last hit on element id along world axis a through point o
  // 6 m either side, up to 300 hits: a long ray through a crowded run used to run out of hits (limit 50) before the
  // far face of a long board (Madina 2 LF-D-2, 11 Nov 2026)
  const origin = { ...o, [a]: o[a] - 6000 }, dir = { x: 0, y: 0, z: 0, [a]: 1 };
  const r = await call("probe_ray", { ...D, origin, direction: dir, max_distance_mm: 12000, limit: 300, target: "family" });
  const h = r.hits.filter((x) => x.element_id === id).map((x) => x.point[a]);
  return h.length ? { lo: Math.min(...h), hi: Math.max(...h) } : null;
}

export function rotP(p, deg) { const th = (deg * Math.PI) / 180; return { x: p.x * Math.cos(th) - p.y * Math.sin(th), y: p.x * Math.sin(th) + p.y * Math.cos(th), z: p.z }; }
export function xform(sols, T) {                        // T: { L, rd, mx, my, off }
  const P = (p) => { const q = rotP({ x: T.mx * p.x, y: T.my * p.y, z: p.z }, T.rd); return { x: T.L.x + q.x + T.off.x, y: T.L.y + q.y + T.off.y, z: T.L.z + q.z + T.off.z }; };
  const Dv = (d) => rotP({ x: T.mx * (d.x ?? 0), y: T.my * (d.y ?? 0), z: d.z ?? 0 }, T.rd);
  return sols.map((s) => ({ ...s, profile: s.profile.map(P), direction: Dv(s.direction) }));
}
export function solidInfo(s) {
  const d = s.direction, dax = AX.reduce((a, b) => (Math.abs(d[b] ?? 0) > Math.abs(d[a] ?? 0) ? b : a)), sg = Math.sign(d[dax]);
  const w0 = s.profile[0][dax], w1 = w0 + sg * s.length_mm;
  const c = Object.fromEntries(AX.map((a) => [a, s.profile.reduce((p, q) => p + q[a], 0) / s.profile.length]));
  c[dax] = (w0 + w1) / 2;
  return { dax, wlo: Math.min(w0, w1), whi: Math.max(w0, w1), c, vol: s.length_mm };
}
export function inPoly(pts, a, b, pa, pb) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const yi = pts[i][b], yj = pts[j][b];
    if ((yi > pb) !== (yj > pb) && pa < ((pts[j][a] - pts[i][a]) * (pb - yi)) / (yj - yi) + pts[i][a]) ins = !ins;
  }
  return ins;
}
export function lineExtent(sols, a, p) {                // exact extent of the solids along world axis a through point p
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
export async function fitToSolids(id, sols, dense = false) {   // drift of instance id from where sols say it should be
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
    // the drift most rays agree on (within 0.5 mm); a tie goes to the smaller move. Not the median: on a mitred board
    // half the rays land on the 45 degree line (half the board thickness in) and the median picked that (LF-A, 9 mm).
    const mode = (v, d0) => { if (!v.length) return d0; let best = v[0], bc = -1; for (const c of v) { const k = v.filter((x) => Math.abs(x - c) < 0.5).length; if (k > bc || (k === bc && Math.abs(c) < Math.abs(best))) { best = c; bc = k; } } return best; };
    const nd = Object.fromEntries(AX.map((a) => [a, mode(vals[a], drift[a])]));
    res = Math.max(...AX.flatMap((a) => vals[a].map((v) => Math.abs(v - nd[a]))));
    if (dense && miss) res = Math.max(res, 999);   // a ray through a board that hits nothing: a hole, notch or curve
    const moved = AX.some((a) => Math.abs(nd[a] - drift[a]) > 0.05); drift = nd;
    if (!moved && pass) break;
  }
  return { drift, res };
}
export async function fitInstance(e, sols, dense = false) {    // best of: as placed, mirrored in x, in y, in both
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
