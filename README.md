# Samaya Factory Revit standards

Skills, defaults, title blocks and tools for Revit work at Samaya Factory.

| Folder | Contents |
|---|---|
| `skills/samaya-revit/` | Claude skill: project questions, stakeholders, revisions, title blocks, modelling defaults, bridge lessons |
| `title-blocks/` | Title block families and logos |
| `tools/` | Bridge client and build scripts |
| `revit-mcp/` | RevitMcp add-in and MCP server source |

## Set up on a computer

```
git clone https://github.com/sultandroid/samaya-revit-standards.git C:\Users\<you>\samaya-revit-standards
cmd /c mklink /J "%USERPROFILE%\.claude\skills\samaya-revit" "%USERPROFILE%\samaya-revit-standards\skills\samaya-revit"
```

The link makes Claude read the skill straight from this repository, so `git pull` is all that is needed to update it.

## Keeping it in sync

When a new lesson or standard comes up, update the matching file under `skills/samaya-revit/references/`, then commit and push. Add new or changed title blocks to `title-blocks/`.

Project models and project data do not belong here.

## Third-party skills

These add-in development skills are installed in `~/.claude/skills` and not stored here, because their source has no license: `revit-addin`, `revit-debug`, `revit-test`, `revit-wpf-mvvm` and `revit-xaml-styles`, from [revit-api-2027-with-claude](https://github.com/tony-hoang-ai-automation/revit-api-2027-with-claude/tree/main/.claude/skills). Copy those folders on another computer.
