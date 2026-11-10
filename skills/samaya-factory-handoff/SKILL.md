---
name: samaya-factory-handoff
description: Prepare and verify the Samaya Factory workshop issue from a Revit fabrication model. Use for revised shop drawings, clean CAD, carpentry solids, CNC files, and order-folder packages.
---

# Prepare the factory handoff

Read [views and sheets](../samaya-revit/references/views-and-sheets.md) and the package rules in [joinery practice](../samaya-revit/references/joinery-practice.md).

1. Check that the model, sheets and exports use the same issue revision and part or assembly marks. Confirm approved finishes and where each goes. Keep unresolved fabrication decisions visible and resolve them before releasing affected parts.
2. Use `tools/order_folder.mjs` to find the project's Final Fabrications Drawings folder. Keep existing factory files in place. Build the index and include the approved finish schedule and swatches. Identify which files are for machining and which are for drawing reference.
3. Package the workshop PDFs, clean sheet DWGs, item CNC folders where needed, and the carpentry 3D model. Use `tools/clean_sheet_dwg.ps1` for the sheet DWGs. Export editable ACIS solids with `tools/carpentry_3d.mjs` and verify with `tools/acad_solids_check.ps1`. Follow the shop's wood and metal scope and disclose mixed-trade parts embedded in the carpentry export.
4. Open the PDFs, check the sheet list, read the DWG and solids check results, and compare the CNC file list and quantities against the current model and index. Confirm the package is in the right order and revision folder before reporting it ready.
