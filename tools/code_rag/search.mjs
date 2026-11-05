// Search our committed code notes (knowledge/codes) and, if present, the LOCAL full-text index (code-library).
// Usage: node search.mjs "<query>" [--code sbc-301-2018] [--k 8] [--lib DIR]
// Ranking: BM25 over Arabic + English tokens; section numbers (29-8, 26.7.4) match exactly.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
const args = process.argv.slice(2), q = args[0] || "";
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const code = opt("--code", ""), K = +opt("--k", 8), lib = opt("--lib", path.join(os.homedir(), "code-library"));
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const norm = s => s.toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/(\d+)\.(\d+)/g, "$1-$2");
const tok = s => norm(s).match(/(?:\d+-)+\d+|[؀-ۿ]{2,}|[a-z]{2,}|\d+(?:\.\d+)?/g) || [];
const docs = [];
// 1. our notes (committed): knowledge/codes/<code>/notes.jsonl
const kdir = path.join(repo, "knowledge", "codes");
if (fs.existsSync(kdir)) for (const c of fs.readdirSync(kdir)) { if (code && !c.startsWith(code)) continue; const f = path.join(kdir, c, "notes.jsonl");
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split("\n")) if (l.trim()) { const n = JSON.parse(l); docs.push({ src: "note", code: c, ref: `${n.section} p.${n.printed_page}`, text: `${n.topic}. ${n.summary} ${(n.keywords || []).join(" ")} ${n.section}` , n }); } }
// 2. local full text (not in git)
if (fs.existsSync(lib)) for (const c of fs.readdirSync(lib)) { if (code && !c.startsWith(code)) continue; const f = path.join(lib, c, "chunks.jsonl");
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split("\n")) if (l.trim()) { const ch = JSON.parse(l); docs.push({ src: "text", code: c, ref: `${ch.section || "-"} p.${ch.printed_page} (pdf ${ch.pdf_page})`, text: ch.text }); } }
const T = docs.map(d => tok(d.text)), N = T.length, avg = T.reduce((a, t) => a + t.length, 0) / Math.max(1, N), df = new Map();
for (const t of T) for (const w of new Set(t)) df.set(w, (df.get(w) || 0) + 1);
const qt = tok(q), k1 = 1.4, b = 0.75;
const score = T.map((t, i) => { const tf = new Map(); for (const w of t) tf.set(w, (tf.get(w) || 0) + 1); let s = 0;
  for (const w of qt) { const f = tf.get(w) || 0; if (!f) continue; const idf = Math.log(1 + (N - df.get(w) + 0.5) / (df.get(w) + 0.5)); s += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * t.length / avg)); }
  return { i, s: s * (docs[i].src === "note" ? 1.5 : 1) }; }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, K);
for (const { i, s } of score) { const d = docs[i]; console.log(`\n[${d.src}] ${d.code}  ${d.ref}  score ${s.toFixed(2)}\n${d.src === "note" ? `${d.n.topic}: ${d.n.summary}` : d.text.slice(0, 500)}`); }
if (!score.length) console.log("no match");
