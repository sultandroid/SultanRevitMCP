// Builds the Samaya Factory Revit project template: title blocks A0 to A3 (ISO 5457 frame, the A1 layout scaled to each size),
// the house dimension style (ISO 129-1, blue), text types, line styles, levels, revision numbering, and a read-me view.
// Usage (Revit open, bridge running): node tools/samaya_template.mjs
// Output: OUT_DIR/Samaya Factory.rte and OUT_DIR/Title Blocks/Samaya Factory A0..A3.rfa. Then copy them into this repo's template/ folder.
import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { call } from "./rvt.mjs";
import { S, ensureStyles } from "./standards.mjs";
import { SIZES, spec as tbSpec } from "./title_block_spec.mjs";

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

// Title block layout: tools/title_block_spec.mjs (shared with client-factory title blocks).
const BRAND = { owner: "Samaya Factory", footer: "samaya-factory.com", logo: OUT_DIR + "Title Blocks/samaya-factory-logo-black.png" };
const spec = (name, SW, SH, SWID) => tbSpec({ name, SW, SH, SWID, source_rfa: SOURCE, save_path: `${OUT_DIR}Title Blocks/${name}.rfa`, brand: BRAND });

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
// Dimension style from standards/sultan-standards.json (ISO 129-1). Revit colours are BGR integers: blue is 255 * 65536.
const D = S.dimensions, bgr = ([r, g, b]) => b * 65536 + g * 256 + r;
if (arrow) { await setd("Tick Mark", arrow); await call("set_parameter", { element_id: arrow, parameter_name: "Tick Size", value: `${D.arrow_mm} mm` }).catch(() => {}); }
for (const [n, v] of [["Text Size", `${D.text_mm} mm`], ["Text Font", D.font], ["Color", bgr(D.color)], ["Line Weight", 1], ["Tick Mark Line Weight", 1], ["Text Offset", "1.5 mm"], ["Witness Line Gap to Element", `${D.witness_gap_mm} mm`], ["Witness Line Extension", `${D.witness_extension_mm} mm`], ["Dimension Line Extension", "0 mm"], ["Text Background", 0]]) await setd(n, v);

// 5. Text types and line styles: every one in the standards file (ISO 128 meaning; thick to thin at least 2:1).
await ensureStyles(call);

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
