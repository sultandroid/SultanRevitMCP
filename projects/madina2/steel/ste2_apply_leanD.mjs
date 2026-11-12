// ST-E2 lean hung design D (Robot hungD, SBC 301 gravity + notional, SBC 306 check, 12 Nov 2026): from the original frame remove
// both plan braces, the bottom back rail, the right back diagonal and every second truss diagonal (TD2, 4, 6, 8, 10).
// Shelf plates stay flat 116x10, hung at 2 points per joint from the HG-E cross members (flat bars in the arch seam).
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" }, id = 1370526;
const g = await call("get_element", { ...D, element_id: id }), L = g.location.point;
const W = (i) => [i.min.x + L.x, i.min.y + L.y, i.min.z, i.max.x + L.x, i.max.y + L.y, i.max.z].map(Math.round);
const near = (a, b) => a.every((v, k) => Math.abs(v - b[k]) <= 3);
const drop = [[5752, 788, 2880, 6336, 2125, 2920], [5751, 3467, 2880, 6337, 4972, 2920], [6318, 756, 8, 6358, 5005, 48], [6318, 3456, 39, 6358, 4983, 2889],
  [5730, 1190, 2800, 5770, 1593, 2900], [5730, 1984, 2800, 5770, 2387, 2900], [5730, 2778, 2800, 5770, 3180, 2900], [5730, 3571, 2800, 5770, 3974, 2900], [5730, 4365, 2800, 5770, 4768, 2900]];
const forms = (await call("inspect_family", { ...D, element_id: id })).items.filter((i) => /Free|Extr/.test(i.class));
const del = forms.filter((i) => drop.some((b) => near(W(i), b)));
if (del.length !== 9) throw new Error("expected 9, found " + del.length);
console.log(JSON.stringify(await call("edit_family_solids", { ...D, element_id: id, delete_form_ids: del.map((i) => i.id) })));
const c = g.parameters.find((p) => p.name === "Comments").value.replace(/ Free-standing check[\s\S]*$/, "");
await call("set_parameter", { ...D, element_id: id, parameter_name: "Comments", value: c + " Lean hung design (12 Nov 2026, Robot + SBC 301/306, projects/madina2/steel hungD): stand-alone, no bolts or anchors; plan braces, bottom back rail, one back diagonal and every second truss diagonal removed; flat shelf plates 116x10 hung from the East Arch Hangers by 40x6 flat bars in the arch seam. Max ratio 0.28, plate deflection 2.8 mm, all feet in compression (min 0.13 kN). SHS 51.5 m (119 kg)." });
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-30));
