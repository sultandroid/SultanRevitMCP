// Build a LOCAL retrieval index from a licensed code PDF (text never goes into git).
// Usage: node extract.mjs <code-id> <file.pdf> [--offset N] [--lib DIR]
//   code-id : e.g. sbc-301-2018-ar
//   --offset: PDF page number of printed page 1 (SBC 301-AR-18: 16), so chunks carry the printed page too
//   --lib   : library folder (default %USERPROFILE%/code-library). Writes <lib>/<code-id>/pages.jsonl and chunks.jsonl
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
const args = process.argv.slice(2);
const [id, pdf] = args;
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const offset = +opt("--offset", 1), lib = opt("--lib", path.join(os.homedir(), "code-library"));
if (!id || !pdf) { console.error("usage: node extract.mjs <code-id> <file.pdf> [--offset N] [--lib DIR]"); process.exit(1); }
const out = path.join(lib, id); fs.mkdirSync(out, { recursive: true });
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdf)), useSystemFonts: true, disableFontFace: true }).promise;
const pages = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p), tc = await page.getTextContent();
  // group items into lines by y, keep reading order right-to-left for Arabic lines
  const rows = new Map();
  for (const it of tc.items) { if (!it.str || !it.str.trim()) continue; const y = Math.round(it.transform[5] / 3) * 3; if (!rows.has(y)) rows.set(y, []); rows.get(y).push({ x: it.transform[4], s: it.str }); }
  const lines = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, its]) => {
    const ar = its.some(i => /[؀-ۿ]/.test(i.s));
    return its.sort((a, b) => ar ? b.x - a.x : a.x - b.x).map(i => i.s).join(" ").replace(/\s+/g, " ").trim(); });
  pages.push({ pdf_page: p, printed_page: p - offset + 1, text: lines.join("\n").replace(/(\d{1,2}) - (?=\d)/g, "$1-") });   // "29 - 8" -> "29-8"
}
fs.writeFileSync(path.join(out, "pages.jsonl"), pages.map(p => JSON.stringify(p)).join("\n"));
// chunks: split each page at section numbers (e.g. 29-8, 26-7-4-1) or every ~900 characters
const secRe = /(^|\n)\s*((?:\d{1,2}-){1,4}\d{1,2})\s/g;
const chunks = [];
for (const p of pages) {
  const cuts = [0]; let m; secRe.lastIndex = 0; while ((m = secRe.exec(p.text))) cuts.push(m.index + m[1].length);
  cuts.push(p.text.length);
  for (let i = 0; i + 1 < cuts.length; i++) {
    let t = p.text.slice(cuts[i], cuts[i + 1]).trim(); if (t.length < 20) continue;
    const sec = (t.match(/^((?:\d{1,2}-){1,4}\d{1,2})\s/) || [])[1] || null;
    while (t.length) { chunks.push({ id: `${id}:${p.pdf_page}:${chunks.length}`, code: id, section: sec, pdf_page: p.pdf_page, printed_page: p.printed_page, text: t.slice(0, 1200) }); t = t.slice(1200); }
  }
}
fs.writeFileSync(path.join(out, "chunks.jsonl"), chunks.map(c => JSON.stringify(c)).join("\n"));
fs.writeFileSync(path.join(out, "source.json"), JSON.stringify({ id, pdf: path.resolve(pdf), pages: doc.numPages, offset, built: new Date().toISOString(), note: "Licensed text for local use only - never commit or publish." }, null, 1));
const empty = pages.filter(p => p.text.length < 30).length;
console.log(JSON.stringify({ out, pages: doc.numPages, chunks: chunks.length, pages_without_text: empty }));
