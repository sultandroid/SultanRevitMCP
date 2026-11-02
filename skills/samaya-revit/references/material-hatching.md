# Material hatching

Every material shows its own hatch where it is cut in a section or detail, so the workshop can read a build-up without keynotes. There is no single world standard for joinery hatches, and they vary by country and office, so this table is the Samaya Factory standard. Use it on every project unless the user changes it.

## Rules

- Set the hatch on the **material** (its cut pattern), never as drawn filled regions. It then stays correct on every section and rebuild.
- Hatch shows on cut faces only. Elevations and plans show no material hatch, apart from a surface pattern where the material really has one, such as tile joints.
- Only categories that Revit cuts show it. **Joinery must be Casework, not Furniture**, or sections show empty outlines.
- Use material hatch at 1:20 and larger. At smaller scales use plain outlines.
- Hatch lines are thin and mid grey (128), so they never compete with the cut outline, which stays heavy and black.
- Spacing is in paper millimetres. A layer thinner than about 2 mm on paper is drawn solid or as a single heavy line, as a hatch would not read.
- Each layer of a build-up is a separate solid with its own material, so an 18 + 8 + 18 build shows three layers. Hatch direction alternates between neighbouring boards of the same kind where needed to read the joint.
- The material legend sheet shows each material's hatch next to its name and finish code.

## Standard

| Material | Cut hatch | Angle | Spacing |
|---|---|---|---|
| EGGER board, 18 mm or 8 mm | Diagonal lines | 45° | 1.5 mm |
| FR MDF | Diagonal lines, opposite way | 135° | 1.5 mm |
| Softwood (plinth, skirting, frames) | Crosshatch | 45° | 2.5 mm |
| Plywood, including bending plywood | Horizontal lines, as laminations | 0° | 1 mm |
| Marble and stone | Diagonal lines, wide | 45° | 4 mm |
| Metal (pegboard, gold tube, supports) | Solid black | | |
| Veneer, HPL, PVC and ABS edge | Solid black thin line | | |
| Concrete and existing structure | Keep the project's concrete pattern, halftone as existing work | | |
| Glass | No hatch | | |

## Applying it

Use the bridge's `set_material_hatch` for each material. Its pattern is created if missing, and is named from the hatch, for example `Hatch 45 1.5`. After a change, re-render one section and check each material reads.
