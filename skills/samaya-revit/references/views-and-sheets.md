# Views, scales and sheets

## View names

Pattern: `<Discipline>-<Location>-<Type>-<Scope>`, for example `A-L01-PLAN-New`, `A-L01-RCP-New`, `A-L01-PLAN-Demo`, `A-SEC-A`.

- **Title on Sheet** holds the readable title for the client, such as "Reflected Ceiling Plan".
- Working views end in `-WK` and never go on a sheet.
- Sort the browser by a browser organisation rule, not by number prefixes on names.
- A view can sit on one sheet only. Duplicate it with `Duplicate as Dependent` or `Duplicate with Detailing` to reuse it.

## View templates

Every view on a sheet has a view template that controls scale, detail level, visibility, filters and phase filter. Do not fix graphics view by view.

| Template | Scale | Detail | Phase Filter |
|---|---|---|---|
| Plan | 1:50 | Medium | Show Previous + New |
| Demolition Plan | 1:50 | Medium | Show Previous + Demo |
| Existing Plan | 1:50 | Medium | Show Complete |
| Reflected Ceiling Plan | 1:50 | Medium | Show Previous + New |
| Elevation | 1:50 | Medium | Show Previous + New |
| Section | 1:50 | Fine | Show Previous + New |
| Detail | 1:5 | Fine | Show New |
| Shop Drawing Unit | 1:20 | Fine | Show New |

The bridge has no command to create these. Check with `list_views` and ask the user to create what is missing, or add a command.

## Scales

Use the ISO 5455 series only: 1:1, 1:2, 1:5, 1:10, 1:20, 1:50, 1:100. Never imperial: 1/4" = 1'-0" is 1:48, not 1:50.

| Content | Scale |
|---|---|
| Key plan | 1:200 or smaller, no dimensions |
| Store plan, RCP, MEP layout | 1:50. Use 1:25 only if the store is too small to read, and agree it. |
| Store elevations and sections | 1:50 or 1:25 |
| Wall elevation, cabinet or unit elevation | 1:20 |
| Joinery and unit sections | 1:10 |
| Construction details | 1:5 |
| Fixing details and profiles | 1:2 or 1:1 |

Text and tags come out the same size on paper at any scale, so check them after a scale change. Show the scale bar or scale in every view title. Write "NTS" only for diagrams.

## Sheet numbers

Pattern: `<Discipline>-<Series><Number>`. Use a Sheet List schedule to manage them.

| Series | Content |
|---|---|
| A-000 | Cover, drawing index, legends, general notes |
| A-100 | Existing, demolition and new plans |
| A-200 | RCP and ceiling details |
| A-300 | Elevations |
| A-400 | Sections |
| A-500 | Details |
| A-600 | Schedules: finishes, doors, marks |
| A-700 | Unit shop drawings |

M- for mechanical, E- for electrical, P- for plumbing, with the same pattern. Ask whether the client or project requires its own numbering.

## Sheet arrangement

**One view per sheet, sized to fill the sheet.** The user set this over any scale in the tables above, and whole-number scales outside the ISO series are fine for it. On a small shop on A1, plans are about 1:9, sections 1:8 and tall details 1:5. Render each sheet: tags, level heads and view titles must stay clear of the title strip and the sheet edge.

For the A1 title block, the drawing area is x 10 to 1022, y 10 to 831, in sheet mm. Keep 15 mm clear inside it.

1. Plan the sheet before placing anything. Largest and most important view first.
2. Place the plan at left or centre. Stack supporting sections and details to the right, nearest the plan they explain.
3. Keep the same view at the same sheet position on every sheet: all plans, all RCPs. Use one shared guide grid, 50 mm spacing, with an intersection at the drawing area corner.
4. Align by grid lines or crop region, not by eye. Plans with the same scope use the same crop or scope box.
5. Orient views the same way on all sheets, such as shop front at the bottom.
6. Keep elevations on one line and sections in line with each other, each with its title below on the same line.
7. Leave room for dimensions and tags, and don't fill every part of the sheet.
8. One scale per sheet where possible, and group mixed scales.
9. Schedules go at top right of the drawing area, next to the title strip, or on an A-600 sheet. Legends and notes also stack on the right.
10. Use the same viewport type for all view titles.

## Joinery sheets

Every fit-out set includes joinery shop drawings in the A-700 series:

- A sheet for each unit type, with its plan, front elevation and section, overall and key dimensions, and quantity.
- **Isolate the unit:** every view on the sheet shows that unit alone, with no neighbours, levels or section marks.
- **Keynote every part or material:** numbered leaders on the views, with a keynote legend on the sheet.
- **Material quantities, not a cutting list:** a table of net consumable area for each material, in m2, with length or count for items such as plinths and grommets.
- Choose the front direction so the unit's length runs left to right in the plan where possible; the top view then needs no rotation.
- **Main three views in standard projection, always aligned:** front elevation, top view directly under it, side view beside it. All three at the same scale, the front and top sharing vertical alignment, the front and side sharing horizontal alignment. The top view is turned so its length runs the same way as the front; rotate its crop, not the viewport, so text and the title stay upright.
- **Scale and use references on the main three views:** a Saudi human figure in thobe and shemagh, 1700 mm tall and shaded grey, on the side view only, and any device the unit carries, such as a POS, drawn in halftone as view-only detail lines, so they stay out of the model and the quantities. Note them as indicative.
- **Door swing:** dashed lines on every door elevation, the triangle pointing at the hinge side, plus a dashed 90 degree arc in the top view.
- Rear elevation, sections, details, keynotes and the material table go in the white space left around the three main views, never in place of them.
- List each unit's mark and exact size on its type sheet, because built sizes differ slightly.
- A quantity schedule of all units, and a material legend with colour swatches, finish names and codes, and where each is used.

## Fabrication sheet layout guide

Use this on every fabrication sheet, every time. Do not start from an older sheet. An old sheet in the model is replaced, not patched.

```
+------------------------------+------------+-----------+-------+
| 1 FRONT ELEVATION            | 2 SIDE     | keynotes  | title |
|                              | beside the | material  | block |
|                              | front, same| table     |       |
|                              | levels     |           |-------|
+------------------------------+------------+-----------+ KEY   |
| 3 PLAN (TOP VIEW)            | sections, rear elev.,  | PLAN  |
| directly under the front,    | details, in the empty  |-------|
| same left and right edges    | area                   |       |
+------------------------------+------------------------+       |
| details and general notes                             |       |
+-------------------------------------------------------+-------+
```

1. Front, plan and side are the fixed main views, all at the same scale. Place them first.
2. The front's left and right edges line up with the plan's. The front's floor and top line up with the side's.
3. Everything else goes in the empty area only: rear elevation, sections, details, keynotes, material table, notes.
3b. The first sheet of each unit also carries an isolated 3D view, so the technician understands the unit at a glance. Each unit also gets an exploded view on its own sheet if needed, taken from the real model parts in shaded, coloured 3D views, two angles side by side (front and rear) on a grid, not drawn by hand, with the assembly order listed.
4. The key plan goes in the title block's KEY PLAN panel on every sheet, unit in red, no title.
5. Isolate the unit, with dimensions, keynotes, skirting, door swings, and wire routes where they apply. The Saudi figure goes on the side view only.
6. Before sending, render the sheet and check each item above, and that no text overlaps or runs out of its area.

## Schedules

- Filter to the phase and discipline. Set Phase on the schedule to New Construction.
- Add units in the heading, and sort and group so it reads like a list.
- Use the same text type on every schedule.
- Split long schedules across columns instead of running past the sheet.
- The cover has a Sheet List drawing index, updating itself.

## Key plan

Every sheet has a key plan in the title block's KEY PLAN panel: a small cropped plan with the area or unit on that sheet highlighted in red. Use a viewport with no title, because the panel already has its heading. A view can sit on only one sheet, so duplicate it for each sheet.

## Detail sheets use a grid

Lay out every detail sheet on columns and rows, with views, tables and notes starting on the same lines. Do not scatter details in free space.

## Key plan must be correct

Check the key plan on every sheet before sending it, by looking at it in the render:

- Mark every unit the sheet covers. A typical sheet for 6 units shows all 6 in red, never just one.
- Read positions from the real elements in the model at build time. Never type coordinates by hand, and never use a sample or temporary element.
- Mark nothing the sheet does not cover. A count of red marks must match the QTY on the sheet.
- It shows the current plan, in the KEY PLAN panel, at 1:100, without a title.
- After any unit moves or changes size, rebuild the key plans that show it.

## Before issuing

- Render every sheet with `export_view_image` and read it, or export a test PDF.
- No placeholder text, working views or stray elements outside title block limits.
- Every view has a title, scale and template.
- Every sheet has its key plan.
- **No overlaps or overflow, ever.** No text, title, tag, dimension or view may overlap anything or leave its panel or the sheet. Check every sheet at full size before reporting it.
- Revision and sign-off are filled.

## Sources

- [Autodesk: guide grids](https://help.autodesk.com/cloudhelp/2024/ENU/RevitLT-GetStarted/files/GUID-73FDE1A3-4F91-46EC-9654-FC4573907D86.htm)
- [Novedge: view placement and sheet composition](https://novedge.com/blogs/design-news/revit-tip-professional-revit-view-placement-and-sheet-composition-workflow)
- [Novedge: consistent sheet layouts](https://novedge.com/blogs/design-news/revit-tip-consistent-sheet-layouts-with-view-templates-scope-boxes-and-guide-grids)
- [Novedge: sheet setup standards](https://novedge.com/blogs/design-news/revit-tip-revit-sheet-setup-and-documentation-standards)
- [Novedge: view and sheet naming](https://novedge.com/blogs/design-news/revit-tip-standardize-revit-view-and-sheet-naming)
- [Archgyan: project browser](https://archgyan.com/mastering-revit-project-browser-organisation-tips-large-projects/)
- [Arkance: browser organisation](https://emea.support.arkance.world/hc/fr/articles/36466124540818-Revit-Tip-Organising-the-Revit-Project-Browser-Part-1)
- [ISO 5455 scales](https://www.iso.org/standard/11500.html)
- [Learn Architecture: drawing scales](https://learnarchitecture.net/articles/39289-architectural-drawing-scales.html)

The numbering, templates, spacing and placement here are Samaya defaults built from this guidance, not rules from those sources. Change them if the user sets a different standard.
