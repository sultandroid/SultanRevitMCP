#!/usr/bin/env node
// MCP server (stdio) that forwards tool calls to the RevitMcp add-in over a loopback socket.
import net from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const PORT = Number(process.env.REVIT_MCP_PORT ?? 48884);
// Longer than the add-in's own 30 s queue timeout, so that error is the one callers normally see.
const TIMEOUT_MS = Number(process.env.REVIT_MCP_TIMEOUT_MS ?? 300_000);

function callRevit(command, params) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port: PORT });
    const chunks = [];
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn(value);
    };

    socket.setTimeout(TIMEOUT_MS, () =>
      finish(reject, new Error(
        `Revit did not answer within ${TIMEOUT_MS / 1000} s. The command may still complete; check the model before retrying.`,
      )),
    );
    socket.on("connect", () => socket.write(JSON.stringify({ command, params }) + "\n"));
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("error", (err) =>
      finish(reject, err.code === "ECONNREFUSED"
        ? new Error(`Cannot reach Revit on port ${PORT}. Start Revit with the RevitMcp add-in loaded.`)
        : err),
    );
    socket.on("end", () => {
      try {
        const response = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (response.ok) finish(resolve, response.result);
        else finish(reject, new Error(response.error));
      } catch {
        finish(reject, new Error("Revit closed the connection without a valid response."));
      }
    });
  });
}

const id = z.number().int().describe("Revit element id");
const ids = z.array(id).min(1);
const point = z
  .object({ x: z.number(), y: z.number(), z: z.number().optional() })
  .describe("Model point in millimetres; z defaults to 0");
const rgb = z.object({ r: z.number().int().min(0).max(255), g: z.number().int().min(0).max(255), b: z.number().int().min(0).max(255) });
const paging = {
  limit: z.number().int().min(1).max(1000).optional().describe("Max results, default 100"),
  offset: z.number().int().min(0).optional(),
};

// Where a family_* tool reads the family from. Give one: path (opened in the background, never made active, closed
// without saving), element_id (an instance in the model), or document (an open family by title); else the active document.
const familySource = {
  path: z.string().optional().describe("Absolute path to an .rfa; opened in the background and closed without saving"),
  expect_sha256: z.string().optional().describe("With path: refuse unless the file's SHA-256 starts with this"),
  element_id: id.optional().describe("An instance in the model whose family to read"),
};
const typeNames = z.array(z.string()).optional().describe("Only these family types; all when omitted");

const read = { readOnlyHint: true };
const ui = { readOnlyHint: false, destructiveHint: false };
const additive = { readOnlyHint: false, destructiveHint: false };
const destructive = { readOnlyHint: false, destructiveHint: true };

// All lengths and coordinates are in millimetres. Every model change is one named undo step in Revit.
const tools = [
  ["inspect_cad_geometry", "Read CAD vectors and layer counts without exploding or changing the import. Coordinates are host model mm. Use layer_contains and pagination for large imports. include_meshes adds hatch mesh boundary edges; include_surfaces adds upward planar solid-face loops. Face areas are in source-symbol coordinates.", { element_id: id, layer_contains: z.string().optional(), include_meshes: z.boolean().optional(), include_surfaces: z.boolean().optional(), limit: z.number().int().min(0).max(50000).optional(), offset: z.number().int().min(0).optional() }, read],
  ["inspect_datums", "Read grid endpoints and level elevations, optionally from a loaded Revit link. Linked grid endpoints are transformed into host coordinates.", { link_instance_id: id.optional() }, read],
  ["set_elements_pinned", "Pin or unpin specified elements, such as datum links. Returns their actual pin states.", { element_ids: ids, pinned: z.boolean().optional() }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["list_documents", "List the documents open in Revit, including linked models. No activation, no writes.", {}, read],
  ["open_document", "Open a model by absolute path and make it active. A model linked into an open host cannot be opened until the host closes.", { path: z.string() }, { readOnlyHint: false, destructiveHint: false }],
  ["activate_document", "Make an open document active by title. Extension and case are ignored; several matches come back as candidates.", { title: z.string() }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["save_document", "Save a document, the active one by default, only if it is modified. Pass path to save a copy under a new name.", { title: z.string().optional(), path: z.string().optional() }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["link_revit_model", "Link another .rvt into the active model. placement 'origin' (default) puts internal origin on internal origin; 'shared' uses shared coordinates, which the two models must already share.", { path: z.string(), placement: z.enum(["origin", "shared"]).optional() }, additive],
  ["inspect_link", "List the active model's linked models: load status, placement, extents, phases and phase mapping. Changes nothing.", {}, read],
  ["reload_link", "Reload linked models from disk: all, or those whose file name contains name.", { name: z.string().optional() }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["acquire_coordinates", "Take a linked model's shared coordinates into the active model (Acquire Coordinates). The model's geometry does not move; save it afterwards.", { link_instance_id: id }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["close_document", "Close a document, the active one by default. Saves first unless save is false. Refuses the last document unless allow_last is set.", { title: z.string().optional(), save: z.boolean().optional(), allow_last: z.boolean().optional() }, { readOnlyHint: false, destructiveHint: true }],
  ["set_view_display", "Set a view's visual style: HLR is black hidden line, Shading is colour.", { view_id: id, style: z.enum(["Wireframe", "HLR", "Shading", "ShadingWithEdges", "Realistic"]) }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["get_project_info", "Get the open model's title, path, Revit version, active view and project information.", {}, read],
  ["list_levels", "List levels with ids and elevations.", {}, read],
  ["list_views", "List views and sheets (templates excluded).", {
    view_type: z.string().optional().describe("Filter, e.g. FloorPlan, ThreeD, Section, Schedule, DrawingSheet"),
  }, read],
  ["list_element_types", "List element types (wall types, family types, title blocks...). Use the ids when creating elements.", {
    category: z.string().optional().describe("Display name (Doors) or built-in name (OST_Doors)"),
    family: z.string().optional().describe("Case-insensitive family name search"),
    ...paging,
  }, read],
  ["query_elements", "Find elements by category, view, level or parameter value. Check 'total' against 'returned' and page with offset.", {
    category: z.string().optional().describe("Display name (Walls) or built-in name (OST_Walls)"),
    view_id: id.optional().describe("Only elements visible in this view"),
    level_id: id.optional(),
    parameter_name: z.string().optional().describe("Only elements that have this parameter"),
    parameter_value: z.string().optional().describe("Case-insensitive search in the parameter's displayed value"),
    ...paging,
  }, read],
  ["get_element", "Get an element's location, bounding box and all parameters.", {
    element_id: id,
    include_type_parameters: z.boolean().optional(),
  }, read],
  ["get_selection", "Get the elements currently selected in Revit.", { ...paging }, read],
  ["get_schedule_data", "Read a schedule view's body as rows of text. Includes the header rows.", {
    view_id: id,
    limit: z.number().int().min(1).max(1000).optional(),
  }, read],
  ["get_view_geometry", "Get a view's origin, right/up/view directions and crop box, to convert drawing positions into model points.", {
    view_id: id.optional().describe("Defaults to the active view"),
  }, read],
  ["probe_ray", "Cast a ray through the model and its Revit links, and list the faces it hits, nearest first. Changes nothing.", {
    origin: point,
    direction: point.describe("Ray direction; only its direction is used"),
    max_distance_mm: z.number().positive().optional().describe("Default 5000"),
    limit: z.number().int().min(1).max(50).optional().describe("Default 8"),
    target: z.enum(["family", "walls", "all"]).optional().describe("What the ray may hit: family instances (default), walls only, or every model element"),
  }, read],
  ["inspect_cut", "Report whether a family instance can be cut, and what geometry its family holds. Changes nothing.", {
    element_id: id,
    cutter_id: id.optional(),
  }, read],
  ["extract_nested_family", "Remove a nested family from an instance's family and place it in the project at the same position.", {
    element_id: id,
    nested_family: z.string(),
    level_id: id.optional().describe("Defaults to the host's level, or the nearest level"),
  }, { readOnlyHint: false, destructiveHint: true }],
  ["set_family_material", "Assign a material to geometry inside an instance's family and reload it.", {
    element_id: id,
    material: z.string(),
    color: rgb,
    form_ids: z.array(z.number().int()).optional().describe("Ids from inspect_family; all solids when omitted"),
  }, { readOnlyHint: false, destructiveHint: true, idempotentHint: true }],
  ["copy_instance_scaled", "Copy an element's solid geometry as a new scaled direct shape, centred on a point, keeping its orientation.", {
    element_id: id,
    category: z.string(),
    name: z.string(),
    scale: z.number().positive(),
    center: point,
    comments: z.string().optional(),
  }, additive],
  ["list_family_text", "List text notes, labels and views inside an instance's family. Changes nothing.", { element_id: id }, read],
  ["list_family_images", "List the images inside an instance's family: type name, file, centre and size in mm. Changes nothing.", { element_id: id }, read],
  ["replace_family_image", "Reload image types in an instance's family from new files (match = part of the type or file name). Each image keeps its centre and width; pad new files to the old proportions first.", { element_id: id, items: z.array(z.object({ match: z.string(), path: z.string() })), save_path: z.string().optional() }, { readOnlyHint: false, destructiveHint: true, idempotentHint: true }],
  ["list_family_parameters", "List an instance's family parameters, plus the shared parameters its labels use (name and GUID). Changes nothing.", { element_id: id }, read],
  ["bind_shared_parameters", "Bind text shared parameters to project categories under given GUIDs, so title block labels tied to them fill. Binds ones a loaded family brought in unbound.", { parameters: z.array(z.object({ name: z.string(), guid: z.string() })), categories: z.array(z.string()).optional() }, additive],
  ["create_text_notes", "Add many text notes to a view or sheet in one step. Each note: location, text (\r for line breaks), text_type_id?, width_mm? (wraps, paper mm), align? left|center|right, valign? top|middle|bottom.", { view_id: id, notes: z.array(z.object({ location: point, text: z.string(), text_type_id: id.optional(), width_mm: z.number().positive().optional(), align: z.enum(["left", "center", "right"]).optional(), valign: z.enum(["top", "middle", "bottom"]).optional() })) }, additive],
  ["place_image", "Place an image in a 2D view or on a sheet, centred on a point, at a width (sheet mm on sheets, model mm in views). height_mm stretches it to an exact box; foreground draws it over model surfaces.", { view_id: id, path: z.string(), center: point, width_mm: z.number().positive(), height_mm: z.number().positive().optional(), foreground: z.boolean().optional() }, additive],
  ["set_family_text_size", "Give the texts or labels in an instance's family that contain match their own text type at size_mm, and reload the family. Fixes a title block label that overflows its cell.", { element_id: id, match: z.string(), size_mm: z.number().positive(), save_path: z.string().optional() }, { readOnlyHint: false, destructiveHint: true, idempotentHint: true }],
  ["import_cad", "Import a DWG into a view (mm, origin to origin, this view only, colours kept). Use a plan view when the import must be cropped. Returns the import id and extents.", { view_id: id, path: z.string(), color: z.enum(["preserve", "black"]).optional(), custom_scale: z.number().positive().optional() }, additive],
  ["save_cloud_copy", "Open an ACC / Autodesk Docs model by region and GUIDs and save a standalone central copy on disk, without synchronising, to link into a local host.", { region: z.string().optional(), project_guid: z.string(), model_guid: z.string(), save_path: z.string() }, additive],
  ["set_family_text", "Replace matching text notes in an instance's family and reload it.", { element_id: id, old_text: z.string(), new_text: z.string() }, { readOnlyHint: false, destructiveHint: true, idempotentHint: true }],
  ["add_titleblock_revision_schedule", "Add a revision schedule to a title block family's sheet and reload it. Location is in sheet mm.", { element_id: id, location: point, fields: z.array(z.object({ name: z.string(), heading: z.string().optional(), width_mm: z.number().positive() })) }, { readOnlyHint: false, destructiveHint: true, idempotentHint: false }],
  ["create_revision", "Create a project revision.", { date: z.string(), description: z.string(), issued_by: z.string().optional(), issued_to: z.string().optional(), issued: z.boolean().optional() }, additive],
  ["set_sheet_revisions", "Set the revisions listed on sheets, replacing what was set before.", { sheet_ids: z.array(id), revision_ids: z.array(id) }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["create_sheet_list", "Create a sheet list schedule.", { name: z.string(), fields: z.array(z.string()), sort_by: z.array(z.string()).optional() }, additive],
  ["set_schedule_format", "Set a schedule's text types, column widths and headings.", { view_id: id, text_type_id: id.optional(), title_text_type_id: id.optional(), column_widths_mm: z.array(z.number().positive()).optional(), headings: z.array(z.string().nullable()).optional() }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["create_dimension_string", "Dimension a string of points along a line in a view. Uses short detail ticks as references, so it does not follow the elements if they move.", { view_id: id, points: z.array(point).min(2), offset_mm: z.number().optional(), tick_mm: z.number().optional() }, additive],
  ["tag_elements", "Tag elements in a view with a tag type, each at its own point.", { view_id: id, tag_type_id: id, leader: z.boolean().optional(), items: z.array(z.object({ element_id: id, location: point })).min(1) }, additive],
  ["create_drafting_view", "Create a drafting view, for legends and notes.", { name: z.string(), scale: z.number().int().positive().optional() }, additive],
  ["create_swatch", "Draw a solid colour rectangle in a drafting view or sheet.", { view_id: id, min: point, max: point, color: rgb }, additive],
  ["set_phase_filter", "Set a view's phase filter by name, such as Show Previous + New.", { view_id: id, name: z.string() }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["set_revision_numbering", "Create a numeric revision sequence with a start number, and use it for all revisions.", { start: z.number().int().optional(), min_digits: z.number().int().optional(), name: z.string().optional() }, additive],
  ["set_revision_sequence", "Assign a revision to a numbering sequence.", { revision_id: id, sequence_id: id }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["paint_element", "Paint every face of an element with a material.", { element_id: id, material_id: id }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["export_sheets_pdf", "Export sheets to one combined vector PDF.", { sheet_ids: ids, folder: z.string(), file_name: z.string() }, additive],
  ["set_family_category", "Change the category of an instance's family and reload it. Furniture cannot be cut in sections; Casework can.", { element_id: id, category: z.string(), save_dir: z.string().optional() }, { readOnlyHint: false, destructiveHint: true, idempotentHint: true }],
  ["isolate_in_view", "Hide everything in a view except the given elements, permanently.", { view_id: id, element_ids: ids }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["create_keynote", "Add a keynote: text at a point with a leader to another point.", { view_id: id, at: point, to: point, text: z.string(), text_type_id: id.optional() }, additive],
  ["set_viewport_no_title", "Give a viewport a type that shows no title.", { viewport_id: id }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["remove_z_band", "Shorten a direct shape or a family's solids by removing the band between two project heights; everything above drops. A very high z1_mm trims the top.", { element_id: id, z0_mm: z.number(), z1_mm: z.number(), save_dir: z.string().optional() }, { readOnlyHint: false, destructiveHint: true, idempotentHint: false }],
  ["set_element_overrides", "Set graphics on specific elements in a view: halftone, line_weight, line_pattern, hide_patterns, surface_transparency, line_color (white hides joint edges).", { view_id: id, element_ids: ids, halftone: z.boolean().optional(), line_weight: z.number().optional(), line_pattern: z.string().optional(), hide_patterns: z.boolean().optional(), surface_transparency: z.number().optional(), line_color: rgb.optional() }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["view_category_counts", "Count a view's elements per category and list long diagonal lines. Changes nothing.", { view_id: id }, read],
  ["set_view_overrides", "Set category overrides in a view: halftone, or a discipline colour (lines plus solid surface and cut fill) with optional surface transparency 0 to 100.", { view_id: id, categories: z.array(z.string()), halftone: z.boolean().optional(), color: rgb.optional(), transparency: z.number().optional() }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["inspect_family", "List the geometry and nested families inside an instance's family. Changes nothing.", {
    element_id: id,
  }, read],
  ["family_types", "A family's category, types and every family parameter with its value in each type (lengths mm, angles deg), formulas, groups and shared GUIDs. Reads from a path, an instance or an open family. Changes nothing.", {
    ...familySource, types: typeNames, name_contains: z.string().optional(),
  }, read],
  ["family_forms", "Every solid, void and nested family in a family: kind, extents, material, visibility, driving parameters, extrusion start/end, and each sketch loop measured in its own plane (w x h, area, centre; holes flagged), so section sizes read directly. Changes nothing.", {
    ...familySource,
    kinds: z.array(z.string()).optional().describe("Extrusion, Sweep, Blend, Revolution, SweptBlend, FreeFormElement, FamilyInstance"),
    solid_only: z.boolean().optional(),
    include_curves: z.boolean().optional().describe("Add each loop's raw curves in model mm"),
    ...paging,
  }, read],
  ["family_dimensions", "A family's dimensions (value, label parameter, view) and reference planes (name, normal, offset, Is Reference). Changes nothing.", {
    ...familySource, labelled_only: z.boolean().optional(),
  }, read],
  ["family_type_extents", "Switch to each family type, regenerate, measure solid extents and length parameters, then roll back, so the family is left as it was. Use match_height_mm to find the type of a given height.", {
    ...familySource, types: typeNames,
    match_height_mm: z.number().optional(), tolerance_mm: z.number().optional().describe("Default 1"),
  }, read],
  ["family_report", "One call, one open of the file: family_types + family_forms (no raw curves) + family_dimensions + family_type_extents. Best start for a model-vs-drawing check.", {
    ...familySource, types: typeNames,
    include: z.array(z.enum(["types", "forms", "dimensions", "extents"])).optional(),
  }, read],
  ["set_family_parameters", "In an open family (document or active): optionally switch to or create a type, then set family parameter values (mm, deg, true/false, names for ids) or formulas. One undo step; not saved.", {
    type: z.string().optional(), create_type: z.boolean().optional(),
    values: z.array(z.object({ name: z.string(), value: z.union([z.number(), z.string(), z.boolean()]).optional(), formula: z.string().optional() })).min(1),
  }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["enable_void_cut", "Turn on 'cut with voids when loaded' in an instance's family and reload it, keeping project type values.", {
    element_id: id,
  }, { readOnlyHint: false, destructiveHint: true, idempotentHint: true }],
  ["create_void_family", "Create and load a round vertical void family from a Generic Model template.", {
    template_path: z.string(),
    name: z.string(),
    diameter_mm: z.number().positive(),
    bottom_mm: z.number().describe("Height of the void's base above its level"),
    height_mm: z.number().positive(),
  }, additive],
  ["cut_with_voids", "Place the void family at each point and cut it from the host instance.", {
    host_id: id,
    family_type_id: id,
    level_id: id,
    points: z.array(point).min(1),
  }, { readOnlyHint: false, destructiveHint: true }],
  ["select_elements", "Select elements in the Revit UI, optionally zooming to them.", {
    element_ids: z.array(id),
    zoom_to: z.boolean().optional(),
  }, ui],
  ["open_view", "Make a view the active view in Revit.", { view_id: id }, ui],
  ["create_project", "Create a new project from a template, save it to a new .rvt file and open it. Never overwrites an existing file.", {
    path: z.string().describe("Full path for the new .rvt file"),
    template_path: z.string().optional().describe("Full path to an .rte template; defaults to Revit's default project template"),
  }, additive],
  ["set_parameter", "Set a parameter value. A number on a length, area or similar parameter is in the parameter's display units; a string like '3000 mm' states its own. An ElementId parameter (Phase Created, Level) takes the target's id. Pass element_ids instead of element_id to set the same value on many elements in one undo step; elements that refuse it are skipped and listed.", {
    element_id: id.optional(),
    element_ids: z.array(id).min(1).optional().describe("Many elements at once, instead of element_id"),
    parameter_name: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    on_type: z.boolean().optional().describe("Set on the element's type instead. This changes EVERY instance of the type."),
  }, { readOnlyHint: false, destructiveHint: true, idempotentHint: true }],
  ["create_level", "Create a level.", { elevation_mm: z.number(), name: z.string().optional() }, additive],
  ["create_grid", "Create a straight grid line.", { start: point, end: point, name: z.string().optional() }, additive],
  ["create_wall", "Create a straight wall. Uses the default wall type when wall_type_id is omitted.", {
    start: point,
    end: point,
    level_id: id,
    height_mm: z.number().positive().optional().describe("Default 3000"),
    base_offset_mm: z.number().optional(),
    wall_type_id: id.optional(),
    structural: z.boolean().optional(),
  }, additive],
  ["create_floor", "Create a floor from a closed boundary. List each corner once; the loop closes itself.", {
    boundary: z.array(point).min(3),
    level_id: id,
    floor_type_id: id.optional(),
  }, additive],
  ["create_room", "Place a room at a point inside an enclosed area.", {
    level_id: id,
    location: point,
    name: z.string().optional(),
    number: z.string().optional(),
  }, additive],
  ["place_family_instance", "Place a family instance. Doors, windows and other hosted families need host_id.", {
    family_type_id: id.describe("Id from list_element_types"),
    location: point,
    level_id: id.optional().describe("Optional only when the host has a level"),
    host_id: id.optional(),
    rotation_deg: z.number().optional(),
    structural_type: z.enum(["NonStructural", "Beam", "Brace", "Column", "Footing"]).optional(),
  }, additive],
  ["move_elements", "Move elements by a relative offset.", {
    element_ids: ids,
    dx_mm: z.number().optional(),
    dy_mm: z.number().optional(),
    dz_mm: z.number().optional(),
  }, { readOnlyHint: false, destructiveHint: true }],
  ["delete_elements", "Delete elements. Revit also deletes dependants (e.g. a wall's doors); the result lists everything removed. Undoable in Revit.", {
    element_ids: ids,
  }, destructive],
  ["create_floor_plan", "Create a floor plan view for a level.", { level_id: id, name: z.string().optional() }, additive],
  ["create_section", "Create a section view along a horizontal cut line, looking in look_direction.", {
    start: point,
    end: point,
    look_direction: point.describe("Horizontal direction the view looks in, perpendicular to the cut line"),
    bottom_mm: z.number(),
    top_mm: z.number(),
    depth_mm: z.number().positive().describe("How far the view sees beyond the cut line"),
    name: z.string().optional(),
    scale: z.number().int().positive().optional().describe("View scale, e.g. 50 for 1:50"),
  }, additive],
  ["create_sheet", "Create a sheet, using the first title block in the model when none is given.", {
    number: z.string().optional(),
    name: z.string().optional(),
    title_block_type_id: id.optional(),
  }, additive],
  ["place_view_on_sheet", "Place a view or schedule on a sheet. location is in sheet millimetres.", {
    sheet_id: id,
    view_id: id,
    location: point,
  }, additive],
  ["view_crop_info", "Read a view's crop region in model millimetres with its scale.", { view_id: id }, read],
  ["set_view_crop", "Set a view's crop region from model millimetres, so a plan is framed on the grids rather than on a link that spans the whole site.", {
    view_id: id,
    min_mm: point,
    max_mm: point,
  }, additive],
  ["fit_view_crop_to_model", "Shrink the crop region to what is actually drawn in the view (host geometry plus every visible link), then a fit_view_to_sheet can fill the sheet.", {
    view_id: id,
    margin_mm: z.number().positive().optional().describe("Margin around the extents, default 100 mm"),
    link_contains: z.string().optional().describe("Only measure links whose name contains this text, e.g. ELEC"),
  }, additive],
  ["fit_view_to_sheet", "One view sized to fill the sheet: sets the view scale until the viewport fits the drawing area inside the title block, then centres it on the sheet.", {
    sheet_id: id,
    view_id: id,
    margin_mm: z.number().positive().optional().describe("Clear margin inside the drawing area, default 15"),
  }, additive],
  ["set_view_scale", "Set a view's scale denominator, e.g. 50 for 1:50.", { view_id: id, scale: z.number().int().min(1).max(5000) }, additive],
  ["drawing_info", "Read what is on a sheet: sheet size, title block box and every viewport with its scale, size and centre in millimetres. Use it to check margins and placement.", { sheet_id: id }, read],

  ["duplicate_view", "Duplicate a view. The original view is not changed.", {
    view_id: id,
    name: z.string().optional(),
    option: z.enum(["Duplicate", "WithDetailing", "AsDependent"]).optional().describe("Default WithDetailing"),
  }, additive],
  ["create_detail_lines", "Draw view-specific detail lines in a view. Points are projected onto the view's plane.", {
    view_id: id,
    lines: z.array(z.object({ start: point, end: point })).min(1),
    line_style: z.string().optional().describe("Line style name, e.g. from ensure_line_style"),
  }, additive],
  ["create_text_note", "Add a text note to a view, using the default text type.", {
    view_id: id,
    location: point,
    text: z.string(),
    text_type_id: id.optional().describe("Id from ensure_text_type; defaults to the default text type"),
  }, additive],
  ["load_family", "Load a family (.rfa) into the model. A family already loaded is kept unchanged. Returns its type ids and placement type.", {
    path: z.string().describe("Full path to the .rfa file"),
  }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["place_on_face", "Place a face-based family on the nearest face hit by a ray from origin along direction.", {
    family_type_id: id,
    origin: point,
    direction: point.describe("Ray direction; only its direction is used"),
    categories: z.array(z.string()).optional().describe("Only hit these categories, e.g. OST_Walls, OST_Ceilings"),
    max_distance_mm: z.number().positive().optional().describe("Default 2000"),
    mark: z.string().optional(),
    comments: z.string().optional(),
  }, additive],
  ["ensure_reference_plane", "Create a named reference plane, or return the existing one with that name. Its normal is x_direction x y_direction.", {
    name: z.string(),
    origin: point,
    x_direction: point.describe("A direction in the plane"),
    y_direction: point.describe("A second direction in the plane"),
  }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["place_on_reference_plane", "Place a work-plane-based family on a reference plane, for example when the real ceiling or wall cannot host it.", {
    family_type_id: id,
    plane_id: id,
    location: point,
    mark: z.string().optional(),
    comments: z.string().optional(),
  }, additive],
  ["ensure_distribution_system", "Create a three-phase wye distribution system, or return the existing one with that name.", {
    phase: z.enum(["three", "single"]).optional(),
    name: z.string(),
    line_to_line_v: z.number().positive(),
    line_to_ground_v: z.number().positive(),
    wires: z.number().int().min(3).max(4).optional().describe("Default 4"),
  }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["set_view_categories", "Hide or show model categories in one view.", {
    view_id: id,
    hide: z.array(z.string()).optional(),
    show: z.array(z.string()).optional(),
  }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["get_electrical_info", "Read a device or panel's electrical connectors, plus the distribution systems in the model.", {
    element_id: id,
  }, read],
  ["diagnose_panel", "Try every distribution system on a panel without keeping the change, and report each result.", { panel_id: id }, read],
  ["set_panel_system", "Set a panel's distribution system through its electrical equipment model.", {
    panel_id: id,
    system_id: id,
  }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["set_view_range", "Set a plan view's top, cut and bottom offsets from its level, and return the resulting range. Omit values to keep them.", {
    view_id: id,
    top_mm: z.number().optional(),
    cut_mm: z.number().optional(),
    bottom_mm: z.number().optional(),
  }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["create_schedule", "Create a schedule for a category with the named fields. Unknown fields are reported with the fields available.", {
    name: z.string(),
    category: z.string().describe("Display name or built-in name, e.g. OST_ElectricalFixtures"),
    fields: z.array(z.string()).min(1),
    sort_by: z.string().optional().describe("One of the fields"),
    total_field: z.string().optional().describe("A numeric field to total at the bottom of the schedule"),
  }, additive],
  ["ensure_project_parameters", "Add instance project parameters to a category, for values such as way, phase or cable.", {
    category: z.string(),
    parameters: z.array(z.object({ name: z.string(), number: z.boolean().optional() })).min(1),
  }, additive],
  ["ensure_material", "Create or update a material's colour.", {
    name: z.string(),
    color: rgb,
    shininess: z.number().int().min(0).max(128).optional(),
    smoothness: z.number().int().min(0).max(100).optional(),
  }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["set_material_hatch", "Set a material's cut pattern, shown where it is cut in sections: solid, or a drafting hatch of lines created when missing. Spacing is on paper.", {
    material: z.string(),
    solid: z.boolean().optional(),
    cross: z.boolean().optional(),
    angle_degrees: z.number().optional(),
    spacing_mm: z.number().positive().optional(),
  }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["create_pipe_run", "Model connected pipes through a list of points, adding elbows where the routing preferences allow.", {
    system: z.enum(["DomesticColdWater", "DomesticHotWater", "Sanitary"]),
    level_id: id,
    points: z.array(point).min(2),
    diameter_mm: z.number().positive(),
    comments: z.string().optional(),
  }, additive],
  ["create_panel_schedule", "Create a Revit panel schedule (DB schedule) for a panel.", { panel_id: id }, additive],
  ["create_opening", "Cut a rectangular opening in a wall at two opposite corners on the wall plane (mm). The wall keeps its identity, so a door or window family can host in it later.", {
    document: z.string().describe("Exact full path of the open, writable target RVT"),
    wall_id: id,
    corner_a: point,
    corner_b: point,
    comments: z.string().optional(),
  }, additive],
  ["create_duct_run", "Create one native rectangular duct between two points. No fittings, turns or equipment connections.", {
    document: z.string().describe("Exact full path of the open, writable target RVT"),
    system_type_id: id,
    duct_type_id: id,
    level_id: id,
    width_mm: z.number().positive(),
    height_mm: z.number().positive(),
    points: z.array(point).length(2),
    comments: z.string().optional(),
  }, additive],
  ["create_circuit", "Create a power circuit from electrical devices, optionally assigning it to a panel.", {
    device_ids: ids,
    panel_id: id.optional(),
    name: z.string().optional().describe("Load name"),
  }, additive],
  ["ensure_line_style", "Create or update a line style. Updating affects every line already using it.", {
    name: z.string(),
    weight: z.number().int().min(1).max(16).describe("Revit pen weight number"),
    color: rgb,
    pattern: z.string().optional().describe("Line pattern name in this model, e.g. Dash; solid when omitted"),
  }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["ensure_text_type", "Create or update a text type. size_mm is the printed height on paper, so it scales with the view.", {
    name: z.string(),
    size_mm: z.number().positive(),
    color: rgb,
    font: z.string().optional().describe("Default Arial"),
    bold: z.boolean().optional(),
  }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }],
  ["extend_view_crop", "Grow (or, with negative values, shrink) a view's crop region on each side.", {
    view_id: id,
    left_mm: z.number().optional(),
    right_mm: z.number().optional(),
    top_mm: z.number().optional(),
    bottom_mm: z.number().optional(),
  }, { readOnlyHint: false, destructiveHint: false }],
  ["rotate_view_crop", "Rotate a plan view's crop region about its centre, so the view turns on the sheet while its text and title stay upright. Positive is counterclockwise.", {
    view_id: id,
    angle_degrees: z.number(),
  }, { readOnlyHint: false, destructiveHint: false }],
  ["build_title_block", "Restyle a title block family: keep its labels, replace all other sheet graphics, save a copy and load it. Points are sheet millimetres.", {
    source_rfa: z.string(),
    save_path: z.string(),
    labels: z.array(z.object({ match: z.string(), at: point, size_mm: z.number().positive(), color: rgb.optional(), bold: z.boolean().optional() })),
    lines: z.array(z.object({ start: point, end: point })).optional(),
    regions: z.array(z.object({ points: z.array(point).min(3), color: rgb })).optional(),
    texts: z.array(z.object({ text: z.string(), at: point, size_mm: z.number().positive(), color: rgb.optional(), bold: z.boolean().optional(), align: z.string().optional() })).optional(),
    images: z.array(z.object({ path: z.string(), center: point, width_mm: z.number().positive() })).optional(),
  }, { readOnlyHint: false, destructiveHint: false }],
  ["make_unit_family", "Turn existing elements into one loadable family: saves the .rfa, loads it, places an instance where they were and deletes them.", {
    element_ids: ids,
    family_name: z.string().describe("Also the .rfa file name"),
    template_path: z.string().describe("Full path to the family template (.rft), which sets the category"),
    save_dir: z.string().describe("Folder for the .rfa; an existing file of that name is overwritten"),
    level_id: id,
    mark: z.string().optional(),
    comments: z.string().optional(),
  }, { readOnlyHint: false, destructiveHint: true }],
  ["create_direct_shape", "Model custom 3D geometry as one element, built from extruded planar profiles. Use when no family fits.", {
    category: z.string().describe("Display name or built-in name, e.g. OST_GenericModel"),
    name: z.string(),
    comments: z.string().optional(),
    solids: z.array(z.object({
      profile: z.array(point).min(3).describe("Closed planar loop; list each corner once"),
      direction: point.describe("Extrusion direction; only its direction is used"),
      length_mm: z.number().positive(),
      hole: z.array(point).min(3).optional().describe("Inner loop, e.g. for a hollow section"),
      holes: z.array(z.array(point).min(3)).optional().describe("Several inner loops, e.g. for a perforated panel"),
      material_id: id.optional().describe("Id from ensure_material"),
    })).min(1),
  }, additive],
];

const server = new McpServer({ name: "revit", version: "1.0.0" });

const errorResult = (err) => ({ isError: true, content: [{ type: "text", text: err.message }] });

// The add-in already runs any command against a named open document ("document": title or path) instead of the active
// one, so agents sharing one Revit never have to switch the active model. Offer it on every tool.
const documentParam = z.string().optional().describe("Open document (title or path) to work on instead of the active one");

for (const [name, description, schema, annotations] of tools) {
  const inputSchema = "document" in schema ? schema : { ...schema, document: documentParam };
  server.registerTool(name, { description, inputSchema, annotations }, async (args) => {
    try {
      const result = await callRevit(name, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return errorResult(err);
    }
  });
}

server.registerTool(
  "export_view_image",
  {
    description: "Render a view or sheet to a PNG image, to see what the model looks like.",
    inputSchema: {
      view_id: id.optional().describe("Defaults to the active view"),
      pixel_size: z.number().int().min(256).max(4096).optional().describe("Image width, default 1600"),
    },
    annotations: read,
  },
  async (args) => {
    try {
      const { view, mime_type, data_base64 } = await callRevit("export_view_image", args);
      return {
        content: [
          { type: "text", text: `View: ${view}` },
          { type: "image", data: data_base64, mimeType: mime_type },
        ],
      };
    } catch (err) {
      return errorResult(err);
    }
  },
);

await server.connect(new StdioServerTransport());
