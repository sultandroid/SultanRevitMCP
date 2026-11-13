# SultanRevitMCP (RevitMcp add-in + MCP server)

Lets an MCP client such as Claude read and edit the model open in Autodesk Revit 2026.

```
MCP client  --stdio-->  server/server.mjs  --127.0.0.1:48884-->  RevitMcp add-in  -->  Revit API
```

The add-in runs inside Revit, because the Revit API is only callable from Revit's own process and main thread. The Node server translates MCP tool calls into commands for it.

## Team quick start (SultanRevitMCP)

Requires Revit 2026, Node 20+ and the [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0).

1. **Clone** the repository.
2. **Install the loader, once.** Close Revit and run `powershell -ExecutionPolicy Bypass -File install-sultan.ps1 -Loader -Dotnet dotnet`.
3. **Optional, to stop the "Always Load" prompt.** Run `sign-loader.ps1 -Setup` once, then `sign-loader.ps1`. You run these yourself: they trust a certificate for your Windows user.
4. **Start Revit.** Choose **Always Load** once if asked.
5. **After each `git pull`**, with Revit open, run `install-sultan.ps1 -Dotnet dotnet`. The new commands load into the running Revit through `reload_handlers`; no restart. Check the loaded version with the `handlers_info` command.
6. **Several projects at once:** open one Revit per model. Each takes its own port (48884, 48885, ...) and records it in `%LOCALAPPDATA%\SultanRevitMCP\instances\`.
   - Scripts: `import { call, useDocument } from "./client/rvt.mjs"; useDocument("MyModel");`
   - MCP server: set `REVIT_MCP_PORT` to that Revit's port.
7. **Register the MCP server** with your client, as below.

Layout:
- `loader/`: the small add-in Revit loads at start.
- `handlers/`: the commands, hot-reloadable. Their sources are in `addin/Handlers*.cs`.
- `client/rvt.mjs`: the Node client.
- `server/`: the MCP server.
- `addin/RevitMcp.csproj` and `install.ps1`: the legacy single-DLL build.

## Legacy install (single DLL, restart for every change)

Close Revit, then run:

```bash
powershell -ExecutionPolicy Bypass -File install.ps1
```

Start Revit and choose **Always Load** when it asks about the unsigned add-in. Then register the server with your client, using the full path to `server.mjs`.

Claude Code:

```bash
claude mcp add revit -- node "C:\full\path\to\revit-mcp\server\server.mjs"
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "revit": {
      "command": "node",
      "args": ["C:\\full\\path\\to\\revit-mcp\\server\\server.mjs"]
    }
  }
}
```

## Tools

| Group | Tools |
| --- | --- |
| Read | `get_project_info`, `list_levels`, `list_views`, `list_element_types`, `query_elements`, `get_element`, `get_selection`, `get_schedule_data`, `get_view_geometry`, `get_electrical_info`, `probe_ray`, `inspect_cut`, `inspect_family`, `export_view_image` |
| UI | `select_elements`, `open_view` |
| Create | `create_project`, `create_level`, `create_grid`, `create_wall`, `create_floor`, `create_room`, `place_family_instance`, `create_floor_plan`, `create_section`, `create_sheet`, `place_view_on_sheet`, `duplicate_view`, `create_detail_lines`, `create_text_note`, `create_direct_shape`, `copy_instance_scaled`, `list_family_text`, `set_family_text`, `add_titleblock_revision_schedule`, `create_revision`, `set_sheet_revisions`, `create_sheet_list`, `set_schedule_format`, `view_category_counts`, `set_view_overrides`, `ensure_line_style`, `ensure_text_type`, `load_family`, `place_on_face`, `ensure_reference_plane`, `place_on_reference_plane`, `create_circuit`, `ensure_distribution_system`, `set_panel_system`, `set_view_categories`, `set_view_range`, `create_schedule`, `create_panel_schedule`, `ensure_project_parameters`, `ensure_material`, `create_pipe_run` |
| Change | `set_parameter`, `move_elements`, `delete_elements`, `extend_view_crop`, `enable_void_cut`, `create_void_family`, `make_unit_family`, `build_title_block`, `cut_with_voids`, `extract_nested_family`, `set_family_material` |
| Families | `family_report`, `family_types`, `family_forms`, `family_dimensions`, `family_type_extents` (read), `set_family_parameters` (change) |

## Family documents

The `family_*` tools read a family from one of three sources, so a check never has to take over the active document:

- `path`: an `.rfa` on disk. Revit opens it in the background (never shown, never active), reads it and closes it without saving. `expect_sha256` (a prefix is enough) refuses the wrong build before anything is read. Cloud-only OneDrive / ACC placeholders are reported as such, instead of Revit's "does not exist".
- `element_id`: an instance in the model; its family is opened for editing, read and closed.
- `document`: a family already open in Revit, by title or path (else the active document).

What they return, in mm and degrees:

- `family_types`: category, types, and every family parameter with its value in each type, formula, group and shared GUID.
- `family_forms`: every solid, void and nested family with extents, material, visibility, driving parameters, extrusion start/end, and each sketch loop measured in its own plane (minimum-area rectangle w x h, area, centre, holes flagged). A 100 x 100 tube shows as `100 x 100` plus `90 x 90 (hole)`, so the wall thickness reads straight off.
- `family_dimensions`: dimensions with their label parameter and value; reference planes with name, plane and Is Reference.
- `family_type_extents`: switches to each type, measures it and rolls back; `match_height_mm` finds the type of a given height.
- `family_report`: all of the above from one open of the file.
- `set_family_parameters`: switch to or create a type and set values or formulas in an open family (one undo step, not saved).

Every MCP tool now also takes `document` (title or path of an open document) to work on that document instead of the active one. The add-in already supported this; the server used to drop the argument.

## Behaviour

- **Units:** coordinates and `*_mm` values are millimetres, relative to the model's internal origin. The exception is `set_parameter`, where a plain number uses the parameter's display units and a string such as `"3000 mm"` states its own.
- **Undo:** each change is one undo step in Revit, named `MCP: ...`. Changes are not saved to disk; saving stays with you. The one exception is `create_project`, which has to save the new project to a new file so Revit can open it.
- **Warnings:** Revit warnings are dismissed and returned in the tool result's `warnings`, because a dialog would block the bridge. Errors roll the change back and come back as tool errors.
- **Busy Revit:** Revit only runs commands when idle. If a dialog is open or a command is active for 30 seconds, the call fails without running. Close the dialog or press Esc, then retry.
- **Security:** the bridge listens on loopback only and has no authentication, so any program running on this computer can drive it. It has no tool for running arbitrary code.

## Configuration

Set `REVIT_MCP_PORT` (default `48884`) for both Revit and the server to change the port. Only one Revit session can hold a port, so a second session's add-in stays inactive unless it starts with a different one.

## Troubleshooting

The loader logs to `%LOCALAPPDATA%\SultanRevitMCP\bridge.log` (the legacy add-in to `%LOCALAPPDATA%\RevitMcp\bridge.log`).

## Tests

```bash
cd server && npm install && npm test
```

These run the MCP server against a fake add-in, so they do not exercise the Revit API.

To build for another Revit version, pass `-RevitVersion`. Revit 2025 and 2026 use .NET 8; earlier versions need a different target framework and are not supported.
