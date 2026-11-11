// Madina 2: E-C1 full steel frame sheet A-2503A (full counter structure, 11 Nov 2026) (user 11 Nov 2026: "make sheet for steel structure ... i mean the counter").
import { call as raw } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import { readFileSync } from "node:fs";
const C = JSON.parse(readFileSync("C:/Users/user/samaya-revit-standards/projects/madina2/fab_config.json", "utf8"));
const call = (n, a = {}) => raw(n, { document: C.doc, ...a });
const P = (x, y, z = 0) => ({ x, y, z });
const setv = (id, n, v) => call("set_parameter", { element_id: id, parameter_name: n, value: v }).catch((e) => console.log("set", n, e.message.slice(0, 70)));
const X = (lx) => 5670 + lx, Y = (ly) => 881 + ly; // E-C1 family -> world (probed: door face at x 5690)
const SN = C.prefix + "2503A", S = 5, L = 10;

// sheet (rebuild cleanly when run again)
for (const s of (await call("query_elements", { category: "OST_Sheets", limit: 500 })).elements) {
  const g = await call("get_element", { element_id: s.id });
  if (g.parameters.find((p) => p.name === "Sheet Number")?.value === SN) { await call("delete_elements", { element_ids: [s.id] }); console.log("old sheet removed"); }
}
for (const v of (await call("list_views", {})).views.filter((v) => /^EC1-ST /.test(v.name))) await call("delete_elements", { element_ids: [v.id] }).catch(() => {});
const grp = (await call("get_element", { element_id: 761126 })).parameters.find((p) => p.name === "Sheet Group")?.value;
const tb = (await call("list_element_types", { category: "OST_TitleBlocks" })).types.find((x) => x.name === C.titleBlock).id;
const sheet = (await call("create_sheet", { number: SN, name: "East Counter E-C1 - Steel Frame", title_block_type_id: tb })).id;
await setv(sheet, "Sheet Group", grp); await setv(sheet, "Sheet Package", "02 JOINERY & FABRICATION");
const tbi = (await call("query_elements", { category: "OST_TitleBlocks", view_id: sheet, limit: 5 })).elements[0]?.id;
for (const [n, v] of C.signoff) { await setv(sheet, n, v); if (tbi) await setv(tbi, n, v); }

// views
const sec = async (name, start, end, look, depth, top, bottom, sc = S) => {
  const id = (await call("create_section", { start, end, look_direction: look, bottom_mm: bottom, top_mm: top, depth_mm: depth, scale: sc })).id;
  await setv(id, "View Name", "EC1-ST " + name); await setv(id, "Title on Sheet", name); await setv(id, "Detail Level", 3);
  await call("set_view_display", { view_id: id, style: "HLR" }).catch(() => {});
  await call("set_view_categories", { view_id: id, hide: ["OST_Levels", "OST_Grids", "OST_Sections"] }).catch(() => {});
  return id;
};
const vF = await sec("Frame Front", P(X(42), Y(3890)), P(X(42), Y(-60)), P(1, 0), 560, 790, -30, L);
const vS = await sec("Section A (sink bay)", P(X(-25), Y(3490)), P(X(665), Y(3490)), P(0, 1), 330, 760, -30);
const vB = await sec("Section B (dry bay)", P(X(-25), Y(2170)), P(X(665), Y(2170)), P(0, 1), 330, 760, -30);
const lvl = (await call("list_levels", {})).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const vP = (await call("create_floor_plan", { level_id: lvl, name: "EC1-ST Plan" })).id;
for (const [n, v] of [["View Template", -1], ["View Scale", L], ["Detail Level", 3], ["Title on Sheet", "Plan at the top ring (+0.660)"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(vP, n, v);
await call("set_view_range", { view_id: vP, top_mm: 670, cut_mm: 660, bottom_mm: 0 }).catch((e) => console.log("range", e.message));
await call("set_view_crop", { view_id: vP, min_mm: P(X(-60), Y(-60)), max_mm: P(X(700), Y(3900)) });
await call("set_view_display", { view_id: vP, style: "HLR" }).catch(() => {});
await call("set_view_categories", { view_id: vP, hide: ["OST_Levels", "OST_Grids", "OST_Sections", "OST_Elev", "OST_Callouts"] }).catch(() => {});

// dimensions (family coords: front posts x 75-115, back 540-580; bay y 3169-3802; rings z 50-90 and 640-680)
const dim = (v, pts) => call("create_dimension_string", { view_id: v, points: pts, tick_mm: 12 }).catch((e) => console.log("dim", e.message.slice(0, 90)));
const zs = [0, 50, 90, 640, 680];
const YP = [38, 1791, 3182, 3751, 3791], XS = [0, 75, 115, 540, 580, 630];
await dim(vF, YP.map((y) => P(X(42), Y(y), 712)));
await dim(vF, [20, 3809].map((y) => P(X(42), Y(y), 760)));
await dim(vF, zs.map((z) => P(X(42), Y(3860), z)));
for (const [v, y] of [[vS, 3490], [vB, 2170]]) { await dim(v, XS.map((x) => P(X(x), Y(y), 712))); await dim(v, zs.map((z) => P(X(650), Y(y), z))); }
await dim(vP, [38, 78, 1791, 1831, 3169, 3209, 3751, 3791].map((y) => P(X(680), Y(y), 660)));
await dim(vP, [75, 115, 540, 580].map((x) => P(X(x), Y(3870), 660)));
const place = async (v, x, y) => (await call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(x, y) })).id;
await place(vF, 255, 735); await place(vB, 130, 515); await place(vS, 330, 515); await place(vP, 600, 555);

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
await txt(815, 812, "E-C1 STEEL FRAME   QTY 1\n3753 x 505 x 680 frame, inside E-C1 (A-2503)\nSHS 40x40x2 welded, painted; SS liner at the sink", bold);
await txt(815, 772, "CUT LIST - SHS 40x40x2 (S235)", bold);
await table(759, [815, 838, 960, 990], [["MARK", "PART", "LENGTH", "QTY"], ["S1", "Post (front 4, back 4)", "590", "8"], ["S2", "Rail front, end to mid post", "1713", "2"], ["S3", "Rail front, mid post to sink", "1351", "2"], ["S4", "Rail front, sink bay", "529", "2"], ["S5", "Rail back, end to mid post", "1713", "2"], ["S6", "Rail back, mid post to sink", "1338", "2"], ["S7", "Rail back, sink bay", "542", "2"], ["S8", "Cross rail", "425", "8"], ["", "Total 22.5 m: buy 5 x 6.0 m", "", ""]]);
await txt(815, 672, "PLATES AND FITTINGS", bold);
await table(659, [815, 945, 995], [["PART", "SIZE", "QTY"], ["Leg tab under front post", "60x40x5", "4"], ["Adjustable leg, steel, 50", "M10", "8"], ["Weld nut under each post", "M10", "8"], ["Self-drill screw, liner", "4.2x16", "24"], ["Clear silicone", "310 ml", "1"]]);
await txt(815, 604, "STAINLESS 304 BRUSHED 1.2 - FLAT SIZES", bold);
await table(591, [815, 945, 995], [["PART", "FLAT", "QTY"], ["Tray 540x622, 40 up all round", "620x702", "1"], ["Back sheet, to the top ring", "622x590", "1"], ["End liner, on the end panel", "540x550", "1"], ["Total 1.08 m2: 1 sheet 2440x1220", "", ""]]);
await txt(815, 542, "NOTES", bold);
await txt(815, 529, ["Weld all joints: fillet 3 all round, grind", "smooth. Frame square within 2 mm over 3.8 m.", "Paint: zinc primer + 2 coats grey.", "One welded frame 3753 long: check site access;", "if needed, split at the mid post with bolted plates.", "MR bottom board sits on the rings (+0.090),", "notched round the posts. Dividers stand on it.", "Front posts stand 2 mm clear of the sink bowl.", "Front legs sit on tabs behind the kick line.", "Top ring carries the marble top at +0.680.", "Grommets sit in front of the back rail.", "Sink tray: notch, fold, weld corners, seal.", "All dimensions in mm. Check on site before cutting."].join("\n"));
console.log("sheet", sheet, SN, JSON.stringify({ vF, vS, vP, kp }));
