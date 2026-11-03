// Sheet A-2501 Strip Cladding Details: the wall cladding is its own item, fitted after the units. Plan of the strips, top and bottom sections, the arch edge.
import { readFileSync } from "node:fs";
import { call } from "./rvt.mjs";
import { sn } from "./sheetno.mjs";
import { markUnits } from "./kpmark.mjs";

const i = await call("get_project_info"); if (i.title !== "Madina1_ARCH_02") throw new Error("Active document is: " + i.title);
const REV = JSON.parse(readFileSync("dwg/sheets.json", "utf8")).rev, TB = 467161, NO = sn(158), NAME = "Strip Cladding Details";
const REVS = [REV, ...(process.env.REV_EXTRA ?? "").split(",").filter(Boolean).map(Number)];
const setv = (id, n, v) => call("set_parameter", { element_id: id, parameter_name: n, value: v }).catch((e) => console.log("param", n, e.message.slice(0, 90)));
const P = (x, y) => ({ x, y, z: 0 });
const note = (await call("ensure_text_type", { name: "Joinery Note 3.5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id;
const bold = (await call("ensure_text_type", { name: "Joinery Note 4 Bold", size_mm: 5.5, color: { r: 0, g: 0, b: 0 }, bold: true })).id;
const red = (await call("ensure_text_type", { name: "Input Required 3.5", size_mm: 5, color: { r: 200, g: 0, b: 0 } })).id;
const redB = (await call("ensure_text_type", { name: "Input Required 4 Bold", size_mm: 5.5, color: { r: 200, g: 0, b: 0 }, bold: true })).id;
const stale = (await call("list_views", {})).views.filter((x) => x.name.startsWith("J158-") || x.name === "KP-158").map((x) => x.id);
const oldS = (await call("query_elements", { category: "OST_Sheets", limit: 1000 })).elements.filter((e) => e.name === NAME).map((e) => e.id);
if (oldS.length) await call("delete_elements", { element_ids: oldS }).catch(() => {});
if (stale.length) await call("delete_elements", { element_ids: stale }).catch(() => {});
await call("ensure_line_style", { name: "Detail Cut", weight: 5, color: { r: 0, g: 0, b: 0 } });
await call("ensure_line_style", { name: "Detail Hatch", weight: 1, color: { r: 128, g: 128, b: 128 } });
await call("ensure_line_style", { name: "Indicative", weight: 1, color: { r: 130, g: 130, b: 130 } });
const seg = (a, b) => ({ start: P(...a), end: P(...b) });
const ring = (pts) => pts.map((p, k) => seg(p, pts[(k + 1) % pts.length]));
const lines = (v, l, style) => call("create_detail_lines", { view_id: v, lines: l, line_style: style });
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const box = (v, x0, y0, x1, y1) => lines(v, ring(rect(x0, y0, x1, y1)), "Detail Cut");
const hatch = (x0, y0, x1, y1, ang, gap) => { const out = [], c = Math.cos((ang * Math.PI) / 180), s = Math.sin((ang * Math.PI) / 180), L = Math.hypot(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; for (let d = -L; d <= L; d += gap) { const px = cx - s * d, py = cy + c * d; let t0 = -L, t1 = L; for (const [p, q] of [[-c, px - x0], [c, x1 - px], [-s, py - y0], [s, y1 - py]]) { if (Math.abs(p) < 1e-9) { if (q < 0) t0 = 1, t1 = 0; continue; } const r = q / p; if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r); } if (t1 - t0 > 1.5) out.push(seg([px + c * t0, py + s * t0], [px + c * t1, py + s * t1])); } return out; };
const dim = async (v, a, b) => { try { await call("create_dimension_string", { view_id: v, points: [P(...a), P(...b)], tick_mm: 25 }); } catch (e) { console.log("dim", e.message.slice(0, 100)); } };
const label = async (v, at, to, text) => { try { await call("create_keynote", { view_id: v, at: P(...at), to: P(...to), text, text_type_id: note }); } catch (e) { console.log("label", e.message.slice(0, 100)); } };
const view = async (name, title, scale) => { const d = await call("create_drafting_view", { name: "J158-" + name, scale }); await setv(d.id, "Title on Sheet", title); return d.id; };

// 1. Plan of the strips, 1:2. Wall at the top; backing 5, strips 20 x 15 at 40 centres, so 20 mm gaps.
const v1 = await view("Strip Plan", "Detail 1: Strips, Plan", 1);
await box(v1, 0, 0, 200, 5); await lines(v1, hatch(0, 0, 200, 5, 45, 2), "Detail Hatch");
for (const x of [10, 50, 90, 130, 170]) { await box(v1, x, -15, x + 20, 0); await lines(v1, hatch(x, -15, x + 20, 0, 135, 3), "Detail Hatch"); }
await lines(v1, [seg([0, 25], [200, 25])], "Indicative");
await dim(v1, [50, -35], [70, -35]); await dim(v1, [70, -35], [90, -35]); await dim(v1, [215, -15], [215, 0]); await dim(v1, [215, 0], [215, 5]);
await label(v1, [-190, 40], [30, 25], "Existing wall, line indicative");
await label(v1, [-190, 15], [5, 3], "Backing, 5 mm");
await label(v1, [-190, -45], [60, -8], "Strip 20 x 15 mm, 40 mm centres");

// 2. Top, section 1:5. Ceiling +3.000; 18 mm FR MDF support, 100 mm, behind the backing; strips stop at the ceiling.
const v2 = await view("Top Section", "Detail 2: Top, Section", 2);
await lines(v2, [seg([-60, 0], [220, 0])], "Detail Cut");
await lines(v2, hatch(-60, 0, 220, 12, 45, 6), "Detail Hatch");
await box(v2, 20, -18, 120, 0); await lines(v2, hatch(20, -18, 120, 0, 45, 3), "Detail Hatch");
await box(v2, 15, -260, 20, 0); await box(v2, 0, -260, 15, 0);
await lines(v2, [seg([150, -260], [150, 0])], "Indicative");
await dim(v2, [-30, -18], [-30, 0]); await dim(v2, [20, 30], [120, 30]);
await label(v2, [260, 25], [180, 6], "Gypsum ceiling +3.000, by others");
await label(v2, [260, -10], [100, -9], "Top support, 18 mm FR MDF, 100 mm deep");
await label(v2, [-260, -120], [7, -120], "Strip, 15 mm, to the ceiling");
await label(v2, [-260, -180], [17, -180], "Backing, 5 mm");
await label(v2, [260, -150], [150, -150], "Existing wall, line indicative");

// 3. Bottom, section 1:5. Low bay cap at +1.984; 6 mm bent closure, 20 mm deep, under the strips; strips start at +1.990.
const v3 = await view("Bottom Section", "Detail 3: Bottom, Section", 2);
await box(v3, -120, -36, 40, 0); await lines(v3, hatch(-120, -36, 40, 0, 45, 6), "Detail Hatch");
await lines(v3, [...ring([[0, 0], [20, 0], [20, 6], [6, 6], [6, 30], [0, 30]])], "Detail Cut");
await box(v3, 0, 6, 15, 220); await box(v3, 15, 0, 20, 220);
await dim(v3, [60, 0], [60, 6]); await dim(v3, [0, 250], [20, 250]);
await label(v3, [-380, -20], [-60, -18], "Low bay top, +1.984");
await label(v3, [-380, 50], [3, 15], "Closure, 6 mm bent trim, 20 mm deep");
await label(v3, [-380, 160], [7, 140], "Strip, from +1.990");
await label(v3, [120, 120], [18, 120], "Backing, 5 mm, from +1.984");

// 4. Arch edge, plan 1:2. The arch side (36 mm veneered frame); the closure wraps its edge and the strips end on it.
const v4 = await view("Arch Edge", "Detail 4: Arch Edge, Plan", 1);
await box(v4, 0, -60, 36, 120); await lines(v4, hatch(0, -60, 36, 120, 45, 4), "Detail Hatch");
await lines(v4, [...ring([[-6, 0], [-6, 20], [-26, 20], [-26, 14], [-12, 14], [-12, 0]])], "Detail Cut");
await box(v4, -46, 0, -26, 15); await box(v4, -86, 0, -66, 15); await box(v4, -126, 0, -6, -5);
await lines(v4, hatch(-126, -5, -6, 0, 45, 2), "Detail Hatch");
await dim(v4, [-6, 40], [-26, 40]); await dim(v4, [-6, -25], [0, -25]);
await label(v4, [90, 60], [20, 60], "Arch unit side, 36 mm, veneer");
await label(v4, [90, 20], [-9, 17], "Closure, 6 mm bent trim");
await label(v4, [-300, 50], [-36, 12], "Last strip, cut to the arch");
await label(v4, [-300, -30], [-60, -3], "Backing, 5 mm, cut round the arch");

// Sheet.
const sheet = (await call("create_sheet", { number: NO, name: NAME, title_block_type_id: TB })).id;
for (const [n, v] of [["Designed By", "Lorch"], ["Checked By", "Mohamed Sultan"], ["Approved By", "Anas Matter"]]) await setv(sheet, n, v);
await setv(sheet, "Sheet Group", "2 Fab: Wall Cladding");
await call("create_text_note", { view_id: sheet, location: P(1027, 672), text: "Samaya Invest", text_type_id: note });
await call("set_sheet_revisions", { sheet_ids: [sheet], revision_ids: REVS });
for (const [v, x, y] of [[v1, 268, 650], [v2, 764, 650], [v3, 268, 260], [v4, 764, 300]]) await call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(x, y) });
const txt = (x, y, t, type = note) => call("create_text_note", { view_id: sheet, location: P(x, y), text: t, text_type_id: type });
await txt(516, 500, "WALL CLADDING: A SEPARATE ITEM", bold);
await txt(516, 485, [
  "Fitted on site after all units are fixed and levelled.",
  "1  Top supports, 18 mm FR MDF, fixed to the wall at +2.982.",
  "2  Backing, 5 mm, from the low bay tops to the ceiling, cut round the arches.",
  "3  Closure trim, 6 mm bent, round each arch and along the bottom edge.",
  "4  Strips, 20 x 15 mm at 40 mm centres, cut to the arch, ending on the closure.",
  "Runs and sizes: see MD1-SF-ZZ-GF-DR-A-2500.",
  "Strips and backing: MDF with light grey HPL.",
  "All dimensions in mm. Check on site before fabrication.",
].join("\n"));
await txt(830, 160, "INPUT REQUIRED FROM THE DESIGNER", redB);
await txt(830, 145, ["Closure trim material and profile.", "Fixing of the strips to the backing."].join("\n"), red);
const kp = (await call("duplicate_view", { view_id: 312, name: "KP-158", option: "Duplicate" })), k = kp.id ?? kp.view_id;
for (const [n, x] of [["View Scale", 100], ["Detail Level", 1], ["Title on Sheet", "Key Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(k, n, x);
const kb = (await call("get_element", { element_id: k })).bounding_box;
await call("extend_view_crop", { view_id: k, left_mm: kb.min.x + 100, right_mm: 6880 - kb.max.x, bottom_mm: kb.min.y + 100, top_mm: 5700 - kb.max.y });
await call("set_view_categories", { view_id: k, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Grids"] }).catch(() => {});
await markUnits(k, /^(W|E|RL|RR) Strip Cladding$/);
const kv = await call("place_view_on_sheet", { sheet_id: sheet, view_id: k, location: P(1102, 430) });
await call("set_viewport_no_title", { viewport_id: kv.id }).catch(() => {});
console.log("done", sheet);
