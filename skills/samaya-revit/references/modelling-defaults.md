# Modelling defaults

## Files

Each project has a `Revit Files` folder:

```
Rvt\ARCH\<Project>_ARCH_nn.rvt       main architectural model
Rvt\FIN EXISTING MODEL\<Project>_EXT.rvt   existing condition
Rvt\MECH\<Project>_MECH.rvt          one discipline file each, linked into ARCH
Rfa\                                 unit families
Rfa\Mechanical\                      discipline families
Rfa\Title Blocks\                    title blocks and logos
```

- **Each discipline is its own file**, linked into ARCH. Never model MEP inside ARCH.
- All discipline files use the same coordinates as ARCH.
- Model the existing condition first, then the new model.

## Materials

Samaya Factory builds in **EGGER laminates and painted FR MDF**, and this replaces veneer and HPL shown on design drawings. Confirm the codes for each project. On Madina 1: EGGER H1113 ST10 Brown Kansas Oak, EGGER U775 ST9 White Grey and F186 ST9 Light Chicago Concrete. EGGER thickness is 18 or 8 mm only. The legend shows the material actually used, not the design file's.

## Freestanding furniture

Model counters, islands and displays as furniture families from the design file's furniture plan and detail sheets, named with their schedule code, such as D-01. Set the position from the furniture plan, and check it against the masonry, because built-in units may have moved since the drawing.

## Grids

**Every project has grids.** Take them from the source drawing where it has any. Otherwise set them on the inside faces of the existing walls (not on joinery faces), and always add centre grids both ways. Keep grid bubbles clear of section heads; put them on the other end if they clash. Always dimension grid to grid on every plan and elevation that shows grids. Number one direction (1, 2, 3) from right to left as seen from the entrance, and letter the other (A, B, C) from the front, and keep the same grids in every discipline file. Show them on all plans and sections, and dimension key items from them.

## Modelling

- Build fabricated units as families, one per unit, with a Mark and a Comments note. Export the marks and unit parts to CSV.
- **Base cabinets are 700 to the top of the worktop:** 50 skirting + 630 cabinet + 20 marble, with the marble straight on the 18 mm carcass top, no substrate (Madina 1, confirmed by the user). The cabinet sheet states the overall 700 next to the cabinet size. When the total is given, check the model's whole stack, not just the top level: Madina 1 already reached 700, but through a 600 carcass and a 30 mm substrate that the detail sheet said was not there.
- The existing model carries the existing levels, all on phase Existing with the shell:
  - `FFL +0.000`: the datum, top of the shop's floor finish. All joinery sits on it.
  - `SSL -0.xxx Existing Slab`: top of the existing slab on grade, one floor build-up (screed and finish) below FFL. The slab element sits on SSL. Ask the site for it; until then ask for it in red as an input. Madina 1: SSL -0.100.
  - `Existing Ceiling +x.xxx`: the existing ceiling or soffit, from the site. Madina 1: +3.720.
  - The existing model is complete: slab on grade, walls, piers, columns, beams, lintels, windows and the ceiling slab, with its soffit at the existing ceiling level. Where the slab thickness is not surveyed, assume 200 mm and say so in Comments.
  - Model the mall floor finish outside the shop on every open side (front and back) in the existing model: top at FFL +0.000 (the mall finish sets the shop FFL), down to SSL. Where the corridor is not surveyed, show an indicative strip and say so in Comments.
  - Model every existing beam on the survey, including a middle downstand beam shown as a double line between a pier and a column, with its top at the soffit. If its depth is not measured, set the underside to a stated assumption (for example the window head), write ASSUMED in Comments, and ask the site.
  - Clash-check the existing model against itself after every change. L-shaped walls and piers give false bounding-box hits, so confirm each one with a ray, or against the outline. Fit existing windows to their structural opening: Madina 1 RW-L was 2550 in a 2520 opening.
  - These levels live in the existing model only. Do not change the ARCH model's levels (its FFL, clear height and others) when the existing levels change, unless the user asks.
  - The existing shell (walls, columns) runs from SSL to the existing ceiling. When either level changes, rebuild the shell and re-check every service above the new ceiling against it.
- Rolling shutters under an existing lintel go on the inside face of the lintel:
  - The box starts at the door head, so the curtain rolls up above the opening.
  - Each guide rail bears on a solid face: a pier back face, a lining return or a unit end panel. The clear opening is measured between the rails, so it may be narrower than the structural opening.
  - The false ceiling stops about 70 mm short of the lintel over each shutter, leaving a slot for the curtain, with an access panel to the box.
  - Shutter power feeds and switches go inside the shutter line, never on the street side.
  - Check the rails, curtain and box against linings, units and the ceiling. Bounding-box checks flag the ceiling over the whole shop, so confirm the slot with a vertical ray.
- Apply every survey dimension, not only the heights. Read the dimension chains together: bay widths plus beam width plus pier offsets give each pier and column face. On Madina 1 the first pass applied the heights but left the middle pier (1.00 m back, not 0.90), the middle rear column (30 mm east, face at y 5190, not 5160) and the rear glazing line (y 5505, not 5350) wrong until the user asked. Cross-check with the ARCH grids, which sit on the existing inside faces: a window or column face that disagrees with the grid is the error.
- After any change to the existing model, check every ceiling-mounted item (access doors, grilles, lights) against the current ceiling level. On Madina 1 an access door stayed at the old +3.20 after the ceiling moved to +3.00. Check every duct sits above the ceiling, and the ceiling outline stops at columns and the window line.
- A site survey overrides the as-built CAD. Check the survey sheet is for this shop (its title and note) before using it, and read every number from enlarged crops. Model what it shows: soffit heights, door and window heads with the lintels above them, and pier and column sizes. Compare each dimension with the model in a table. Then check every new element against ARCH and MECH for clashes, such as shutter boxes under a door head.
  - Name levels by what they are. Never leave `Level 1` or `Level 2`. Levels closer than about 300 mm get a duplicated level type with the head at one end only, so the tags don't overlap.
- Every shop has a level at the underside of the main ceiling, named `Clear Height +x.xx`. This is the shop's clear height.
- Use reference planes for other setting-out heights such as an arch springing, not extra levels.
- Note assumptions in the element's Comments: anything not stated on the source drawing.
- Take HVAC and other services from the latest revision of the source drawing, and record the source file in Comments.

## Graphics

- **Existing work is always halftone** in every view and on every sheet, through phase graphics. See `phases.md`.

## Reading source drawings

- Before modelling or making sheets, list every sheet in the latest source CAD: plans, flooring, RCP, lighting, power, details and schedules. Render each one and check it off. Do not stop at the area needed for the current task. On Madina 1 this was missed, and the Rev-03 flooring, power and lighting plans were found late.
- Prefer plans in the architectural file, which are at the model's true scale, over a discipline file drawn at another scale.
- Model finishes as drawn: tile size, layout, joints and start point.

## Reading services drawings

- An architectural drawing shows only what touches the ceiling. Before modelling a service, also read the discipline's own submittal, for example `Submittal's\Mep\<Rev>\Mech`, even if it is an older revision.
- Identify equipment from the plan and the discipline drawing, not from a legend alone. On Madina 1 the architectural legend called a symbol "exhaust fan", and the mechanical layout shows the same symbol as the concealed AC unit.
- List what was left out when reporting a service as modelled.
- Grille type comes from the latest drawing's airflow arrows: arrows leaving the slot are supply, and arrows pointing at it are return. Zoom in and read them. Where revisions disagree, the latest wins, and say so.

## Services above the ceiling

- Before routing, find the height available: ceiling top to slab soffit, less any beams. Report the clearance for each item. Search level markers in the drawings, such as `SL` and `CL`, and confirm they are placed on this shop's sheets.
- On small shops, flexible hoses from a discharge box can replace rigid duct, with the mechanical engineer's approval.
- **Flexible duct is 1.5 m long at most** (Samaya Factory standard). It matches CMC 603.4.1 and common specifications. SBC 501, based on the IMC, does not limit flexible air duct length but caps flexible air connectors at 4.3 m and bars them from passing through walls, floors and ceilings. Use flex only as the final connection to a grille or plenum, never in place of a rigid elbow or to cross a beam. Longer runs are rigid duct. Measure every flex run along its centreline and report it.
- **Clash-check MECH against ARCH after every change on either side.** Compare MECH family solids with ARCH solids above the ceiling line. A direct shape's box covers its whole outline, gaps included, so confirm any hit with a ray. Intended contacts (grilles in a ceiling, a drain through a ceiling) are listed as such, not fixed.
- A condensate drain never drops through a unit, and is never exposed. Drop it in a closed void, such as behind a slat wall or in a boxed column, and ask the site for the floor drain position there.
- A cove LED strip and a linear grille in the same tray band: the strip stops 50 mm short of each grille. Update the strip length on the electrical schedule.
- Route services clear of existing beams. Cross a downstand beam only where the ceiling below leaves room under it, using a flat rigid duct, and keep everything under the slab soffit.

## AC condensate

Manage AC condensate water above the ceiling. No exposed pipes or risers in the shop. If the drawing's discharge point is not above the ceiling, ask for it instead of assuming.

## Changing heights

- When a height changes, keep the design. Take the difference out of the straight parts, such as arch legs and panels, and never distort a curve or a detail. Keep base cabinets, worktops and curved heads as designed unless told otherwise.
- `remove_z_band` removes a band between two heights from a unit or direct shape, and everything above drops. Choose a band that crosses no shelf or detail. It leaves a model seam at the cut; note that the real part is one piece. Rebuilding a family this way needs no change to its neighbours, but check the strips and panels it carries.

## Fitting MEP from CAD to an as-built model

The model follows the site as-built, so the MEP CAD may be drawn for a different room size. It is still the design: place each item by its proportion of the room and its relation to walls, units and ceiling features, keep real fixture sizes, and round positions to whole centimetres. Do not copy CAD coordinates directly.

Each MEP sheet shows only its own system, with the room in halftone, device labels, a legend with quantities, and the key plan. Do not invent positions the CAD does not show: flag them.

Do not write "to be confirmed by the electrical engineer" on sheets. Samaya Factory does the electrical engineering in-house.

MEP sheets follow ISO 128: black lines on white, hidden line views, never colour. Tell systems apart with line type and weight, and materials with hatches. Fabrication exploded and 3D views stay shaded.

Circuit layouts use curved arcs between devices, as on real projects, never straight lines across the room, and each circuit ends in a home-run arrow labelled with its number, not a line to the panel.

Read the CAD's own DB schedule before writing one. Loads, breakers and cables come from it, not from assumptions. Confirm the site supply, single or three phase, before sizing. Electrical packages include a schedules sheet: mark, description, quantity, load, mounting, circuit and sheet.
