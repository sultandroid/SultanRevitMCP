# SultanRevitMCP

Samaya Factory's Revit system for every factory project. It holds the bridge that lets Claude drive Revit (`revit-mcp/`), the know-how (`skills/samaya-revit`: joinery and fabrication methods, sheets, 3D views, template, revisions and every lesson learned), the factory template and title blocks, and general tools. Every problem solved on a project becomes a rule or a tool here, so it does not come back. Private; the team pulls it and runs `revit-mcp/install-sultan.ps1`.

| Folder | Contents |
|---|---|
| `skills/samaya-revit/` | Claude skill: project questions, stakeholders, revisions, title blocks, modelling defaults, bridge lessons |
| `title-blocks/` | Title block families and logos |
| `tools/` | Bridge client and build scripts |
| `revit-mcp/` | **SultanRevitMCP**: our Revit add-in and MCP server source (code and files still named RevitMcp until the loader rework) |

## Set up on a computer

```
git clone https://github.com/sultandroid/SultanRevitMCP.git C:\Users\<you>\samaya-revit-standards
cmd /c mklink /J "%USERPROFILE%\.claude\skills\samaya-revit" "%USERPROFILE%\samaya-revit-standards\skills\samaya-revit"
```

The repository was renamed from `samaya-revit-standards`; the local folder keeps the old name so existing links and paths still work. Old clones keep working through GitHub's redirect, but you can point them at the new name with `git remote set-url origin https://github.com/sultandroid/SultanRevitMCP.git`.

The link makes Claude read the skill straight from this repository, so `git pull` is all that is needed to update it.

Then register the MCP server with Claude Desktop (Settings > Developer > Edit Config) and restart it fully; see [`revit-mcp/README.md`](revit-mcp/README.md) for the loader install and the config:

```json
{
  "mcpServers": {
    "revit": {
      "command": "node",
      "args": ["C:\\Users\\<you>\\samaya-revit-standards\\revit-mcp\\server\\server.mjs"]
    }
  }
}
```

## Keeping it in sync

When a new lesson or standard comes up, update the matching file under `skills/samaya-revit/references/`, then commit and push. Add new or changed title blocks to `title-blocks/`.

Project models and project data do not belong here.

## Third-party skills

These add-in development skills are installed in `~/.claude/skills` and not stored here, because their source has no license: `revit-addin`, `revit-debug`, `revit-test`, `revit-wpf-mvvm` and `revit-xaml-styles`, from [revit-api-2027-with-claude](https://github.com/tony-hoang-ai-automation/revit-api-2027-with-claude/tree/main/.claude/skills). Copy those folders on another computer.
