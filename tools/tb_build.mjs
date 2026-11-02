// Samaya Factory A1 title block, from the labels of A1 metric_Samaya. Coordinates are sheet mm on a 1192 x 841 sheet.
import { call } from "./rvt.mjs";

const ROOT = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/";
const RFA = ROOT + "Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 1/Revit Files/Rfa/Title Blocks/";
const BLACK = { r: 0, g: 0, b: 0 };
const L = 1022, R = 1182, M = 1102, X = L + 5, W = 10, T = 831, B = 10;
const P = (x, y) => ({ x, y, z: 0 });
const rect = (a, b, y0, y1, color) => ({ points: [P(a, y0), P(b, y0), P(b, y1), P(a, y1)], color });
const line = (x1, y1, x2, y2) => ({ start: P(x1, y1), end: P(x2, y2) });
const head = (text, x, y, color = BLACK) => ({ text, at: P(x, y), size_mm: 2.5, color, bold: true });
const ROWS = [741, 691, 641, 471, 371, 281, 241, 186, 146, 116, 86, 56, 24];

const spec = {
  source_rfa: ROOT + "Assetes/Revit Familes/Title Block/A1 metric_Samaya.rfa",
  save_path: RFA + "Samaya Factory A1.rfa",
  lines: [
    line(W, B, R, B), line(R, B, R, T), line(R, T, W, T), line(W, T, W, B), line(L, B, L, T),
    ...ROWS.map((y) => line(L, y, R, y)),
    line(M, 56, M, 146),
  ],
  images: [{ path: RFA + "samaya-factory-logo-black.png", center: P((L + R) / 2, 786), width_mm: 130 }],
  texts: [
    head("CLIENT", X, 737), head("CONSULTANT", X, 687), head("NOTES", X, 637), head("KEY PLAN", X, 467), head("REVISIONS", X, 367),
    head("PROJECT", X, 277), head("DRAWING TITLE", X, 237),
    head("DRAWING NO.", X, 182), head("REV", 1154, 182),
    head("SCALE", X, 142), head("DATE", M + 5, 142), head("DESIGNED BY", X, 112), head("CHECKED BY", M + 5, 112), head("APPROVED BY", X, 82), head("PROJECT NO.", M + 5, 82),
    { text: "This drawing is the property of Samaya Factory. Do not scale. Check all dimensions on site before fabrication.", at: P(X, 51), size_mm: 2, color: BLACK },
    { text: "samaya-factory.com", at: P(X, 20), size_mm: 3, color: BLACK, bold: true },
  ],
  labels: [
    { match: "Client Name", at: P(X, 722), size_mm: 3.5, color: BLACK },
    { match: "Project Name", at: P(X, 265), size_mm: 3.5, color: BLACK, bold: true },
    { match: "Sheet Name", at: P(X, 225), size_mm: 4, color: BLACK, bold: true },
    { match: "A101", at: P(X, 172), size_mm: 7, color: BLACK, bold: true },
    { match: "Current Revision", at: P(1154, 172), size_mm: 5, color: BLACK, bold: true },
    { match: '1/8" = 1\'-0"', at: P(X, 132), size_mm: 3, color: BLACK },
    { match: "Project Issue Date", at: P(M + 5, 132), size_mm: 3, color: BLACK },
    { match: "DSG", at: P(X, 102), size_mm: 3, color: BLACK },
    { match: "CHK", at: P(M + 5, 102), size_mm: 3, color: BLACK },
    { match: "APR", at: P(X, 72), size_mm: 3, color: BLACK },
    { match: "Project Number", at: P(M + 5, 72), size_mm: 3, color: BLACK },
  ],
};
const i = await call("get_project_info");
if (i.title !== "Madina1_ARCH_02") throw new Error("Active document is: " + i.title);
const r = await call("build_title_block", spec);
console.log(JSON.stringify(r));
const tid = r.types[0];
const inst = (await call("query_elements", { category: "OST_TitleBlocks", limit: 5 })).elements.find((e) => e.family === r.family);
const t = await call("list_family_text", { element_id: inst.id });
const c = {}; for (const x of t.items) c[x.class] = (c[x.class] ?? 0) + 1;
console.log(JSON.stringify(c));
for (const x of t.items.filter((q) => q.class !== "TextNote")) console.log(x.text.trim(), Math.round(x.x), Math.round(x.y));
await call("add_titleblock_revision_schedule", { element_id: inst.id, location: P(L + 1, 362), fields: [{ name: "Revision Number", heading: "REV", width_mm: 16 }, { name: "Revision Description", heading: "DESCRIPTION", width_mm: 104 }, { name: "Revision Date", heading: "DATE", width_mm: 38 }] });
console.log("revision schedule added");
