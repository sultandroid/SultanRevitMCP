---
name: samaya-revit
description: Samaya Factory Revit standards and working method. Use for any Revit modelling, sheet, title block, revision or family work, including through the RevitMcp bridge. Covers the questions to ask before starting a project, stakeholders and sheet sign-off, revisions, title blocks, file organisation and bridge lessons. Trigger on Revit, RVT, RFA, sheets, title block, revision, or a Samaya Factory shopfit project.
---

# Samaya Factory Revit standards

The brand is **Samaya Factory** (samaya-factory.com). Never write "Samaya" alone or "Samaya Investment" on drawings.

Read these when relevant:

- [references/project-setup.md](references/project-setup.md): questions to ask and stakeholders. Read before any new project or sheet set.
- [references/revisions.md](references/revisions.md): revision system.
- [references/title-blocks.md](references/title-blocks.md): the title block and how to rebuild it.
- [references/modelling-defaults.md](references/modelling-defaults.md): file structure and modelling rules.
- [references/revit-bridge.md](references/revit-bridge.md): RevitMcp bridge use and known failures.

## Always

1. **Ask before assuming project data.** Client name, project name and the other items in `project-setup.md` must come from the user. Never leave placeholder values on an issued sheet and never invent them.
2. **Fill sign-off from the stakeholder list**, and confirm who the designer is on each project.
3. **Check by looking.** Render the sheet or view with `export_view_image` and read the image before saying it is done. No error from Revit does not mean it looks right.
4. **Existing work is always halftone** in every view and sheet. See `modelling-defaults.md`.
5. **Keep this skill current.** When something new is learned or the user corrects a standard, update the matching file in this repository in the same session, then commit and push. See the README.
