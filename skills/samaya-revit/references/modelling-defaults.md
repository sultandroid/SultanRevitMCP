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

## Modelling

- Build fabricated units as families, one per unit, with a Mark and a Comments note. Export the marks and unit parts to CSV.
- Every shop has a level at the underside of the main ceiling, named `Clear Height +x.xx`. This is the shop's clear height.
- Use reference planes for other setting-out heights such as an arch springing, not extra levels.
- Note assumptions in the element's Comments: anything not stated on the source drawing.
- Take HVAC and other services from the latest revision of the source drawing, and record the source file in Comments.

## Graphics

- **Existing work is always halftone** in every view and on every sheet, through phase graphics. See `phases.md`.

## Reading services drawings

- An architectural drawing shows only what touches the ceiling. Before modelling a service, also read the discipline's own submittal, for example `Submittal's\Mep\<Rev>\Mech`, even if it is an older revision.
- Identify equipment from the plan and the discipline drawing, not from a legend alone. On Madina 1 the architectural legend called a symbol "exhaust fan", and the mechanical layout shows the same symbol as the concealed AC unit.
- List what was left out when reporting a service as modelled.

## Services above the ceiling

- Before routing, find the height available: ceiling top to slab soffit, less any beams. Report the clearance for each item. Search level markers in the drawings, such as `SL` and `CL`, and confirm they are placed on this shop's sheets.
- On small shops, flexible hoses from a discharge box can replace rigid duct, with the mechanical engineer's approval.

## AC condensate

Manage AC condensate water above the ceiling. No exposed pipes or risers in the shop. If the drawing's discharge point is not above the ceiling, ask for it instead of assuming.
