// Scales a unit's 3D view to fill a free area on its sheet, given in sheet mm as x0,x1,y0,y1 (read it off the render). Text note extents cannot be read on a sheet.
// Usage: node fit3d.mjs "<sheet number>=<unit family name>@x0,x1,y0,y1" ...   or import { fit3d }. Isolates the view on the unit first.
import { call } from "./rvt.mjs";
import { sn } from "./sheetno.mjs";

export async function fit3d(sheetId, viewId, unitId, [X0, X1, Y0, top] = [690, 1005, 45, 560]) {
  await call("isolate_in_view", { view_id: viewId, element_ids: [unitId] });
  // Isolation does not hide linked models: hide the links category too.
  await call("set_view_categories", { view_id: viewId, hide: ["OST_RvtLinks"] }).catch(() => {});
  const vname = (await call("get_element", { element_id: viewId })).name;
  const vps = (await call("query_elements", { category: "OST_Viewports", view_id: sheetId, limit: 200 })).elements;
  let vp = null; for (const v of vps) { const g = await call("get_element", { element_id: v.id }); if (g.parameters?.some((q) => q.name === "View" && q.value === vname)) { vp = v.id; break; } }
  if (!vp) throw new Error("no viewport for " + vname);
  // Paper size of Revit's default isometric view from the visible model box: width (dx + dy) / sqrt 2, height 0.816 dz + 0.408 (dx + dy).
  const B = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const id of [unitId]) {
    const b = (await call("get_element", { element_id: id })).bounding_box;
    B.x0 = Math.min(B.x0, b.min.x); B.x1 = Math.max(B.x1, b.max.x); B.y0 = Math.min(B.y0, b.min.y); B.y1 = Math.max(B.y1, b.max.y); B.z0 = Math.min(B.z0, b.min.z); B.z1 = Math.max(B.z1, b.max.z);
  }
  const dx = B.x1 - B.x0, dy = B.y1 - B.y0, dz = B.z1 - B.z0, w = 0.866 * (dx + dy), h = dz + 0.5 * (dx + dy), aw = X1 - X0, ah = top - Y0 - 20;
  // Smallest whole scale that fits, leaving about 20 mm for the view title.
  const s2 = Math.ceil(Math.max(w / aw, h / ah));
  const vpId = vp;
  await call("set_parameter", { element_id: viewId, parameter_name: "View Scale", value: s2 });
  await call("delete_elements", { element_ids: [vpId] });
  const r = await call("place_view_on_sheet", { sheet_id: sheetId, view_id: viewId, location: { x: (X0 + X1) / 2, y: (Y0 + top) / 2 + 8, z: 0 } });
  return { scale: s2, top: Math.round(top), viewport: r.id };
}

if (process.argv[1]?.endsWith("fit3d.mjs")) {
  const views = (await call("list_views", {})).views;
  const sheets = (await call("query_elements", { category: "OST_Sheets", limit: 500 })).elements;
  const units = []; for (const c of ["OST_Furniture", "OST_Casework", "OST_GenericModel"]) units.push(...(await call("query_elements", { category: c, limit: 1000 })).elements);
  for (const arg of process.argv.slice(2)) {
    const [no, rest] = arg.split("="), [fam, box] = rest.split("@"), rect = box ? box.split(",").map(Number) : undefined, u = units.find((e) => e.name === fam && !e.location?.rotation_deg); if (!u) { console.log(no, "no unit", fam); continue; }
    const v = views.find((x) => x.name === `J${no}-3D View`); if (!v) { console.log(no, "no 3D view"); continue; }
    let sid = null; for (const s of sheets) { const g = await call("get_element", { element_id: s.id }); if (g.parameters.find((q) => q.name === "Sheet Number")?.value === `${sn(no)}`) { sid = s.id; break; } }
    console.log(no, JSON.stringify(await fit3d(sid, v.id, u.id, rect)));
  }
}
