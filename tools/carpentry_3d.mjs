// Carpentry 3D model for a fabrication package: a 3D view with only the carpentry work (casework, furniture, wood generic models,
// wood ceiling parts such as oak beams), exported as DWG with TRUE 3D solids (ACIS), not mesh, into the package's
// "3D Model (carpentry)" folder. Check it afterwards with acad_solids_check.ps1 (3DSOLID count, no POLYFACE/MESH).
//
// Usage: node tools/carpentry_3d.mjs <config.json>
// Config: { doc, box: {min:{x,y,z}, max:{x,y,z}} (the shop, mm), out: "<package folder>/3D Model (carpentry)",
//           file: "MD1 Carpentry 3D Model Rev 05 (solids)",
//           hideNames: ["Marble Top", "Prayer Carpet"]   // family or element names (regex) of non-carpentry items in kept categories
//           hideIds: [ ... ]                            // e.g. gypsum ceilings when oak beams share the Ceilings category
//           keepCategories?: [...] }                    // default: Casework, Furniture, Generic Models, Ceilings
// First used on Madina 1 (5 Nov 2026): 1,195 solids, no mesh.
import { readFileSync, writeFileSync } from "node:fs";
import { call as raw } from "./rvt.mjs";
const C = JSON.parse(readFileSync(process.argv[2], "utf8"));
const call = (n, a = {}) => raw(n, { document: C.doc, ...a });
const NAME = "FAB-3D Carpentry";
const keep = new Set(C.keepCategories ?? ["Casework", "Furniture", "Generic Models", "Ceilings"]);
const old = (await call("list_views", {})).views.filter((v) => v.name === NAME).map((v) => v.id);
if (old.length) await call("delete_elements", { element_ids: old });
const { min, max } = C.box, c = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
const v = await call("create_3d_view", { name: NAME, eye: { x: c.x - 20000, y: c.y - 20000, z: c.z + 20000 }, target: c, style: "ShadingWithEdges", box_min: min, box_max: max });
const id = v.id ?? v.view_id;
// Hide every category that is not carpentry (by what the view actually shows), plus links and annotation.
const counts = (await call("view_category_counts", { view_id: id })).counts ?? {};
const cats = Object.keys(counts);
const OST = { "Communication Devices": "OST_CommunicationDevices", "Data Devices": "OST_DataDevices", Doors: "OST_Doors", Windows: "OST_Windows", "Electrical Equipment": "OST_ElectricalEquipment", "Electrical Fixtures": "OST_ElectricalFixtures", "Fire Alarm Devices": "OST_FireAlarmDevices", "Lighting Fixtures": "OST_LightingFixtures", "Lighting Devices": "OST_LightingDevices", "Security Devices": "OST_SecurityDevices", "Mechanical Equipment": "OST_MechanicalEquipment", "Ducts": "OST_DuctCurves", "Air Terminals": "OST_DuctTerminal", "Plumbing Fixtures": "OST_PlumbingFixtures", "Pipes": "OST_PipeCurves", Walls: "OST_Walls", Floors: "OST_Floors", Roofs: "OST_Roofs", Columns: "OST_Columns", "Structural Framing": "OST_StructuralFraming", "Structural Columns": "OST_StructuralColumns", "Specialty Equipment": "OST_SpecialityEquipment", "Conduits": "OST_Conduit", "Cable Trays": "OST_CableTray", Stairs: "OST_Stairs", Railings: "OST_StairsRailing", Rooms: "OST_Rooms", Topography: "OST_Topography", Ceilings: "OST_Ceilings", Cameras: "OST_Cameras", Planting: "OST_Planting", Entourage: "OST_Entourage" };
const hide = ["OST_RvtLinks", "OST_SectionBox", "OST_Levels", "OST_Grids", "OST_CLines", ...cats.filter((k) => !keep.has(k) && OST[k]).map((k) => OST[k])];
for (const h of hide) await call("set_view_categories", { view_id: id, hide: [h] }).catch(() => {});
const re = C.hideNames?.length ? new RegExp(C.hideNames.join("|"), "i") : null, ids = [...(C.hideIds ?? [])];
if (re) for (const cat of ["OST_Casework", "OST_Furniture", "OST_GenericModel", "OST_Ceilings"]) for (const e of (await call("query_elements", { view_id: id, category: cat, limit: 2000 })).elements) if (re.test(e.family ?? e.name)) ids.push(e.id);
if (ids.length) await call("hide_elements", { view_id: id, element_ids: ids });
const left = (await call("view_category_counts", { view_id: id })).counts;
const im = await call("export_view_image", { view_id: id, pixel_size: 2000 });
writeFileSync(`${C.out}/${C.file} (check).png`, Buffer.from(im.data_base64, "base64"));
const r = await call("export_view_dwg", { view_id: id, folder: C.out, file_name: C.file, solids: "acis" });
console.log("view", id, "shown", JSON.stringify(left), "->", JSON.stringify(r));
