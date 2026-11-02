# RevitMcp bridge

Source is in `revit-mcp/`. Client helper: `tools/rvt.mjs`. Raw socket on 127.0.0.1:48884, JSON `{command, params}` plus a newline.

## Rules

- It works only on the **active document**. Check `get_project_info` title before every write.
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
| "One or more of the elementIds cannot be deleted" | Often the active view. Have the user switch view, or update in place. |

## Scripting

Bash heredocs with backslash paths are unreliable. Use forward slashes or write the file directly.
- query_elements returns at most 1000 per call: page with offset, or later elements are silently missed.
- A rebuild script that fails midway leaves its views behind, and the next run cannot reuse their names. Clear views by name prefix at the start of the script.
- Rotating a viewport on a sheet (Rotation on Sheet) also throws it far from its place and turns its title and text. Rotate the crop with rotate_view_crop instead.
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
- **Panel schedule views cannot be exported** with `export_view_image`.
- **Ceiling plan view range cannot be raised** with `set_view_range` ("Plan view range is not valid"). Lights recessed above the top of the range do not draw in hidden line, so draw their symbols with detail lines and check every light against the legend.

