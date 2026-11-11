// Madina 2 ST-E2: undo ste2_rear_end_13.mjs (user via the sheets session, 11 Nov 2026: FL-A was rebuilt flush with the arch
// fronts instead, "do NOT move the steel"). Rear posts back to front face world y 4965, base plates 4935..5035.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" }, id = 1370526, ST = "SHS 40x40x2 Steel Approved", BP = "Steel Base Plate 8 Approved";
const fi = await call("inspect_family", { ...D, element_id: id });
const F = fi.items.filter((i) => i.class === "FreeFormElement" || i.class === "Extrusion");
const at = (i) => [i.min.x, i.min.y, i.min.z, i.max.x, i.max.y, i.max.z].map(Math.round).join(",");
const pick = (s) => { const f = F.filter((i) => at(i) === s); if (f.length !== 1) throw new Error("not found once: " + s); return f[0]; };
const moveIds = ["30,4252,8,70,4292,2920", "70,4252,2880,618,4292,2920", "50,4252,56,638,4292,2884", "618,4252,48,658,4292,2880"].map((s) => pick(s).id);
const del = ["0,4252,0,100,4352,8", "608,4252,0,658,4352,8", "30,70,2780,70,4252,2820", "30,70,2880,70,4252,2920",
  "618,30,8,658,4292,48", "618,30,1480,658,4292,1520", "618,30,2880,658,4292,2920"].map((s) => pick(s).id);
const B = (x0, y0, z0, x1, y1, z1, material) => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, material });
const add = [B(0, 4209, 0, 100, 4309, 8, BP), B(608, 4209, 0, 658, 4309, 8, BP), B(30, 70, 2780, 70, 4239, 2820, ST), B(30, 70, 2880, 70, 4239, 2920, ST),
  B(618, 30, 8, 658, 4279, 48, ST), B(618, 30, 1480, 658, 4279, 1520, ST), B(618, 30, 2880, 658, 4279, 2920, ST)];
const r = await call("edit_family_solids", { ...D, element_id: id, delete_form_ids: del, add, move: [{ ids: moveIds, dx_mm: 0, dy_mm: -13, dz_mm: 0 }] });
console.log("deleted", r.deleted, "added", r.added.length, JSON.stringify((await call("get_element", { ...D, element_id: id })).bounding_box));
