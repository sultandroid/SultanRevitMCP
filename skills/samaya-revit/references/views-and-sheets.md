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

## Sheet numbers (ISO 19650)

Every sheet number is an ISO 19650-2 container name: `Project-Originator-Volume-Level-Type-Role-Number`, for example `MD1-SF-ZZ-GF-DR-A-2101`.

| Field | Value |
|---|---|
| Project | the project code, such as MD1 |
| Originator | SF (Samaya Factory) |
| Volume | ZZ (the whole shop) |
| Level | GF, or the floor |
| Type | DR (every Revit sheet is a drawing) |
| Role | A general and fabrication, E electrical, M mechanical (HVAC), P plumbing, S structural, Z general multi-discipline |
| Number | 4 digits; the series makes the groups |

Series, in the order of the set. Sorting by number gives this order, because DR-A sorts before DR-E and DR-M:

| Series | Group | Content |
|---|---|---|
| A-0001 | 0 General | Cover and drawing index, general notes |
| A-1001 to 1099 | 1 Arch GA | Plans: floor plan, RCP |
| A-1101 to 1199 | 1 Arch GA | General sections |
| A-1201 to 1299 | 1 Arch GA | Sections through units |
| A-1301 to 1399 | 1 Arch GA | General details |
| A-1901 to 1999 | 1 Arch GA | Schedules |
| A-2000 to 2999 | 2 Fab: (item) | Fabrication, one block of 100 per item family. Each block opens with the item's general arrangement (x00), then each unit, its exploded view, parts and details (x01 onwards). Madina 1: 2000 base cabinets, 2100 arch units, 2200 low bays, 2300 rear centre and Mihrab, 2400 free-standing units. |
| E-1001 to 1099 | 3 Electrical | Layouts: lighting, power, data, fire alarm, PA, CCTV |
| E-1101 to 1199 | 3 Electrical | Circuits and conduits |
| E-1201 to 1299 | 3 Electrical | Distribution boards |
| E-1901 to 1999 | 3 Electrical | Schedules |
| M-1001 onwards | 4 Mechanical | HVAC layouts, then details and schedules, the same way |

- Each sheet carries a "Sheet Group" parameter with its group. The drawing index lists GROUP, DRAWING NO., TITLE and REV, sorted by number, one line per sheet: about 48, 60, 72 and 12 mm wide, with short group names.
- Cross-references in notes use the full number. Table columns use the short code (A-2104, E-1201).
- Keep the map from any old number to the ISO number in one module, and have every script use it. On Madina 1 this is `sheetno.mjs`, with `sn()` for the full number and `ss()` for the short code. Renumbering then means editing the map, setting "Sheet Number" again, and running `replace_text` for any note that quotes an old number.
- Ask whether the client or project requires its own numbering before using this.

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

The user's arrangement (set by hand on Madina 1 sheet 120, 3 Nov 2026):

```
+---------+-----------+-----------+-----------+------------+-------+
| 1 FRONT | 2 SIDE    | SECTION A | SECTION B | title,     | title |
|         | + figure  |           |           | keynotes,  | block |
| heads aligned on one line, spread evenly    | quantities,|       |
| from the left margin to the text column     | notes      |-------|
+---------+-----------+-----------+-----------+ (x 815)    | KEY   |
| TOP VIEW| DETAIL    | DETAIL    |           +------------+ PLAN  |
| under   | under     | under     |           | 3D VIEW,   |-------|
| front   | side      | section A |           | fitted to  |       |
+---------+-----------+-----------+-----------+ the space  |       |
                                              +------------+-------+
```

1. Top row: Front, Side (with the Saudi figure), Section A, Section B, all at the same scale. Their heads sit on one line and their levels line up. They are spread evenly from the left margin (x 45) to the text column at x 815 on A1. Use each view's crop width, which already holds its dimensions and the figure; adding margins on top counts that space twice.
2. Row two puts each plan or detail under the view it belongs to: Top View under Front, on the same left and right edges (ISO first angle, plan below the front). The first detail goes under Side and the second under Section A.
3. Text column at x 815: title and quantity, keynotes, material quantities (QTY column at x 975), notes. If the four top-row views do not fit across, fall back to Front and Side in the top row, with the sections beside them or in row two.
3b. The first sheet of each unit also carries an isolated 3D view, so the technician understands the unit at a glance. Scale it to fill the free area under the text column (x 755 to the title block, bottom margin up to the end of the notes), never a fixed small scale. Copy it from the isometric "3D all" view, never from a close-up 3D view. Bridge viewports have no readable outline, so size it from the unit's box (default isometric: width (dx + dy) / 1.414, height 0.816 dz + 0.408 (dx + dy)) and read the free area off the render. Each unit also gets exploded views on their own exploded view sheet only, never on any other sheet. Isolation only hides what exists when it runs, so place exploded copies first, then isolate every 3D view again. They are taken from the real model parts in shaded, coloured 3D views, two angles side by side (front and rear) on a grid, not drawn by hand, with the assembly order listed.
4. The key plan goes in the title block's KEY PLAN panel on every sheet, unit in red, no title.
5. Isolate the unit, with dimensions, keynotes, skirting, door swings, and wire routes where they apply. The Saudi figure goes on the side view only.
6. Before sending, render the sheet and check each item above, and that no text overlaps or runs out of its area.
7. Side units (on a side wall, facing +x or -x) are drawn in their own frame: Front is the face the customer sees, not the model's south. On Madina 1 the generator takes `face: "+x"` and turns sections, dimensions, keynotes and detail lines into the unit's frame. The plan crop cannot be rotated on duplicated plan views (`rotate_view_crop` fails with "Crop region element not found"), so the Top View of a side unit stays north-up. Say so on the sheet check.
8. One sheet per family of identical units, with QTY. Equalise runs so the units are the same size: when two facing runs differ (Madina 1 base cabinets, west 3910 and east 3950 clear), take the difference out of the corner filler, so both runs hold the same cabinets (4 x 987.5). Update the marble top, end panel and the general arrangement tables after the change. Where one unit in a family is wider, it gets its own sheet (the user's choice on Madina 1: low bays W-L2 944 and E-L2 983 moved from A-2201 to A-2203 "Middle Side Low Bay", next number in the block, so no existing sheet is renumbered). A sheet's QTY counts only units that match its dimensions. When the units on one sheet differ in depth (Madina 1 west bays 580 deep, east 550), the size line lists each, and a sheet without its own details points to the sheet that has them. Read every unit's box before writing QTY: a family's ref unit does not prove the others match.
9. A part of a merged unit (Madina 1: niche frame, niche cabinet, column cladding, carpet hanger inside the Mihrab) gets a section-boxed 3D view around that part, not a copy of the unit's 3D, which shows the whole Mihrab or other units. Free-standing units get an isolated 3D placed in the sheet's free corner when the text column is full.

## Schedules

- Filter to the phase and discipline. Set Phase on the schedule to New Construction.
- Add units in the heading, and sort and group so it reads like a list.
- Use the same text type on every schedule.
- Split long schedules across columns instead of running past the sheet.
- The cover has a Sheet List drawing index, updating itself.

## Key plan

Every sheet has a key plan in the title block's KEY PLAN panel: a small cropped plan with the area or unit on that sheet highlighted in red. Use a viewport with no title, because the panel already has its heading. A view can sit on only one sheet, so duplicate it for each sheet.

## Free-standing units in sections

In every section, free-standing units (island displays, counters, display units) are hidden and shown only by their outer outline: one grey dashed rectangle per unit, the extent of its main parts, with no internal lines. Outlets mounted on the unit are hidden with it. Use `hide_elements` for the unit, then draw detail lines in the "Indicative Outline" style (weight 1, grey, Dash). The exceptions are the unit's own detail sheet and its working views (on Madina 1, J131 and WK-Pegboard Bend are the counter D-01, and J132 is the island D-02). The script `isl_outline.mjs` logs the lines it creates, so a rerun replaces them. Rerun it whenever a section is added or a unit moves.

## Isolated views go stale

An isolated view (unit sheets, exploded views) only hid what existed when it was isolated. Every element made later, such as a rebuilt shutter, a new ceiling or a new LED strip, appears in all of them. After any model change, rerun the clean-up: in each isolated view, hide everything visible except the view's own unit, and hide the links category. Then render every sheet that has a 3D view and check it. When a unit is merged into another, its old sheet shows the merged unit. Ask the user whether to retire it. On Madina 1 the user kept 127 Niche Frame and 130 Carpet Hanger after the Mihrab merge.

When a run is equalised (Madina 1: base cabinets 3950 both sides), equalise the units above it too, so matching units on both sides are the same size: the west upper row was rebuilt as the east row shifted 40 mm, and W-L2 and E-L2 became 983 each. Rebuild everything that follows the units' positions (arches, lanterns centred on the bays, strip cladding cut to the arches, corner panels, top supports), then the unit, arrangement and storage sheets.

A new sheet's title block takes the family defaults (Designer, Checker, Approver). Set Designed By, Checked By and Approved By on its title block from the stakeholder list every time.

## Coordination sheets

Every shop with services above a ceiling gets coordination sheets, role Z, group "5 Coordination" (after M):
- Z-1001 Coordinated Ceiling Plan: the RCP with ceilings, lights, devices, grilles and access doors together, shaded so each discipline reads in its colour (an exception to black and white: coordination is read by colour), with what was checked listed.
- Z-1002 Ceiling Void Plan: cut above the ceiling (+3.65 on Madina 1), services in colour, ceilings halftone, beams and the tray step dashed, routes noted. Hide generic models when the existing slab is one.
- Z-1101 Coordination Sections at 1:10, cropped to the zones that matter (grilles, AC unit, each beam crossing), with vertical clearance dimensions and a clearance table: each item's gap to the ceiling below and the beam or slab above, read from the model. Flag gaps under about 80 mm, where hangers and insulation will not fit.
- Colour by discipline in coordination views only, with `set_view_overrides` `color` (lines plus solid surface and cut fill): Mechanical blue (30, 110, 230), Electrical orange (245, 140, 0), architecture in its own finishes, existing grey. Override every category of each discipline (mechanical equipment, ducts, flex, terminals, pipes; lighting, electrical fixtures and equipment, fire alarm, security, communication, data, conduit). Put a one-line colour key on each coordination sheet. The models keep their own materials.
- On a busy plan, put every label outside the walls with a leader to its item, in a column on each side, and widen the crop (annotation crop clips text) to hold them. Labels placed inside the shop land on joinery and lights (the user flagged Z-1001 on Madina 1).

A regenerated sheet is a new sheet: it loses its "Sheet Group", so the drawing index shows a blank group. After any sheet rebuild, set the groups again and check the cover. When checking 3D views, check both the view itself and its place on the sheet: on Madina 1 the cover's overall 3D ran into the title block's revision panel, and a key plan kept its viewport title.

## Section lines stay clean

General plans show only the building sections. Every fabrication, detail or working section has "Hide at scales coarser than" set to 1:2 when it is created (the master plan here runs at 1:9, so 1:20 is not enough), so its line never appears on a general plan. Section lines should be evenly placed, must not cross text, and their heads sit outside the plan.

## Every sheet uses a grid

Every sheet, of any kind, is laid out on one grid: A1 drawing area x 20 to 1012, 6 columns of 165 mm, lines at 20, 186, 351, 516, 682, 847, 1012, centres at 103, 268, 434, 599, 764, 929. Views centre on a column or a column line. Views in a row share a level, so the same height reads across them. Notes and tables start on a column line. Never place by eye.

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
- **Keynotes and leaders:** numbers in neat columns beside the view, one column per side, aligned top to bottom, and numbered in reading order (top to bottom, left column then right). Leaders are straight and horizontal, from the part to the column, with no angled, crossing or bunched leaders, and never through a dimension or another label. Bold 6 mm numbers; the key text sits next to the detail with the same numbers.
- **Inputs required** (questions for the client, operator, mall or site): always in red text (bold red heading "INPUT REQUIRED FROM THE ..."), in the bottom right corner of the drawing area beside the title block, inside a revision cloud where the item is an assumption. Never in black among the notes.
- **Out-of-scope items** (goods, carpets, loose furniture) show grey and halftone, never in colour.
- **Keep a margin:** nothing (views, titles, bubbles, dimensions) within 15 mm of the drawing border or the title block.
- **Chains:** drop segments under about 60 mm from a chain, since the number will not fit; give those sizes in a table or a larger detail.
- **Re-isolate after model changes.** An isolated view hides only what existed when it was isolated, so any new or rebuilt element appears in every unit and 3D view. After changing the model, rebuild or re-isolate every sheet that could show it, and re-render before reporting.
- **Grids** show on plans, sections and arrangement elevations, never in an isolated unit view.
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
