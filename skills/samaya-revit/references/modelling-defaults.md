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

## Shop inside a bigger building

Some shops sit inside a bigger project that has its own Revit model, and open into a neighbour, as the Jalal wal Jamal store does into the Jalal wal Jamal museum at Jabal Omar (user, 4 Nov 2026).

- **Link the host model into EXT. Never copy from it.** Its owner keeps it; a reload brings their changes. Ask which file is current before linking.
- **Use the host's shared coordinates.** Acquire them from the link, so the shop sits in its true place in the building. All our discipline files take the same coordinates.
- **The shop shell is still ours,** in EXT, on phase Existing: shared walls, columns and the opening to the neighbour. Model the shared door as a real opening and say in Comments where it leads.
- **The host shows halftone,** like all existing work. Hide it in fabrication and 3D unit views.
- **Key plan and site plan (A-0002)** come from the linked floor: the shop filled, the neighbour halftone and named, and an arrow for visitor flow between them.
- **Log every interface** with the neighbour: the shared door and who supplies it, fire separation, shared HVAC or power, and anything fixed to the shared wall. Raise each one with the host's team before detailing.

## Materials

Samaya Factory builds in **EGGER laminates and painted FR MDF**, and this replaces veneer and HPL shown on design drawings. Confirm the codes for each project. On Madina 1: EGGER H1113 ST10 Brown Kansas Oak, EGGER U775 ST9 White Grey and F186 ST9 Light Chicago Concrete. EGGER thickness is 18 or 8 mm only. The legend shows the material actually used, not the design file's.

## Freestanding furniture

Model counters, islands and displays as furniture families from the design file's furniture plan and detail sheets, named with their schedule code, such as D-01. Set the position from the furniture plan, and check it against the masonry, because built-in units may have moved since the drawing.

## Grids

**Every project has grids.** Take them from the source drawing where it has any. Otherwise set them on the inside faces of the existing walls (not on joinery faces), and always add centre grids both ways. Keep grid bubbles clear of section heads; put them on the other end if they clash. Always dimension grid to grid on every plan and elevation that shows grids. Number one direction (1, 2, 3) from right to left as seen from the entrance, and letter the other (A, B, C) from the front, and keep the same grids in every discipline file. Show them on all plans and sections, and dimension key items from them.

## Scope and reference context

- Read the project's scope and LOD requirements before modelling. Separate reference context from the contracted production scope.
- Keep out-of-scope context within its stated maximum detail. Do not upgrade the whole context model to production detail just because some elements are missing.
- Refine context only where it affects a production interface, and use a cited source drawing/revision for the relevant edge, level, host or clearance. Record the evidence and any open decision.
- Treat approximate context envelopes as coordination aids, not approved dimensions, quantities, structural design or fabrication geometry. Do not infer hidden structure or site conditions from them.
- If source information does not resolve an interface, leave it open for the responsible designer or site verification. Build awarded production elements in their assigned discipline model to the level needed for coordination and shop output.

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
  - Hand-written surveys are often scanned sideways; a rotated 2 and 3 are easy to confuse. Check every survey number against the as-built CAD, and where they differ by a whole digit, ask the site rather than pick one (Madina 2 east bay: read 2.82, CAD 3.22). Where they agree (Madina 2 front openings 2.19 / 2.18, depth 4.49), the CAD gives the exact plan and the survey gives the heights.
  - A new shop in the same mall starts from the previous shop's existing model: copy `<Previous>_EXT.rvt` to `<Project>_EXT.rvt`, keep its levels, phases, materials and existing-structure families, and rebox each family to the new plan and heights with `edit_family_solids`. Confirm every face and height with `probe_ray`: a family's bounding box can keep the old extent after a rebox. Reset the project information; never carry the previous client or project name.
  - Where the 2D "as-built" plan and the designer's 3D model disagree, check both against the site survey. On Madina 2 the 3D model matched the survey (inside 6.08) and the 2D plan was 380 too wide; the shell was rebuilt from the 3D, so the ARCH joinery sits on it with a fixed shift (EXT = 3D − 10, 75).
- **ARCH levels, as Madina 1:** `SSL -0.xxx Existing Slab`, `FFL +0.000`, `Clear Height +x.xx` (main ceiling), one level per other ceiling (`C02 <finish> +x.xx`) and `Existing Ceiling +x.xxx` (soffit). Create each with its name (`create_level`), then delete the template's Level 1 / Level 2 and their views and make the FFL plan. The lower one of each close pair gets a `Level Head Left` type (head at end 1 only), the base type keeps end 2.
- **3D CAD joinery import:** pieces the prism converter rejects (arches with rounded edges, multi-part counters) are rebuilt as an outline extrusion: the largest face loop, arcs kept, extruded through the piece's thinnest dimension (vertical for counters). Only pegboards with hundreds of holes stay as boxes. A bounding-box fallback is never left in the model: it turns arches and rounded counters into solid blocks.
  - Name levels by what they are. Never leave `Level 1` or `Level 2`. Levels closer than about 300 mm get a duplicated level type with the head at one end only, so the tags don't overlap.
- Every shop has a level at the underside of the main ceiling, named `Clear Height +x.xx`. This is the shop's clear height.
  - **Clear height always means the LOWER ceiling level, measured from FFL** (user, Makkah, 4 Nov 2026). When a beam limits the ceiling, set the upper ceiling (raised field) a stated gap under the beam (Makkah: 70 mm), keep the design step between the two levels (Makkah: 250 mm), and the clear height follows (Makkah: +3.00 lower, +3.25 field under a beam at +3.32). Coffers above the field on the beam line are made shallower; the grid stays.
  - **Supply grilles go side mounted in the step** between the two ceiling levels when the user asks (Makkah: linear 800 x 200 in a 250 mm step), with the plenum behind the step above the lower ceiling. Route the supply duct above the lower ceiling, not over a raised field.
- Use reference planes for other setting-out heights such as an arch springing, not extra levels.
- **Every model element has a remark** in its Comments parameter (user, 4 Nov 2026). No element is left blank. Write it as `<what it is> | <source> | <status>`, for example `Gypsum ceiling CL-01 | Rev-05 RCP-101 | ASSUMED height, confirm on site`. Status is `CONFIRMED` (from a survey or an approved drawing) or `ASSUMED` with what to check. Before issuing, list the elements with empty Comments and fill them.
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
- **The mechanical engineer's layout governs HVAC:** which grilles supply and which return, grille and duct sizes, airflow, the FCU, the access door and the routes. Architectural RCP arrows only show intent. On Madina 1 the model first followed the arch RCP (supply west and east); the engineer's SD layout has supply rear and east, return west and front, 60 in grilles, a 16 x 14 in main reducing to 12 x 10 in, 12 in flex, and the access door beside the FCU, and the user said to follow it. Adapt it only where the as-built site forces it (a grille face limited by the step height, a plenum under an existing beam), and state each adaptation on the sheets.
- Grille type comes from the latest drawing's airflow arrows: arrows leaving the slot are supply, and arrows pointing at it are return. Zoom in and read them. Where revisions disagree, the latest wins, and say so.

## Services above the ceiling

- Before routing, find the height available: ceiling top to slab soffit, less any beams. Report the clearance for each item. Search level markers in the drawings, such as `SL` and `CL`, and confirm they are placed on this shop's sheets.
- On small shops, flexible hoses from a discharge box can replace rigid duct, with the mechanical engineer's approval.
- **Flexible duct is 1.5 m long at most** (Samaya Factory standard). It matches CMC 603.4.1 and common specifications. SBC 501, based on the IMC, does not limit flexible air duct length but caps flexible air connectors at 4.3 m and bars them from passing through walls, floors and ceilings. Use flex only as the final connection to a grille or plenum, never in place of a rigid elbow or to cross a beam. Longer runs are rigid duct. Measure every flex run along its centreline and report it.
- **MECH colour code for shaded and 3D views** (sheets stay black and white): supply air blue, return air green, AC and other equipment amber, refrigerant copper, condensate purple. Grille face frames and access doors keep their white finish; only the neck takes the system colour. Set it in the MECH families' materials (`set_family_material`), so every host view shows it.
- **HVAC layout sheet (M-1001):** a floor plan cut above the ceiling (cut +3.65, bottom at the ceiling), MECH in black and the shop in halftone, marks with leaders, supply and return arrows, the tray step and beams dashed, grille set-out dimensions, a legend with quantities and a key plan. Keep generic models hidden in it when the existing slab is a generic model: it covers everything below it in plan.
- **Clash-check ARCH and MECH against the existing model, solid by solid.** Open EXT alone and dump its solids; open MECH beside it (EXT does not link it); then ARCH. Family boxes of L-shaped walls run into the shop (Madina 1: a 690 mm box for a wall whose inside face is at x 240), so sample the real inside faces with rays while EXT is open and use those. Direct-shape ceilings give false hits at notches: confirm each with a vertical ray. On Madina 1 this found the west end panels 15 mm inside the existing wall (drawn from x 225, wall face at 240); nothing new may penetrate the existing.
- **Clash-check MECH against ARCH after every change on either side.** Compare MECH family solids with ARCH solids above the ceiling line. A direct shape's box covers its whole outline, gaps included, so confirm any hit with a ray. Intended contacts (grilles in a ceiling, a drain through a ceiling) are listed as such, not fixed.
- A condensate drain never drops through a unit, and is never exposed. Drop it in a closed void, such as behind a slat wall or in a boxed column, and ask the site for the floor drain position there.
- A cove LED strip and a linear grille in the same tray band: the strip stops 50 mm short of each grille. Update the strip length on the electrical schedule.
- **Model a tray step as built, never as a solid band.** C01 turns up as a 12.5 mm board on a steel angle frame. On Madina 1 the step was a solid 50 x 212 mm band, and all four linear grilles and the LED strip were buried in it, invisible from below; found only when the grille details were drawn.
- **Place grilles where the CAD sections draw them, not from the RCP alone.** An RCP shows a linear grille on the tray edge line and cannot tell a soffit grille from one in the vertical step face. Find the wall sections and elevations that cut the ceiling and read the grille there. On Madina 1 the rev-02 wall section draws the grilles in the vertical face of the tray step, 150 high, 25 mm above the lower ceiling and 30 mm below the step top, with horizontal airflow arrows on the RCP; I first put them in the tray soffit and the user corrected it. Supply plenums then sit behind the step above the lower ceiling, and every duct or flex crosses over the step board.
- **Linear grilles are 200 mm high at minimum** (smallest on the market, per the user). A grille in a tray step needs a step of about 250 mm (25 mm clear above and below). When the tray height is fixed (Madina 1: clear height +3.15), drop a band of the lower ceiling around the tray instead (Madina 1: 250 mm wide at +2.90, with a drop board up to C01 +3.00), so the rest of the ceiling and all joinery up to it stay. Keep the band clear of access doors and tracks; lower any track inside it.
- **Magnetic track follows the design render, not the RCP dashes.** On Madina 1 the CAD drew nine short track pieces; the render shows one continuous recessed track round the shop carrying twin spot heads (linear modules can replace any pair). Model it as continuous runs, keep the same distance from the ceiling edge on every side (Madina 1: 167.5 mm from the band edge on the west, rear and east, per the user), break it only where something must cross (the access door), and move devices off its line. Put a spot pair at each arch, low bay and feature, and update the circuit load and the schedule.
- Every ceiling grille and access door gets a detail sheet: a section through each supply grille (grille, neck, plenum, duct connection, hangers), each return grille (neck open to the void, return path), the access door under the AC unit (frame, door, service clearance), and an RCP corner where grilles and LED meet. Draw them in drafting views at the model's real positions and heights, and list what is assumed (grille, plenum and neck sizes, return path).
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
