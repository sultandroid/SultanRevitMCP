// Madina 2 A-2119 East Steel Frame ST-E2 + East Arch Hangers HG-E: a clear steel sheet (user 16 Nov 2026: "make good clear
// sheet for the steel model"). Replaces the generic fab_sheet layout: every frame plane on its own view with the member marks of
// the cut list (S1-S10), plan, hanger section at the arch joint, base detail, typical end-rail joint, cut list + parts tables,
// bilingual notes. World: front plane x 5730-5770, back plane x 6318-6358, y 756-5005, z 0-2920 (+2.945 rod tops).
import { call as raw } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import { readFileSync } from "node:fs";
const C = JSON.parse(readFileSync("C:/Users/user/samaya-revit-standards/projects/madina2/fab_config.json", "utf8"));
const call = (n, a = {}) => raw(n, { document: C.doc, ...a });
const P = (x, y, z = 0) => ({ x, y, z });
const setv = (id, n, v) => call("set_parameter", { element_id: id, parameter_name: n, value: v }).catch((e) => console.log("set", n, e.message.slice(0, 70)));
const SN = C.prefix + "2119", FRAME = 1370526, HANG = 1402618, REV = [1490963];

// clean rebuild: old sheet + views of earlier runs (fab_sheet "J2119-" and ours "ST2-")
for (const s of (await call("query_elements", { category: "OST_Sheets", limit: 500 })).elements) {
  const g = await call("get_element", { element_id: s.id });
  if (g.parameters.find((p) => p.name === "Sheet Number")?.value === SN) await call("delete_elements", { element_ids: [s.id] });
}
for (const v of (await call("list_views", {})).views.filter((v) => /^(ST2-|J2119-)/.test(v.name))) await call("delete_elements", { element_ids: [v.id] }).catch(() => {});
const tb = (await call("list_element_types", { category: "OST_TitleBlocks" })).types.find((x) => x.name === C.titleBlock).id;
const sheet = (await call("create_sheet", { number: SN, name: "East Steel Frame ST-E2", title_block_type_id: tb })).id;
await setv(sheet, "Sheet Group", "2 Fab: Arch Units"); await setv(sheet, "Sheet Package", "02 JOINERY & FABRICATION");
const tbi = (await call("query_elements", { category: "OST_TitleBlocks", view_id: sheet, limit: 5 })).elements[0]?.id;
for (const [n, v] of C.signoff) { await setv(sheet, n, v); if (tbi) await setv(tbi, n, v); }

// views
const iso = (v) => call("isolate_in_view", { view_id: v, element_ids: [FRAME, HANG] }).catch((e) => console.log("iso", e.message.slice(0, 60)));
const sec = async (name, title, start, end, look, depth, top, bottom, sc) => {
  const id = (await call("create_section", { start, end, look_direction: look, bottom_mm: bottom, top_mm: top, depth_mm: depth, scale: sc })).id;
  await setv(id, "View Name", "ST2-" + name); await setv(id, "Title on Sheet", title); await setv(id, "Detail Level", 3);
  await call("set_view_display", { view_id: id, style: "HLR" }).catch(() => {});
  await call("set_view_categories", { view_id: id, hide: ["OST_Levels", "OST_Grids", "OST_Sections", "OST_Elev", "OST_Callouts"] }).catch(() => {});
  await iso(id); return id;
};
const vF = await sec("Front", "Front Frame (truss)", P(5700, 5200), P(5700, 560), P(1, 0), 135, 3060, -260, 20);
const vB = await sec("Back", "Back Frame", P(6290, 5200), P(6290, 560), P(1, 0), 120, 3060, -260, 20);
const vE = await sec("End", "End Frame (2 No.)", P(5560, 700), P(6560, 700), P(0, 1), 120, 3060, -260, 20);
const vH = await sec("Hanger", "Hanger (2 No.)", P(5640, 2060), P(6440, 2060), P(0, 1), 160, 3010, 1740, 10);
const vD = await sec("Base", "Base: front post", P(5640, 700), P(5880, 700), P(0, 1), 140, 190, -40, 2);
const lvl = (await call("list_levels", {})).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const vP = (await call("create_floor_plan", { level_id: lvl, name: "ST2-Plan" })).id;
for (const [n, v] of [["View Template", -1], ["View Scale", 20], ["Detail Level", 3], ["Title on Sheet", "Plan from above"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(vP, n, v);
await call("set_view_range", { view_id: vP, top_mm: 3100, cut_mm: 3050, bottom_mm: 0 }).catch((e) => console.log("range", e.message));
await call("set_view_crop", { view_id: vP, min_mm: P(5380, 560), max_mm: P(6560, 5200) });
await call("set_view_display", { view_id: vP, style: "HLR" }).catch(() => {});
await call("set_view_categories", { view_id: vP, hide: ["OST_Levels", "OST_Grids", "OST_Sections", "OST_Elev", "OST_Callouts"] }).catch(() => {});
await iso(vP);
const v3 = (await call("create_3d_view", { name: "ST2-3D", eye: P(3000, -2500, 6500), target: P(6050, 2880, 1450), style: "HLR", box_min: P(5600, 600, -50), box_max: P(6500, 5150, 3000) })).id;
await setv(v3, "View Scale", 30); await setv(v3, "Title on Sheet", "3D View"); await iso(v3);

// dimensions
const dim = (v, pts) => call("create_dimension_string", { view_id: v, points: pts, tick_mm: 6 }).catch((e) => console.log("dim", e.message.slice(0, 90)));
await dim(vF, [756, 5005].map((y) => P(5750, y, -180)));                               // overall
await dim(vF, [0, 2780, 2920].map((z) => P(5750, 5180, z)));                            // chords
await dim(vB, [776, 2138, 3454, 4985].map((y) => P(6338, y, -180)));                    // post centres
await dim(vB, [0, 1520, 2920].map((z) => P(6338, 5180, z)));                            // rail tops
await dim(vE, [5730, 6358].map((x) => P(x, 776, -180)));
await dim(vE, [0, 1520, 2920].map((z) => P(6460, 776, z)));
await dim(vH, [5770, 5810, 6040, 6318].map((x) => P(x, 2138, 1790)));                   // chord face, rods, back rail face
await dim(vH, [1907, 2880, 2920].map((z) => P(6400, 2138, z)));
await dim(vD, [5700, 5730, 5770, 5800].map((x) => P(x, 776, -25)));
await dim(vD, [0, 8].map((z) => P(5860, 776, z)));
await dim(vP, [776, 2138, 3454, 4985].map((y) => P(5500, y, 3000)));
await dim(vP, [5750, 6338].map((x) => P(x, 640, 3000)));

// member marks in the views (text 3.5)
const tag = (await call("ensure_text_type", { name: "Sheet Note 3.5", size_mm: 3.5, color: { r: 0, g: 0, b: 0 } })).id;
const mark = (v, p, t) => call("create_text_note", { view_id: v, location: p, text: t, text_type_id: tag }).catch((e) => console.log("tag", e.message.slice(0, 60)));
await mark(vF, P(5700, 4870, 1300), "S1"); await mark(vF, P(5700, 870, 1300), "S1");
await mark(vF, P(5700, 1700, 3080), "S3 top chord"); await mark(vF, P(5700, 1700, 2700), "S4 bottom chord");
await mark(vF, P(5700, 4200, 2700), "S5 diagonals (5)");
await mark(vB, P(6290, 4870, 900), "S2"); await mark(vB, P(6290, 2020, 900), "S2"); await mark(vB, P(6290, 3340, 900), "S2"); await mark(vB, P(6290, 870, 2300), "S2");
await mark(vB, P(6290, 4300, 1600), "S6"); await mark(vB, P(6290, 4300, 3000), "S6"); await mark(vB, P(6290, 4300, 150), "S7");
await mark(vB, P(6290, 1700, 1200), "S10");
await mark(vE, P(6200, 700, 3060), "S8"); await mark(vE, P(6200, 700, 1600), "S8"); await mark(vE, P(6200, 700, 140), "S8");
await mark(vE, P(5930, 700, 2300), "S9");

// numbered callouts in the details, legend beside them on the sheet
const n = (v, p, k) => mark(v, p, String(k));
await n(vH, P(5900, 2060, 2960), 1); await n(vH, P(6100, 2060, 2870), 2); await n(vH, P(5850, 2060, 2400), 3); await n(vH, P(6260, 2060, 1990), 4); await n(vH, P(5660, 2060, 2960), 5);
await n(vD, P(5745, 700, 130), 1); await n(vD, P(5810, 700, 18), 2); await n(vD, P(5830, 700, 60), 3);
// typical joint: end rail to post (drafting, 1:5) - PROPOSED, the model has no joint detail
const vJ = (await call("create_drafting_view", { name: "ST2-Joint", scale: 5 })).id;
await setv(vJ, "Title on Sheet", "Joint: end rail to post"); await setv(vJ, "View Scale", 2);
const rect = (x0, y0, x1, y1) => [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]];
const L = (a) => a.map(([x0, y0, x1, y1]) => ({ start: P(x0, y0), end: P(x1, y1) }));
await call("create_detail_lines", { view_id: vJ, lines: [...L([...rect(0, -80, 40, 80), ...rect(40, -20, 84, 20), ...rect(40, -20, 44, 20), ...rect(86, -20, 260, 20), [260, -26, 266, 0], [266, 0, 260, 26]]),
  { start: P(59.5, 0), end: P(68.5, 0), mid: P(64, 4.5) }, { start: P(68.5, 0), end: P(59.5, 0), mid: P(64, -4.5) }] });
await dim(vJ, [P(0, -110), P(40, -110), P(84, -110)]);

const legend = async (x, y, lines) => call("create_text_note", { view_id: sheet, location: P(x, y), text: lines.join(String.fromCharCode(10)), text_type_id: (await call("ensure_text_type", { name: "Sheet Note 5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id });
// place
const place = async (v, x, y) => (await call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(x, y) })).id;
await place(vF, 160, 690); await place(vB, 430, 690); await place(vE, 640, 690); await place(vH, 470, 480);
await place(vP, 75, 360); await place(v3, 270, 330); await place(vD, 660, 505); await place(vJ, 660, 255);

await legend(395, 395, ["1 Cross member L40x40x4, bolted to the top chord", "   and the back rail, top leg flush +2.920", "2 M10 rod: nut + washer under and over", "3 Flat bar 40x6 in the seam between the arch heads", "   2 screws 4x30 each side, @ 150", "4 Shelf plate 523x116x10, welded to the back post,", "   M8 bolt to the flat bar", "5 Top chord S3", "1 الزاوية متربطة في الشاسيه", "2 صامولة فوق وتحت", "3 المبسط بين رؤوس الأقواس", "4 الرف ملحوم في القايم"]);
await legend(598, 412, ["1 Front post S1", "2 Base plate 100x100x8, welded", "3 End floor rail S8", "Rests on the floor, no anchor", "القايم ملحوم على شريحة 8 مم"]);
await legend(598, 168, ["1 Post S1 / S2", "2 Cleat L40x40x4 x 40, welded (workshop)", "3 End rail S8 / S9, 2 mm gap,", "   1 bolt M8 x 60 + nut + 2 washers (site)", "PROPOSED: confirm before cutting", "زاوية ملحومة في القايم ومسمار M8 في الموقع"]);
await call("create_text_note", { view_id: vJ, location: P(10, 60), text: "1", text_type_id: tag }); await call("create_text_note", { view_id: vJ, location: P(55, 45), text: "2", text_type_id: tag }); await call("create_text_note", { view_id: vJ, location: P(180, 45), text: "3", text_type_id: tag });
// key plan
const planId = (await call("list_views", {})).views.find((v) => v.name === C.planView).id;
const kp = (await call("duplicate_view", { view_id: planId, name: "ST2-KP", option: "Duplicate" })).id;
for (const [n, x] of [["View Template", -1], ["View Scale", 100], ["Detail Level", 1], ["Title on Sheet", "Key Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(kp, n, x);
await call("set_view_categories", { view_id: kp, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Grids", "OST_Dimensions", "OST_TextNotes"] }).catch(() => {});
await call("create_swatch", { view_id: kp, min: P(5730, 756), max: P(6358, 5005), color: { r: 200, g: 30, b: 30 } });
const kv = await call("place_view_on_sheet", { sheet_id: sheet, view_id: kp, location: P(1102, 430) });
await call("set_viewport_no_title", { viewport_id: kv.id }).catch(() => {});

// text column
const note = (await call("ensure_text_type", { name: "Sheet Note 5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id;
const bold = (await call("ensure_text_type", { name: "Sheet Heading 5.5", size_mm: 5.5, color: { r: 0, g: 0, b: 0 }, bold: true })).id;
const txt = (x, y, t, ty = note) => call("create_text_note", { view_id: sheet, location: P(x, y), text: t, text_type_id: ty });
const table = async (y, cols, rows) => { for (let c = 0; c < cols.length; c++) await txt(cols[c], y, rows.map((r) => r[c]).join("\n")); };
await txt(815, 812, "EAST STEEL FRAME ST-E2   QTY 1\nHolds the 3 east arches, behind the spandrels\n4249 x 628 x 2920, SHS 40x40x2 S235, painted black", bold);
await txt(815, 772, "CUT LIST - SHS 40x40x2", bold);
await table(759, [815, 838, 958, 995], [["MARK", "PART", "LENGTH", "QTY"], ["S1", "Front post", "2912", "2"], ["S2", "Back post", "2832", "4"], ["S3", "Front top chord", "4169", "1"], ["S4", "Front bottom chord", "4169", "1"],
  ["S5", "Truss diagonal, cut to the chords", "~402", "5"], ["S6", "Back rail +1.520 / +2.920 top", "4249", "2"], ["S7", "Back floor rail", "4169", "1"], ["S8", "End rail (top, middle, floor)", "548", "6"],
  ["S9", "End diagonal, cut to fit", "~2873", "2"], ["S10", "Back diagonal, cut to fit", "~3125", "1"], ["", "Total 52.3 m: buy 10 bars x 6 m", "", ""]]);
await txt(815, 650, "HANGERS HG-E AND PLATES", bold);
await table(637, [815, 932, 1000], [["PART", "SIZE", "QTY"], ["Hanger cross member", "L40x40x4 x 548", "2"], ["Hanger flat bar (arch seam)", "40x6 x 923", "4"], ["Adjusting rod + 2 nuts + 2 washers", "M10 x 145", "4"],
  ["Shelf plate, welded to back post", "523x116x10", "2"], ["Base plate, front post", "100x100x8", "2"], ["Base plate, back post", "50x100x8", "4"], ["Bolt flat bar to shelf plate", "M8", "4"]]);
await txt(815, 562, "NOTES", bold);
await txt(815, 549, ["Weld the front frame (S1, S3, S4, S5) and the back", "frame (S2, S6, S7, S10) in the workshop: fillet 3", "all round, grind smooth, square within 2 mm.",
  "End rails S8 and diagonals S9 join the frames on", "site: cleat + 1 M8 each end (typical joint, to confirm).", "Frames are 4.25 m long: check the mall access first.",
  "Feet rest on the floor, no anchors (calc S-0001).", "Shelf plates: level on the M10 nuts +/-25, then lock.", "ALL STEEL PAINTED BLACK, rods and nuts too:", "no galvanising, no powder coat.",
  "الفريم الأمامي والخلفي لحام في الورشة", "القطع الجانبية بتتربط في الموقع بمسمار M8", "اتأكد إن الفريم 4.25 م يدخل من باب المول", "كل الحديد دهان أسود، من غير جلفنة",
  "All dimensions in mm. Check on site before cutting."].join("\n"));
await call("set_sheet_revisions", { sheet_ids: [sheet], revision_ids: REV });
console.log("sheet", sheet, JSON.stringify({ vF, vB, vE, vH, vD, vP, v3, vJ }));
console.log(JSON.stringify(await call("save_document", { title: C.doc })).slice(-40));
