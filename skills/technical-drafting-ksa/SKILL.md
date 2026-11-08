---
name: technical-drafting-ksa
description: Create, revise, audit and release CAD drawings to Saudi Arabian practice - ISO technical-drawing standards as adopted by SASO/GSO, Saudi Building Code (SBC 2024) checks, bilingual Arabic/English title blocks, consultant review codes, SCE stamps, Hijri/Gregorian dates and 230 V/60 Hz supply. Use for AutoCAD/DWG/DXF work and AutoCAD-to-Revit handover through SultanRevitMCP; shop drawings, fabrication and fit-out drawings, joinery, metalwork, glazing, showcases, mechanical parts and assemblies; dimensions, fits, GD&T, weld symbols, BOMs, revisions, plot/PDF scale truth, CAD DRC and release gates. Trigger on KSA, Saudi, SASO, SBC, Civil Defense, Balady, shop drawing, AutoCAD, DWG, DXF, or any drawing for a project in Saudi Arabia.
---

# KSA Technical Drafting

Make readable fabrication and installation drawings, not decorative CAD. Treat geometry, line hierarchy, views, dimensions, notes and the title block as one system. Adapted from `mechanical-drafting-gbt` (MIT, beiming183-cloud) with the Chinese GB/T baseline replaced by Saudi practice.

## Which Rules Win

1. Contract, project specification, consultant-approved BEP/CAD standard and project template.
2. A project-specific skill when one exists (for example the Aseer submittal skill). Its title block, numbering and sheet rules win.
3. Samaya Factory house standards on factory work: `standards/sultan-standards.json` and the `samaya-revit` skill in the SultanRevitMCP repository (fonts Arial and Cairo/Tahoma, text types, line styles, scales, sheet numbering).
4. SBC 2024 for building-installed work (`references/ksa-building-code.md`).
5. ISO drawing standards via SASO/GSO (`references/ksa-drafting.md`).
6. Practical defaults in the references, marked as defaults.

## Portability Contract

- Keep the workflow tool-neutral. Find out which CAD application, MCP bridge, shell, parsers and renderers are actually available before running anything, and map each step to a tool that exists. Never invent a tool call or claim a check ran when only an example schema exists.
- Before installing or upgrading any tool, check whether a working copy is already installed (for example AutoCAD 2026 `accoreconsole.exe`, Node, Python) and reuse it.
- Keep deliverables and evidence in standard files (DWG, DXF, PDF, JSON reports) so another person or agent can reopen and check them.

## Required Workflow

1. Classify the task and read only the references it needs: always `references/ksa-drafting.md`; `references/ksa-building-code.md` for anything fixed to or powered from a building; `references/sultanrevitmcp-link.md` when Revit or the SultanRevitMCP bridge is involved; `references/autocad-mcp-workflow.md` for AutoCAD automation; `references/complex-assembly-drafting.md` for multi-system assemblies; `references/consumer-product-concept.md` for new products, enclosures or mains-powered items; `references/cad-workflows.md` for 2D/3D conversion and PDF/image intake; `references/cad-3d-modeling.md` for 3D parts; `references/gps-inspection.md` for GD&T and inspection; `references/product-definition-release.md` for BOMs, revisions and release packages; `references/engineering-analysis.md` for any performance claim; `references/drc-review.md` for every DRC, fit, clash or release review.
2. Inspect the source CAD, drawings, screenshots, specification and requirements. Record defects, and keep supplied values apart from derived or assumed ones.
3. Confirm before laying out views: project template, sheet size, scale, units (mm, levels in m), projection method, plot style, drawing number, revision, status and the deliverable. Default to first-angle only when nothing else says; record the assumption.
4. Keep unrelated user geometry. For large repairs build a clean replacement in a separate area; delete the old one only with permission.
5. Set layers, linetypes, text styles (TrueType for Arabic) and dimension styles before geometry. Use the project layer standard, else ISO 13567, else this fallback: `OUTLINE` thick continuous, `THIN` thin continuous, `CENTER` thin chain, `HIDDEN` thin dashed, `HATCH`, `DIM`, `TEXT` thin continuous.
6. Plot monochrome through the approved CTB/STB. Colours are for editing only.
7. Lay out aligned views first; add sections only where they explain the inside.
8. Dimension from functional datums (grids, FFL, structure, reference faces); avoid closed chains, duplicates and crossings.
9. Add tolerances, finishes, materials, fire classes, glass types and weld symbols only when supplied or justified. Mark missing data `TBD`.
10. Fill the title block from supplied data only. Leave the consultant stamp box empty. Never mark a drawing approved.
11. Run the verification tier and the plotted-PDF check, including Arabic text and real scale, before calling anything ready.

### Mutation Gates (before every drawing or model edit)

- **Document identity**: before open, save, export or any change, record the document path/ID, units and revision and check the active document is the intended one. A mismatch stops work. Never switch the user's active document silently.
- **Transaction**: group each logical part in one transaction. Any failure rolls the whole group back; check entity counts returned to their earlier values.
- **Postcondition**: after every change, read back type, coordinates, size, layer, associations and closure and compare with the request. An unexplained difference is a hard stop: undo, try one bounded recovery, then switch method or report `BLOCKED`.
- **Layer and authority**: create or verify all layers, linetypes, text and dimension styles, and source authorities before geometry. Never fall back to layer `0` or guessed production dimensions.
- **User session**: attach to a running AutoCAD or Revit session read-only by default. Do not change profiles, windows or system variables unless asked.

### Evidence Gates

- **Scale truth**: `FIT`/`NTS` and a numeric scale are different claims. A fit-to-page PDF labelled `1:20` fails `PLOT_SCALE_CONSISTENCY`. State the scale for the sheet size (`1:20 @ A1`).
- **Arabic truth**: Arabic must join, read right-to-left and survive the PDF. A screen check alone is not evidence.
- **Render truth**: a preview records visual style, camera, visible parts, non-blank ratio and clipping. A wireframe image is not a shaded-review pass.
- **Bounding boxes**: AABB overlap is screening only; it cannot prove contact, clearance or wall thickness.
- **One lane**: send CAD bridge calls one at a time with timeouts; never run parallel edits or screenshots.
- **Round evidence**: keep a JSON record per round with identity, transactions, requested-vs-actual diffs, DRC results and output hashes (`scripts/build_release_manifest.py`). Missing or hand-edited evidence makes the round `BLOCKED`.

## CAD Execution Rules

- Keep every external call bounded by a timeout. A timeout is a recorded `TIMEOUT`/`BLOCKED`, not a reason to retry forever. Do not restart the host app or the user's AutoCAD/Revit to recover.
- Use native lines, arcs, circles, polylines, hatches, MTEXT and associative dimensions. Never fake dimensions with loose text and arrows.
- Keep model and paper space separate. Check viewport scale, annotation scale and plotted lineweights.
- Centrelines run a little past outlines, in a centre linetype.
- Put diameter symbols, fits and weld data inside the dimension or symbol object.
- Pair cutting planes with section labels. Call an end view an end view.
- Use the project title block unchanged; never redraw or resize it.
- Never infer a fit, tolerance, finish, material, fire class, glass make-up, anchor or weld size from appearance.
- Treat agreement between views as something to prove, not assume.
- Without loads, materials, supports and acceptance criteria, do not claim strength, stability, fire or safety. Building-installed structural items need a qualified engineer's calculation.
- Keep native editable CAD as the source of truth; PDF, DXF, images and renders are derived.
- For complex assemblies, set up a parameter table, part tree, common datums, connection plan and view plan first; build and check one subsystem at a time.
- For mains-powered or moving items, define the safety architecture first (Saudi supply 230/400 V, 60 Hz; SASO conformity) before internal detail.
- Use supplier data or measured values for bought-in parts; keep unverified sizes `TBD`.
- Treat agent-made drawings as `candidate after human review` until the consultant's review records a status.
- When a tool cannot make or check a linetype, symbol, Arabic font, dimension style or plot behaviour, say so and use the closest documented fallback. Do not claim full compliance.

## Progressive References

- `references/ksa-drafting.md`: order of authority, ISO/SASO/GSO baseline, units and levels, projection, title block and review codes, Hijri dates, Arabic text, lines, text, scales, dimensions, sections, simplified representations, welds, release rule IDs, checklists.
- `references/ksa-building-code.md`: SBC 2024 edition and authorities, part list, item checks (fire finish, glazing, accessibility, structural fixing, electrical, mechanical, existing buildings), fit-out and exhibit items, reporting.
- `references/sultanrevitmcp-link.md`: how this skill works with the SultanRevitMCP Revit bridge, house standards, AutoCAD helper scripts and the SBC code library.
- `references/autocad-mcp-workflow.md`: AutoCAD readiness, recovery, errors, setup, transactions, annotation, geometry audit, plotting, DXF comparison.
- `references/complex-assembly-drafting.md`, `references/consumer-product-concept.md`, `references/cad-workflows.md`, `references/cad-3d-modeling.md`, `references/gps-inspection.md`, `references/product-definition-release.md`, `references/engineering-analysis.md`, `references/drc-review.md`: carried over from the upstream skill, with standard references switched to KSA/ISO.

## Revision Strategy

For an isolated defect with stable geometry, edit the responsible entity in place, keep a rollback point and run the checks that depend on it. Rebuild in a separate area only when defects are widespread or cross several views. Compare geometry, annotation and the plotted PDF before replacing the old version, and erase it only with permission. Add a revision row with date, description and initials for every issued change. In the final reply, list corrected defects, assumptions, open `TBD` items, files produced, checks not yet run and any compliance limit.
