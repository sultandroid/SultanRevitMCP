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
| Bridge stalls after renaming a level or plan view | Renaming a level, or a plan view named like its level, opens a modal dialog. Do not rename them: use `create_level`, or set Title on Sheet. |
| Family conversions vanish | Revit reverted 14 `make_unit_family` conversions with no journaled Undo, cause unknown. Check families are present after each batch. |
| "Curve length is too small" | Geometry under Revit's short curve tolerance, about 0.8 mm. |
| "Sketch plane creation is not allowed in this family" | Old add-in build in the `lines` branch of `build_title_block`. Source is fixed, reinstall. |
| A linked model loads but draws nothing, in every view | The link was made with a forward-slash path (`C:/...`). Revit loads the file but cannot tie the link to it: the journal says "Where is the document?" and `inspect_link` shows `link_doc` null. Delete the link and link again with a backslash path. The add-in now turns paths to backslashes itself (Makkah, 4 Nov 2026). Hand-made links are fine. |
| "One or more of the elementIds cannot be deleted" | Often the active view. Have the user switch view, or update in place. |

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
