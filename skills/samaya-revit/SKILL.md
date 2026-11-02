---
name: samaya-revit
description: Samaya Factory Revit standards and working method. Use for any Revit modelling, view, sheet, schedule, title block, phase, revision or family work, including through the RevitMcp bridge. Covers the questions to ask before starting a project, stakeholders and sign-off, phases, revisions, view templates, scales, sheet arrangement, title blocks, file organisation and bridge lessons. Trigger on Revit, RVT, RFA, views, sheets, schedules, scale, title block, phase, revision, or a Samaya Factory shopfit project.
---

# Samaya Factory Revit standards

The brand is **Samaya Factory** (samaya-factory.com). Never write "Samaya" alone or "Samaya Investment" on drawings.

Read these when relevant:

- [references/project-setup.md](references/project-setup.md): questions to ask and stakeholders. Read before any new project or sheet set.
- [references/phases.md](references/phases.md): phases, filters and graphics. Read before modelling or setting up views.
- [references/revisions.md](references/revisions.md): revision system.
- [references/views-and-sheets.md](references/views-and-sheets.md): view names, templates, scales, sheet numbers, sheet arrangement and schedules. Read before making any view or sheet.
- [references/title-blocks.md](references/title-blocks.md): the title block and how to rebuild it.
- [references/modelling-defaults.md](references/modelling-defaults.md): file structure and modelling rules.
- [references/joinery-practice.md](references/joinery-practice.md): how joinery is really built: boards, edges, cladding existing structure. Read before detailing any unit or cladding.
- [references/revit-bridge.md](references/revit-bridge.md): RevitMcp bridge use and known failures.

## Always

1. **Ask before assuming project data.** Client name, project name and the other items in `project-setup.md` must come from the user. Never leave placeholder values on an issued sheet and never invent them.
2. **Fill sign-off from the stakeholder list**, and confirm who the designer is on each project.
3. **Check by looking.** Render the sheet or view with `export_view_image` and read the image before saying it is done. No error from Revit does not mean it looks right.
4. **Always use phases.** Every element and view has one, and existing work is always halftone through the phase graphics. See `phases.md`.
5. **Always use Revit revisions.** Never type a revision by hand. See `revisions.md`.
6. **Always add grids** to every project and show them on plans and sections. See `modelling-defaults.md`.
7. **Use the standard dimension style** on shop drawings: 5 mm black Arial, Diagonal 3mm ticks, strings 12 mm apart. See `joinery-practice.md`.
8. **Keep this skill current.** When something new is learned or the user corrects a standard, update the matching file in this repository in the same session, then commit and push. See the README.
