---
name: samaya-furniture-shop-drawing
description: "Use when turning a designer's furniture drawing or render (side table, coffee table, TV unit, console, wall panel, any loose or fitted furniture piece) into a buildable Revit model and a set of workshop shop drawings for a carpenter: shop drawing, assembly (exploded), junction details and finishes sheets, bilingual English and Egyptian workshop Arabic. Also use for a client factory's sample drawings (Endura Furniture Factory and others), for redrawing a design office's PDF as an executive drawing, and whenever the user says 'think like a carpenter', 'مخطط تنفيذي', 'رسم تنفيذي', 'شوب دروينج'. Works through SultanRevitMCP. Not for shop-fit wall runs and store fit-outs (use samaya-revit) or steel (samaya-welded-fabrication)."
metadata:
  learned-from: "Endura side table ST-01 sample, 12 Nov 2026 (indora-furniture/revit/sample-side-table)"
---

# Furniture shop drawings (carpenter-first)

Prerequisites: Revit open with the SultanRevitMCP bridge; read `../samaya-revit/SKILL.md` "Always" rules and `../samaya-revit/references/views-and-sheets.md` before any sheet. This skill adds what a single furniture piece needs on top of them.

The worked example to copy is `indora-furniture/revit/sample-side-table/` (GitHub `sultandroid/indora-furniture`): every script below exists there and runs in that order. Read `references/study.md` before modelling and `references/pipeline.md` when you start building, to reuse it instead of writing new scripts.

## Workflow

1. **Read the designer's sheet properly.** Render the PDF at 6x (`pdf-to-png-converter`), crop each view and read every dimension. Extract its text with `pdfjs-dist`: Arabic in CAD PDFs comes out with each word reversed (حجر comes out as رجح); decode before deciding. Never guess a material from a render's texture.
2. **Ask before modelling** (one question set): which piece, client/project names (EN + AR) for the title block, sign-off, and every material you could not read. Use the designer's own materials; never swap one in.
3. **Study before modelling** (user rule): function for the end user (height for the use, edges, stability and tipping, delivery, knock-down), proportions, the fabrication process and machine for every part (CNC, hot press, cold press, bending, trades), veneer work, assembly order. Write `STUDY.md`, copy it to the client Drive folder, and agree its decisions first. Read `references/study.md` for the checklist.
4. **Plan the parts like a carpenter** in one `parts.mjs` list (sizes, material, assembly step, exploded offset, junctions). For each part answer: what holds it, what screw goes where (into real wood), in what order can every screw be reached. See the build rules below.
5. **Model** one Casework family (sections cut it) plus separate elements for parts fitted last (glass). Probe with rays and move it to its true place: families from `make_unit_family` land about 44.7 off.
6. **Sheets**, all on the client's title block: 2101 shop drawing (`fab_sheet.mjs` + finishing script), 2102 assembly (exploded), 2103 junction details, 2104 finishes and paints. Render every sheet and read it before saying it is done.
7. **Issue**: export one PDF, save the model, commit and push the client repo; every new lesson goes into this skill or `samaya-revit` references in the same session.

## Build rules (the carpenter's way)

- **Standard stock only**: every part from `standards/sultan-standards.json` `stock_sizes` (softwood 20x40, 40x40, 40x60, 45x95; MDF 3-25; oak 20-50; glass 4-10). A size not on the list is planed from the next stock size and says so ("40 x 56, planed from 40 x 60").
- **Every frame mitred at 45** (trays, plinths, trims), modelled as four mitred pieces.
- **A rebated rail is one piece**: never two strips glued (glue lines crack the paint). Model each rail as one solid: `create_direct_shape` with `union: true`. Same for a board with a routed recess.
- **Glass is laid loose** on 2 mm clear rubber pads in its rebate, flush with the frame, never glued (it lifts out for cleaning). Mirror is glued with neutral mirror adhesive. Glass shown see-through in every view (`surface_transparency` 70).
- **Flush means flush**: when the design shows a shelf level with its frame, size the rebate, board and plinth so it is; check with a section.
- **Fixings**: draw each screw at its real height through real wood; cut a fixing detail where the fixing really is (not through a window or void).
- **Curved members are bent laminations**, never cut from a straight blank (short grain breaks). **Round frames are segments** in two layers, joints staggered. **Solid wood moves**: slotted fixings, never glued full face to metal or glass.
- **An angled member meeting a flat part** (a curved leg on a base): cut its end level and seat it in a shallow locating recess (5 mm, the footprint only), fixed by a bolt from below into a threaded insert plus 2 dowels and glue. A deep pocket at a 40 deg angle runs over 100 long and weakens the base (user, CT-01).
- **Proportion by family**: give legs the same section as the frame they carry (CT-01 legs 50 x 70 = ring 50 x 70); the factory found 40 x 50 and 45 x 60 weak.
- **Skins on frames** (stone alternative clay sheet, veneer panels): glued on an MDF backing, edges hidden under a mitred trim that stands proud.

## Sheet rules (on top of views-and-sheets.md)

- **Every note bilingual**: easy English, Egyptian workshop Arabic under it. The Arabic gives the words only; sizes and numbers stay in the English line. Every Arabic line goes through `tools/arabic_text.mjs` `arLine()` (fixes Revit's left-to-right layout; refuses digits).
- **Workshop words**: rebate تفريزة, dowel كاويلة, oak أرو, softwood موسكي, clamp زرجينة, tempered سيكوريت, frame/rail برواز, glue غرا, screw برغي. Ask when unsure; never invent a word.
- **Views**: front, side, two sections at 1:5 on one floor line; top view under the front; no crop borders; material numbers on the 3D view only (`keynotes3d: true`); no dimension on the human figure.
- **A clean coloured 3D on every sheet**, each from its own angle (front-right, back-left, low front-left, high front), so the set shows the whole piece. First sheet: overall W, D, H drawn on its 3D, placed on the far top edges so nothing crosses the piece or its title.
- **First sheet also carries the designer's reference render**, captioned with its source.
- **Junction sheet**: one 1:1 section wherever two materials meet, hatches by material, screws and dowels drawn, bilingual labels in a column, joint text beside.
- **Finishes sheet**: code, photo, finish, system (sanding, sealer, coats, sheen), parts, in a table with the largest text that fits (6 mm). Photos are reference only and the sheet says so: the approved samples govern.
- **Title block**: client factory logo (the Samaya layout through `tools/brand_title_blocks.mjs`), designer name and logo in the DESIGNER panel, project name in English and Arabic.
- **Nothing overlaps**: check every label, dimension and title against every viewport on the render.

## Gotchas

- `fab_sheet.mjs` hatch is picked from the material NAME: "MDF ... Oak Veneer" is MDF, "Solid Oak Rail" is timber; check the legend swatches.
- `fab_sheet.mjs` placement check votes with rays; rings and frames have empty middles, so pass `placementAxes: ["x"]` or the piece jumps 40 up (a 620 table read 660).
- Casework cut in a plan view shows no hatch: draw junction details as vertical sections (`create_section`), looking +x or +y.
- A section box sees parts beyond the cut: keep `depth_mm` small (30) on details.
- `create_dimension_string` does not work in 3D views: draw 3D sizes as blue detail lines on the sheet, projected with the view's direction and scale.
- Revit ignores Unicode direction marks; only `arLine()` (visual order plus U+200E between runs) prints mixed Arabic correctly.
- Inline `node -e` with Arabic or nested quotes can trip the shell safety check: put edits in a `.cjs` file and run it.
- Revit can close your model if another session is working: check `list_documents` and reopen before a long run.
- Hard-coded piece names in nine scripts made the second piece slow to start: keep names, marks, sheet numbers and the piece box in one place when you copy the pipeline.
- The designer's own derived numbers (arc lengths, totals) are checks: a mismatch means a missed detail (legs sitting in base pockets).
- Edits to CRLF files with `\n` patterns miss silently in scripts; use the Edit tool or match per line.
