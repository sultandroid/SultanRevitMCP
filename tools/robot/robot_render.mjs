// High-resolution analysis pictures drawn from Robot's own results (white background, metric, labelled).
// Robot's 4096 px screen capture does not draw bars on this machine, so the pictures are drawn here from the result data.
// Usage: node robot_render.mjs <model.json> <results.json> <outDir> [views.json]
//   model.json   : { nodes:[{id,x,y,z}] m, bars:[{id,n1,n2,sec,grp}], supports:[ids], cases, combos }   (robot_build input)
//   results.json : { bars:[[bar,case,pos,FX,FY,FZ,MX,MY,MZ]] N/Nm (FX>0 compression), nodes:[[node,case,UX,UY,UZ(mm),RX,RY,RZ(N)]] }
//   views.json   : optional list; default set below. Each view -> <name>.svg and <name>.png (Edge headless, 2x).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const [mf, rf, out, vf] = process.argv.slice(2);
const M = JSON.parse(fs.readFileSync(mf, "utf8").replace(/^\uFEFF/, ""));
const R = JSON.parse(fs.readFileSync(rf, "utf8").replace(/^\uFEFF/, ""));
fs.mkdirSync(out, { recursive: true });
const N = new Map(M.nodes.map(n => [n.id, n]));
const cname = Object.fromEntries([...M.cases, ...M.combos].map(c => [c.no, c.name]));
const uls = M.combos.filter(c => c.type === "ULS").map(c => c.no);
const grpOf = b => b.grp.replace(/^S /, "").replace(/ pin-\w+/, "");
const GRP = { post: ["#1f5fa8", "Post"], rail: ["#2e9e44", "Rail"], backleg: ["#c0392b", "Frame back leg"], horiz: ["#e67e22", "Frame horizontal"], tie: ["#8e44ad", "Back tie"], "X-brace": ["#7f8c8d", "X-brace"], diag: ["#555555", "Frame diagonal"] };
// ---- section properties (SHS b x b x t) and AISC 360 ratio, same as kac_check.mjs ----
const shs = s => { const m = /SHS (\d+)x\d+x([\d.]+)/.exec(s), b = +m[1], t = +m[2]; const A = b * b - (b - 2 * t) ** 2, I = (b ** 4 - (b - 2 * t) ** 4) / 12; return { A, r: Math.sqrt(I / A), Z: (b ** 3 - (b - 2 * t) ** 3) / 4 }; };
const Fy = 275, E = 200000, phi = 0.9;
const Fcr = KLr => { const Fe = Math.PI ** 2 * E / KLr ** 2; return KLr <= 4.71 * Math.sqrt(E / Fy) ? 0.658 ** (Fy / Fe) * Fy : 0.877 * Fe; };
const blen = b => { const a = N.get(b.n1), c = N.get(b.n2); return Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z); };
const byBar = new Map(); for (const r of R.bars) { if (!byBar.has(r[0])) byBar.set(r[0], []); byBar.get(r[0]).push(r); }
const byNode = new Map(); for (const r of R.nodes) { if (!byNode.has(r[0])) byNode.set(r[0], new Map()); byNode.get(r[0]).set(r[1], r); }
const ratioOf = b => { const s = shs(b.sec), KL = grpOf(b) === "post" ? 2480 : blen(b) * 1000; let best = 0;
  for (const r of byBar.get(b.id) || []) { if (!uls.includes(r[1])) continue; const P = Math.abs(r[3]), Pc = r[3] > 0 ? phi * Fcr(KL / s.r) * s.A : phi * Fy * s.A, Mc = phi * Fy * s.Z;
    const pr = P / Pc, mm = (Math.abs(r[7]) + Math.abs(r[8])) * 1000 / Mc, q = pr >= 0.2 ? pr + 8 / 9 * mm : pr / 2 + mm; best = Math.max(best, q); } return best; };
const momOf = (b, c) => Math.max(0, ...(byBar.get(b.id) || []).filter(r => r[1] === c).map(r => Math.hypot(r[7], r[8]) / 1000));
const axOf = (b, c) => { const rs = (byBar.get(b.id) || []).filter(r => r[1] === c); return rs.length ? rs.reduce((a, r) => Math.abs(r[3]) > Math.abs(a) ? r[3] : a, 0) / 1000 : 0; };
// ---- projection ----
const proj = (az, el) => { const ca = Math.cos(az * Math.PI / 180), sa = Math.sin(az * Math.PI / 180), ce = Math.cos(el * Math.PI / 180), se = Math.sin(el * Math.PI / 180);
  return p => { const u = p.x * ca + p.y * sa, d = -p.x * sa + p.y * ca; return [u, p.z * ce - d * se, d]; }; };
const colorRamp = t => { t = Math.max(0, Math.min(1, t)); const stops = [[0, [38, 99, 186]], [0.35, [46, 170, 120]], [0.6, [240, 200, 40]], [0.8, [235, 120, 30]], [1, [200, 30, 30]]];
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], k = (t - t0) / (t1 - t0); return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * k)).join(",")})`; } return "rgb(200,30,30)"; };
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
// ---- draw one view ----
function draw(v) {
  const W = v.w || 1800, H = v.h || 900, P = proj(v.az ?? -32, v.el ?? 22);
  const disp = (id, c, k) => { const r = byNode.get(id)?.get(c); return r ? { x: r[2] / 1000 * k, y: r[3] / 1000 * k, z: r[4] / 1000 * k } : { x: 0, y: 0, z: 0 }; };
  let k = 0; if (v.mode === "deformed") { let dmax = 0; for (const n of M.nodes) { const r = byNode.get(n.id)?.get(v.case); if (r) dmax = Math.max(dmax, Math.hypot(r[2], r[3], r[4])); } k = dmax > 0 ? (v.target ?? 0.6) / (dmax / 1000) : 0; v._dmax = dmax; v._k = k; }
  const pt = (id, def) => { const n = N.get(id), d = def ? disp(id, v.case, k) : { x: 0, y: 0, z: 0 }; return P({ x: n.x + d.x, y: n.y + d.y, z: n.z + d.z }); };
  const all = M.nodes.map(n => pt(n.id, false)).concat(v.mode === "deformed" ? M.nodes.map(n => pt(n.id, true)) : []);
  const minU = Math.min(...all.map(p => p[0])), maxU = Math.max(...all.map(p => p[0])), minV = Math.min(...all.map(p => p[1])), maxV = Math.max(...all.map(p => p[1]));
  const padL = 60, padR = v.legend ? 330 : 60, padT = 90, padB = 80, sc = Math.min((W - padL - padR) / (maxU - minU), (H - padT - padB) / (maxV - minV));
  const X = p => padL + (p[0] - minU) * sc, Y = p => H - padB - (p[1] - minV) * sc;
  const g = [];
  const bars = [...M.bars].sort((a, b) => (pt(b.n1)[2] + pt(b.n2)[2]) - (pt(a.n1)[2] + pt(a.n2)[2]));
  let vals = null, vmax = 1, vmin = 0;
  if (v.mode === "ratio") { vals = new Map(M.bars.map(b => [b.id, ratioOf(b)])); vmax = 1.0; }
  if (v.mode === "moment") { vals = new Map(M.bars.map(b => [b.id, momOf(b, v.case)])); vmax = Math.max(...vals.values()) || 1; }
  if (v.mode === "axial") { vals = new Map(M.bars.map(b => [b.id, axOf(b, v.case)])); vmax = Math.max(...[...vals.values()].map(Math.abs)) || 1; vmin = -vmax; }
  for (const b of bars) {
    const a = pt(b.n1), c = pt(b.n2), grp = grpOf(b);
    if (v.mode === "model") g.push(`<line x1="${X(a)}" y1="${Y(a)}" x2="${X(c)}" y2="${Y(c)}" stroke="${GRP[grp]?.[0] || "#333"}" stroke-width="${grp === "post" ? 4 : 3}" stroke-linecap="round"/>`);
    else if (v.mode === "deformed" || v.mode === "reactions") { g.push(`<line x1="${X(a)}" y1="${Y(a)}" x2="${X(c)}" y2="${Y(c)}" stroke="#c8c8c8" stroke-width="2"/>`); }
    else { const val = vals.get(b.id), t = v.mode === "axial" ? (val - vmin) / (vmax - vmin) : val / vmax;
      const col = v.mode === "axial" ? (val > 0 ? `rgb(${Math.round(255 - 200 * Math.min(1, val / vmax))},${Math.round(255 - 170 * Math.min(1, val / vmax))},255)` : `rgb(255,${Math.round(255 - 210 * Math.min(1, -val / vmax))},${Math.round(255 - 220 * Math.min(1, -val / vmax))})`) : colorRamp(t);
      g.push(`<line x1="${X(a)}" y1="${Y(a)}" x2="${X(c)}" y2="${Y(c)}" stroke="#555" stroke-width="7" stroke-linecap="round"/><line x1="${X(a)}" y1="${Y(a)}" x2="${X(c)}" y2="${Y(c)}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`); }
  }
  if (v.mode === "deformed") for (const b of bars) { const a = pt(b.n1, true), c = pt(b.n2, true); g.push(`<line x1="${X(a)}" y1="${Y(a)}" x2="${X(c)}" y2="${Y(c)}" stroke="#c0392b" stroke-width="3" stroke-linecap="round"/>`); }
  // supports
  for (const id of M.supports) { const p = pt(id); const x = X(p), y = Y(p); g.push(`<path d="M${x} ${y} l-9 15 h18 z" fill="#222"/>`); }
  // extreme labels
  let nlab = 0; const lab = (p, text, col = "#000") => { const dy = 40 + 46 * (nlab++); g.push(`<g><line x1="${X(p)}" y1="${Y(p)}" x2="${X(p) + 8}" y2="${Y(p) - dy + 13}" stroke="${col}" stroke-width="1.5"/><circle cx="${X(p)}" cy="${Y(p)}" r="4" fill="${col}"/><rect x="${X(p) + 8}" y="${Y(p) - dy}" width="${text.length * 11 + 14}" height="26" rx="4" fill="#fff" stroke="${col}" stroke-width="2"/><text x="${X(p) + 15}" y="${Y(p) - dy + 19}" font-size="18" font-family="Arial" fill="${col}">${esc(text)}</text></g>`); };
  if (vals && v.mode !== "axial") { const top = [...vals.entries()].sort((a, b) => b[1] - a[1]).slice(0, v.labels ?? 3); for (const [id, val] of top) { const b = M.bars.find(q => q.id === id), a = pt(b.n1), c = pt(b.n2); lab([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], `${v.mode === "ratio" ? val.toFixed(2) : val.toFixed(2) + " kNm"}  ${GRP[grpOf(b)]?.[1] || ""}`, "#b03020"); } }
  if (v.mode === "axial") { const ent = [...vals.entries()]; for (const [id, val] of [ent.sort((a, b) => b[1] - a[1])[0], ent.sort((a, b) => a[1] - b[1])[0]]) { const b = M.bars.find(q => q.id === id), a = pt(b.n1), c = pt(b.n2); lab([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], `${val > 0 ? "C" : "T"} ${Math.abs(val).toFixed(2)} kN  ${GRP[grpOf(b)]?.[1] || ""}`, val > 0 ? "#1f5fa8" : "#b03020"); } }
  if (v.mode === "deformed") { let best = null; for (const n of M.nodes) { const r = byNode.get(n.id)?.get(v.case); if (r) { const d = Math.hypot(r[2], r[3], r[4]); if (!best || d > best.d) best = { d, id: n.id }; } } if (best) lab(pt(best.id, true), `max ${best.d.toFixed(1)} mm`, "#c0392b"); }
  if (v.mode === "reactions") { const rs = M.supports.map(id => ({ id, r: byNode.get(id)?.get(v.case) })).filter(q => q.r);
    for (const q of rs) { const p = pt(q.id), fy = q.r[6] / 1000, fz = q.r[7] / 1000, len = Math.max(-60, Math.min(60, fz * 18)); g.push(`<line x1="${X(p)}" y1="${Y(p) + 18}" x2="${X(p)}" y2="${Y(p) + 18 + len}" stroke="${fz > 0 ? "#1f5fa8" : "#c0392b"}" stroke-width="4"/>`); }
    for (const q of [...rs].sort((a, b) => b.r[7] - a.r[7]).slice(0, 2).concat([...rs].sort((a, b) => a.r[7] - b.r[7]).slice(0, 2))) lab(pt(q.id), `Fz ${(q.r[7] / 1000).toFixed(2)} kN`, q.r[7] > 0 ? "#1f5fa8" : "#c0392b"); }
  // legend
  const L = [];
  if (v.legend) { const lx = W - padR + 30; let ly = padT + 10;
    if (v.mode === "model" || v.mode === "reactions" || v.mode === "deformed") { for (const [kk, [col, nm]] of Object.entries(GRP)) { if (!M.bars.some(b => grpOf(b) === kk)) continue; L.push(`<line x1="${lx}" y1="${ly}" x2="${lx + 40}" y2="${ly}" stroke="${v.mode === "model" ? col : "#c8c8c8"}" stroke-width="5"/><text x="${lx + 52}" y="${ly + 6}" font-size="18" font-family="Arial">${v.mode === "model" ? nm : "Undeformed"}</text>`); ly += 30; if (v.mode !== "model") break; }
      if (v.mode === "deformed") L.push(`<line x1="${lx}" y1="${ly}" x2="${lx + 40}" y2="${ly}" stroke="#c0392b" stroke-width="4"/><text x="${lx + 52}" y="${ly + 6}" font-size="18" font-family="Arial">Deformed (x${Math.round(v._k)})</text>`);
      if (v.mode === "reactions") L.push(`<text x="${lx}" y="${ly + 10}" font-size="17" font-family="Arial" fill="#1f5fa8">Blue: down (compression)</text><text x="${lx}" y="${ly + 36}" font-size="17" font-family="Arial" fill="#c0392b">Red: uplift</text>`);
      L.push(`<path d="M${lx + 20} ${ly + 60} l-9 15 h18 z" fill="#222"/><text x="${lx + 52}" y="${ly + 74}" font-size="18" font-family="Arial">Pinned support</text>`); }
    else { const steps = 10; for (let i = 0; i <= steps; i++) { const t = 1 - i / steps, val = vmin + (vmax - vmin) * t;
        const col = v.mode === "axial" ? (val > 0 ? `rgb(${Math.round(255 - 200 * val / vmax)},${Math.round(255 - 170 * val / vmax)},255)` : `rgb(255,${Math.round(255 - 210 * (-val / vmax))},${Math.round(255 - 220 * (-val / vmax))})`) : colorRamp(t);
        L.push(`<rect x="${lx}" y="${ly + i * 30}" width="40" height="30" fill="${col}" stroke="#666"/><text x="${lx + 52}" y="${ly + i * 30 + 21}" font-size="17" font-family="Arial">${v.mode === "ratio" ? val.toFixed(1) : (v.mode === "axial" ? (val > 0 ? "C " : val < 0 ? "T " : "") + Math.abs(val).toFixed(2) : val.toFixed(2))}</text>`); }
      L.push(`<text x="${lx}" y="${ly + (steps + 1) * 30 + 26}" font-size="17" font-family="Arial">${v.mode === "ratio" ? "Utilisation (AISC 360)" : v.mode === "axial" ? "Axial force kN (C / T)" : "Bending moment kNm"}</text>`); } }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>
<text x="${padL}" y="42" font-size="28" font-weight="bold" font-family="Arial" fill="#1f2a3f">${esc(v.title)}</text>
<text x="${padL}" y="70" font-size="18" font-family="Arial" fill="#555">${esc(v.sub || (v.case ? `${cname[v.case]} - from Robot results, model ${path.basename(mf)}` : `from Robot model, ${M.nodes.length} nodes / ${M.bars.length} members`))}</text>
${g.join("\n")}${L.join("\n")}
<text x="${W - 20}" y="${H - 18}" text-anchor="end" font-size="15" font-family="Arial" fill="#888">Samaya Factory - Robot Structural Analysis 2026 results, units kN, kNm, mm</text></svg>`;
  return { svg, W, H };
}
const DEF = [
  { name: "01_model", mode: "model", title: "Analysis model - segment from the open end", legend: true },
  { name: "02_defl_W1", mode: "deformed", case: 8, title: "Deformed shape - SLS D + 0.6 W1 (wind from street)", legend: true },
  { name: "03_defl_W3", mode: "deformed", case: 14, title: "Deformed shape - SLS D + 0.6 W3 (free-end zone, case C)", legend: true },
  { name: "04_moment_W1", mode: "moment", case: 6, title: "Bending moment - ULS 1.2D + 1.0 W1", legend: true },
  { name: "05_moment_W3", mode: "moment", case: 12, title: "Bending moment - ULS 1.2D + 1.0 W3 (open end)", legend: true },
  { name: "06_axial_W3", mode: "axial", case: 12, title: "Axial force - ULS 1.2D + 1.0 W3 (open end)", legend: true },
  { name: "07_ratio", mode: "ratio", title: "Member utilisation - ULS envelope (AISC 360-16 LRFD)", sub: "Highest ratio over all ULS combinations, same check as section 5.2", legend: true },
  { name: "08_reactions_W1", mode: "reactions", case: 6, title: "Support reactions Fz - ULS 1.2D + 1.0 W1", legend: true },
];
const V = vf ? JSON.parse(fs.readFileSync(vf, "utf8")) : DEF;
const edge = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(p => fs.existsSync(p));
const res = [];
for (const v of V) {
  const { svg, W, H } = draw(v), sf = path.resolve(out, v.name + ".svg"), pf = path.resolve(out, v.name + ".png");
  fs.writeFileSync(sf, svg);
  if (edge) execFileSync(edge, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2", `--window-size=${W},${H}`, `--screenshot=${pf}`, "file:///" + sf.replace(/\\/g, "/")], { stdio: "ignore" });
  res.push({ name: v.name, png: fs.existsSync(pf) ? pf : null, px: `${W * 2}x${H * 2}`, extra: v._dmax ? `max displacement ${v._dmax.toFixed(1)} mm` : "" });
}
console.log(JSON.stringify(res, null, 1));
