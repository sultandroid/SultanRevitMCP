// Samaya Factory calculation note builder (docx), style: samaya-doc-style-guide/projects/factory-technical (v1.0).
// Usage: node build_calc_note.mjs <spec.json>      then: powershell -File docx_to_pdf.ps1 -Docx <out.docx> -Pdf <out.pdf>
// Spec: { out_docx, meta: {...}, body: [ {h1}|{h2}|{h3}|{p}|{note:{label,text}}|{table:{head,rows,widths,size,caption}}|{img:{path,width_mm,caption}}|{pagebreak:true} ] }
// Images are embedded at full resolution and Word is told not to compress them (hi-res figures in the PDF).
import fs from "node:fs";
import path from "node:path";
import sizeOf from "image-size";
import JSZip from "jszip";
import { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, TableOfContents, HeadingLevel, PageBreak, VerticalAlign, TableLayoutType, StyleLevel } from "docx";

const C = { navy: "061428", accent: "1E5A9E", light: "3B82C4", dark: "334155", muted: "6B6B6B", band: "F1F5F9", rule: "CBD5E1", pass: "1E7B34", fail: "B01E2F" };
const FONT = "Calibri", USABLE_MM = 165;
const mm = v => Math.round(v * 56.7);                 // twips
const px = v => Math.round(v / 25.4 * 96);           // mm -> px at 96 dpi (docx image units)
const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const M = spec.meta;

const run = (text, o = {}) => new TextRun({ text: String(text ?? ""), font: FONT, size: Math.round((o.size ?? 10) * 2), bold: o.bold, italics: o.italic, color: o.color ?? "000000" });
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], alignment: o.align ?? AlignmentType.JUSTIFIED,
  spacing: { before: Math.round((o.before ?? 0) * 20), after: Math.round((o.after ?? 6) * 20), line: o.line ?? 276 }, keepNext: o.keepNext, keepLines: o.keepLines,
  heading: o.heading, pageBreakBefore: o.pageBreakBefore, border: o.border, bidirectional: o.rtl });
const img = (p, wmm, maxHmm) => { const d = sizeOf(fs.readFileSync(p)); let w = px(wmm), h = Math.round(w * d.height / d.width);
  if (maxHmm && h > px(maxHmm)) { h = px(maxHmm); w = Math.round(h * d.width / d.height); }
  return new ImageRun({ type: path.extname(p).slice(1).toLowerCase() === "jpg" ? "jpg" : path.extname(p).slice(1).toLowerCase(), data: fs.readFileSync(p), transformation: { width: w, height: h } }); };
const noBorders = { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } };
const line = { style: BorderStyle.SINGLE, size: 4, color: C.rule };
const gridBorders = { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line };

// result colouring: OK green, FAILS red, ratio > 1 red
function cellRun(text, head, size, isHead) {
  const t = String(text ?? "");
  if (isHead) return run(t, { size, bold: true, color: "FFFFFF" });
  if (/^(OK|PASS)\b/i.test(t)) return run(t, { size, bold: true, color: C.pass });
  if (/^(FAILS|FAIL|NOT OK|NOT ADEQUATE)\b/i.test(t) || /\bFAILS\b/.test(t)) return run(t, { size, bold: true, color: C.fail });
  if (/ratio|interaction|util/i.test(head) && /^\d+(\.\d+)?$/.test(t) && +t > 1.0) return run(t, { size, bold: true, color: C.fail });
  return run(t, { size });
}
function table({ head, rows, widths, size = 8.5, caption, align }) {
  const n = head.length; let w = widths && widths.length === n ? widths.slice() : Array(n).fill(USABLE_MM / n);
  const k = USABLE_MM / w.reduce((a, b) => a + b, 0); w = w.map(v => v * k);
  const numeric = head.map((_, c) => rows.length > 0 && rows.every(r => /^[-+]?[\d.,/ ]+(%| kN| kPa| mm| m)?$|^-$|^OK|^FAILS/.test(String(r[c] ?? ""))));
  const last = rows.length - 1;   // keep the whole table on one page: every row keeps with the next (Word still breaks a table longer than a page)
  const mk = (cells, isHead, i) => new TableRow({ tableHeader: isHead, cantSplit: true, children: cells.map((t, c) => new TableCell({
    width: { size: mm(w[c]), type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    shading: isHead ? { type: ShadingType.CLEAR, fill: C.navy, color: "auto" } : (i % 2 ? { type: ShadingType.CLEAR, fill: C.band, color: "auto" } : undefined),
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    children: [new Paragraph({ alignment: isHead || numeric[c] || (align && align[c] === "c") ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { before: 0, after: 0, line: 240 }, keepNext: isHead || i < last, keepLines: true, children: [cellRun(t, head[c], size, isHead)] })] })) });
  const out = [];
  if (caption) out.push(para(run(caption, { size: 9, italic: true, color: C.muted }), { align: AlignmentType.LEFT, before: 4, after: 3, keepNext: true }));
  out.push(new Table({ layout: TableLayoutType.FIXED, width: { size: mm(USABLE_MM), type: WidthType.DXA }, columnWidths: w.map(mm), borders: gridBorders, rows: [mk(head, true, 0), ...rows.map((r, i) => mk(r, false, i))] }));
  out.push(para(run(""), { after: 4 }));
  return out;
}

// ---------- cover ----------
const cover = [];
cover.push(para(img(M.logo, 70), { align: AlignmentType.CENTER, before: 10, after: 18 }));
cover.push(para(run(M.title.toUpperCase(), { size: 24, bold: true, color: C.navy }), { align: AlignmentType.CENTER, after: 4 }));
cover.push(para(run(M.subtitle, { size: 13, color: C.accent }), { align: AlignmentType.CENTER, after: 14, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.accent, space: 8 } } }));
if (M.project_ar) cover.push(para(run(M.project_ar, { size: 14, bold: true, color: C.navy }), { align: AlignmentType.CENTER, after: 2, rtl: true }));
cover.push(para(run(M.project_en, { size: 12, color: C.dark }), { align: AlignmentType.CENTER, after: 2 }));
cover.push(para(run(`Project No. ${M.project_no}`, { size: 10.5, color: C.muted }), { align: AlignmentType.CENTER, after: 14 }));
cover.push(para(run("CLIENT", { size: 8, bold: true, color: C.muted }), { align: AlignmentType.CENTER, after: 4 }));
if (M.client_logo) cover.push(para(img(M.client_logo, 50, 28), { align: AlignmentType.CENTER, after: 4 }));
if (M.client_ar) cover.push(para(run(M.client_ar, { size: 11, bold: true }), { align: AlignmentType.CENTER, after: 0, rtl: true }));
cover.push(para(run(M.client_en, { size: 10 }), { align: AlignmentType.CENTER, after: 12 }));
cover.push(...table({ head: ["Item", "Value"], rows: M.control, widths: [45, 120], size: 9 }));
if (M.software_logo) { cover.push(para(run("ANALYSIS SOFTWARE", { size: 8, bold: true, color: C.muted }), { align: AlignmentType.CENTER, before: 6, after: 3 }));
  cover.push(para(img(M.software_logo, 55), { align: AlignmentType.CENTER, after: 4 })); }
cover.push(para(run(`Samaya Factory  |  samaya-factory.com  |  ${M.status}`, { size: 8.5, color: C.muted }), { align: AlignmentType.CENTER, before: 6, after: 0 }));

// ---------- front matter ----------
const front = [para(run("DOCUMENT CONTROL", { size: 14, bold: true, color: C.navy }), { pageBreakBefore: true, align: AlignmentType.LEFT, after: 6, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.rule, space: 2 } } })];
front.push(...table({ head: ["Rev", "Date", "Status", "Change"], rows: M.revisions, widths: [12, 22, 33, 98], size: 9, caption: "Revision history" }));
if (M.signoff) front.push(...table({ head: ["Role", "Name", "Signature", "Date"], rows: M.signoff, widths: [40, 55, 40, 30], size: 9, caption: "Sign-off" }));
front.push(para(run("CONTENTS", { size: 14, bold: true, color: C.navy }), { before: 14, align: AlignmentType.LEFT, after: 6, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.rule, space: 2 } } }));
front.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }));

// ---------- body ----------
const body = [];
let fig = 0;
for (const [bi, b] of spec.body.entries()) {
  const nx = spec.body[bi + 1] || {}, lead = !!(nx.table || nx.img || nx.list);   // a lead-in paragraph stays with its table, figure or list
  if (b.h1) body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: !b.noBreak, keepNext: true, children: [run(b.h1.toUpperCase(), { size: 14, bold: true, color: C.navy })], spacing: { before: 0, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.rule, space: 2 } } }));
  else if (b.h2) body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [run(b.h2, { size: 11.5, bold: true, color: C.accent })], spacing: { before: 240, after: 80 } }));
  else if (b.h3) body.push(new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: [run(b.h3, { size: 10.5, bold: true, color: C.dark })], spacing: { before: 160, after: 60 } }));
  else if (b.p != null) body.push(para(run(b.p, { size: b.size ?? 10, bold: b.bold }), { keepNext: b.keepNext ?? lead }));
  else if (b.list) b.list.forEach((t, i) => body.push(para([run(`${i + 1}.  `, { bold: true, color: C.accent }), run(t)], { after: 3 })));
  else if (b.note) body.push(new Paragraph({ children: [run((b.note.label || "NOTE") + "   ", { bold: true, color: C.accent }), run(b.note.text, { color: C.dark })], spacing: { before: 120, after: 120 }, indent: { left: 160 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: C.light, space: 8 } } }));
  else if (b.table) body.push(...table(b.table));
  else if (b.img) { body.push(para(img(b.img.path, b.img.width_mm ?? USABLE_MM, b.img.max_h_mm ?? 205), { align: AlignmentType.CENTER, before: 4, after: 2, keepNext: !!b.img.caption, keepLines: true }));
    if (b.img.caption) body.push(para(run(b.img.caption, { size: 9, italic: true, color: C.muted }), { align: AlignmentType.CENTER, after: 8 })); }
  else if (b.pagebreak) body.push(new Paragraph({ children: [new PageBreak()] }));
}

// ---------- header / footer ----------
const hdr = new Header({ children: [new Table({ layout: TableLayoutType.FIXED, width: { size: mm(USABLE_MM), type: WidthType.DXA }, columnWidths: [mm(30), mm(95), mm(40)],
  borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 4, color: C.rule } }, rows: [new TableRow({ children: [
    new TableCell({ width: { size: mm(30), type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [img(M.logo, 25)] })] }),
    new TableCell({ width: { size: mm(95), type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [run(M.header_title || M.title, { size: 7.5, bold: true, color: C.navy })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [run(M.header_sub || M.project_en, { size: 7.5, color: C.muted })] })] }),
    new TableCell({ width: { size: mm(40), type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [
      new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [run(M.doc_no, { size: 7.5, bold: true, color: C.navy })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [run(`Rev ${M.rev}  -  ${M.date}`, { size: 7.5, color: C.muted })] })] }) ] })] })] });
const ftr = new Footer({ children: [new Paragraph({ tabStops: [{ type: "center", position: mm(USABLE_MM / 2) }, { type: "right", position: mm(USABLE_MM) }],
  border: { top: { style: BorderStyle.SINGLE, size: 6, color: C.navy, space: 4 } },
  children: [run(M.doc_no, { size: 8, color: C.muted }), new TextRun({ font: FONT, size: 16, color: C.muted, children: ["\tPage ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] }), run("\tSamaya Factory", { size: 8, color: C.muted })] })] });

const doc = new Document({
  creator: "Samaya Factory", title: `${M.doc_no} ${M.title}`, description: M.subtitle,
  features: { updateFields: true },
  styles: { default: { document: { run: { font: FONT, size: 20 } } },
    paragraphStyles: [{ id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 28, bold: true, color: C.navy } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 23, bold: true, color: C.accent } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 21, bold: true, color: C.dark } }] },
  sections: [{ properties: { titlePage: true, page: { size: { width: mm(210), height: mm(297) }, margin: { top: mm(25), bottom: mm(20), left: mm(25), right: mm(20), header: mm(12), footer: mm(10) } } },
    headers: { default: hdr, first: new Header({ children: [new Paragraph("")] }) }, footers: { default: ftr, first: new Footer({ children: [new Paragraph("")] }) },
    children: [...cover, ...front, ...body] }],
});
let buf = await Packer.toBuffer(doc);
// keep pictures at full resolution: <w:doNotAutoCompressPictures/>
const zip = await JSZip.loadAsync(buf), sx = await zip.file("word/settings.xml").async("string");
if (!sx.includes("doNotAutoCompressPictures")) zip.file("word/settings.xml", sx.replace(/<w:settings([^>]*)>/, "<w:settings$1><w:doNotAutoCompressPictures/>"));
buf = await zip.generateAsync({ type: "nodebuffer" });
fs.writeFileSync(spec.out_docx, buf);
console.log("docx", spec.out_docx, (buf.length / 1e6).toFixed(1) + " MB", spec.body.length, "blocks");
