// SBC 306 (AISC 360 LRFD) member check of the Robot forces: combination 10 = 1.2D+1.6L governs (1.4D is lighter here); SLS 11. Fy 235 (S235 / cold-formed SHS), E 200000.
import fs from "node:fs";
const R = JSON.parse(fs.readFileSync(new URL(`./ste2_results_${process.argv[2] ?? "v2"}.json`, import.meta.url), "utf8").replace(/^\uFEFF/, ""));
const M = JSON.parse(fs.readFileSync(new URL("./ste2_robot.json", import.meta.url), "utf8"));
const fy = 235, E = 200000, phiC = 0.9, phiB = 0.9, phiT = 0.9;
const SEC = { SHS: { A: 294, I: 73365, W: 3668, Wpl: 4352, i: Math.sqrt(73365 / 294) },
  L40: { A: 308, I: 44800, W: 1550, Wpl: 2800, i: 12.1 }, ROD: { A: 58, I: 270, W: 63, Wpl: 106, i: 2.15 }, FB: { A: 240, I: 720, W: 240, Wpl: 360, i: 1.73 }, RHS: { A: 475, I: 104000, W: 5200, Wpl: 6300, i: Math.sqrt(104000 / 475) }, PL116x10: { A: 1800, Iz: 1137000, Wplz: 15800, Wply: 22427 } /* T 116x10 + fin 80x8, elastic to the fin tip */ };
if (process.env.FLAT) SEC.PL116x10 = { A: 1160, Iz: 9667, Wplz: 2900, Wply: 33640 };
const nd = Object.fromEntries(M.nodes.map((n) => [n.id, n]));
const rows = R.bars.map((b) => {
  const g = M.bars[b.bar - 1], a = nd[g.n1], c = nd[g.n2];
  const L = Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z) * 1000;
  const N = b.N, My = Math.abs(b.My) * 1000, Mz = Math.abs(b.Mz) * 1000; // N, N.mm
  let u, mode;
  if (["SHS", "RHS", "L40", "ROD", "FB"].includes(b.sec)) {
    const s = SEC[b.sec], KL = L / s.i, Fe = Math.PI ** 2 * E / KL ** 2;            // SBC 306 E3, K = 1
    const Fcr = fy / Fe <= 2.25 ? 0.658 ** (fy / Fe) * fy : 0.877 * Fe;
    const Pc = N < 0 ? phiC * Fcr * s.A : phiT * fy * s.A, Mc = phiB * fy * s.Wpl; // b/t = 18 < 1.12 sqrt(E/Fy): compact
    const pr = Math.abs(N) / Pc, mr = (My + Mz) / Mc;
    u = pr >= 0.2 ? pr + 8 / 9 * mr : pr / 2 + mr;                                  // SBC 306 H1-1a / H1-1b
    mode = (N < 0 ? "comp" : "tension") + `, KL/r ${KL.toFixed(0)}${KL > 200 && N < 0 ? " (over 200)" : ""}`;
  } else { const s = SEC.PL116x10; u = My / (phiB * fy * s.Wplz) + Mz / (phiB * fy * s.Wply); mode = "flat plate, weak-axis bending (Robot local y)"; }
  return { ...b, L: Math.round(L), u, mode };
});
const byId = {};
for (const r of rows) if (!byId[r.id] || r.u > byId[r.id].u) byId[r.id] = r;
const list = Object.values(byId).sort((a, b) => b.u - a.u);
const dmax = R.nodes.reduce((m, n) => { const d = Math.hypot(n.ux, n.uy, n.uz) * 1000; return d > m.d ? { d, n } : m; }, { d: 0 });
const tip = R.nodes.filter((n) => Math.abs(n.x - 5.73) < 0.001).map((n) => ({ y: n.y, uz: n.uz * 1000 }));
const hx = R.nodes.filter((n) => Math.abs(n.z - 2.9) < 0.001).reduce((m, n) => Math.max(m, Math.abs(n.ux * 1000)), 0);
const out = { list, dmax: { mm: dmax.d, node: dmax.n }, shelfTip: tip, topSway: hx, reactions: R.reactions };
fs.writeFileSync(new URL(`./ste2_check_${process.argv[2] ?? "v2"}.json`, import.meta.url), JSON.stringify(out, null, 1));
for (const r of list) console.log(r.id.padEnd(7), r.sec.padEnd(8), String(r.L).padStart(5), "N", (r.N / 1000).toFixed(2).padStart(6), "kN My", (r.My / 1000).toFixed(3), "Mz", (r.Mz / 1000).toFixed(3), "kNm  u", r.u.toFixed(2), r.u > 1 ? "FAIL" : "ok", " ", r.mode);
console.log("max SLS displacement", dmax.d.toFixed(1), "mm at", JSON.stringify(dmax.n));
console.log("shelf plate tips uz (mm)", JSON.stringify(tip), "limit", (608 / 125).toFixed(1), "(cantilever L/125)");
console.log("top sway ux max", hx.toFixed(1), "mm, limit H/400 (SBC 301 App. C, cladding fixed to it) =", (2900 / 400).toFixed(1));
console.log("ULS reactions (kN)", R.reactions.map((r) => `n${r.node}: ${(r.FX / 1000).toFixed(2)}/${(r.FY / 1000).toFixed(2)}/${(r.FZ / 1000).toFixed(2)}`).join("  "));
