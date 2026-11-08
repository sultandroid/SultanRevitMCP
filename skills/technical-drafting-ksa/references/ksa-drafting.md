# KSA Technical Drafting Reference

Saudi Arabia has no separate national drafting standard. Drawings follow the ISO technical-drawing series, which SASO (Saudi Standards, Metrology and Quality Organization) adopts as SASO or GSO (Gulf) standards, plus the contract, the project CAD/BIM standard, and the Saudi Building Code (SBC) for anything built into a building. This file sets the drafting baseline. `ksa-building-code.md` sets the SBC checks.

## Order of Authority

When two sources disagree, the higher one wins. Record which source drove each rule.

1. Contract documents and the project specification (including the consultant-approved BEP, CAD standard, drawing numbering and title block).
2. Written consultant or client instructions (RFI answers, review comments, approved submittals).
3. Saudi Building Code (SBC 2024) for building-installed work; SASO technical regulations for regulated products.
4. ISO technical-drawing standards, using the SASO/GSO adoption where one exists.
5. Client-specific standards named in the contract only, for example Saudi Aramco `SAES-A-202` (Engineering Drawing Preparation) on Aramco work. Do not apply Aramco rules to other clients.
6. The practical defaults in this file, clearly marked as defaults.

Never mix two systems (for example ISO and ASME tolerancing, or ISO 2553 system A and AWS weld symbols) on one drawing unless the project specification says so and the drawing says which applies.

## Standards Baseline

Check the edition in force before any contractual compliance claim. SASO and GSO adoption numbers differ from the ISO numbers; look them up in the SASO or GSO catalogue and record both. Do not quote a SASO number from memory.

### Core drawing presentation

- ISO 128-1, -2, -3 (2020 editions): general principles, line conventions, views, sections and cuts.
- ISO 129-1:2018: indication of dimensions and tolerances.
- ISO 5457: sheet sizes and layout (A0 to A4, frame, centring and grid marks).
- ISO 5455: scales.
- ISO 3098 series: lettering (Latin script). ISO has no Arabic lettering part; see the Arabic text rules below.
- ISO 5456-2: orthographic projection (first-angle and third-angle symbols).
- ISO 7200: title-block data fields.
- ISO 7519 and ISO 128 building parts: general principles for construction drawings; ISO 4157 for building and space designation; ISO 13567 for CAD layer naming when the project has no layer standard.

### Apply when the drawing needs it

- ISO 6410-1: screw threads. ISO 2203: gears. ISO 2162-1: springs. ISO 8826-1: rolling bearings (adopted as GSO ISO 8826-1). ISO 6411: centre holes.
- ISO 2553:2019: welding symbols. Declare system A (ISO) or system B (AWS-style). Many Saudi consultants specify AWS D1.1 for structural steel welding; if so, use AWS A2.4 symbols and say so in the general notes.
- ISO 1101: geometrical tolerancing. ISO 5459: datums. ISO 286-1/-2: fits and tolerance grades. ISO 2768-1/-2: general tolerances. ISO 21920-1: surface texture indication (replaces ISO 1302). ISO 13920: general tolerances for welded construction.
- ISO 7573: parts lists. ISO 6433: item references (balloons).
- ASME Y14.5 / Y14.100 only when the project specification names them (common with US consultants and some Aramco packages).

Official sources: SASO (`https://www.saso.gov.sa`), GSO (`https://www.gso.org.sa`), ISO Online Browsing Platform (`https://www.iso.org/obp`). A standard being listed does not make every value in this file normative; some values here are practical CAD defaults.

## Requirement Integrity

- Classify each production requirement as supplied, derived from geometry, assumed, or unresolved.
- Derive only mathematically necessary values from trusted geometry. Do not derive design intent, fits, tolerances, materials, finishes, fire ratings, glass type, or processes from appearance.
- Keep source precision. Do not add decimal places that imply accuracy nobody asked for.
- Use `TBD` or a clear assumption for missing data. Never turn a likely choice into a requirement.
- Resolve contradictions between geometry, dimensions, notes, title block and the project specification before calling a drawing ready.
- Record the standard number and edition behind each contractual symbol or rule.

## KSA Anchor Rules

### Units and levels

- Metric only. Lengths in millimetres without a unit suffix; state "ALL DIMENSIONS IN mm UNLESS NOTED" in the general notes.
- Levels in metres to three decimals against the project datum, for example `FFL +0.000`, `SSL -0.150`, `TOS +3.250`. Record what the datum is (project zero or survey datum) and keep it the same on every sheet.
- Do not show imperial values unless the specification asks for dual units.

### Projection

- Default to first-angle (ISO 5456-2 method E) only when the contract, project template and source drawing say nothing. Record the assumption.
- Some Saudi Aramco and US-consultant packages use third-angle. Check before laying out views.
- The projection symbol, view placement and title-block field must agree.

### Sheets and title block

- ISO A-series sheets. Shop drawings are commonly A1 or A0 with A3 reduced prints for review; follow the project's sheet size list.
- Title block in the lower-right corner unless the approved project template puts it elsewhere (many Saudi project templates use a full-height right-side strip). Use the project template exactly; do not redraw it.
- Typical KSA title-block fields, filled only from supplied data:
  - Owner/client name in Arabic and English, and the project name and number.
  - Consultant / engineer of record, main contractor, and specialist subcontractor or fabricator, each with logo only where the template provides a slot.
  - Drawing title, drawing number in the project numbering scheme, sheet number, revision, status or purpose of issue.
  - Scale for the stated sheet size, sheet size, projection symbol, units.
  - Drawn / checked / approved names or initials with dates.
  - Responsible engineer's Saudi Council of Engineers (SCE) membership number and stamp, where the authority, client or contract requires a stamped drawing.
  - Consultant review stamp box, left empty for the reviewer.
  - Revision table: revision, date, description, by, checked.
- Review status codes are set by the project (a common set is A Approved, B Approved as Noted, C Revise and Resubmit, D Rejected). Use the project's own codes and wording; never mark a drawing approved yourself.

### Dates and calendar

- Use Gregorian dates in `DD/MM/YYYY` or the project's format. Add the Hijri date only when the template or client asks.
- Convert Gregorian to Hijri with a tested Umm al-Qura library or table, never by hand. Show which calendar each date uses, for example `08/11/2026` and `1448/05/17 هـ`, after checking the conversion.

### Arabic and bilingual text

- AutoCAD SHX fonts cannot draw joined Arabic letters. Use a TrueType style that has the Arabic range and is installed on every machine that will open or plot the file (for example Arial, Tahoma, Simplified Arabic, or the font named in the project template).
- Put Arabic in MTEXT, not single-line TEXT, and check that letters join and read right-to-left. Older AutoCAD versions and some DXF readers reverse or split Arabic; check the plotted PDF, not only the screen.
- Keep each language on its own line or in its own cell. Avoid an Arabic word and an English word in one line of mixed direction unless you have checked the result.
- Use Western digits (0-9) in dimensions, levels, drawing numbers and tables. Use Arabic-Indic digits only in Arabic prose when the client asks, and never mix both in one value.
- Arabic text at the same height as Latin text looks smaller. A practical default is one size step larger in the ISO 3098 series (for example 3.5 mm Latin, 5 mm Arabic); record it as a default.
- Arabic translations of technical terms must come from the client, the consultant, or a reviewed glossary. Do not invent technical Arabic.
- In PDF output, check that TrueType text stays as searchable text or as clean geometry, that no glyphs became boxes or question marks, and that line order did not change.

### Line hierarchy

- Use widths from the ISO 128-2 series: 0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1.0, 1.4, 2.0 mm.
- Mechanical drawings: thin to thick ratio 1:2 (for example 0.25 / 0.5, or 0.35 / 0.7).
- Construction drawings: thin, thick and extra-thick in ratio 1:2:4 (for example 0.18 / 0.35 / 0.7), with extra-thick for cut walls and slabs.
- Visible outlines thick continuous; dimensions, extension lines, leaders and hatch thin continuous; axes and symmetry thin long-dash dot; hidden edges thin dashed; cutting planes thin chain with thick ends.
- Plot in monochrome through a named plot style (CTB/STB) that the project approves. Layer colours may help editing only when the plot style gives the right widths.

### Text heights

- ISO 3098 series: 1.8, 2.5, 3.5, 5, 7, 10, 14, 20 mm (plotted).
- Practical defaults: 2.5 mm dimensions and notes on A3/A2, 3.5 mm on A1/A0; 5 or 7 mm view titles; title-block text from the template.

### Scales

- ISO 5455 series. Reduction 1:2, 1:5, 1:10, 1:20, 1:50, 1:100, 1:200, 1:500, 1:1000. Enlargement 2:1, 5:1, 10:1. Full size 1:1.
- Fit-out and shop drawings: plans and elevations usually 1:20 to 1:50; sections 1:5 to 1:20; details 1:1 to 1:5.
- State the scale for the stated sheet size, for example `1:20 @ A1`. A reduced A3 print of an A1 sheet is `1:40 @ A3` or must be marked as reduced.

### Dimensioning (ISO 129-1)

- Give each size once. Put shorter dimensions nearest the object and overall dimensions outside.
- Avoid crossing dimension and extension lines. Do not use object outlines as dimension lines.
- Dimension from functional datums: grid lines, finished floor, structural steel, or the object's own reference faces. Avoid fully closed chains unless one dimension is marked reference `( )`.
- Use the diameter symbol before diameters and `R` before radii. Put fits with the size, for example `⌀50 h6`.
- Use one arrow or tick style, one text height and one precision per sheet. Construction drawings commonly use oblique ticks; mechanical drawings use filled arrows. Follow the project template.
- For setting-out, reference grid lines and levels from the architectural or structural drawings and state the source drawing number and revision.

### Views and sections

- Keep views aligned to the chosen projection method.
- A section needs a cutting plane and matching labels (`A-A`) unless its location is obvious. Call an end view an end view, not a section.
- Hatch only cut material, one angle and spacing per part. Do not hatch holes, slots or space outside the material.
- Use material hatches from the project legend (concrete, blockwork, steel, timber, glass, insulation). Add the legend if the template has none.
- Show each view's source: "REF. ARCH DWG xxx REV x" for setting-out taken from other drawings.

### Standard simplified representations

- Keep the 3D model and the 2D drawing convention as separate evidence. Do not project every thread helix, gear tooth, spring turn or bearing ball into a routine view.
- Threads (ISO 6410-1): major-diameter boundary thick and minor-diameter thin for external threads; end view thin three-quarter circle; full designation such as `M10x1.5-6g`.
- Gears, springs, bearings and centre holes: use ISO 2203, ISO 2162-1, ISO 8826-1 and ISO 6411 simplified forms and keep the designation, quantity and BOM consistent.
- Welds: one symbol system per drawing (ISO 2553 system A, or AWS A2.4 when AWS D1.1 governs). Put weld size, length, pitch, all-round and site-weld flags in the symbol, not in loose notes.
- Fasteners and anchors: give grade/property class, finish, and for post-installed anchors the product name, size, embedment and edge distance from the approved product data (European Technical Assessment or ICC-ES report). Keep values `TBD` until the product is approved.

## Release DRC Rules

Create these rules when they apply:

- `KSA_PROJECTION_METHOD`: method, view placement, symbol and title-block field agree.
- `KSA_TITLE_BLOCK_LAYOUT`: project template used unchanged; fields, margins and orientation match; logos only in template slots.
- `KSA_DRAWING_NUMBER`: number, revision and sheet follow the project numbering scheme and match the drawing register.
- `KSA_BILINGUAL_TEXT_RENDER`: Arabic glyphs join, read right-to-left, have no boxes or reversals, and survive the plotted PDF; Latin text fits the ISO 3098 heights.
- `KSA_DATE_CALENDAR`: each date's calendar is clear; Hijri dates come from a checked conversion.
- `KSA_UNITS_LEVELS`: mm lengths, m levels to three decimals, one datum stated and used on every sheet.
- `KSA_APPROVAL_STAMP`: consultant stamp box present and empty; status code from the project list; SCE stamp area present where required.
- `KSA_WELD_SYMBOL_SYSTEM`: one weld symbol system, declared in the notes, matching the welding code in the specification.
- `KSA_SBC_REFERENCE`: building-installed items carry the SBC checks from `ksa-building-code.md`.
- `ISO_THREAD_REPRESENTATION`, `ISO_GEAR_REPRESENTATION`, `ISO_SPRING_REPRESENTATION`, `ISO_BEARING_REPRESENTATION`, `ISO_CENTRE_HOLE_REPRESENTATION`: the representation level, notes and BOM agree with geometry and purpose.
- `VIEW_SEMANTICS_CONSISTENCY`: view name, cutting plane, hatch, visibility and parts shown agree.
- `PLOT_SCALE_CONSISTENCY`: title-block scale matches the real plotted scale on the stated sheet; fit-to-page output is marked `NTS` and records plot mode `FIT`.

Each result records the standard and edition, drawing/view/entity IDs, representation level, evidence, and any object the tool could not check. A familiar-looking symbol with no traceable source is not a pass.

## Shaft and Machined-Part Checklist

- End chamfers drawn and dimensioned once, for example `2x45°` at each end.
- Shoulder changes clear; fillet radii or undercuts given where needed.
- Bearing and fit seats use sensible tolerance zones; any assumed fit is marked as assumed.
- Keyway width, depth and length all given.
- Surface texture (ISO 21920-1) attached to the surface or given as a general requirement.
- Overall length and segment lengths do not form a closed chain.

## Fabrication and Fit-Out Checklist

- Materials named to one standard family per item (for example EN 10025 S275JR, ASTM A36, EN 573 6063-T6 aluminium, EN 12150 toughened glass) and matching the approved material submittal.
- Finishes named with system, colour code (RAL or approved sample) and thickness where the specification gives one.
- Fixings to the building show substrate, fixing type, size, spacing and edge distance, with `TBD` where the structural engineer has not approved them.
- Interfaces with other trades (MEP, lighting, flooring, ceiling) are shown with the other trade's drawing number and revision.
- Tolerances for site work follow the specification; otherwise state the assumed site tolerance.
- Glass, fire-rated, accessible, structural and electrical items pass the matching SBC check in `ksa-building-code.md`.

## Staged Verification

Use checks matched to risk. Escalate any unexplained conflict and do not claim completion while one remains.

### Pass 1: whole-drawing consistency

- Check geometry for open boundaries that should be closed, zero-thickness material, overlaps, duplicates, broken tangency, off-axis concentric features and disconnected solids.
- Recalculate simple relations: chained and overall lengths, radius versus diameter, symmetry, angles, pitch and count, section positions, level differences. Compare with the shown dimensions and the source.
- Trace every boundary, hole, slot, shoulder, chamfer and pattern through every view where it should appear.
- For assemblies and installations, check mating geometry, fits and clearances, motion envelopes, and that nothing clashes with the building or other trades.

### Pass 2: independent cross-view rebuild

Apply to changed geometry, critical features, dense intersections, sections and anything that failed or looked unclear in Pass 1.

- Rebuild the feature from two views or from one view plus dimensions, predict it in the third view and compare.
- Check every section against its cutting plane.
- Recompute critical dimensions by a different route, for example the sum of segments against the overall.
- For repeated or mirrored features, compare count, pitch, angle and hand, not just one instance.

### Pass 3: release check

- Recheck corrected conflicts, high-risk features, datums, interfaces and critical dimensions after annotation and layout.
- Inspect the final PDF for lost fonts or Arabic glyphs, clipped content, wrong scale, changed lineweights, stale dimensions and misaligned views.
- Stop when all high-risk checks pass and no unexplained conflict remains.

### Physical plausibility limit

- Check only what the data supports: geometric continuity, fit, motion, obvious clashes, material continuity and interface agreement.
- Strength, stiffness, stability, fatigue, thermal, fire and safety stay `not evaluated` unless loads, materials, constraints, method and acceptance criteria are available and a proper calculation is done. Building-installed structural items need calculations by a qualified engineer as SBC and the contract require.

## Audit Checklist

- Dimensions agree with geometry; coaxial, symmetric, parallel and perpendicular relations are true where intended.
- Closed profiles are closed, duplicates removed, no construction geometry plots.
- Project sheet, frame and title block used unchanged; scale stated for the sheet size.
- Projection method, symbol and view layout agree.
- View names agree with what the views actually show.
- Line types and widths are distinct and follow the plot style.
- One dimension style, text height, arrow type, precision and unit convention per sheet.
- Fits, tolerances, surface texture and weld symbols are attached to the right features.
- Hatches are bounded, even, from the project legend, and exclude voids.
- Notes do not overlap geometry or dimensions.
- Arabic text joins, reads right-to-left and survives the PDF; dates show their calendar.
- Drawing number, revision and status match the drawing register; consultant stamp box is empty.
- Title-block scale matches the real PDF scale.
- Assumed and unresolved items are disclosed; nothing invented is shown as approved design intent.
- The drawing has enough information to make, install and inspect the item without duplicate or conflicting requirements.
