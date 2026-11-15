// Madina 2 A-2703 Ceiling Rattan Band: 2 junction details at 1:2 (rule: junction detail wherever materials meet), drawn as
// drafting views (a model section did not draw the neighbours on A-2702, see cf1_details.mjs).
// Coordinates: X across the south band from the TF-1 lining inner face (y 1568) toward the room centre, Y = height from the
// C02 board underside (+3.200). Band 8 FR MDF + 3 rattan X 1..421 (1 mm scribe), Ceiling Wood Frame U from X 422.
// Re-run after fab_sheet.mjs RB-1 (it rebuilds the sheet).
import { call as raw } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" }, call = (n, a = {}) => raw(n, { ...D, ...a });
const P = (x, y, z = 0) => ({ x, y, z });
const setv = (id, n, v) => call("set_parameter", { element_id: id, parameter_name: n, value: v }).catch((e) => console.log("set", n, e.message.slice(0, 70)));
let sheet = null;
for (const s of (await call("query_elements", { category: "OST_Sheets", limit: 500 })).elements) {
  const g = await call("get_element", { element_id: s.id }); if (/2703$/.test(g.parameters.find((p) => p.name === "Sheet Number")?.value)) sheet = s.id;
}
for (const v of (await call("list_views", {})).views.filter((v) => /^RB1-D /.test(v.name))) await call("delete_elements", { element_ids: [v.id] }).catch(() => {});
await call("ensure_line_style", { name: "Outline Only - By Others" }).catch(() => {});
const rect = (x0, y0, x1, y1) => [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]];
const L = (a) => a.filter(([x0, y0, x1, y1]) => Math.hypot(x1 - x0, y1 - y0) > 1.5).map(([x0, y0, x1, y1]) => ({ start: P(x0, y0), end: P(x1, y1) }));
const brk = (x, y0, y1) => [[x, y0, x, (y0 + y1) / 2 - 3], [x, (y0 + y1) / 2 - 3, x + 3, (y0 + y1) / 2], [x + 3, (y0 + y1) / 2, x - 3, (y0 + y1) / 2 + 2], [x - 3, (y0 + y1) / 2 + 2, x, (y0 + y1) / 2 + 5], [x, (y0 + y1) / 2 + 5, x, y1]];
const dim = (v, pts) => call("create_dimension_string", { view_id: v, points: pts, tick_mm: 2 }).catch((e) => console.log("dim", e.message.slice(0, 90)));
async function detail(name, title, x0, x1, ours, others, dims) {
  const v = (await call("create_drafting_view", { name, scale: 2 })).id;
  await setv(v, "Title on Sheet", title);
  await call("create_detail_lines", { view_id: v, lines: L(ours) });
  await call("create_detail_lines", { view_id: v, lines: L(others), line_style: "Outline Only - By Others" });
  for (const d of dims) await dim(v, d);
  return v;
}
// shared parts, clipped to the detail window
const band = (a, b) => [...rect(Math.max(1, a), -8, Math.min(421, b), 0), ...rect(Math.max(1, a), -11, Math.min(421, b), -8)];
const board = (a, b) => rect(a, 0, b, 12.5);
const chan = (c) => rect(c - 30, 12.5, c + 30, 39.5);
const screw = (x) => [[x, -8, x, 35], [x - 4, -8, x + 4, -8]];
// 1:1 so 3 / 8 / 12.5 read; the 1 mm scribes are written, not dimensioned (A0 sheet, 15 Nov 2026 zoom check)
// A: at the tray edge (TF-1 lining)
const vA = await detail("RB1-D Band at Tray Edge", "Detail A: at the tray edge", -30, 115,
  [...band(-30, 95), ...brk(95, -11, 0), ...screw(60)],
  [...rect(-8, -60, 0, 0), ...rect(-20.5, -60, -8, 12.5), ...board(-20.5, 95), ...chan(60)],
  [[P(-8, -40), P(0, -40)], [P(110, -11), P(110, 0), P(110, 12.5)]]);
// B: at the Ceiling Wood Frame
const vB = await detail("RB1-D Band at Wood Frame", "Detail B: at the wood frame", 340, 560,
  [...band(340, 421), ...brk(340, -11, 0), ...screw(380), ...rect(422, -100, 440, 0), ...rect(440, -100, 522, -82), ...rect(522, -100, 540, 0)],
  [...board(330, 560), ...chan(380)],
  [[P(422, -115), P(440, -115), P(522, -115), P(540, -115)], [P(555, -100), P(555, -11), P(555, 0)]]);
for (const v of [vA, vB]) await setv(v, "View Scale", 1);
const tt = (await call("ensure_text_type", { name: "Sheet Note 5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id;
for (const [v, x, y] of [[vA, 100, 228], [vB, 330, 228]]) await call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(x, y) });
const notes = [
  [30, 118, ["DETAIL A: dashed = by others", "(gypsum): tray edge board,", "C02 12.5 board, channel @ 400.", "TF-1 lining 8 EGGER H1145,", "fixed on site.",
    "المتقطع شغل الجبس", "والبطانة بتتركب في الموقع", "Band 1 mm off the lining.", "سيب 1 مم عند البطانة"].join("\n")],
  [152, 118, ["DETAIL B: band 11 =", "8 FR MDF oak veneer", "+ rattan 3 pasted under.", "شريط إم دي إف 8 قشرة أرو", "+ راتان 3 ملزوق",
    "Screw into the channel", "@ 300; rattan covers", "the screw heads.", "مسمار كل 30 سم", "والراتان يغطي الراس",
    "Band 1 mm off the", "wood frame (A-2702).", "سيب 1 مم عند البرواز الخشب"].join("\n")]];
for (const [x, y, t] of notes) await call("create_text_note", { view_id: sheet, location: P(x, y), text: t, text_type_id: tt });
// location views: their dimension texts fell on drawing lines (LAW: no text over drawing); the SPACE note gives the sizes
for (const v of (await call("list_views", {})).views.filter((v) => /2703-Location/.test(v.name))) {
  const ds = (await call("query_elements", { view_id: v.id, category: "OST_Dimensions" })).elements.map((e) => e.id);
  if (ds.length) await call("delete_elements", { element_ids: ds });
}
console.log("details", vA, vB);
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-40));
