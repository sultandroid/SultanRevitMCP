// NOTE: as built, the front posts and front rails sit at x 75-115 (front posts y Y0+13..Y0+53 to clear the hinge plates) and the
// front legs at x 101-126 on tabs: the first run below (x 120-160) clashed with the sink bowl at x 117 and was moved.
// Madina 2 E-C1 sink bay (user 11 Nov 2026, "Hybrid, steel at sink"): family coords, x 0 = room face, y along the run, z up.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" }, id = 391666;
const B = (x0, y0, z0, x1, y1, z1, material, color) => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, material, ...(color ? { color } : {}) });
const MR = "EGGER White Carcass 18 MR", MRB = "EGGER White Back 8 MR", ST = "SHS 40x40x2 Steel Approved", SS = "Stainless Steel 304 Brushed 1.2", FT = "Adjustable Leg Steel 50";
const W = { r: 238, g: 238, b: 234 }, SSC = { r: 200, g: 202, b: 205 };
const Y0 = 3169, Y1 = 3802;                     // sink bay between the last divider and the end panel
const add = [
  // carcass parts that ran through the sink bay, now stopping at the divider (MR board)
  B(38, 38, 50, 630, Y0, 68, MR, W),            // bottom
  B(544, 38, 68, 552, Y0, 662, MRB, W),         // inner back (pipe void behind it)
  // SHS 40x40x2 frame: posts, bottom and top rings (top ring carries the marble top at +0.680)
  ...[[120, 160], [540, 580]].flatMap(([a, b]) => [[Y0, Y0 + 40], [Y1 - 40, Y1]].map(([c, d]) => B(a, c, 50, b, d, 640, ST))),
  ...[[50, 90], [640, 680]].flatMap(([z0, z1]) => [
    B(120, Y0 + 40, z0, 160, Y1 - 40, z1, ST), B(540, Y0 + 40, z0, 580, Y1 - 40, z1, ST),
    B(160, Y0, z0, 540, Y0 + 40, z1, ST), B(160, Y1 - 40, z0, 540, Y1, z1, ST)]),
  // adjustable feet under the 4 posts, inside the kick line
  ...[[125, 155], [545, 575]].flatMap(([a, b]) => [[Y0 + 5, Y0 + 35], [Y1 - 35, Y1 - 5]].map(([c, d]) => B(a, c, 0, b, d, 50, FT, { r: 90, g: 90, b: 90 }))),
  // stainless 304 liner: folded tray with 40 upstands, back sheet to the top, end liner on the end panel
  B(40, Y0, 90, 580, Y1, 91.5, SS, SSC),
  B(40, Y0, 91.5, 41.5, Y1, 130, SS), B(578.5, Y0, 91.5, 580, Y1, 130, SS),
  B(41.5, Y0, 91.5, 578.5, Y0 + 1.5, 130, SS),
  B(580, Y0, 91.5, 581.5, Y1, 680, SS),
  B(40, Y1 - 1.5, 91.5, 580, Y1, 640, SS),
];
const r = await call("edit_family_solids", { ...D, element_id: id, delete_form_ids: [1287050, 1287658, 1287045], add });
console.log("edit", JSON.stringify(r).slice(0, 300));
// whole counter in moisture-resistant board, stainless kick
const fi = await call("inspect_family", { ...D, element_id: id });
const ids = (re) => fi.items.filter((i) => re.test(i.material ?? "")).map((i) => i.id);
for (const [re, m, c] of [[/^EGGER White Carcass 18$/, MR, W], [/^EGGER White Back 8$/, MRB, W], [/^Softwood Skirting Black$/, "Stainless Steel 304 Brushed Kick 1.2 on MR MDF", SSC]]) {
  const f = ids(re); if (!f.length) continue;
  console.log(m, JSON.stringify(await call("set_family_material", { ...D, element_id: id, material: m, color: c, form_ids: f })));
}
await call("set_parameter", { ...D, element_id: id, parameter_name: "Comments", value: "East counter 3840 x 640 x 700, 3 drawers and 5 framed rattan doors, travertine top 20 | Sink bay (last bay, 633 wide): SHS 40x40x2 frame (4 posts, bottom and top rings, top ring carries the marble top), 4 adjustable feet behind the kick, stainless 304 brushed 1.2 folded tray (40 upstands), back sheet and end liner; pipe void behind; sink in a cut-out in the travertine top, edges sealed (user, 11 Nov 2026: hybrid, steel at the sink) | Carcasses and backs in moisture-resistant EGGER board (MR); kick stainless 304 brushed 1.2 on MR MDF | Factory base cabinet standard, door frames from user's Elevation A | 8 bar handles (5 doors, 3 drawers), 2 half overlay hinges per door, hinges on the right facing the counter, in plastic dowels" });
const g = await call("get_element", { ...D, element_id: id });
console.log(JSON.stringify(g.location), JSON.stringify(g.bounding_box));
