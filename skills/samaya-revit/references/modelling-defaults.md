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
- The existing model carries the existing levels, all on phase Existing with the shell:
  - `FFL +0.000`: the datum, top of the shop's floor finish. All joinery sits on it.
  - `SSL -0.xxx Existing Slab`: top of the existing slab on grade, one floor build-up (screed and finish) below FFL. The slab element sits on SSL. Ask the site for it; until then ask for it in red as an input. Madina 1: SSL -0.100.
  - `Existing Ceiling +x.xxx`: the existing ceiling or soffit, from the site. Madina 1: +3.720.
  - The existing shell (walls, columns) runs from SSL to the existing ceiling. When either level changes, rebuild the shell and re-check every service above the new ceiling against it.
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
