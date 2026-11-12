// Apply the Robot v4 design (SBC 301/306, 11 Nov 2026) to ST-E2: remove the 2 back diagonals and the bottom back rail,
// fin 80x8 under each shelf plate (T 116x90), 4 wall-tie plates (back posts to the east wall). Then refresh the analytical lines.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import fs from "node:fs";
const D = { document: "Madina2_ARCH_01" }, id = 1370526;
const g = await call("get_element", { ...D, element_id: id }), L = g.location.point;
const W = (i) => [i.min.x + L.x, i.min.y + L.y, i.min.z, i.max.x + L.x, i.max.y + L.y, i.max.z].map(Math.round);
const near = (a, b) => a.every((v, k) => Math.abs(v - b[k]) <= 2);
const fi = await call("inspect_family", { ...D, element_id: id });
const forms = fi.items.filter((i) => /Free|Extr/.test(i.class));
const drop = forms.filter((i) => [[6318, 778, 40, 6358, 2136, 2888], [6318, 3456, 39, 6358, 4983, 2889], [6318, 756, 8, 6358, 5005, 48]].some((b) => near(W(i), b)));
if (drop.length !== 3) throw new Error("expected 3 parts to drop, found " + drop.length);
const B = (x0, y0, z0, x1, y1, z1, material) => ({ min: { x: x0 - L.x, y: y0 - L.y, z: z0 }, max: { x: x1 - L.x, y: y1 - L.y, z: z1 }, material });
const PL = "Steel Plate 10 Approved";
const add = [];
for (const y of [2138, 3454]) add.push(B(5730, y - 4, 1817, 6318, y + 4, 1897, PL));                       // fin 80x8 under the shelf plate
for (const [y, z] of [[776, 2900], [4985, 2900], [2138, 1902], [2138, 2900], [3454, 1902], [3454, 2900]].filter(([y, z]) => !(z === 2900 && (y === 2138 || y === 3454)) || true))
  add.push(B(6318, y + 20, z - 40, 6360, y + 26, z + 40, "Steel Base Plate 8 Approved"));                  // tie plate on the post side, anchored into the wall
const r = await call("edit_family_solids", { ...D, element_id: id, delete_form_ids: drop.map((i) => i.id), add });
console.log("family", JSON.stringify(r).slice(0, 120));
const c = g.parameters.find((p) => p.name === "Comments").value;
await call("set_parameter", { ...D, element_id: id, parameter_name: "Comments", value: c + " | v4 (Robot + SBC 301/306 check, 11 Nov 2026): back diagonals and bottom back rail removed; shelf plates stiffened with 80x8 fin (T 116x90); 6 wall-tie plates 80x6 with M10 anchors into the east wall at the back posts (+2.90 corners and joints, +1.90 joints); HG-E cross members part of the frame. Calc: projects/madina2/steel (Madina2_ST-E2_v4.rtd)." });
// analytical lines: remove BD1, BD2, BR28; add HG1, HG2
const ids = JSON.parse(fs.readFileSync("projects/madina2/steel/ste2_revit_ids.json"));
const del = [];
for (const aid of ids) { const e = await call("get_element", { ...D, element_id: aid }).catch(() => null); const cm = e?.parameters.find((p) => p.name === "Comments")?.value ?? ""; if (/ (BD1|BD2|BR28) /.test(cm + " ")) del.push(aid); }
if (del.length) await call("delete_elements", { ...D, element_ids: del });
const hg = await call("create_analytical_members", { ...D, members: [2138, 3454].map((y, i) => ({ start: { x: 5750, y, z: 2900 }, end: { x: 6338, y, z: 2900 }, role: "beam", release_start: "fixed", release_end: "fixed", comments: `ST-E2 HG${i + 1} SHS 40x40x2 - HG-E cross member` })) });
fs.writeFileSync("projects/madina2/steel/ste2_revit_ids.json", JSON.stringify([...ids.filter((x) => !del.includes(x)), ...hg.ids]));
console.log("analytical removed", del.length, "added", hg.created);
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-30));
