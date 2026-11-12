// Rebuild ST-E2 as the minimal wall-fixed frame (Robot "min", SBC 301/306, 11 Nov 2026): keep the back frame (posts, rails
// +1.500/+2.900, base plates), shelf T brackets and wall-tie plates; remove everything in front of the back line.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import fs from "node:fs";
const D = { document: "Madina2_ARCH_01" }, id = 1370526;
const g = await call("get_element", { ...D, element_id: id }), L = g.location.point;
const fi = await call("inspect_family", { ...D, element_id: id });
const forms = fi.items.filter((i) => /Free|Extr/.test(i.class)).map((i) => ({ id: i.id, x0: i.min.x + L.x, z0: i.min.z, z1: i.max.z, m: i.material }));
const keepShelf = (f) => f.z0 >= 1816 && f.z1 <= 1908;                     // shelf plates + fins
const drop = forms.filter((f) => f.x0 < 6300 && !keepShelf(f));
console.log("forms", forms.length, "drop", drop.length, "keep", forms.length - drop.length);
const r = await call("edit_family_solids", { ...D, element_id: id, delete_form_ids: drop.map((f) => f.id) });
console.log(JSON.stringify(r).slice(0, 60));
await call("set_parameter", { ...D, element_id: id, parameter_name: "Comments", value: "East steel ST-E2, MINIMAL WALL-FIXED FRAME (user, 11 Nov 2026; Robot + SBC 301/306 check, projects/madina2/steel/Madina2_ST-E2_min.rtd): 4 back posts SHS 40x40x2 on base plates, rails +1.500 and +2.900, tied to the existing east wall with 6 plates and M10 anchors (+2.90 all posts, +1.90 joint posts; wall type to confirm on site). Shelf brackets at the arch joints: PL 116x10 + 80x8 fin (T 116x90) welded to the joint posts, carry shelf ES-1. Arch tops held back by the HG-E cross members to the +2.900 rail. Front posts, front truss, end frames, plan braces and back diagonals removed. Max ratio 0.66, shelf tip 4.1 mm (L/125 = 4.9)." });
const ids = JSON.parse(fs.readFileSync("projects/madina2/steel/ste2_revit_ids.json"));
const del = [];
for (const aid of ids) { const e = await call("get_element", { ...D, element_id: aid }).catch(() => null); const cm = (e?.parameters.find((p) => p.name === "Comments")?.value ?? "") + " ";
  if (/ST-E2 (FP\d|TC|BC|TD\d+|ER\d|ED\d|PB\d) /.test(cm)) del.push(aid); }
if (del.length) await call("delete_elements", { ...D, element_ids: del });
fs.writeFileSync("projects/madina2/steel/ste2_revit_ids.json", JSON.stringify(ids.filter((x) => !del.includes(x))));
console.log("analytical removed", del.length, "left", ids.length - del.length);
const g2 = await call("get_element", { ...D, element_id: id }); console.log(JSON.stringify(g2.bounding_box));
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-30));
