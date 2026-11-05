// EXAMPLE from DAS (5 Nov 2026): AISC 360-16 LRFD member check, deflection, reactions and concrete base overturning/sliding from robot_build.ps1 results.
// Copy next to the project's model/results JSON and set DIR, SEC, BASE and the post buckling lengths for the job.
// AISC 360-16 LRFD member check (SBC 306) from the Robot forces in das_robot_results.json. Fy 275 MPa (S275), E 200 GPa. Units N, mm.
import fs from "node:fs";
const DIR = "C:/Users/user/AppData/Local/Temp/claude/4dd925465a493673/c44b4e0e-28a2-44a2-9f89-e5d849147aab/scratchpad";
const M = JSON.parse(fs.readFileSync(`${DIR}/das_robot.json`, "utf8"));
const R = JSON.parse(fs.readFileSync(`${DIR}/das_robot_results.json`, "utf8").replace(/^\uFEFF/, ""));
const Fy = 275, E = 200000, phi = 0.9;
const SEC = {
  "IPE 220": { A: 3337, Zx: 285.4e3, Sx: 252.0e3, Zy: 58.1e3, Iy: 205e4, rx: 91.1, ry: 24.8, J: 9.07e4, Cw: 22.67e9, h0: 210.8, I: true },
  "IPE 160": { A: 2009, Zx: 123.9e3, Sx: 108.7e3, Zy: 26.1e3, Iy: 68.3e4, rx: 65.8, ry: 18.4, J: 3.6e4, Cw: 3.96e9, h0: 152.6, I: true },
  "SHS 40x40x1.25": { A: 193.75, Z: (40 ** 3 - 37.5 ** 3) / 4, r: Math.sqrt((40 ** 4 - 37.5 ** 4) / 12 / 193.75) },
  "SHS 50x50x2.5": { A: 475, Z: (50 ** 3 - 45 ** 3) / 4, r: Math.sqrt((50 ** 4 - 45 ** 4) / 12 / 475) },
};
const Fcr = KLr => { const Fe = Math.PI ** 2 * E / KLr ** 2; return KLr <= 4.71 * Math.sqrt(E / Fy) ? Math.pow(0.658, Fy / Fe) * Fy : 0.877 * Fe; };
// LTB (F2), Cb = 1
const MnI = (s, Lb) => { const Mp = Fy * s.Zx, rts = Math.sqrt(Math.sqrt(s.Iy * s.Cw) / s.Sx), Lp = 1.76 * s.ry * Math.sqrt(E / Fy);
  const Lr = 1.95 * rts * E / (0.7 * Fy) * Math.sqrt(s.J / (s.Sx * s.h0) + Math.sqrt((s.J / (s.Sx * s.h0)) ** 2 + 6.76 * (0.7 * Fy / E) ** 2));
  if (Lb <= Lp) return Mp; if (Lb <= Lr) return Math.min(Mp, Mp - (Mp - 0.7 * Fy * s.Sx) * (Lb - Lp) / (Lr - Lp));
  const Fc = Math.PI ** 2 * E / (Lb / rts) ** 2 * Math.sqrt(1 + 0.078 * s.J / (s.Sx * s.h0) * (Lb / rts) ** 2); return Math.min(Mp, Fc * s.Sx); };
const L = b => { const a = M.nodes[b.n1 - 1], c = M.nodes[b.n2 - 1]; return Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z) * 1000; };
const uls = new Set(M.combos.filter(c => c.type === "ULS").map(c => c.no)), cname = Object.fromEntries([...M.cases, ...M.combos].map(c => [c.no, c.name]));
// strong-axis buckling length of the posts: base to brace joint, and 2.1 x the cantilever above it
const postKLx = { B: Math.max(4880 - 1020, 2.1 * (7300 - 4880)), A: Math.max(3253 - 820, 2.1 * (4860 - 3253)) };
const out = {};
for (const b of M.bars) {
  const s = SEC[b.sec], len = L(b), seg = b.grp[0], kind = b.grp.slice(2);
  for (const r of R.bars.filter(x => x[0] === b.id && uls.has(x[1]))) {
    const [, cn, pos, FX, FY, FZ, MX, MY, MZ] = r; const P = Math.abs(FX), comp = FX > 0;          // Robot: FX > 0 = compression
    let Pc, Mcx, Mcy, Mx = Math.abs(MY) * 1000, My = Math.abs(MZ) * 1000;
    if (s.I) {
      const KLx = kind === "post" ? postKLx[seg] : len, KLy = len;                                  // posts: weak axis held by the rails at every node
      Pc = comp ? phi * Fcr(Math.max(KLx / s.rx, KLy / s.ry)) * s.A : phi * Fy * s.A;
      Mcx = phi * MnI(s, kind === "post" ? Math.min(len, 1220) : len); Mcy = phi * Fy * Math.min(s.Zy, 1.6 * s.Zy);
    } else { Pc = comp ? phi * Fcr(len / s.r) * s.A : phi * Fy * s.A; Mcx = Mcy = phi * Fy * s.Z; }
    const pr = P / Pc, ratio = pr >= 0.2 ? pr + 8 / 9 * (Mx / Mcx + My / Mcy) : pr / 2 + Mx / Mcx + My / Mcy;
    const k = b.grp; if (!out[k] || ratio > out[k].ratio) out[k] = { group: k, section: b.sec, ratio: +ratio.toFixed(2), bar: b.id, combo: cname[cn], at: pos, N_kN: +(FX / 1000).toFixed(1), My_kNm: +(MY / 1000).toFixed(2), Mz_kNm: +(MZ / 1000).toFixed(2), slender: s.I ? undefined : +(len / s.r).toFixed(0) };
  }
}
// deflection (SLS) at the post tops, and reactions (ULS) at the supports
const sls = M.combos.filter(c => c.type === "SLS").map(c => c.no), tops = {};
for (const seg of ["B", "A"]) { const ys = seg === "B" ? 0.168 : 20.138; const topZ = Math.max(...M.nodes.filter(n => Math.abs(n.y - ys) < 0.002).map(n => n.z));
  const ids = M.nodes.filter(n => Math.abs(n.y - ys) < 0.002 && Math.abs(n.z - topZ) < 0.001).map(n => n.id);
  let worst = 0, wc = 0; for (const r of R.nodes.filter(x => ids.includes(x[0]) && sls.includes(x[1]))) { const d = Math.hypot(r[2], r[3]); if (d > worst) { worst = d; wc = r[1]; } }
  tops[seg] = { top_m: topZ, max_mm: +worst.toFixed(1), limit_h100_mm: +(topZ * 10).toFixed(0), combo: cname[wc] }; }
const reac = {};
for (const r of R.nodes.filter(x => x.length > 5 && uls.has(x[1]))) { const n = M.nodes[r[0] - 1], seg = n.y > 10 ? "A" : "B", type = Math.abs(n.y - (seg === "B" ? 0.168 : 20.138)) < 0.002 ? "post base" : "brace foot", k = `${seg} ${type}`;
  reac[k] ??= { up_kN: 0, down_kN: 0, shear_kN: 0 }; const fz = r[7] / 1000, sh = Math.hypot(r[5], r[6]) / 1000;
  reac[k].down_kN = Math.max(reac[k].down_kN, +fz.toFixed(1)); reac[k].up_kN = Math.min(reac[k].up_kN, +fz.toFixed(1)); reac[k].shear_kN = Math.max(reac[k].shear_kN, +sh.toFixed(1)); }
// concrete base per frame: overturning about the toe on the far side and sliding (friction 0.5), base weight with the combination's D factor
const BASE = { B: { W: 1.4, L: 2.3, H: 1.0, y0: 0.058 }, A: { W: 1.0, L: 1.8, H: 0.8, y0: 20.058 } }, base = {};
for (const c of M.combos.filter(c => c.type === "ULS")) {
  const dF = c.f.find(f => f[0] === 1)[1];
  const bySup = {}; for (const r of R.nodes.filter(x => x.length > 5 && x[1] === c.no)) bySup[r[0]] = r;
  for (const seg of ["B", "A"]) {
    const bs = BASE[seg], Wc = bs.W * bs.L * bs.H * 24 * dF, yc = bs.y0 + bs.L / 2, zTop = bs.H + 0.02;
    const frames = {}; for (const id of M.supports) { const n = M.nodes[id - 1]; if ((seg === "B") !== (n.y < 10)) continue; (frames[n.x.toFixed(2)] ??= []).push([n, bySup[id]]); }
    for (const [x, sups] of Object.entries(frames)) {
      // reactions are forces ON the structure; the frame pushes the base with the opposite sign
      let FyT = 0, FzT = 0, Mx = 0;          // Mx about the base centre line, + tips towards +Y
      for (const [n, r] of sups) { const fy = -r[6] / 1000, fz = -r[7] / 1000; FyT += fy; FzT += fz; Mx += fy * zTop + fz * (n.y - yc) * -1 * -1; }
      const V = Wc - FzT;                     // net down on the soil (FzT < 0 means the frame pushes down)
      const dir = Math.sign(Mx) || 1, Mot = Math.abs(fyMoment(sups, yc, zTop)), Mres = Wc * bs.L / 2;
      const ecc = Math.abs(fyMoment(sups, yc, zTop)) / Math.max(V, 1e-6);
      const key = seg + (/W3/.test(c.name) ? " free end (W3)" : " mid-wall (W1/W2)"); const fos = (Wc * bs.L / 2 + stab(sups, yc, bs.L, dirOf(sups, yc, zTop))) / Math.max(over(sups, yc, bs.L, zTop, dirOf(sups, yc, zTop)), 1e-6);
      const slide = 0.5 * Math.max(V, 0) / Math.max(Math.abs(FyT), 1e-6);
      if (!base[key] || fos < base[key].overturning_FS) base[key] = { overturning_FS: +fos.toFixed(2), sliding_FS: +slide.toFixed(2), combo: c.name, frame_x_m: +x, base_kN: +Wc.toFixed(1), frame_push_kN: +FyT.toFixed(1), frame_down_kN: +(-FzT).toFixed(1) };
    }
  }
}
function dirOf(sups, yc, zTop) { let m = 0; for (const [n, r] of sups) m += (-r[6] / 1000) * zTop; return Math.sign(m) || 1; }
function fyMoment(sups, yc, zTop) { let m = 0; for (const [n, r] of sups) m += (-r[6] / 1000) * zTop - (-r[7] / 1000) * (n.y - yc); return m; }
// moments about the toe on the side the wind pushes to: overturning = horizontal push x height + uplift x arm; stabilising = downward frame loads x arm
function over(sups, yc, L, zTop, d) { const toe = yc + d * L / 2; let m = 0; for (const [n, r] of sups) { const fy = -r[6] / 1000, fz = -r[7] / 1000; m += Math.abs(fy) * zTop; if (fz > 0) m += fz * Math.abs(toe - n.y); } return m; }
function stab(sups, yc, L, d) { const toe = yc + d * L / 2; let m = 0; for (const [n, r] of sups) { const fz = -r[7] / 1000; if (fz < 0) m += -fz * Math.abs(toe - n.y); } return m; }
console.log(JSON.stringify({ bases: base }, null, 1));
const res = { bases: base, members: Object.values(out).sort((a, b) => b.ratio - a.ratio), deflection: tops, reactions: reac, log: R.log };
fs.writeFileSync(`${DIR}/das_robot_check.json`, JSON.stringify(res, null, 1));
console.table(res.members.map(m => ({ group: m.group, section: m.section, ratio: m.ratio, combo: m.combo, N_kN: m.N_kN, My: m.My_kNm, Mz: m.Mz_kNm })));
console.log(JSON.stringify({ deflection: tops, reactions: reac }, null, 1));
