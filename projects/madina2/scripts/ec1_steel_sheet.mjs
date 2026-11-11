// Madina 2: E-C1 sink bay steel frame sheet A-2503A (user 11 Nov 2026: "make sheet for steel structure ... i mean the counter").
import { call as raw } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import { readFileSync } from "node:fs";
const C = JSON.parse(readFileSync("C:/Users/user/samaya-revit-standards/projects/madina2/fab_config.json", "utf8"));
const call = (n, a = {}) => raw(n, { document: C.doc, ...a });
const P = (x, y, z = 0) => ({ x, y, z });
const setv = (id, n, v) => call("set_parameter", { element_id: id, parameter_name: n, value: v }).catch((e) => console.log("set", n, e.message.slice(0, 70)));
const X = (lx) => 5670 + lx, Y = (ly) => 872 + ly; // E-C1 family -> world (probed: door face at x 5690)
const SN = C.prefix + "2503A", S = 2;

// sheet (rebuild cleanly when run again)
for (const s of (await call("query_elements", { category: "OST_Sheets", limit: 500 })).elements) {
  const g = await call("get_element", { element_id: s.id });
  if (g.parameters.find((p) => p.name === "Sheet Number")?.value === SN) { await call("delete_elements", { element_ids: [s.id] }); console.log("old sheet removed"); }
}
for (const v of (await call("list_views", {})).views.filter((v) => /^EC1-ST /.test(v.name))) await call("delete_elements", { element_ids: [v.id] }).catch(() => {});
const grp = (await call("get_element", { element_id: 761126 })).parameters.find((p) => p.name === "Sheet Group")?.value;
const tb = (await call("list_element_types", { category: "OST_TitleBlocks" })).types.find((x) => x.name === C.titleBlock).id;
const sheet = (await call("create_sheet", { number: SN, name: "East Counter E-C1 - Steel Sink Frame", title_block_type_id: tb })).id;
await setv(sheet, "Sheet Group", grp); await setv(sheet, "Sheet Package", "02 JOINERY & FABRICATION");
const tbi = (await call("query_elements", { category: "OST_TitleBlocks", view_id: sheet, limit: 5 })).elements[0]?.id;
for (const [n, v] of C.signoff) { await setv(sheet, n, v); if (tbi) await setv(tbi, n, v); }

// views
const sec = async (name, start, end, look, depth, top, bottom) => {
  const id = (await call("create_section", { start, end, look_direction: look, bottom_mm: bottom, top_mm: top, depth_mm: depth, scale: S })).id;
  await setv(id, "View Name", "EC1-ST " + name); await setv(id, "Title on Sheet", name); await setv(id, "Detail Level", 3);
  await call("set_view_display", { view_id: id, style: "HLR" }).catch(() => {});
  await call("set_view_categories", { view_id: id, hide: ["OST_Levels", "OST_Grids", "OST_Sections"] }).catch(() => {});
  return id;
};
const vF = await sec("Frame Front", P(X(42), Y(3860)), P(X(42), Y(3140)), P(1, 0), 560, 760, -30);
const vS = await sec("Section A (sink bay)", P(X(-25), Y(3490)), P(X(665), Y(3490)), P(0, 1), 330, 760, -30);
const lvl = (await call("list_levels", {})).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const vP = (await call("create_floor_plan", { level_id: lvl, name: "EC1-ST Plan" })).id;
for (const [n, v] of [["View Template", -1], ["View Scale", S], ["Detail Level", 3], ["Title on Sheet", "Plan at the top ring (+0.660)"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(vP, n, v);
await call("set_view_range", { view_id: vP, top_mm: 670, cut_mm: 660, bottom_mm: 0 }).catch((e) => console.log("range", e.message));
await call("set_view_crop", { view_id: vP, min_mm: P(X(-25), Y(3140)), max_mm: P(X(665), Y(3860)) });
await call("set_view_display", { view_id: vP, style: "HLR" }).catch(() => {});
await call("set_view_categories", { view_id: vP, hide: ["OST_Levels", "OST_Grids", "OST_Sections", "OST_Elev", "OST_Callouts"] }).catch(() => {});

// dimensions (family coords: front posts x 75-115, back 540-580; bay y 3169-3802; rings z 50-90 and 640-680)
const dim = (v, pts) => call("create_dimension_string", { view_id: v, points: pts, tick_mm: 12 }).catch((e) => console.log("dim", e.message.slice(0, 90)));
const zs = [0, 50, 90, 640, 680];
await dim(vF, [3169, 3182, 3222, 3762, 3802].map((y) => P(X(42), Y(y), 712)));
await dim(vF, [3169, 3802].map((y) => P(X(42), Y(y), 742)));
await dim(vF, zs.map((z) => P(X(42), Y(3838), z)));
await dim(vS, [0, 75, 115, 540, 580, 630].map((x) => P(X(x), Y(3490), 712)));
await dim(vS, zs.map((z) => P(X(650), Y(3490), z)));
await dim(vP, [75, 115, 540, 580].map((x) => P(X(x), Y(3835), 660)));
await dim(vP, [3169, 3209, 3762, 3802].map((y) => P(X(650), Y(y), 660)));
await dim(vP, [3265, 3715].map((y) => P(X(-10), Y(y), 660)));

// place (A0: views left of the text column at x 815)
const place = async (v, x, y) => (await call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(x, y) })).id;
await place(vF, 230, 610); await place(vS, 610, 610); await place(vP, 230, 215);

// key plan
const planId = (await call("list_views", {})).views.find((v) => v.name === C.planView).id;
const kp = (await call("duplicate_view", { view_id: planId, name: "EC1-ST KP", option: "Duplicate" })).id;
for (const [n, x] of [["View Template", -1], ["View Scale", 100], ["Detail Level", 1], ["Title on Sheet", "Key Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(kp, n, x);
await call("set_view_categories", { view_id: kp, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Grids", "OST_Dimensions", "OST_TextNotes"] }).catch(() => {});
await call("create_swatch", { view_id: kp, min: P(X(0), Y(3169)), max: P(X(630), Y(3802)), color: { r: 200, g: 30, b: 30 } });
const kv = await call("place_view_on_sheet", { sheet_id: sheet, view_id: kp, location: P(1102, 430) });
await call("set_viewport_no_title", { viewport_id: kv.id }).catch(() => {});

// text column
const note = (await call("ensure_text_type", { name: "Sheet Note 5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id;
const bold = (await call("ensure_text_type", { name: "Sheet Heading 5.5", size_mm: 5.5, color: { r: 0, g: 0, b: 0 }, bold: true })).id;
const txt = (x, y, t, ty = note) => call("create_text_note", { view_id: sheet, location: P(x, y), text: t, text_type_id: ty });
const table = async (y, cols, rows) => { for (let c = 0; c < cols.length; c++) await txt(cols[c], y, rows.map((r) => r[c]).join("\n")); };
await txt(815, 812, "E-C1 SINK BAY STEEL FRAME   QTY 1\n633 x 505 x 680 frame, inside E-C1 (A-2503)\nMild steel, welded, painted; stainless liner", bold);
await txt(815, 772, "CUT LIST - SHS 40x40x2 (S235)", bold);
await table(759, [815, 838, 960, 990], [["MARK", "PART", "LENGTH", "QTY"], ["S1", "Post, front", "590", "2"], ["S2", "Post, back", "590", "2"], ["S3", "Rail, front (bottom + top)", "540", "2"], ["S4", "Rail, back (bottom + top)", "553", "2"], ["S5", "Rail, side (bottom + top)", "425", "4"], ["", "Total 6.25 m: buy 2 x 6.0 m", "", ""]]);
await txt(815, 698, "PLATES AND FITTINGS", bold);
await table(685, [815, 945, 995], [["PART", "SIZE", "QTY"], ["Leg tab under front post", "60x40x5", "2"], ["Adjustable leg, steel, 50", "M10", "4"], ["Weld nut under each post", "M10", "4"], ["Self-drill screw, liner", "4.2x16", "24"], ["Clear silicone", "310 ml", "1"]]);
await txt(815, 630, "STAINLESS 304 BRUSHED 1.2 - FLAT SIZES", bold);
await table(617, [815, 945, 995], [["PART", "FLAT", "QTY"], ["Tray 540x633, 40 up all round", "620x713", "1"], ["Back sheet, to the top ring", "633x590", "1"], ["End liner, on the end panel", "540x550", "1"], ["Total 1.08 m2: 1 sheet 2440x1220", "", ""]]);
await txt(815, 568, "NOTES", bold);
await txt(815, 555, ["Weld all joints: fillet 3 all round, grind", "smooth. Frame square within 2 mm.", "Paint: zinc primer + 2 coats grey.", "Front posts stand 2 mm clear of the sink bowl.", "Front legs sit on tabs behind the kick line.", "Top ring carries the marble top at +0.680.", "Tray: notch corners, fold upstands, weld", "corners, seal with clear silicone.", "Fit tray, back sheet and end liner after paint.", "Pipe void behind the back sheet.", "All dimensions in mm.", "Check on site before cutting."].join("\n"));
console.log("sheet", sheet, SN, JSON.stringify({ vF, vS, vP, kp }));
