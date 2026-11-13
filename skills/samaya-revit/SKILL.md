---
name: samaya-revit
description: Model buildable Samaya Factory assemblies in Revit for workshop fabrication and site installation. Use for shopfit joinery, cladding, hoarding, fabrication families and shop drawings, including work through SultanRevitMCP. Also covers Samaya Factory project setup, views, sheets, schedules, title blocks, phases and revisions.
---

# Samaya Factory fabrication modeling in Revit

The brand is **Samaya Factory** (samaya-factory.com). Never write "Samaya" alone or "Samaya Investment" on drawings.

For a fabrication model or family, start with [fabrication modeling](references/fabrication-modeling.md), then read the trade reference. Use those rules before drawing geometry or laying out sheets.


## Fabrication trade skills

Use the skill for the work at hand. A model can use more than one.

- [Carpentry](../samaya-carpentry/SKILL.md) for wood parts, joinery and assembly.
- [Welded fabrication](../samaya-welded-fabrication/SKILL.md) for steel parts, connections and fit-up.
- [CNC](../samaya-cnc/SKILL.md) for machine-cut part geometry and DXF checks.
- [Factory handoff](../samaya-factory-handoff/SKILL.md) for packaging and checking the workshop issue.

Read these when relevant:

- [references/project-setup.md](references/project-setup.md): questions to ask and stakeholders. Read before any new project or sheet set.
- [references/phases.md](references/phases.md): phases, filters and graphics. Read before modelling or setting up views.
- [references/revisions.md](references/revisions.md): revision system.
- [references/views-and-sheets.md](references/views-and-sheets.md): view names, templates, scales, sheet numbers, sheet arrangement and schedules. Read before making any view or sheet.
- [references/bim-standards-map.md](references/bim-standards-map.md): the BIM standards that govern our work by tier (ISO 19650, ISO 7817, IFC and buildingSMART, drawing ISOs, regional), what we apply and the gaps. Read when a client sets BIM requirements or a BEP is needed.
- [references/3d-views.md](references/3d-views.md): 3D, isometric and exploded views on sheets, made with `tools/view3d.mjs`. Read before making any 3D view.
- [references/title-blocks.md](references/title-blocks.md): the title block and how to rebuild it.
- [references/modelling-defaults.md](references/modelling-defaults.md): file structure and modelling rules.
- [references/joinery-practice.md](references/joinery-practice.md): how joinery is really built: boards, edges, cladding existing structure. Read before detailing any unit or cladding.
- [references/drawing-and-bim-standards.md](references/drawing-and-bim-standards.md): ISO 128 drawing rules, ISO 19650 information management and IFC. Read before any sheet, issue or export.
- [references/material-hatching.md](references/material-hatching.md): the hatch for each material in sections and details. Read before making any section, detail or material legend.
- [references/revit-bridge.md](references/revit-bridge.md): SultanRevitMCP bridge use and known failures.
- [references/lockers.md](references/lockers.md): locker makers' rules (modules, doors, hinges by thickness and weight, locks, air, rails, fixing, accessibility, real board thicknesses) and the `locker_system.mjs` / `locker_check.mjs` tools. Read before any locker.
- [references/joinery-check.md](references/joinery-check.md): rules J01-J10 and `tools/joinery_check.mjs` (board sizes, shelf sag, hinge by door thickness, modules through the site door, wall fixing, inserts, clashes, Viroc joints). Run on every joinery item before sheets.
- [references/metal-hoarding.md](references/metal-hoarding.md): our hoarding systems by height (light frame up to 4.2 m, lattice frame on RCC footings above 4 m), member sizes, footings, wind loads used and how to model them. Read before any hoarding or site fence job.
- Calculation notes (structural): follow skill `samaya-structural-calc` (executive summary and codes/loads/combinations tables first, factory + client logo, never Robot's raw report). Build with `tools/calc_note/build_calc_note.mjs` (spec JSON -> docx, full-resolution figures) and `tools/calc_note/docx_to_pdf.ps1`. Style: Samaya Factory technical document guide (`samaya-doc-style-guide/projects/factory-technical`): factory logo, client logo, analysis-software logo on the cover, result columns OK green / FAILS red. The note is analysis only: no cost-saving or "where we can reduce" section (cost reductions go to the user in chat). No "ASSUMED" / "to be confirmed" / open-items wording (state design values plainly; the consultant will ask). Tables never split across pages (the builder keeps rows together). Pictures are Robot screen captures from `tools/robot/robot_views.ps1` (4096 px, trimmed). Doors and gates get their own Robot model (jambs, stays, hinges, pads), closed and open. Word conversion: the temp copy needs a unique file name, or after a killed Word a hidden "serious error, open it?" prompt hangs Open.

## Always

1. **Ask before assuming project data.** Client name, project name and the other items in `project-setup.md` must come from the user. Never leave placeholder values on an issued sheet and never invent them.
2. **Fill sign-off from the stakeholder list**, and confirm who the designer is on each project.
3. **Check by looking.** Render the sheet or view with `export_view_image` and read the image before saying it is done. No error from Revit does not mean it looks right. No text or view may overlap or overflow. **Law for every sheet issue (user, 13 Nov 2026): no text may touch or cross any drawing line, symbol, view, image or other text.** Zoom-crop the busy parts of each render (details, diagrams, leaders) and fix every overlap before sending a render or exporting a PDF; `sheet_overflow.ps1` only checks the border.
4. **Always use phases.** Every element and view has one, and existing work is always halftone through the phase graphics. See `phases.md`.
5. **Always use Revit revisions.** Never type a revision by hand. See `revisions.md`.
6. **Always add grids** to every project and show them on plans and sections. See `modelling-defaults.md`.
7. **Use the standard dimension style** on shop drawings: ISO 129-1, Arial 5 mm **blue**, filled 30 degree arrows 3.5 mm, extension legs (3 mm gap, 3 mm past), strings 12 mm apart. See `joinery-practice.md`.
8. **Fabrication sheets follow one layout.** Front, plan directly under it, side beside it, key plan in its panel, the rest in the empty area. Read the Fabrication sheet layout guide in `references/views-and-sheets.md` before making one.
9. **Before ANY sheet, read the sheet rules first and apply all of them:** the 6-column grid, views sized and centred on column lines, one scale per row, 15 mm clear, 5 mm notes and 5.5 mm bold headings, line weights at least 2:1, the dimension style, key plan, revision and sign-off. Then check the render against "Before issuing" in `views-and-sheets.md`. The user caught a sheet built by eye on Madina 2 and said it must never happen again.
10. **Plain English, always.** Every note on a sheet and every message to the user: easy English (about a 5th-grade reading level), short sentences, the tone of a site engineer. No long words where a short one works.
11. **Standards come from one file.** Colours, line styles, text, dimensions, scales, sheet grid and numbering, and coordination colours are in `standards/sultan-standards.json`, applied with `tools/standards.mjs`. Never hard-code them in a script. See `drawing-and-bim-standards.md`.
12. **Every fix becomes general.** SultanRevitMCP serves every factory project. A problem solved once becomes a rule here and, where it can, a general tool or check that takes project data from a config, so it never comes back.
13. **Keep this skill current.** When something new is learned or the user corrects a standard, update the matching file in this repository in the same session, then commit and push. See the README.
14. **Close the Revit files you opened when the work is done.** At the end of every Revit work session, save the intended production model or family, verify that the save succeeded and `is_modified` is false, then close it with `close_document` to free memory for others—even when the larger project goal will continue in a later turn. Close only files this session opened (the model, plus helper files such as structure models or families opened for editing), or files the user expressly names for closeout. Never close any other open file, even if it looks idle: someone else may be using it. Keep a file open only while more work in it will continue in the same active session. If Revit/MCP cannot close the file, say so clearly and do not claim it was closed. See "Compiling and document control" in `revit-bridge.md`.
15. **One writer per model, claimed and released.** When more than one agent or person works on a project, keep a live-work file (`05_BIM/00_Management/<CODE>-Live-Agent-Work-<Pnn>.json`). Before writing a model: claim it there (who, the real time from the clock, scope, expected element count) and check its SHA256 equals the last released hash. After: save, read back, close, write the new SHA256 and counts, and release. Never write a model someone else holds; leave a note instead. See `multi_writer` in `sultan-standards.json`.
16. **Phases, status and sub-colours.** Each discipline owns its existing elements on phase Existing; EXT holds the shell only. Tag status, source and maturity with SF_PhaseStatus, SF_ExistingSource and SF_Maturity, and run `tools/phase_audit.mjs` before every issue. Coordination views colour existing grey, reservations transparent, then sub-discipline colours per category (`colourByDiscipline`) so every category in a discipline has its own shade and ceilings (`[175, 195, 210]` cool slate) never share the floor colour (`[230, 215, 185]` warm sand). See `phases.md` and "Coordination colours" in `drawing-and-bim-standards.md`.
