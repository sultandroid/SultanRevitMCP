// Samaya Factory A1 title block, from the labels of A1 metric_Samaya. Coordinates are sheet mm on a 1192 x 841 sheet.
import { call } from "./rvt.mjs";

const ROOT = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/";
const RFA = ROOT + "Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 1/Revit Files/Rfa/Title Blocks/";
const NAVY = { r: 15, g: 47, b: 82 }, BLUE = { r: 30, g: 90, b: 158 }, WHITE = { r: 254, g: 254, b: 254 }, INK = { r: 25, g: 35, b: 45 }, RULE = { r: 184, g: 199, b: 214 };
const L = 1022, R = 1182, M = 1102, X = L + 5, W = 10, T = 831, B = 10;
const P = (x, y) => ({ x, y, z: 0 });
const rect = (a, b, y0, y1, color) => ({ points: [P(a, y0), P(b, y0), P(b, y1), P(a, y1)], color });
const line = (x1, y1, x2, y2) => ({ start: P(x1, y1), end: P(x2, y2) });
const head = (text, x, y, color = BLUE) => ({ text, at: P(x, y), size_mm: 2.5, color, bold: true });
const ROWS = [741, 691, 641, 471, 371, 281, 241, 186, 146, 116, 86, 56, 24];

const spec = {
  source_rfa: ROOT + "Assetes/Revit Familes/Title Block/A1 metric_Samaya.rfa",
  save_path: RFA + "Samaya Factory A1.rfa",
  regions: [
    rect(L, R, 146, 186, BLUE), rect(L, R, B, 24, NAVY),
    ...[[W, B, R, B, 1], [R, B, R, T, 1], [W, T, R, T, 1], [W, B, W, T, 1], [L, B, L, T, 1]].map(([x0, y0, x1, y1, t]) => (y0 === y1 ? rect(x0, x1, y0 - t / 2, y0 + t / 2, BLUE) : rect(x0 - t / 2, x0 + t / 2, y0, y1, BLUE))),
    ...ROWS.map((y) => rect(L, R, y - 0.45, y + 0.45, RULE)),
    rect(M - 0.45, M + 0.45, 56, 146, RULE),
  ],
  images: [{ path: RFA + "samaya-factory-logo-navy.png", center: P((L + R) / 2, 786), width_mm: 159 }],
  texts: [
    head("CLIENT", X, 737), head("CONSULTANT", X, 687), head("NOTES", X, 637), head("KEY PLAN", X, 467), head("REVISIONS", X, 367),
    head("PROJECT", X, 277), head("DRAWING TITLE", X, 237),
    head("DRAWING NO.", X, 182, WHITE), head("REV", 1154, 182, WHITE),
    head("SCALE", X, 142), head("DATE", M + 5, 142), head("DESIGNED BY", X, 112), head("CHECKED BY", M + 5, 112), head("APPROVED BY", X, 82), head("PROJECT NO.", M + 5, 82),
    { text: "This drawing is the property of Samaya Factory. Do not scale. Check all dimensions on site before fabrication.", at: P(X, 51), size_mm: 2, color: INK },
    { text: "samaya-factory.com", at: P(X, 20), size_mm: 3, color: WHITE, bold: true },
  ],
  labels: [
    { match: "Client Name", at: P(X, 722), size_mm: 3.5, color: INK },
    { match: "Project Name", at: P(X, 265), size_mm: 3.5, color: INK, bold: true },
    { match: "Sheet Name", at: P(X, 225), size_mm: 4, color: INK, bold: true },
    { match: "A101", at: P(X, 172), size_mm: 7, color: WHITE, bold: true },
    { match: "Current Revision", at: P(1154, 172), size_mm: 5, color: WHITE, bold: true },
    { match: '1/8" = 1\'-0"', at: P(X, 132), size_mm: 3, color: INK },
    { match: "Project Issue Date", at: P(M + 5, 132), size_mm: 3, color: INK },
    { match: "DSG", at: P(X, 102), size_mm: 3, color: INK },
    { match: "CHK", at: P(M + 5, 102), size_mm: 3, color: INK },
    { match: "APR", at: P(X, 72), size_mm: 3, color: INK },
    { match: "Project Number", at: P(M + 5, 72), size_mm: 3, color: INK },
  ],
};
const i = await call("get_project_info");
if (i.title !== "Madina1_ARCH_02") throw new Error("Active document is: " + i.title);
const r = await call("build_title_block", spec);
console.log(JSON.stringify(r));
const tid = r.types[0];
if ((await call("query_elements", { category: "OST_Sheets", limit: 50 })).elements.some((e) => /Title block check/.test(e.name))) { console.log("reloaded on existing sheet"); process.exit(0); }
const s = await call("create_sheet", { number: "A-000", name: "Title block check", title_block_type_id: tid });
console.log("sheet", JSON.stringify(s));
const inst = (await call("query_elements", { category: "OST_TitleBlocks", limit: 5 })).elements.find((e) => e.family === r.family);
const t = await call("list_family_text", { element_id: inst.id });
const c = {}; for (const x of t.items) c[x.class] = (c[x.class] ?? 0) + 1;
console.log(JSON.stringify(c));
for (const x of t.items.filter((q) => q.class !== "TextNote")) console.log(x.text.trim(), Math.round(x.x), Math.round(x.y));
await call("add_titleblock_revision_schedule", { element_id: inst.id, location: P(L + 1, 362), fields: [{ name: "Revision Number", heading: "REV", width_mm: 16 }, { name: "Revision Description", heading: "DESCRIPTION", width_mm: 104 }, { name: "Revision Date", heading: "DATE", width_mm: 38 }] });
console.log("revision schedule added");
