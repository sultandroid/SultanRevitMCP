// Builds the Samaya Factory Revit project template: title blocks A0 to A3 (ISO 5457 frame, the A1 layout scaled to each size),
// the house dimension style (ISO 129-1, blue), text types, line styles, levels, revision numbering, and a read-me view.
// Usage (Revit open, bridge running): node tools/samaya_template.mjs
// Output: OUT_DIR/Samaya Factory.rte and OUT_DIR/Title Blocks/Samaya Factory A0..A3.rfa. Then copy them into this repo's template/ folder.
import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { call } from "./rvt.mjs";

const ROOT = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/";
const OUT_DIR = ROOT + "Technical Office/Revit Template/";
const SOURCE = ROOT + "Assetes/Revit Familes/Title Block/A1 metric_Samaya.rfa"; // carries the labels the builder moves
const LOGO = new URL("../title-blocks/samaya-factory-logo-black.png", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const BASE_TEMPLATE = "C:/ProgramData/Autodesk/RVT 2026/Templates/English/DefaultMetric.rte";
const TEMPLATE_RVT = OUT_DIR + "Samaya Factory Template.rvt", TEMPLATE_RTE = OUT_DIR + "Samaya Factory.rte";
const BLACK = { r: 0, g: 0, b: 0 }, NL = String.fromCharCode(10);
const P = (x, y) => ({ x, y, z: 0 });
mkdirSync(OUT_DIR + "Title Blocks", { recursive: true });
copyFileSync(LOGO, OUT_DIR + "Title Blocks/samaya-factory-logo-black.png");

// ISO 216 sizes, landscape, with the strip width used on each.
const SIZES = [["A0", 1189, 841, 160], ["A1", 841, 594, 140], ["A2", 594, 420, 120], ["A3", 420, 297, 100]];

// The A1-layout title block (designed on 1192 x 841, strip 160 wide) scaled to one sheet size.
function spec(name, SW, SH, SWID) {
  const R = SW - 10, L = R - SWID, X = L + 5 * (SWID / 160), M = (L + R) / 2, W = 20, T = SH - 10, B = 10;
  const ky = (T - B) / 821, kx = SWID / 160, y = (v) => B + (v - 10) * ky, x = (v) => L + (v - 1022) * kx;
  const f = Math.min(1, Math.max(0.55, ky * 1.3)), size = (s) => Math.round(Math.max(2.6, s * f) * 10) / 10;
  const zone = SH >= 841 ? 100 : 50, COLS = Math.max(2, Math.round((R - W) / zone)), ROWS_Z = Math.max(2, Math.round((T - B) / zone));
  const zw = (R - W) / COLS, zh = (T - B) / ROWS_Z;
  const line = (x1, y1, x2, y2) => ({ start: P(x1, y1), end: P(x2, y2) });
  const head = (text, xx, yy) => ({ text, at: P(xx, yy), size_mm: 2.5, color: BLACK, bold: true });
  const ROWS = [741, 691, 641, 591, 471, 371, 281, 241, 186, 146, 116, 86, 56, 24].map(y);
  const used = new Set(["2.5b", "2n", "3b"]);
  const lab = (match, xx, yy, s, bold = false) => { let z = size(s); while (used.has(z + (bold ? "b" : "n"))) z = Math.round((z + 0.1) * 10) / 10; used.add(z + (bold ? "b" : "n")); return { match, at: P(xx, yy), size_mm: z, color: BLACK, bold }; };
  return {
    source_rfa: SOURCE, save_path: `${OUT_DIR}Title Blocks/${name}.rfa`, sheet_size_mm: { w: SW, h: SH },
    lines: [
      line(W, B, R, B), line(R, B, R, T), line(R, T, W, T), line(W, T, W, B), line(L, B, L, T),
      ...ROWS.map((yy) => line(L, yy, R, yy)), line(M, y(56), M, y(146)),
      line(SW / 2, T, SW / 2, SH), line(SW / 2, 0, SW / 2, B), line(0, SH / 2, W, SH / 2), line(R, SH / 2, SW, SH / 2),
      ...Array.from({ length: COLS + 1 }, (_, k) => line(W + k * zw, T, W + k * zw, T + 5)), ...Array.from({ length: COLS + 1 }, (_, k) => line(W + k * zw, B, W + k * zw, B - 5)),
      ...Array.from({ length: ROWS_Z + 1 }, (_, k) => line(W, B + k * zh, W - 5, B + k * zh)), ...Array.from({ length: ROWS_Z + 1 }, (_, k) => line(R, B + k * zh, R + 5, B + k * zh)),
    ],
    images: [{ path: OUT_DIR + "Title Blocks/samaya-factory-logo-black.png", center: P(M, y(786)), width_mm: Math.round(130 * kx) }],
    texts: [
      head("CLIENT", X, y(737)), head("CONSULTANT", X, y(687)), head("DESIGNER", X, y(637)), head("NOTES", X, y(587)), head("KEY PLAN", X, y(467)), head("REVISIONS", X, y(367)),
      ...Array.from({ length: COLS }, (_, k) => ({ text: String(k + 1), at: P(W + k * zw + zw / 2 - 2, T + 7), size_mm: 2.5, color: BLACK })),
      ...Array.from({ length: COLS }, (_, k) => ({ text: String(k + 1), at: P(W + k * zw + zw / 2 - 2, 7), size_mm: 2.5, color: BLACK })),
      ...Array.from({ length: ROWS_Z }, (_, k) => ({ text: String.fromCharCode(65 + ROWS_Z - 1 - k), at: P(W - 8, B + k * zh + zh / 2 + 2), size_mm: 2.5, color: BLACK })),
      ...Array.from({ length: ROWS_Z }, (_, k) => ({ text: String.fromCharCode(65 + ROWS_Z - 1 - k), at: P(R + 3, B + k * zh + zh / 2 + 2), size_mm: 2.5, color: BLACK })),
      head("PROJECT", X, y(277)), head("DRAWING TITLE", X, y(237)), head("DRAWING NO.", X, y(182)), head("REV", x(1154), y(182)),
      head("SCALE", X, y(142)), head("DATE", M + 5 * kx, y(142)), head("DRAWN BY", X, y(112)), head("CHECKED BY", M + 5 * kx, y(112)), head("APPROVED BY", X, y(82)), head("PROJECT NO.", M + 5 * kx, y(82)),
      { text: SWID >= 160 ? "This drawing is the property of Samaya Factory. Do not scale. Check all dimensions on site before fabrication." : "Property of Samaya Factory. Do not scale." + NL + "Check all dimensions on site.", at: P(X, y(51)), size_mm: 2, color: BLACK },
      { text: "samaya-factory.com", at: P(X, y(20)), size_mm: 3, color: BLACK, bold: true },
    ],
    labels: [
      lab("Client Name", X, y(722), 3.5), lab("Project Name", X, y(265), 3.5, true), lab("Sheet Name", X, y(225), 4, true), lab("A101", X, y(172), 7, true),
      lab("Current Revision", x(1154), y(172), 5, true), lab('1/8" = 1\'-0"', X, y(132), 3), lab("Project Issue Date", M + 5 * kx, y(132), 3.1),
      lab("DSG", X, y(102), 3.2), lab("CHK", M + 5 * kx, y(102), 3.3), lab("APR", X, y(72), 3.4), lab("Project Number", M + 5 * kx, y(72), 3.6),
    ],
    revSchedule: (() => { const rev = Math.max(12, Math.round(16 * kx)), date = Math.max(24, Math.round(38 * kx)); return { location: P(L + 1, y(362)), fields: [{ name: "Revision Number", heading: "REV", width_mm: rev }, { name: "Revision Description", heading: "DESCRIPTION", width_mm: SWID - 2 - rev - date }, { name: "Revision Date", heading: "DATE", width_mm: date }] }; })(),
  };
}

// 1. A new project from the metric template (an earlier build is replaced).
for (const f of [TEMPLATE_RVT, TEMPLATE_RTE]) { try { (await import("node:fs")).unlinkSync(f); } catch {} }
const info = await call("create_project", { path: TEMPLATE_RVT, template_path: BASE_TEMPLATE });
const TITLE = "Samaya Factory Template";
const g = async () => { await call("activate_document", { title: TITLE }); const t = (await call("get_project_info")).title; if (t !== TITLE) throw new Error("active is " + t); };
await g(); console.log("project", info.path ?? info.title);

// 2. Title blocks, each tested on a sheet with its revision schedule, then rendered.
const tests = [];
for (const [sz, SW, SH, SWID] of SIZES) {
  await g();
  const name = `Samaya Factory ${sz}`, s = spec(name, SW, SH, SWID), { revSchedule, ...build } = s;
  const r = await call("build_title_block", build); console.log(name, JSON.stringify(r).slice(0, 120));
  const sheet = (await call("create_sheet", { number: `TEST-${sz}`, name: `Test ${sz}`, title_block_type_id: r.types[0] })).id;
  const tb = (await call("query_elements", { category: "OST_TitleBlocks", view_id: sheet, limit: 5 })).elements[0].id;
  await call("add_titleblock_revision_schedule", { element_id: tb, ...revSchedule }).catch((e) => console.log("rev schedule", e.message.slice(0, 80)));
  tests.push([sz, sheet]);
}

// 3. Levels: FFL with a plan; the default Level 1 and 2 removed. Close levels get the head at one end ("Level Head Left").
await g();
let lv = (await call("list_levels")).levels;
const ffl = lv.find((l) => l.name === "FFL +0.000")?.id ?? (await call("create_level", { name: "FFL +0.000", elevation_mm: 0 })).id;
const old = lv.filter((l) => /^Level \d$/.test(l.name));
if (old.length) { const vs = (await call("list_views", {})).views.filter((v) => old.some((l) => l.name === v.level)).map((v) => v.id); await call("open_view", { view_id: tests[0][1] }); await call("delete_elements", { element_ids: [...vs, ...old.map((l) => l.id)] }); }
await call("create_floor_plan", { level_id: ffl, name: "FFL +0.000" }).catch(() => {});
const lt = (await call("list_element_types", { category: "OST_Levels" })).types[0].id;
await call("duplicate_type", { type_id: lt, name: "Level Head Left" }).then(async (d) => { for (const [p, v] of [["Symbol at End 1 Default", "1"], ["Symbol at End 2 Default", "0"]]) await call("set_parameter", { element_id: d.id, parameter_name: p, value: v }); }).catch(() => {});
for (const [p, v] of [["Symbol at End 1 Default", "0"], ["Symbol at End 2 Default", "1"]]) await call("set_parameter", { element_id: lt, parameter_name: p, value: v }).catch(() => {});

// 4. Dimension style: ISO 129-1, Arial 5 mm blue, filled 30 degree arrows 3.5 mm, extension legs 3 mm gap and 3 mm past.
const dims = (await call("list_element_types", { category: "OST_Dimensions" }).catch(() => ({ types: [] }))).types;
const dimId = dims.find((t) => /Linear|Diagonal/i.test(t.name))?.id ?? 261;
let arrow = null; for (let id = 200; id <= 400 && !arrow; id++) { const e = await call("get_element", { element_id: id }).catch(() => null); if (e && e.name === "Arrow Filled 30 Degree" && e.category == null) arrow = id; }
const setd = (n, v) => call("set_parameter", { element_id: dimId, parameter_name: n, value: v }).catch((e) => console.log("dim", n, e.message.slice(0, 60)));
if (arrow) { await setd("Tick Mark", arrow); await call("set_parameter", { element_id: arrow, parameter_name: "Tick Size", value: "3.5 mm" }).catch(() => {}); }
for (const [n, v] of [["Text Size", "5 mm"], ["Text Font", "Arial"], ["Color", 255 * 65536], ["Line Weight", 1], ["Tick Mark Line Weight", 1], ["Text Offset", "1.5 mm"], ["Witness Line Gap to Element", "3 mm"], ["Witness Line Extension", "3 mm"], ["Dimension Line Extension", "0 mm"], ["Text Background", 0]]) await setd(n, v);

// 5. Text types (sheet sizes) and line styles (ISO 128 meaning; thick to thin at least 2:1).
for (const [n, s, c, b] of [["Sheet Note 5", 5, BLACK, false], ["Sheet Heading 5.5 Bold", 5.5, BLACK, true], ["Keynote 6 Bold", 6, BLACK, true], ["Input Required 5 Red", 5, { r: 230, g: 0, b: 0 }, true], ["Highlight 5.5 Bold Green", 5.5, { r: 0, g: 140, b: 60 }, true]])
  await call("ensure_text_type", { name: n, size_mm: s, color: c, bold: b });
for (const [n, w, c, p] of [["Detail Cut", 5, BLACK], ["Detail Medium", 3, BLACK], ["Detail Thin", 1, BLACK], ["Detail Hidden", 1, BLACK, "Dash"], ["Detail Centre", 1, BLACK, "Dash dot"],
  ["Indicative Outline", 1, { r: 128, g: 128, b: 128 }, "Dash"], ["Key Plan Red", 5, { r: 230, g: 0, b: 0 }], ["Highlight Green", 6, { r: 0, g: 140, b: 60 }], ["Figure Grey", 1, { r: 120, g: 120, b: 120 }], ["Dim Reference Hidden", 1, { r: 254, g: 254, b: 254 }]])
  await call("ensure_line_style", { name: n, weight: w, color: c, ...(p ? { pattern: p } : {}) }).catch(async () => call("ensure_line_style", { name: n, weight: w, color: c }));

// 6. Revisions: two-digit numbers per project; the template's default Revision 1 becomes 00, so a project's first issue is 01.
await call("set_revision_numbering", { start: 0, min_digits: 2, name: "Samaya Rev" }).catch((e) => console.log("rev numbering", e.message.slice(0, 60)));
// Project information stays empty: it comes from the user (or Odoo) on each project.
const pi = (await call("query_elements", { category: "OST_ProjectInformation", limit: 1 })).elements[0].id;
for (const n of ["Client Name", "Project Name", "Project Number", "Project Address", "Project Status"]) await call("set_parameter", { element_id: pi, parameter_name: n, value: " " }).catch(() => {});

// 7. Read-me view: the rules that matter most, in plain English.
const note = (await call("ensure_text_type", { name: "Sheet Note 5", size_mm: 5, color: BLACK })).id;
const head = (await call("ensure_text_type", { name: "Sheet Heading 5.5 Bold", size_mm: 5.5, color: BLACK, bold: true })).id;
const rd = (await call("create_drafting_view", { name: "00 Samaya Factory - Read Me", scale: 1 })).id;
await call("create_text_note", { view_id: rd, location: P(0, 0), text: "SAMAYA FACTORY REVIT TEMPLATE - READ ME", text_type_id: head });
await call("create_text_note", { view_id: rd, location: P(0, -12), text_type_id: note, text: [
  "WRITING",
  "- Write every note in easy English (about a 5th-grade reader). Short sentences.",
  "  Sound like a site engineer. Use a short word where it works.",
  "- Questions for the client, mall or site go in RED (Input Required 5 Red), bottom right.",
  "",
  "SHEETS (read views-and-sheets.md before any sheet)",
  "- Title blocks: Samaya Factory A0, A1, A2, A3 (ISO 216, ISO 5457 frame).",
  "- Grid on A0: 6 columns of 165 mm, lines at 20 186 351 516 682 847 1012.",
  "  Centre views on a column or a column line. Notes and tables start on a line.",
  "- One scale per row. Keep 15 mm clear of the border and the title strip.",
  "- Text 5 mm, headings 5.5 mm bold, keynote numbers 6 mm bold.",
  "- Dimensions: ISO 129-1, blue, filled arrows, extension legs. Strings 12 mm apart.",
  "- Lines: cut thick (Detail Cut), the rest thin. Thick to thin at least 2 to 1.",
  "- Every sheet: key plan in the KEY PLAN panel, revision, sign-off filled.",
  "- Render the sheet and check: nothing overlaps, nothing runs out of its panel.",
  "",
  "MODEL",
  "- Phases: Existing and New Construction. Existing work shows halftone.",
  "- Name levels by what they are: SSL, FFL +0.000, Clear Height +x.xx.",
  "- Revisions: Revit revisions only, two digits (01, 02). Never type a REV by hand.",
  "- Sheet numbers: ISO 19650, for example MD2-SF-ZZ-GF-DR-A-2101.",
  "",
  "Full standards: github.com samaya-revit-standards, skills/samaya-revit."].join(NL) });

// 8. Check each size by rendering its test sheet, then remove the test sheets and save as a template.
for (const [sz, sheet] of tests) { const im = await call("export_view_image", { view_id: sheet, pixel_size: 2400 }); writeFileSync(`${OUT_DIR}check-${sz}.png`, Buffer.from(im.data_base64, "base64")); }
if (process.argv[2] !== "keep-tests") { await g(); await call("open_view", { view_id: rd }); await call("delete_elements", { element_ids: tests.map((t) => t[1]) }); }
await g(); console.log(JSON.stringify(await call("save_document", { title: TITLE })).slice(-60));
console.log("template", JSON.stringify(await call("save_document", { title: TITLE, path: TEMPLATE_RTE }).catch((e) => ({ err: e.message }))));
