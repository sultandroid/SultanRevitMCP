// Madina 2 A-2119 East Steel Frame ST-E2 (user 16 Nov 2026: "the steel that hold the arches"): dimensions fab_sheet does not
// add. Re-run after `node tools/fab_sheet.mjs projects/madina2/fab_config.json ST-E2` (scale 1:20 so all views fit).
// Front Elevation: heights 0 / +1.480 rail / +1.907 shelf plates / +2.780 bottom chord / +2.920 top, on the left.
// Top View: post centres 776 / 2138 / 3454 / 4985 (the elevation's horizontal chain crossed keynote 7, so it lives here).
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" };
const views = (await call("list_views", D)).views, V = (re) => views.find((v) => re.test(v.name)).id;
const fe = V(/2119-Front Elevation$/), tv = V(/2119-Top View$/);
await call("create_dimension_string", { ...D, view_id: fe, points: [0, 1480, 1907, 2780, 2920].map((z) => ({ x: 5730, y: 556, z })), tick_mm: 2 });
await call("create_dimension_string", { ...D, view_id: tv, points: [776, 2138, 3454, 4985].map((y) => ({ x: 5600, y, z: 2000 })), tick_mm: 2 });
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-40));
