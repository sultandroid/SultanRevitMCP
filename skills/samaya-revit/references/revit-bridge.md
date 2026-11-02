# RevitMcp bridge

Source is in `revit-mcp/`. Client helper: `tools/rvt.mjs`. Raw socket on 127.0.0.1:48884, JSON `{command, params}` plus a newline.

## Rules

- It works only on the **active document**. Check `get_project_info` title before every write.
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
| Bridge stalls after renaming a level | `set_parameter` Name on a level opens a modal dialog. Do not rename levels, use `create_level`. |
| Family conversions vanish | Revit reverted 14 `make_unit_family` conversions with no journaled Undo, cause unknown. Check families are present after each batch. |
| "Curve length is too small" | Geometry under Revit's short curve tolerance, about 0.8 mm. |
| "Sketch plane creation is not allowed in this family" | Old add-in build in the `lines` branch of `build_title_block`. Source is fixed, reinstall. |
| "One or more of the elementIds cannot be deleted" | Often the active view. Have the user switch view, or update in place. |

## Scripting

Bash heredocs with backslash paths are unreliable. Use forward slashes or write the file directly.
