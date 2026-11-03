// Sheet of marble details: bird's-nose edge, top at the wall, arch head fascia, with how each is fixed.
import { readFileSync, writeFileSync } from "node:fs";
import { call } from "./rvt.mjs";
import { markUnits } from "./kpmark.mjs";

const LOG = "dwg/joinery.json", log = JSON.parse(readFileSync(LOG, "utf8"));
const i = await call("get_project_info"); if (i.title !== "Madina1_ARCH_02") throw new Error("Active document is: " + i.title);
const REV = JSON.parse(readFileSync("dwg/sheets.json", "utf8")).rev, TB = 467161, NO = "MD1-SF-ZZ-GF-DR-A-2106", NAME = "Marble Details";
const setv = (id, n, v) => call("set_parameter", { element_id: id, parameter_name: n, value: v }).catch((e) => console.log("param", n, e.message.slice(0, 90)));
const P = (x, y) => ({ x, y, z: 0 });
const note = (await call("ensure_text_type", { name: "Joinery Note 3.5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id;
const bold = (await call("ensure_text_type", { name: "Joinery Note 4 Bold", size_mm: 5.5, color: { r: 0, g: 0, b: 0 }, bold: true })).id;
const stale = (await call("list_views", {})).views.filter((x) => x.name.startsWith("J134-") || x.name === "KP-134").map((x) => x.id);
const oldS = (await call("query_elements", { category: "OST_Sheets", limit: 1000 })).elements.filter((e) => e.name === NAME).map((e) => e.id);
if (oldS.length) await call("delete_elements", { element_ids: oldS }).catch(() => {});
if (stale.length) await call("delete_elements", { element_ids: stale }).catch(() => {});

await call("ensure_line_style", { name: "Detail Cut", weight: 5, color: { r: 0, g: 0, b: 0 } });
await call("ensure_line_style", { name: "Detail Hatch", weight: 1, color: { r: 128, g: 128, b: 128 } });
await call("ensure_line_style", { name: "Indicative", weight: 1, color: { r: 130, g: 130, b: 130 } });
const seg = (a, b) => ({ start: P(...a), end: P(...b) });
const ring = (pts) => pts.map((p, k) => seg(p, pts[(k + 1) % pts.length]));
const chain = (pts) => pts.slice(1).map((p, k) => seg(pts[k], p));
const lines = (v, l, style) => call("create_detail_lines", { view_id: v, lines: l, line_style: style });
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// Lines at an angle across a rectangle, clipped to it.
const hatch = (x0, y0, x1, y1, ang, gap) => { const out = [], c = Math.cos((ang * Math.PI) / 180), s = Math.sin((ang * Math.PI) / 180), L = Math.hypot(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; for (let d = -L; d <= L; d += gap) { const px = cx - s * d, py = cy + c * d; let t0 = -L, t1 = L; for (const [p, q] of [[-c, px - x0], [c, x1 - px], [-s, py - y0], [s, y1 - py]]) { if (Math.abs(p) < 1e-9) { if (q < 0) t0 = 1, t1 = 0; continue; } const r = q / p; if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r); } if (t1 - t0 > 1.5) out.push(seg([px + c * t0, py + s * t0], [px + c * t1, py + s * t1])); } return out; };
const dim = async (v, a, b) => { try { await call("create_dimension_string", { view_id: v, points: [P(...a), P(...b)], tick_mm: 25 }); } catch (e) { console.log("dim", e.message.slice(0, 100)); } };
const label = async (v, at, to, text) => { try { await call("create_keynote", { view_id: v, at: P(...at), to: P(...to), text, text_type_id: note }); } catch (e) { console.log("label", e.message.slice(0, 100)); } };
const view = async (name, title, scale) => { const d = await call("create_drafting_view", { name: "J134-" + name, scale }); await setv(d.id, "Title on Sheet", title); return d.id; };

// 1. Bird's-nose edge, 1:1. Marble 20, 3 mm bed, substrate 30 set back 20, on the cabinet.
const v1 = await view("Birds Nose Edge", "Detail 1: Bird's-nose Edge", 1);
const R = 12, arc = Array.from({ length: 9 }, (_, k) => { const a = (Math.PI / 2) * (k / 8); return [R - R * Math.cos(a), 20 - R + R * Math.sin(a)]; });
await lines(v1, [...chain([[8, 0], ...arc, [170, 20]]), seg([8, 0], [170, 0])], "Detail Cut");
await lines(v1, ring(rect(20, -18, 170, 0)), "Detail Cut");
await lines(v1, ring(rect(20, -90, 38, -21)), "Detail Cut");
await lines(v1, [...hatch(12, 0, 170, 20, 45, 4), ...hatch(20, -18, 170, 0, 45, 1.5), ...hatch(20, -90, 38, -21, 45, 1.5)], "Detail Hatch");
await dim(v1, [-30, 0], [-30, 20]); await dim(v1, [-30, -18], [-30, 0]); await dim(v1, [0, 42], [20, 42]);
await label(v1, [60, 62], [60, 15], "Marble top, 20 mm");
await label(v1, [195, 28], [4, 14], "Bird's-nose edge: R12 top, 45 degree undercut");
await label(v1, [195, -8], [90, -1], "Silicone, directly on the cabinet top");
await label(v1, [195, -28], [100, -10], "Cabinet top, 18 mm");
await label(v1, [80, -70], [29, -60], "Door, 18 mm");

// 2. Top at the wall, 1:2. Silicone joint at the wall, marble directly on the cabinet top.
const v2 = await view("Top at Wall", "Detail 2: Top at Wall", 2);
await lines(v2, [...ring(rect(-300, 0, -3, 20)), ...ring(rect(-300, -18, 0, 0))], "Detail Cut");
await lines(v2, [...ring(rect(0, -140, 60, 60))], "Detail Cut");
await lines(v2, [...hatch(-300, 0, -3, 20, 45, 8), ...hatch(-300, -18, 0, 0, 45, 3), ...hatch(0, -140, 60, 60, 45, 12)], "Detail Hatch");
await lines(v2, [seg([-3, 20], [0, 26])], "Detail Cut");
await label(v2, [-300, 60], [-200, 12], "Marble top, 20 mm");
await label(v2, [-260, 110], [-1.5, 22], "Silicone joint, 3 mm, colour to match");
await label(v2, [-300, -70], [-150, -8], "Cabinet top, 18 mm");
await label(v2, [110, -60], [30, -60], "Existing wall");

// 3. L-shaped marble head, section, 1:2. u runs back from the marble's face, z up from its underside.
const v3 = await view("L Marble Head", "Detail 3: L-shaped Marble", 2);
const C = 3, T = 20, B = T + 18, corner = [[0, C], [C, 0]];
await lines(v3, [...chain([[C, 587], [0, 587 - C], ...corner, [50, 0], [50, 10], [62, 10], [62, 0], [476 - C, 0], [476, C], [476, T], [T, T], [T, 587], [C, 587]]), seg([C / 2, C / 2], [T, T])], "Detail Cut");
await lines(v3, chain([[476, T], [476, B], [B, B], [B, 587], [T, 587]]), "Detail Cut");
await lines(v3, [...hatch(0, T, T, 587, 45, 8), ...hatch(T, 0, 476, T, 45, 8), ...hatch(T, T, B, 587, 135, 3), ...hatch(B, T, 476, B, 135, 3)], "Detail Hatch");
await lines(v3, [...[100, 250, 400].map((z) => seg([T - 1, z], [T + 1, z])), ...[120, 260, 400].map((u) => seg([u, T - 1], [u, T + 1]))], "Detail Cut");
await lines(v3, ring(rect(52, 8, 60, 10)), "Detail Cut");
await lines(v3, [200, 400].flatMap((u) => [seg([u, T], [u, B + 15]), seg([u - 15, B + 15], [u + 15, B + 15])]), "Detail Cut");
await dim(v3, [-50, T], [-50, 510]); await dim(v3, [0, -40], [476, -40]);
await label(v3, [-210, 430], [10, 380], "Marble face, 20 mm");
await label(v3, [150, 420], [29, 340], "Backing L, 18 mm, screwed to the frame");
await label(v3, [150, 300], [T, 250], "Silicone dabs on the backing");
await label(v3, [250, 150], [200, B + 15], "Stainless steel clips, 400 mm centres, hold the soffit");
await label(v3, [300, -85], [400, 10], "Marble soffit, 20 mm");
await label(v3, [-50, -85], [56, 9], "8 mm LED strip, 12 x 10 mm channel");

// 4. Corner of the L, 1:1. Faces meet on a mitre, with a small chamfer on the corner.
const v4 = await view("L Marble Corner", "Detail 4: L Corner", 1);
await lines(v4, [...chain([[0, 100], ...corner, [100, 0]]), seg([T, 100], [T, T]), seg([T, T], [100, T]), seg([C / 2, C / 2], [T, T]), seg([T, B], [100, B]), seg([B, B], [B, 100])], "Detail Cut");
await lines(v4, [...hatch(0, T, T, 100, 45, 4), ...hatch(T, 0, 100, T, 45, 4), ...hatch(T, T, B, 100, 135, 1.5), ...hatch(B, T, 100, B, 135, 1.5)], "Detail Hatch");
await dim(v4, [-22, T], [-22, 0]); await dim(v4, [0, -22], [T, -22]);
await label(v4, [-110, 70], [10, 60], "Marble face, 20 mm");
await label(v4, [125, -18], [60, 10], "Marble soffit, 20 mm");
await label(v4, [-110, -35], [10, 10], "45 degree mitre, stone adhesive");
await label(v4, [-110, 25], [2, 3], "Chamfer, 3 mm");
await label(v4, [125, 50], [60, 29], "Backing L, 18 mm");

// Sheet.
const sheet = (await call("create_sheet", { number: NO, name: NAME, title_block_type_id: TB })).id;
for (const [n, v] of [["Designed By", "Lorch"], ["Checked By", "Mohamed Sultan"], ["Approved By", "Anas Matter"]]) await setv(sheet, n, v);
await call("create_text_note", { view_id: sheet, location: P(1027, 672), text: "Samaya Invest", text_type_id: note });
await call("set_sheet_revisions", { sheet_ids: [sheet], revision_ids: [REV, ...(process.env.REV_EXTRA ?? "").split(",").filter(Boolean).map(Number)] });
for (const [v, x, y] of [[v1, 268, 640], [v2, 764, 640], [v3, 268, 225], [v4, 764, 225]]) await call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(x, y) });
const txt = (x, y, t, type = note) => call("create_text_note", { view_id: sheet, location: P(x, y), text: t, text_type_id: type });
await txt(516, 470, "FIXING NOTES", bold);
await txt(516, 455, [
  "Marble top: directly on the cabinet top, no substrate. Neutral-cure silicone suitable for natural stone.",
  "No screws through the marble.",
  "Silicone joint at the wall, colour to match the marble.",
  "Light strips always sit in a recessed cove, also in marble: 12 x 10 mm channel set in a slot in the 20 mm marble.",
  "Arch head L: silicone on the backing. Overhead soffit also held by stainless steel clips, never adhesive alone.",
  "Marble edges polished. L joint: 45 degree mitre, 3 mm chamfer at the outer corner and free ends.",
].join("\n"));
await txt(516, 400, "Chamfer size, top edge profile, clips and fixing are proposed.\nConfirm before fabrication. All dimensions in mm.");
const kpD = await call("duplicate_view", { view_id: 312, name: "KP-134", option: "Duplicate" });
const kp = kpD.id ?? kpD.view_id;
for (const [n, x] of [["View Scale", 100], ["Detail Level", 1], ["Title on Sheet", "Key Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(kp, n, x);
const kb = (await call("get_element", { element_id: kp })).bounding_box;
await call("extend_view_crop", { view_id: kp, left_mm: kb.min.x + 100, right_mm: 6880 - kb.max.x, bottom_mm: kb.min.y + 100, top_mm: 5700 - kb.max.y });
await call("set_view_categories", { view_id: kp, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines"] }).catch(() => {});
await markUnits(kp, /Marble Top|Arch Typical A/);
const kv = await call("place_view_on_sheet", { sheet_id: sheet, view_id: kp, location: P(1102, 430) });
await call("set_viewport_no_title", { viewport_id: kv.id }).catch(() => console.log("key plan title stays until add-in install"));
log.MT = { sheet, v1, v2, v3, v4, vKey: kp }; writeFileSync(LOG, JSON.stringify(log));
console.log("done", sheet);
