# SultanRevitMCP bridge

SultanRevitMCP is the Samaya Factory name for our own Revit bridge. Its code, DLL, add-in folder and log path still read `RevitMcp`; they are renamed together with the hot-reload loader rework, which needs one Revit restart anyway. Until then, use the `RevitMcp` paths below.

Source is in `revit-mcp/`. Client helper: `tools/rvt.mjs`. Raw socket on 127.0.0.1:48884, JSON `{command, params}` plus a newline.

## Rules

- It works only on the **active document**. Check `get_project_info` title before every write.
- The active document does not stay put. After open_document or activate_document, Revit can flip back to another open document between calls or between script runs. A long script on a second document must call activate_document and assert the title before each step. Make scripts resumable, skipping steps already logged, so a flip costs only a resume. On Madina 1 an ELEC rebuild flipped to ARCH halfway and saved with half its circuits gone.
- To work in a linked discipline file, close the host and open that file alone. Confirm from the title before any write, and reload the link in the host afterwards.
- There are no save, open or link commands. The user saves: click in the drawing area, press Ctrl+S. Do not send save keystrokes, Revit hung after one. Verify with file time and `is_modified`.
- Use `export_view_image` to see results. Otherwise check with `probe_ray`, bounding boxes and counts.

## Installing the add-in

Close Revit fully, then:

```
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Dotnet "$env:LOCALAPPDATA\RevitMcp\dotnet-sdk\dotnet.exe"
```

Compile check while Revit is open: build with `-p:OutDir="$TEMP/revitmcp_check/"`.

## Known failures

| Symptom | Cause and action |
|---|---|
| Bridge stalls after renaming a level or plan view | Only when a plan view has the same name as its level: Revit asks whether to rename the other one too. Check with `list_views` first. A level with no same-named view renames cleanly (Jalal wal Jamal, Nov 2026). Otherwise rename the view first to something else, or ask the user to answer the dialog. |
| Family conversions vanish | Revit reverted 14 `make_unit_family` conversions with no journaled Undo, cause unknown. Check families are present after each batch. On Makkah a rebuild by name ran right after `edit_family_solids` on the same family: the edit stayed, but the new family and instance vanished, and the old instance was back. Split such jobs into two steps (edit, then check, then rebuild), check the instance id after every rebuild, and rerun only the missing step. |
| "Curve length is too small" | Geometry under Revit's short curve tolerance, about 0.8 mm. |
| "Sketch plane creation is not allowed in this family" | Old add-in build in the `lines` branch of `build_title_block`. Source is fixed, reinstall. |
| A linked model loads but draws nothing, in every view | The link was made with a forward-slash path (`C:/...`). Revit loads the file but cannot tie the link to it: the journal says "Where is the document?" and `inspect_link` shows `link_doc` null. Delete the link and link again with a backslash path. The add-in now turns paths to backslashes itself (Makkah, 4 Nov 2026). Hand-made links are fine. |
| "One or more of the elementIds cannot be deleted" | Often the active view. Have the user switch view, or update in place. |
| Timeout on the first rename in a new model | Template `Level 1` plan and level share a name, so renaming either one opens the rename dialog (DAS, 5 Nov 2026: the level got renamed too, and Revit was then closed). In a new model never rename `Level 1` / `Level 2`: create the named levels, make and open a new plan, then delete the template levels (their views and the Site plan go with them). |
| Comments on a grid: "no such parameter" | Grids have no Comments parameter. Put a grid's source and ASSUMED status in a note on the plan sheet instead. |

## Scripting

Bash heredocs with backslash paths are unreliable. Use forward slashes or write the file directly.
- query_elements returns at most 1000 per call: page with offset, or later elements are silently missed.
- A rebuild script that fails midway leaves its views behind, and the next run cannot reuse their names. Clear views by name prefix at the start of the script.
- Rotating a viewport on a sheet (Rotation on Sheet) also throws it far from its place and turns its title and text. Rotate the crop with rotate_view_crop instead.
- `create_3d_view` makes a 3D view from an eye point to a target, with a section box and a display style. Use it for check views and photos to send the user.
- `query_elements` takes `view_id`: clear a view's own detail lines, text notes and dimensions with it before redrawing, instead of recreating the view and sheet.
- Every new add-in build brings back Revit's "Security - Unsigned Add-In" prompt, which only the user can clear. Batch changes into as few builds as possible.
- `set_view_overrides` takes `color` (and `transparency`) to colour whole categories in a view: the discipline colours for coordination views.
- `set_element_overrides` takes `halftone`, `line_pattern` (a line pattern name, for projection and cut lines), `line_weight`, `hide_patterns` (hides surface and cut fill) and `surface_transparency` (0 to 100). Use 100 for an outline only in shaded views.
- **Direct shapes do not draw material cut hatches in sections.** Anything that must hatch, existing structure included, is made into a family with `make_unit_family` (Generic Model is cuttable), then its phase is set again.
- To rearrange a sheet the generator cannot rebuild (for example a unit merged into another), move its viewports and notes with `move_elements` (dx, dy in sheet mm, read positions off the render). Find a note's id with `replace_text` in `dry_run` mode, with the replacement set to "" so the note is listed. For a 3D view of part of a merged unit, use `create_3d_view` with a section box around that part.
- `replace_text` replaces text in every text note, or in one view with `view_id`: `pairs` [{find, replace}] applied in order, with `dry_run` to list the notes it would change. Use it after renumbering sheets, longest numbers first.
- `inspect_link` lists each link: load status, whether the link is tied to its document, element count and the phase map. `list_phases` lists the phases. Run `inspect_link` after every `link_revit_model`.
- `hide_elements` hides elements in one view (`unhide: true` shows them again). It is per element, so new elements are not covered.
- Link chains block opening: ARCH links MECH and EXT, and ELEC links ARCH. A model cannot be opened while any open model links it, and the last open model cannot be closed through the bridge. When a chain blocks the swap, save and restart Revit on the model needed.
- **Project Browser organization is read-only in the Revit API.** `BrowserOrganization` only exposes getters, such as GetCurrentBrowserOrganizationForSheets, GetFolderItems and SortingParameterId. There is no create, set-folders or set-current, so the bridge cannot group sheets into browser folders. The user sets it once per model: Sheets (all) > Browser Organization > New > Folders by "Sheet Group", sorted by Sheet Number. Grouping still holds through the ISO number order and the drawing index.
- `install.ps1` needs `-Dotnet "$env:LOCALAPPDATA\RevitMcp\dotnet-sdk\dotnet.exe"`. There is no `dotnet` on the PATH.
- Detail lines are the way to draw indicative items in a section view: create_swatch only works in drafting views and sheets. Grey shade is close horizontal lines until a filled region tool exists.

## Compiling and document control

- **Never ask the user to close Revit to compile.** Revit locks the live DLL, so compile-check into a throwaway folder, which works with Revit open: `dotnet build addin/RevitMcp.csproj -c Release -p:OutDir="$TEMP/revitmcp_check/"`. Only a real install needs Revit closed: do it once, at the end, when the user agrees.
- **Never send keystrokes to Revit** (SendKeys, PostMessage, Ctrl+S). Revit hung on one. Use list_documents, open_document, activate_document, save_document and close_document.
- A model linked into an open host cannot be opened until the host closes. Linked models appear in list_documents with is_linked true.
- Revit will not close the active document through the API, so close_document brings another open saved document forward first. With no other document open, the last one has to be closed by hand, even with allow_last.
- The source is `revit-mcp/` in this repository. Edit and install from here. `revit-mcp-project` is an old copy.
- Verify a save from the file's LastWriteTime, not from the return value. `tools/doc_control_check.mjs` runs the check.

## Electrical circuits and panels

- **Voltage types hold plain volts, not internal units.** `AddVoltageType` with a converted value makes a 220 V system about 2370 V, and every panel then refuses it: "The Distribution System can not be assigned" and "The panel and circuit do not match". The add-in now passes plain volts. Systems already made with the old code stay wrong and must be replaced.
- **The panel connector must match the system.** Connector voltage equals the system's line-to-line voltage, or line-to-ground on a two-wire system, and the poles must fit. Single phase 220 V: two-wire system, connector 220 V, 1 pole, part type PanelBoard. Check with `diagnose_panel`.
- **Circuits go in a separate ELEC model** started from `Electrical-Default_Metric.rte`. Build devices with `make_unit_family` and its `connector` option, then `create_circuit` and `create_panel_schedule`.
- **Panel schedule views cannot be exported on their own,** but they can go on a sheet: `place_view_on_sheet` takes a panel schedule view, and the sheet exports.
- **A panel schedule has no view scale.** Its size comes from the template's text, row heights and column widths, about 2 mm text by default, which is tiny on A1. Use `scale_panel_schedule` with a factor (2.4 fills A1) and `slots_from_panel: true` so the slot count follows the panel's Max Number of Single Pole Breakers. An existing view keeps the old look: delete it, `create_panel_schedule` again, and place it again.
- **Ceiling plan view range cannot be raised** with `set_view_range` ("Plan view range is not valid"). Lights recessed above the top of the range do not draw in hidden line, so draw their symbols with detail lines and check every light against the legend.
- **Device connectors must be Power - Balanced to carry load.** A Power - Circuit connector has no load field, so its circuit reads 0 VA. Pass `system: "PowerBalanced"` in the `connector` option. The field is named "Apparent Power" on the family connector, not "Apparent Load".
- **Read a panel schedule with `read_panel_schedule`,** since the view cannot be exported. Check breaker ratings, because new circuits default to 20 A and the panel's MCB rating to 1 A. Set "Rating" on each circuit and "Mains" and "MCB Rating" on the panel.
- **Restarting Revit for an install:** save every open model through the bridge, close with `taskkill` without `/F`, install, start `Revit.exe` with the model path, then wait for port 48884. It can take over four minutes. Clean test types with `clean_electrical_types` and link models with `link_revit_model`.

- **A model linked into the open host cannot be opened through the bridge.** `open_document` fails with "Object reference not set". Close the host first.

- **Rebuild a placed unit family in place by its own name.** `make_unit_family` with the existing family name loads over it (OverwriteFamily): every placed instance keeps its position, mark and tags and takes the new shape, as long as the parts' lowest corner sits at the same spot of the unit. Delete the one extra instance it places. Build from `Metric Furniture.rft` and set the category after with `set_family_category`: `Metric Casework.rft` carries a 3D view whose camera inflates every instance's bounding box, and the camera cannot be deleted through the bridge.
- **Place copies from `origin_mm`, never from the expected extent.** The family origin is the lowest corner of *all* the solids, so a part that overhangs the unit (a capital wider than its pier) moves it. On Makkah the pier copies landed 10 mm off until they were placed from `origin_mm`. `make_unit_family` also deletes its source shapes, so do not delete them again.
- **Factory-made parts are fixed.** When a part is already made in the factory (Makkah column CAD 03), never change its size in the model; move the parts around it instead. `edit_family_solids` takes `move: [{ids, dz_mm}]` to shift forms inside a family (ids from `inspect_family`).
- **One family for a composed pier or unit, made from one measured instance.** Group the designer pieces per instance in a local frame (wall to room, along the wall), compare the groups, and build from one when they match (mirror copies count as matching). Then delete the other groups and place copies (`tools`: Makkah `pier_groups.mjs`, `pier_family.mjs`).
- **A duplicate of "3D all" keeps its section box.** Units placed outside the shop (exploded copies) vanish in it, and `place_view_on_sheet` then fails with "Object reference not set" because the view is empty. Make those views with `create_3d_view` aimed at the copy, and hide `OST_RvtLinks` in every 3D view on a sheet, since isolation does not hide links (lights from the linked model show otherwise).

## SultanRevitMCP: loader and hot reload (installed 4 Nov 2026)

The add-in is split in two:
- `revit-mcp/loader/` → `SultanRevitMCP.Loader.dll`: socket server on 48884, command queue, handlers host. Revit loads it at start. It changes rarely, and a change needs one restart.
- `revit-mcp/handlers/` → `SultanRevitMCP.Handlers.dll`: every command. It compiles the same `addin/Handlers*.cs` sources, plus `Entry.cs`.

**New or changed commands:** run `revit-mcp/install-sultan.ps1` with Revit open. It builds the handlers into `%LOCALAPPDATA%\SultanRevitMCP\handlers\<yyyyMMdd-HHmmss>\` and sends `reload_handlers`.
- The loader reads the DLL from bytes into a collectible load context: nothing is locked, the old build is unloaded, and Revit stays open.
- Revit never loads the handlers DLL itself, so there is no "Always Load" prompt for command changes.
- `handlers_info` reports the loaded version.
- To roll back, delete the newest version folder and call `reload_handlers`.
- **Check the version after every install.** If `handlers_info` still names an older folder and a new command says "Unknown command", the running Revit is not picking up new folders (seen 4 Nov 2026: it stayed on 20261104-075232 through several installs, sandboxed or not). Work-around: copy the new `SultanRevitMCP.Handlers.dll` and `.pdb` into the folder it names (keep a backup of the old DLL), then call `reload_handlers`. The loader reads the DLL as bytes, so the copy is not locked. The cause is not found yet.

**One-time switch:** with Revit closed, run `install-sultan.ps1 -Loader`. It retires `RevitMcp.addin` to `.bak`.

**Signing:** the user runs `sign-loader.ps1 -Setup` once, then `sign-loader.ps1` after each loader install. It is the user's action because it changes which certificates Windows trusts.

**Still needs a restart:** changes to the loader, a Revit update, or an add-in crash.

## Several Revits at once, one per session (SultanRevitMCP)

The cause: one Revit, one port and one active model. Two sessions on the same Revit switch each other's active model, and commands land on the wrong file.

**One Revit per session or model.** Revit runs several copies on one machine under one licence (about 2 to 4 GB RAM each with a shop model).
- The loader takes the first free port from 48884 to 48899 (`REVIT_MCP_PORT` pins one).
- It writes `%LOCALAPPDATA%\SultanRevitMCP\instances\<pid>.json` with its port and open models, kept current on open, create, save-as and close.
- `handlers_info` reports the port and pid.

**`tools/rvt.mjs` routes each call by model name:**
1. `REVIT_MCP_PORT`
2. else the Revit that has `params.document` (or `useDocument(title)`, or `REVIT_DOC`) open
3. else 48884

Stale registry files of closed Revits are removed.

**`document` parameter on every command:** the command works on that open model (title or full path) without activating it, so no session switches another's active model. Commands that need the UI still act on the active model: active view, selection, `open_view`, view image export of the active view. Pass `view_id` where a command takes one.

**How to work:**
- Start one Revit per project: `Revit.exe "<model.rvt>"`.
- In each session's scripts, call `useDocument("<title>")` once, or set `REVIT_DOC`.
- For the MCP server, set `REVIT_MCP_PORT` to that Revit's port. Read it from the registry file or `handlers_info`.

Each Revit still runs its commands one at a time.

## Makkah lessons (4 Nov 2026)

- `reload_link` (optional `name`) reloads linked models from disk after they were edited in another Revit. Run it in the host, then `inspect_link`, before any coordination check.
- **Reading a linked model leaves its link unloaded.** To read the existing shell (EXT), close the host, open EXT, read it, reopen the host, then close EXT. The host then shows the EXT link unloaded (the existing slab and walls vanish from renders) until `reload_link` runs. Always reload after this swap.
- **Fit joinery to the existing structure from EXT, not from the designer's file.** On Makkah, the designer's niche pegboards and the gate lunette sat 30 to 400 mm inside the existing rear column. Read the column from EXT and wrap it: a front board just in front of the face, sides tight to it, and the wall boards trimmed to meet the sides.
- **Linked models draw their own levels in host sections, so every level shows two or three times.** The API cannot hide a category inside one link. Fix: set "Building Story" = No on the host's own levels, then `hide_linked_levels` (view_ids) adds a filter "Building Story = Yes" hidden to each view; host filters also act on linked elements. Run it on every new section or elevation.
- `create_detail_lines` draws a true arc when a line has a `mid` point (start, mid, end). Use it for arch set-outs instead of short segments.
- `load_family` takes `overwrite: true` to load an edited .rfa over the loaded one; placed instances stay put.
- `api_members` (type) lists a Revit API type's members, to check what the API allows before writing a command.
- `sheet_browser_info` reports the Project Browser sheet grouping (organisation name, folder parameters). See "Sheet groups" in views-and-sheets.md.
- **Pin the port when a model is open in one Revit and linked in another.** The client routes by title and can pick the Revit where the model is only a link (Makkah: ELEC in the second Revit links ARCH, and calls for ARCH went there). Set REVIT_MCP_PORT.
- `remap_shapes` (element_ids, axis, from[], to[], optional source_document) refits direct shapes in place by a piecewise-linear map along one axis: the way to stretch a joinery run to new bay sizes. Flat faces are rebuilt whole (no triangle edges). Read the geometry from an untouched backup with source_document when a first pass went wrong. Makkah 880 arch refit, 190 pieces.
- **A model opened while another Revit still holds it opens read-only;** save_document then fails with "The file is read-only". Close it and open it again, writable, in one Revit only.
- `create_project` works now: it closes the hidden in-memory copy before opening the saved file. Use it with the metric MEP templates (`Mechanical-Default_Metric.rte`, `Electrical-Default_Metric.rte`).
- `create_floor_plan` takes `ceiling: true` for a reflected ceiling plan.
- `set_view_overrides` takes `categories` (an array), not `category`. A wrong key fails silently inside a `.catch`.
- Views made in an MEP model get the template's view template, which locks View Scale and Detail Level. Set "View Template" to `-1` first.
- A fresh RCP made in ARCH after the MEP links were added showed none of the host ceilings (cause not found). `duplicate_view` of a working RCP was fine: build coordination views as duplicates.
- There is no way to list revisions. Each script run that calls `create_revision` adds another one (Makkah got four). Keep the revision id in a file per model and reuse it.
- A new model has no "Sheet Group" parameter: add it with `ensure_project_parameters` (category OST_Sheets) before making sheets.
- In `add_titleblock_revision_schedule` the field "Description" was not found; check the field names before placing, as the schedule cannot be removed through the bridge.
- Write scripts with paths and line breaks through a file editor, not bash heredocs: backslashes and 
 were lost several times.

**Installed and proven (4 Nov 2026):**
- Revit started with the new loader and the bridge answered in about a minute, with no "Always Load" prompt.
- `install-sultan.ps1` built a new handlers version and loaded it into the same running Revit (same pid), with every command working after the reload.
- The old `RevitMcp.addin` is retired to `.bak`; do not run the old `install.ps1`, which would bring it back.
- From now on, add or change commands with `install-sultan.ps1` and never restart Revit for it.

## Text commands (4 Nov 2026)

- `list_text_notes` (optional `view_id`, optional `contains` list) returns each note's id, full text, view and sheet. `get_element` does not return note text.
- `set_text_note` (element_id, text) replaces a note's whole text. Use `\r` for line breaks, as the notes on our sheets do.
- `add_family_text` puts fixed text into a loaded family and reloads it (see `title-blocks.md`).
- After a level change, notes, level ticks and dimension reference lines in sections stay at the old height. List them with `list_text_notes` and `query_elements` (OST_Lines in the view), then move them with `move_elements` dz_mm. Dimensions tied to the lines follow.

## Title block commands (4 Nov 2026)

`list_family_images`, `replace_family_image`, `list_family_parameters` and `bind_shared_parameters` are in `addin/Handlers.FamilyImages.cs`. See "Labels that show blank" in `title-blocks.md`.
- **The Home screen runs no commands.** A Revit with no model open takes the socket call but never runs it ("did not pick up the command within 30 seconds"), with no dialog to clear. Open any model first.
- **A cloud model cannot be linked through the bridge yet:** `link_revit_model` takes disk paths only. A `CLD:\` path from a journal fails. Link ACC models by hand (Insert > Link Revit > Autodesk Docs) until a cloud option is added.
- The loader still loads only the old version folder (see above). Copying the new DLL and PDB into that folder and calling `reload_handlers` worked three times in a row today.

## Aseer Type 4 lessons (4 Nov 2026)

- **Pass `document` on every call when another session shares the Revit.** The active model flipped to another session's file twice in one hour. The MCP tools do not take it yet, so script through the socket with `"document": "<title>"` (export_view_image works this way too and returns the PNG as base64).
- **Glass hides what is behind it in hidden line.** A front view of a showcase must be a section that cuts just inside the front glass, not an elevation. Cut past any thin inner rings (the Aseer recess ring is 15 to 27 mm in), or the ring's front wall shows as a solid black band across the view.
- **Reading a DWG without opening AutoCAD:** run `accoreconsole.exe /i <copy.dwg> /s <script.scr> /readonly`. AutoCAD's secure load refuses LISP files from the temp folder; do not change SECURELOAD, put the LISP inline in the .scr instead. There is no ActiveX in accoreconsole (`vlax-ename->vla-object` returns nil): read DXF codes with `entget` and block contents with `tblsearch` and `entnext`.
- **Design-team layouts exported from Revit keep the Revit coordinates and family origins:** case positions can be taken from the block insertion points, corrected by each block's own extents (the Aseer 1400 x 800 case origin is 108 mm off centre).

## Sheet copying lessons (Aseer Type 4 lighting sheets, 4 Nov 2026)

New commands: `create_text_notes` (many notes in one step, each with type, wrap `width_mm`, align), `place_image` (2D view or sheet; `height_mm` stretches to an exact box, `foreground` draws it over model surfaces), `set_family_text_size` (gives one family text or label its own smaller type: fixes a title block label that runs out of its cell).
- **Revit does not cut casework in plan.** It draws the whole family from above, so a glass hood top hides everything inside the case, whatever the view range. In a showcase plan, hide the case and draw its outline and glass line with detail lines; objects and luminaires then show.
- **Raster images default to the Background draw layer** and hide behind model surfaces in hidden line. `Draw Layer` 0 is Foreground, 1 is Background (the reverse of what it looks like). Use `place_image` with `foreground: true`.
- **rotate_view_crop on Revit 2026 plans:** the crop region is an uncategorised Element named like the view, not a Viewers element; the command now finds it. Rotating keeps the crop's on-screen size, so crop to the final on-sheet shape first.
- **Reading CAD sheets:** AutoCAD MTEXT over 250 characters keeps its first parts in DXF group 3; join them with group 1, or the start of long notes is lost.
- **PowerShell scripts:** variable names ignore case (`$R` overwrites `$r`, `$T` overwrites `$t`), and `$pid` is reserved. Use distinct names for vectors and scalars.
- **Cloud (ACC) models link only into cloud hosts (4 Nov 2026).** `link_revit_model` now also takes `region`, `project_guid` and `model_guid` (from a journal's `CLD:\US\{project}...\{model}` path), but Revit refuses it into a local model: "This Document is a not cloud model". This replaces the older note above. For a local host, open the ACC model, Save As a detached copy into the project's `Rvt\Linked\` folder, link that, and write its date in the link's comments.
- **`save_cloud_copy` (region, project_guid, model_guid, save_path)** opens an ACC model and saves a standalone central copy on disk, then closes without synchronising (Revit will not detach a cloud model on open). Aseer: 510 MB cloud model, copy 424 MB in 55 s. Link that copy into a local host.
- **Read a linked model by name.** `document` may now name a linked model for read commands (levels, query, element boxes); writes to it fail, as Revit keeps linked documents read-only.
- **Check a link's levels before trusting origin to origin.** The Aseer ARCH model's basement floor sits at +4200 internal, so a host FFL +0.000 plan cut at 1200 showed nothing. Plan XY matched exactly (its grids lie on the host's, which came from the design team's DWG); moving the link -4200 put its floor on the host FFL. Write the shift in the link's Comments.
- A `RevitLinkInstance` reports no bounding box through `get_element`; take building extents from grids or from the link's walls.

## Subcontractor DWG sheets (GBH WD Submittal 16, 4 Nov 2026)

- **GBH draws sheets in model space at a scale (13 on Submittal 16), not on layouts.** Find each frame from the title block's fixed labels: their sheet positions are known from our title block family, so origin = label position - label sheet position x scale.
- **AutoCAD Mechanical objects are proxies in plain AutoCAD.** They block WBLOCK ("proxy object that does not allow copying"), cannot be scaled, moved or erased, and `-EXPORTTOAUTOCAD` in accoreconsole does not convert them. Cut a sheet by erasing everything else and saving a new DWG; the proxies left behind stay at their old positions.
- **Import such a cut into a plan view, not a drafting view.** `import_cad` (view_id, path, color?) imports in mm, origin to origin. A plan view's crop region clips the import, so stray proxies far away disappear; a drafting view cannot crop. Hide the model and links in that plan view.
- A title block shows "1 : 1" for a sheet whose only views are 1:1. To read "As indicated", give one other view (the key plan drafting view) a second scale, with its content scaled up to match.
- **`create_filled_regions` (view_id, regions [{points, color}])** makes solid fills in any 2D view, sections included (points are projected onto the view plane). Use it for finish shading on schematic views; keep fills off the object zone, since detail items draw over model elements.
- **PowerShell traps seen again:** `| Select-Object -First n` stops the script feeding it (a PDF page render stopped after page 1); and `$W` and `$w` are one variable.
