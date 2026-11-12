// One way to make a 3D view of a unit for a sheet, so the same faults do not come back:
//  - a fresh view, never a duplicate of "3D all" (that carries its section box, hidden categories and overrides);
//  - a section box round the unit plus a margin, so neighbours and the shell stay out;
//  - the unit isolated, linked models hidden (isolation does not hide links: their light fittings showed on A-2101);
//  - the scale worked out from the unit's box projected on the view plane, not guessed;
//  - an empty view is caught before place_view_on_sheet, which otherwise fails with "Object reference not set".
// Usage: import { unit3d } from "./view3d.mjs"; await unit3d(call, { name, ids, sheet, area: [x0, x1, y0, y1] })
//        node view3d.mjs <element id> [<element id> ...]   (makes "CHECK 3D <id>" and saves a PNG next to this file)

const ISO = { "front-left": [1, 1, -1], "front-right": [-1, 1, -1], "back-left": [1, -1, -1], "back-right": [-1, -1, -1] };
const unit = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Bounding box round several elements, in model mm. */
export async function boxOf(call, ids) {
  const B = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const id of ids) {
    const b = (await call("get_element", { element_id: id })).bounding_box;
    if (!b) throw new Error(`Element ${id} has no bounding box`);
    ["x", "y", "z"].forEach((k, i) => { B.min[i] = Math.min(B.min[i], b.min[k]); B.max[i] = Math.max(B.max[i], b.max[k]); });
  }
  return B;
}

/** Width and height (mm) the box takes up in a view looking along `fwd`: the 8 corners projected on the view's right and up axes. */
export function projected(B, fwd) {
  const f = unit(fwd), r0 = cross(f, [0, 0, 1]), right = Math.hypot(...r0) < 1e-9 ? [1, 0, 0] : unit(r0), up = unit(cross(right, f));
  const us = [], vs = [];
  for (const x of [B.min[0], B.max[0]]) for (const y of [B.min[1], B.max[1]]) for (const z of [B.min[2], B.max[2]]) { us.push(dot([x, y, z], right)); vs.push(dot([x, y, z], up)); }
  return { w: Math.max(...us) - Math.min(...us), h: Math.max(...vs) - Math.min(...vs) };
}

/**
 * Makes (or remakes) a 3D view of `ids` and, when `sheet` and `area` are given, places it scaled to fill that area.
 * area is [x0, x1, y0, y1] in sheet mm; `title` leaves room under the box for the view title.
 * Returns { view, scale, viewport, w, h }.
 */
export async function unit3d(call, { name, ids, sheet = null, area = null, dir = "front-left", margin = 30, style = "ShadingWithEdges", title = 20, isolate = true, scales = null, box = null }) {
  // `box` ({min:[x,y,z], max:[x,y,z]}) overrides the element boxes: Casework families made from Metric Casework.rft report a box
  // inflated by the template's camera, so pass the box of the family's own solids for those.
  const B = box ?? await boxOf(call, ids);
  const lo = B.min.map((v) => v - margin), hi = B.max.map((v) => v + margin);
  const c = B.min.map((v, i) => (v + B.max[i]) / 2), f = ISO[dir] ?? dir, d = 10000;
  const P = (a) => ({ x: a[0], y: a[1], z: a[2] });
  const v = await call("create_3d_view", { name, eye: P(c.map((ci, i) => ci - f[i] * d)), target: P(c), style, box_min: P(lo), box_max: P(hi) });
  const view = v.id ?? v.view_id;
  if (isolate) await call("isolate_in_view", { view_id: view, element_ids: ids });
  await call("set_view_categories", { view_id: view, hide: ["OST_RvtLinks", "OST_SectionBox", "OST_Levels", "OST_Grids", "OST_CLines"] }).catch(() => {});
  await call("set_parameter", { element_id: view, parameter_name: "Detail Level", value: 3 }).catch(() => {});
  await call("set_parameter", { element_id: view, parameter_name: "Crop Region Visible", value: 0 }).catch(() => {}); // no border on sheets
  const counts = (await call("view_category_counts", { view_id: view })).counts ?? {};
  const shown = Object.entries(counts).filter(([k]) => !["Cameras", "Element", "Section Boxes"].includes(k)).reduce((a, [, n]) => a + n, 0);
  if (!shown) throw new Error(`3D view "${name}" shows nothing: check the section box and the isolated ids`);
  const { w, h } = projected({ min: lo, max: hi }, f);
  if (!sheet || !area) return { view, w, h };
  const [x0, x1, y0, y1] = area, aw = x1 - x0, ah = y1 - y0 - title;
  const need = Math.max(w / aw, h / ah);
  const scale = scales ? (scales.find((s) => s >= need) ?? scales[scales.length - 1]) : Math.ceil(need);
  await call("set_parameter", { element_id: view, parameter_name: "View Scale", value: scale });
  await call("set_parameter", { element_id: view, parameter_name: "Title on Sheet", value: "3D View" }).catch(() => {});
  const vp = await call("place_view_on_sheet", { sheet_id: sheet, view_id: view, location: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + title / 2, z: 0 } });
  return { view, scale, viewport: vp.id, w, h };
}

if (process.argv[1]?.endsWith("view3d.mjs") && process.argv.length > 2) {
  const { call } = await import(process.env.RVT_CLIENT ?? "./rvt.mjs");
  const { writeFileSync } = await import("node:fs");
  for (const id of process.argv.slice(2).map(Number)) {
    const r = await unit3d(call, { name: `CHECK 3D ${id}`, ids: [id] });
    const im = await call("export_view_image", { view_id: r.view, pixel_size: 1200 });
    writeFileSync(`check3d_${id}.png`, Buffer.from(im.data_base64, "base64"));
    console.log(id, "view", r.view, "projected", Math.round(r.w), "x", Math.round(r.h), "mm");
  }
}
