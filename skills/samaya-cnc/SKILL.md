---
name: samaya-cnc
description: Create and verify Samaya Factory CNC and laser-cut DXFs from fabrication model geometry. Use for shaped or drilled parts, routed pockets, curved ribs, and cut-file handoff.
---

# Model and export CNC parts

Read the CNC file rules in [joinery practice](../samaya-revit/references/joinery-practice.md). Use the same part geometry that built the model.

1. Extract each curved or holed part in its machining plane. Establish the face and orientation. Check handed parts separately, and carry the part mark, material, thickness, and quantity through to the cut list.
2. Write one AutoCAD R12 DXF per part with `tools/cnc_dxf.mjs`, at 1:1 in mm, with the lower-left of the profile at 0,0. Use one closed polyline on `CUT` with true arcs, circles on `HOLES`, and `POCKET-<depth>` for routing. Put labels on `TEXT` and keep them out of machining. Use R12-safe layer names. Resolve any fractional depth naming with the shop before issue.
3. Use `tools/cnc_arch_paths.mjs` for matching arch profiles where applicable. Check the full arc extents, including points between vertices. If a part will exceed stock or the machine envelope, resolve the split in the fabrication model first.
4. Run `tools/acad_check.ps1` on each file, compare the extents and hole count with the model, and render the profile. Check pocket depths and handedness against the detail. Put a CSV cut list in each item folder with part, material, thickness, quantity, size, and notes. Resolve any machining settings needed for release with the workshop.
