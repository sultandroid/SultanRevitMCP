// Draws DXFs written by dxf.mjs to one SVG (bulges as SVG arcs), for an eye check.
import { readFileSync, writeFileSync } from "node:fs";
const files = process.argv.slice(3), out = process.argv[2]; let X = 20, parts = [];
for (const f of files) {
  const t = readFileSync(f, "utf8").split(/\r?\n/), ents = []; let cur = null;
  for (let i = 0; i < t.length - 1; i += 2) { const c = t[i].trim(), v = t[i + 1];
    if (c === "0") { if (v === "POLYLINE") cur = { k: "P", v: [] }, ents.push(cur); else if (v === "VERTEX") cur?.v.push({ b: 0 }); else if (v === "CIRCLE") ents.push(cur = { k: "C" }); else if (v === "SEQEND" || v === "TEXT" || v === "LINE") cur = v === "SEQEND" ? null : (ents.push({ k: v }), null); continue; }
    if (!cur) continue; const last = cur.k === "P" ? cur.v[cur.v.length - 1] : cur;
    if (!last) continue; if (c === "10") last.x = +v; if (c === "20") last.y = +v; if (c === "42") last.b = +v; if (c === "40") last.r = +v; }
  let w = 0, h = 0; for (const e of ents) for (const p of e.k === "P" ? e.v : e.k === "C" ? [e] : []) { w = Math.max(w, p.x); h = Math.max(h, p.y); }
  parts.push({ f, ents, X, w, h }); X += w + 80;
}
const H = Math.max(...parts.map((p) => p.h)) + 60, s = (y) => H - 20 - y;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${X}" height="${H}" viewBox="0 0 ${X} ${H}" style="background:#fff">`;
for (const p of parts) { for (const e of p.ents) {
  if (e.k === "C") svg += `<circle cx="${p.X + e.x}" cy="${s(e.y)}" r="${e.r}" fill="none" stroke="green" stroke-width="1.5"/>`;
  if (e.k === "P") { let d = `M ${p.X + e.v[0].x} ${s(e.v[0].y)}`; for (let k = 0; k < e.v.length; k++) { const a = e.v[k], b = e.v[(k + 1) % e.v.length]; if (Math.abs(a.b) > 1e-9) { const th = 4 * Math.atan(Math.abs(a.b)), ch = Math.hypot(b.x - a.x, b.y - a.y), r = ch / (2 * Math.sin(th / 2)); d += ` A ${r} ${r} 0 ${th > Math.PI ? 1 : 0} ${a.b > 0 ? 0 : 1} ${p.X + b.x} ${s(b.y)}`; } else d += ` L ${p.X + b.x} ${s(b.y)}`; } svg += `<path d="${d} Z" fill="none" stroke="red" stroke-width="3"/>`; } }
  svg += `<text x="${p.X}" y="${H - 2}" font-size="22">${p.f.split("/").pop()}</text>`; }
writeFileSync(out, svg + "</svg>");
