// Madina 2 A-2702 CF-1: 1:2 box section through a member and 1:5 mitre corner plan, plus its own revision.
import { call as raw } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" }, call = (n, a = {}) => raw(n, { ...D, ...a });
const P = (x, y, z = 0) => ({ x, y, z });
const setv = (id, n, v) => call("set_parameter", { element_id: id, parameter_name: n, value: v }).catch((e) => console.log("set", n, e.message.slice(0, 70)));
let sheet = null;
for (const s of (await call("query_elements", { category: "OST_Sheets", limit: 500 })).elements) {
  const g = await call("get_element", { element_id: s.id }); if (/2702$/.test(g.parameters.find((p) => p.name === "Sheet Number")?.value)) sheet = s.id;
}
for (const v of (await call("list_views", {})).views.filter((v) => /^CF1-D /.test(v.name))) await call("delete_elements", { element_ids: [v.id] }).catch(() => {});
const dim = (v, pts) => call("create_dimension_string", { view_id: v, points: pts, tick_mm: 6 }).catch((e) => console.log("dim", e.message.slice(0, 90)));
// frame: x 2130..4510, y 1990..3720, z 3100..3200; front member y 1990..2090
// Detail A: a section made with create_section here drew no CF-1 at all (cause not found, 11 Nov 2026), so it is a copy
// of the fab_sheet Section A (which draws it) at 1:2, cropped in the view's own coordinates to the front member's U.
const secA = (await call("list_views", {})).views.find((v) => /2702-Section A$/.test(v.name)).id;
const vA = (await call("duplicate_view", { view_id: secA, name: "CF1-D Box Section", option: "Duplicate" })).id;
await setv(vA, "View Scale", 2); await setv(vA, "Title on Sheet", "Detail A: box section");
await call("set_view_crop", { view_id: vA, min_mm: P(2420, 90), max_mm: P(2640, 310) });
const lvl = (await call("list_levels", {})).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const vB = (await call("create_floor_plan", { level_id: lvl, name: "CF1-D Mitre Corner" })).id;
for (const [n, v] of [["View Template", -1], ["View Scale", 2], ["Detail Level", 3], ["Title on Sheet", "Detail B: mitre corner"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(vB, n, v);
await call("set_view_range", { view_id: vB, top_mm: 3190, cut_mm: 3150, bottom_mm: 3110 }).catch((e) => console.log("range", e.message));
await call("set_view_crop", { view_id: vB, min_mm: P(2110, 1970), max_mm: P(2270, 2130) });
await call("set_view_display", { view_id: vB, style: "HLR" }).catch(() => {});
await call("set_view_categories", { view_id: vB, hide: ["OST_Levels", "OST_Grids", "OST_Sections", "OST_Elev", "OST_Callouts"] }).catch(() => {});
await dim(vB, [2130, 2148, 2212, 2230].map((x) => P(x, 2118, 3150)));
await dim(vB, [1990, 2008, 2072, 2090].map((y) => P(2258, y, 3150)));
for (const v of [vA, vB]) await call("set_element_overrides", { view_id: v, element_ids: [572716], hide_patterns: true }); // show the 45 joints
for (const [v, x, y] of [[vA, 380, 400], [vB, 520, 400]]) await call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(x, y) });
await call("set_sheet_revisions", { sheet_ids: [sheet], revision_ids: [1427797, 1463701] });
await call("create_text_note", { view_id: sheet, location: P(160, 285), text: "U 100 x 100, open top\n18 FR MDF + oak veneer\nall joints 45", text_type_id: (await call("ensure_text_type", { name: "Sheet Note 5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id });
console.log("details", vA, vB);
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-40));
