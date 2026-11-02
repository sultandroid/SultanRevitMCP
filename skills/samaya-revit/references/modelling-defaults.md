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
- Use reference planes for setting-out heights such as an arch springing, not extra levels.
- Note assumptions in the element's Comments: anything not stated on the source drawing.
- Take HVAC and other services from the latest revision of the source drawing, and record the source file in Comments.
