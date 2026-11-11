// Madina 2 E-C1: 10 mm tolerance each side (user 11 Nov 2026: "make tolerance in width" -> "10 each side").
// Clear space between the east arch legs: world y 871..4720 = 3849. Counter 3840 -> 3829: the sink bay loses 11 at the far end
// (633 -> 622 inner), sink and tap stay centred in the bay, then the counter moves +9 so both ends sit 10 from the arch legs.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" }, id = 391666, CUT = 11, TAP = 560874;
const fi = await call("inspect_family", { ...D, element_id: id });
const P = fi.items.filter((i) => /FreeForm|Extrusion/.test(i.class));
const isSink = (i) => /^Sink /.test(i.material ?? "");
const moveEnd = P.filter((i) => !isSink(i) && i.min.y >= 3735).map((i) => i.id);                       // end panel, end posts, legs, return, handle, end liner
const shorten = P.filter((i) => !isSink(i) && i.min.y < 3735 && i.max.y > 3700);                        // top, kicks, rear back, rails, tray, back sheet, sink door
const sink = P.filter(isSink).map((i) => i.id);
const add = shorten.map((i) => ({ min: { x: i.min.x, y: i.min.y, z: i.min.z }, max: { x: i.max.x, y: i.max.y - CUT, z: i.max.z }, material: i.material }));
console.log("move", moveEnd.length, "shorten", shorten.length, shorten.map((i) => `${i.material.slice(0, 24)} ${Math.round(i.min.y)}-${Math.round(i.max.y)}`).join(" | "));
const r = await call("edit_family_solids", { ...D, element_id: id, delete_form_ids: shorten.map((i) => i.id), add,
  move: [{ ids: moveEnd, dx_mm: 0, dy_mm: -CUT, dz_mm: 0 }, { ids: sink, dx_mm: 0, dy_mm: -CUT / 2, dz_mm: 0 }] });
console.log("deleted", r.deleted, "added", r.added.length);
await call("move_elements", { ...D, element_ids: [id], dx_mm: 0, dy_mm: 9, dz_mm: 0 });
await call("move_elements", { ...D, element_ids: [TAP], dx_mm: 0, dy_mm: 9 - CUT / 2, dz_mm: 0 });
