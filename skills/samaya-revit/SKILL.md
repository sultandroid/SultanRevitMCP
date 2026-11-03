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
- [references/3d-views.md](references/3d-views.md): 3D, isometric and exploded views on sheets, made with `tools/view3d.mjs`. Read before making any 3D view.
- [references/title-blocks.md](references/title-blocks.md): the title block and how to rebuild it.
- [references/modelling-defaults.md](references/modelling-defaults.md): file structure and modelling rules.
- [references/joinery-practice.md](references/joinery-practice.md): how joinery is really built: boards, edges, cladding existing structure. Read before detailing any unit or cladding.
- [references/drawing-and-bim-standards.md](references/drawing-and-bim-standards.md): ISO 128 drawing rules, ISO 19650 information management and IFC. Read before any sheet, issue or export.
- [references/material-hatching.md](references/material-hatching.md): the hatch for each material in sections and details. Read before making any section, detail or material legend.
- [references/revit-bridge.md](references/revit-bridge.md): RevitMcp bridge use and known failures.

## Always

1. **Ask before assuming project data.** Client name, project name and the other items in `project-setup.md` must come from the user. Never leave placeholder values on an issued sheet and never invent them.
2. **Fill sign-off from the stakeholder list**, and confirm who the designer is on each project.
3. **Check by looking.** Render the sheet or view with `export_view_image` and read the image before saying it is done. No error from Revit does not mean it looks right. No text or view may overlap or overflow.
4. **Always use phases.** Every element and view has one, and existing work is always halftone through the phase graphics. See `phases.md`.
5. **Always use Revit revisions.** Never type a revision by hand. See `revisions.md`.
6. **Always add grids** to every project and show them on plans and sections. See `modelling-defaults.md`.
7. **Use the standard dimension style** on shop drawings: ISO 129-1, Arial 5 mm **blue**, filled 30 degree arrows 3.5 mm, extension legs (3 mm gap, 3 mm past), strings 12 mm apart. See `joinery-practice.md`.
8. **Fabrication sheets follow one layout.** Front, plan directly under it, side beside it, key plan in its panel, the rest in the empty area. Read the Fabrication sheet layout guide in `references/views-and-sheets.md` before making one.
9. **Before ANY sheet, read the sheet rules first and apply all of them:** the 6-column grid, views sized and centred on column lines, one scale per row, 15 mm clear, 5 mm notes and 5.5 mm bold headings, line weights at least 2:1, the dimension style, key plan, revision and sign-off. Then check the render against "Before issuing" in `views-and-sheets.md`. The user caught a sheet built by eye on Madina 2 and said it must never happen again.
10. **Plain English, always.** Every note on a sheet and every message to the user: easy English (about a 5th-grade reading level), short sentences, the tone of a site engineer. No long words where a short one works.
11. **Keep this skill current.** When something new is learned or the user corrects a standard, update the matching file in this repository in the same session, then commit and push. See the README.
