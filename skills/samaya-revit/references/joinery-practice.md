# Joinery practice

Use this to detail how a unit is really built. Sizes here are normal shop practice, not project requirements. Note them as assumed until the workshop confirms them.

## Boards

- **EGGER boards come only in 18 mm and 8 mm. Never use 20 or 25 mm EGGER.** Thicker looks need built-up edges or a frame. Sheets are commonly 2800 x 2070 mm. Check the grade, FR or MR, against the project.
- Use one piece wherever the size fits. Plan any joint on a centre line or behind a unit.
- Grain direction is set by the sheet. Keep it the same on panels that are seen together.
- Cut edges that show get matching ABS or PVC edge, 1 to 2 mm. Hidden edges still get sealed in damp locations.
- **Design for production: sizes in whole centimetres.** Unit widths, depths, heights and positions end in 0 (920, not 925 or 851). Model the real size; never only round the displayed dimension, or the drawing lies. Exceptions are material thicknesses and joints (18, 8, 3 mm), and site fillers that take up what remains against existing walls.
- **Shadow gap to the ceiling, always: at least 20 mm.** Joinery (set work, full-height panels, cladding, fillers) never runs tight to the ceiling. Stop it at least 20 mm under the ceiling and leave an even shadow gap, so ceiling movement and site levels do not crack or bind the joinery. Model the real gap. Factory rule from the user, 4 Nov 2026 (Madina 1: joinery to +3.05 under the +3.07 ceiling). Value in `standards/sultan-standards.json` joinery.shadow_gap_to_ceiling_min_mm.
- **Repeat one size wherever possible.** Units of the same kind share one size across the shop, with one type and one sheet, and only true one-offs differ. Fewer types make production simpler.
- **EGGER comes in 18 mm and 8 mm only.** For a thicker part, use two EGGER layers with a recessed 8 mm or 18 mm layer between them: 18+8+18 = 44 mm, 18+18+18 = 54 mm. No softwood core and no other thickness. Show the build-up in a detail. Where the part should read as one thick sheet, such as arch sides, use double 18 mm = 36 mm with no recess and one edge band across both layers.
- **Plinths are always painted softwood**, never EGGER or MDF.
- **Every unit gets the project's default skirting.** Read it from the project's existing skirting and match it. Madina 1: black, 50 mm high, face 50 mm behind the unit's faces. Keep the unit's overall height: the skirting takes its 50 mm from the lowest part.
- Painted work is FR MDF, sanded and sealed before paint. Prime cut edges twice, because MDF edges absorb paint.

## Cladding existing structure

Never fix a finished sheet straight onto a column or wall. It is not flat or square.

1. Survey the structure on site: size, plumb and flatness. Modelled sizes are not enough.
2. Fix FR treated battens to the structure, about 40 x 20 mm at up to 600 mm centres, using plugs and screws. Pack them with shims to one true plane.
3. Where the structure is out of line with neighbouring surfaces, pack those battens to the same plane.
4. Hang the sheet on a French cleat or panel clips, so no screw shows and it can be removed.
5. Allow 2 to 3 mm at each edge to scribe to the frame, or use a deliberate shadow gap.
6. Keep access to any services behind, and seal against damp walls.

## Typical sizes for production

- **Round every unit size to whole centimetres** (1210, not 1212 or 1211.5), so the workshop works in round numbers. Take the leftover millimetres up in a filler, a post or the gap to the wall, never in the unit.
- **One size per repeated element** wherever the eye cannot see the difference. On Madina 2 the user kept only the rear middle arch (the feature) different, and made the other 8 arches one size and type. Keep a size different only where it is part of the design (a feature or a centre emphasis), and say why on the study sheet.

## Arches

- **Use the keel arch (pointed broken arch, عقد مدبب منكسر)** on Madina-style shopfronts. Two arcs with centres on the springing line, radius R, each running into a straight tangent line that meets the other at the apex. The user chose it over the five-centred arch (العقد المخموس) because it matches the designer's shape. Applies to Madina 1 and Madina 2.
- Get R and the rise from the designer's CAD line: fit the keel to the outline and keep the ratios. Madina 2: rise 0.60 x span, R 0.43 x span (side arches); rise 0.57, R 0.38 (rear centre). Round R, rise and springing to whole cm.
- All arches in one shop share one springing level (where the marble head starts), rear and side alike. Keep each arch's rise and R; the apex follows (apex = springing + rise). Check the tallest apex stays under the cladding top. With the same counter height and shelf count, the shelves then line up across the shop.
- Frame and inner lines: inner arc is the same centre with R minus the frame width; the inner straight line runs parallel to the outer one.
- Before a shape change, show it on the real elevation with the old shape overlaid and the largest gap in mm.

## Fitting between units

- Fit cladding before the cabinet or trim that covers its edge.
- A modelled clash with structure means the unit must change. Report it instead of hiding it.
- Check that a sheet can get through the doors and be lifted into place. Split it if it can't.

## Modelling for shop drawings

- **Revit does not cut the Furniture category in sections.** A section through a furniture family only shows an outside view. Build fixed joinery as Casework, so sections show real cuts through carcass, shelves and backs.
- Check any new section on a render: if you can see parts beyond the far clip, or no cut faces, the category is the cause.
- Fabrication sheets carry a material quantity table per unit, in m2 for each material. No cutting list.

## Pegboard and cable management

### Factory pegboard system (the Madina 1 standard)

Every open shelf unit with a pegboard back is built this way unless the user says otherwise. Model it with `tools/pegboard_system.mjs` (geometry only: it returns the parts as `create_direct_shape` solids for any unit size, then `make_unit_family`). First used on Madina 1 (typical arch, `projects/madina1/scripts/m_keel.mjs`, sheets A-2102 to A-2104), then Makkah (units OS-A/B/C).

| Layer, from the back of the unit | Thickness | Notes |
|---|---|---|
| Rear steel plate | 2 | 2 halves, 5 mm gap at the centre |
| Space | 30 | wiring |
| Front steel plate | 2 | 2 halves, on the back of the wood board |
| FR MDF | 18 | pegboard core |
| EGGER face | 8 | approved decor; board total 60 from the back |

- The wood pegboard (FR MDF + EGGER, 26) is **one piece**, drilled together with the plates: Ø21 holes at 50 mm pitch, grid centred across the board (columns ±25, ±75, ...), at least 45 mm solid border.
- 2 mm steel angles fixed to the sides carry the plates. No softwood stops.
- Removable lower panel under the pegboard, same 26 build-up, about 140 high, 3 rows of vent holes: access to the wiring.
- Shelves sit on hole rows, at fixed positions (350 apart on Madina 1 and Makkah). Each shelf is double EGGER 18 (36) with a PVC 2 mm front edge and the LED in a 12 x 10 groove 15 mm behind the front.
- Pegs are hardwood: Ø25 under the shelf, 360 long, top seated 9 mm into the shelf; Ø20 shank through the board to the rear plate. 4 per shelf, on hole columns (two near the centre, two near the sides).
- Lit shelves take power through the pegs: the split plates are the two low-voltage poles, with brass strips on the live pegs and in the shelf grooves. Needs an electrical engineer's review and a tested sample.
- Assembly order (as on the Madina 1 exploded view): frame and steel angles, rear plates, driver and wiring, front plates on the wood board, wood pegboard and lower panel, pegs, shelves.
- The fabrication sheet shows a plan detail at the side (side, angle, plates, space, board) and the exploded view.

### Metal pegboard and general rules

- Metal pegboard: 25 mm hole pitch is the common metric standard, 25.4 mm imperial. Holes are 4 to 6 mm. Confirm the accessories first, because hooks must match hole size, pitch and panel thickness.
- Perforated metal sheets are flat with no bends, and have a solid 50 mm border with no holes all round. Centre the hole grid in the sheet.
- Every counter manages its wires in a **double back**: a removable inner back with a cable void, about 80 mm, running from the floor to the top. No cable tray. Grommets in the top sit directly over the void, sized to fit it, usually 60 mm. Shelves stop at the inner back. The bottom panel runs the full depth, with only one wire hole, about 50 mm, at the void. Coordinate with the power and data drawings.

## Finishes and fixings

- Paint colours are given as RAL codes. When the client has not given one, write "RAL approved colour" and never suggest a code. Keep material names short enough for the keynote and quantity tables (about 30 characters); put "to match ..." in the sheet notes.
- Hinges, and any screw into MDF or board, go into plastic dowels (Fischer-type inserts): 5 x 12 mm for mounting plates, 8 mm press-in for hinge cups. Every unit with doors gets a hinge detail. Hinge make and type: approved, unless given.
- Base cabinet standard here: carcass EGGER white 18 mm, back EGGER white 8 mm, shelf 18 mm; fronts, front strips and doors FR MDF painted to match the strip cladding; skirting softwood, 50 mm high, painted black.
- Skirting is part of the cabinet it sits under, not a separate run: it shows on the unit sheet and in its quantities. `edit_family_solids` adds it, and other box parts, to an existing family without redrawing profiled parts such as flutes.
- Every unit sheet carries a hardware table: per unit and for the full quantity (hinges, plates, plastic dowels, screws, handles, shelf pins). Hardware items get their own materials so they count by number, never by area.
- Repeated units of one type are the same size, in whole centimetres; fillers at the run ends take up the as-built difference.
- Each wall run gets an arrangement elevation: all its units in a row, others indicative, with each unit width and the total length available dimensioned.
- Every wooden unit type gets an arrangement sheet (here 114 base cabinets, 115 arch units, 116 low bays, 117 rear centre units) so fabrication can check sizes before cutting: per side, chains for grid to grid, each unit and gap, the type end to end, and wall to wall with the space either side; a size table of every unit by mark, read from the model.
- The arrangement sheet: views scaled to fill the sheet; the units in question in full black, every other element halftone by element override; a width and quantity table (qty = available length / 1000 rounded up, width = length / qty); a storage table for the shop operator (net inside W x D x H, litres each and total, shelf area); and the marble top quantities (length, depth, thickness, pieces, area, front edge), since this is where the run lengths are.

## Hanging and loaded display

- Any unit that carries goods (carpet hangers, rails, hooks) gets a study before fabrication: clear heights and drops dimensioned, a load check with stated assumptions (items x weight x 1.5 for customers pulling), rail deflection, and how the load reaches structure.
- Fixings must land on structure or on battens, never on screws in board alone. Check the bracket positions against the batten and stud positions in the model. When they miss, use a steel back plate with anchors through the cladding into the wall or column.
- Ask the operator for item count, sizes, type, the heaviest weight, who handles the goods, and the space needed below. Until they answer, suggest typical goods and say so on the sheet (here prayer carpets 700 x 1100, about 1.5 kg, hung full length, not folded).
- Goods and any other out-of-scope items (carpets, products, loose furniture) are separate elements named `IND ...`, halftone in every view, never inside our unit families or quantities.

## Shelf lighting

- Open shelf units with adjustable shelves are lit from the sides: a 12 x 8 mm LED channel routed in each side panel's inner face, vertical, from the base to the underside of the top shelf, at least 50 mm behind the front edge. It sits forward of the shelves, so every shelf is lit at any height.
- A unit with side strips has no strips on its shelves. Do not double the lighting.
- Whenever a unit gains, loses or changes LED, update the electrical sheets in the same session. Measure the LED length in every placed unit from its family solids (the longest side of each LED solid), and compare it with the lighting schedule, the driver count and the circuit load. Then refresh the DB totals and the device model in the ELEC file. On Madina 1 the rebuilt niche units and the Mihrab unit added 9.4 m that no schedule carried.

## Dimension style

Shopfit workshop drawings follow ISO 129-1 for dimensioning, with one house deviation: dimensions are **blue** so they stand apart from the black geometry (the user's choice; ISO itself assumes black).

On A1 shop drawings: Arial 5 mm blue text and lines, closed filled arrowheads 30 degrees at 3.5 mm (ISO 129-1 terminator), lines at weight 1, text offset 1.5 mm, opaque text background. Every dimension has **extension lines**: a 3 mm gap from the object and running 3 mm past the dimension line, no dimension line extension. Never dimension straight off a reference mark on the dimension line: keep the references on the measured edges and offset only the line (`create_dimension_string` with `witness: true` and `offset_mm`), so the legs show. Stack strings 12 mm apart on paper, and put grid to grid on the outermost string. Keynote numbers 6 mm bold, keynote legend and sheet notes 5 mm, headings 5.5 mm bold. Don't dimension parts under about 25 mm in a chain, because the text won't fit: give them in a note or a larger detail. These values are practice-based judgement; 3.5 and 5 mm are ISO 3098 nominal sizes.

Set the type with `set_parameter`. Tick Mark takes an element id: scan low ids with `get_element`. Hide the reference ticks from `create_dimension_string` with a near-white line style.
- Metal pegboard never sits directly on the panel. It sits on a softwood frame under its solid border, which leaves space behind the sheet for hooks, inside an 18 mm trim flush with the sheet. Show this in a detail on the fabrication sheet.
- Show the wire route for any powered device: dashed grey, from the floor through the bottom hole and double back to the device.
- No free Saudi figure block was found online, so draw it as outlines: thobe, shemagh, agal, 1700 mm.
- **Marble is always 20 mm thick**, whatever the design file says. A marble top sits directly on the cabinet top, with no substrate.
- Marble always gets its own details: edge profile, such as bird's-nose, the top at the wall, and a section showing how it is fixed. Marble is bonded with stone-safe silicone. No screws through it.
- Show an indicative logo in halftone on units that carry branding, sized and marked to confirm.
- L-shaped marble, such as an arch head: join the two legs on a 45 degree mitre, with a small chamfer at the outer corner and on the free ends. Do not round this corner.
- **Light strips always sit in a recessed cove, never on the surface, even in marble.** In marble, cut the slot through the stone into the backing. Model and detail the recess. Default: 8 mm wide, 2 mm thick 24V COB strip in a 12 x 10 mm aluminium channel with diffuser. Common strips are 8, 10 and 12 mm wide; a 10 mm strip needs about a 15 mm channel. Confirm against the supplier's datasheet.
- **Back panels fit from the front, after the unit is installed.** A wood pegboard follows the factory pegboard system above (Madina 1 standard): 26 board (18 FR MDF + 8 EGGER) on split steel plates, Ø21 holes at 50 pitch, steel angles at the sides, 2 mm clearance each side. Do not use the older 18 mm stop and 5 mm / 25 mm hole build-up (superseded by the user, 4 Nov 2026). Plan installation order when detailing.
- Lit shelves have fixed positions. Coordinate LED, wire and supports: pegs stop behind the LED channel, and the wire comes through one set hole behind the shelf and runs hidden inside the double layer.
- Pegboard shelf pegs are hardwood. A lit shelf takes power through the pegs: wood board in one piece, only the metal plates behind it split into two low-voltage halves, access through a removable lower panel, brass strips on the live pegs and in the shelf grooves. It needs an electrical engineer's review and a tested sample.
- Parts for a workshop get their own cut sheet and 1:1 DXF: one file per plate, with size, quantity, material and hole schedule. Split parts to fit the workshop's sheet and the install order.
- **CNC files (factory standard, Madina 1, 5 Nov 2026).** Every curved or holed part is extracted on its own: one part per DXF, 1:1 in mm, lower-left at 0,0, the outline as ONE closed polyline with true arcs (bulges, not short segments), holes as circles. Layers: CUT (outline), HOLES (through), POCKET-<depth> (routed, not through), TEXT (label, do not cut). Write AutoCAD R12 DXF with `tools/cnc_dxf.mjs` (layer names only A-Z, 0-9, - and _: a dot such as "12.5" makes AutoCAD refuse the file). Generate the parts from the same geometry script that built the model, never by tracing a sheet. Check every file with `tools/acad_check.ps1` (one closed polyline, hole count, extents = the part size) and draw them to an image before issuing. Each item folder gets a CSV cut list (part, material, thickness, qty, size, note). Example: `projects/madina1/scripts/cnc/` (keel arch ribs and heads, pegboard plates, shaped cladding strips, island R200 parts, beam half-laps). Pointed (two-centred) and round arch parts: `tools/cnc_arch_paths.mjs` gives the closed paths (`pointedRing`, `roundRing`, `spandrelPanel`, inset k for the bending-ply wrap); example `projects/makkah/scripts/cnc/cnc_arches.mjs` (band ribs, gate ring ribs, spandrel panels cut 20 inside the band). Measure part sizes along the arcs, not from the vertices: a semicircle has all its vertices on the springing line.
- **Where the package goes** (user, 6 Nov 2026): into the project's own order folder `Samaya/Orders/<year>/<no> <store name in Arabic>/Final Fabrications Drawings`. Find it with `tools/order_folder.mjs` (`packageFolder("Makkah")` -> `040 متجر مكة المكرمة`), never a typed path; add a new project's Arabic name to its map first. KEC stores: Madina 1 `038 متجر المدينة 1`, Madina 2 `039 متجر المدينة 2`, Makkah `040 متجر مكة المكرمة`, Qahwatina `041 قهوتنا - مدينة المعرفة المدينة`. The order folder also holds the client's approved colours (`الوان ...`) and the factory's own files (AutoCad, CNC programs, photos): add to it, never move or delete those.
- **Fabrication package folder** (per order, "Final Fabrications Drawings"): `00 READ ME - Index.pdf` (sheets, CNC files, checks before cutting), `PDF` (whole set + one PDF per sheet), `DWG (clean)` (sheet DWGs cleaned with `tools/clean_sheet_dwg.ps1`: audit, purge, overkill, lines joined to polylines; for reference, not cutting), `CNC` (one folder per item). Factory set = wood and metal only: leave out stone (marble) and study sheets.
- **Approved colours, always, on every project** (user, 6 Nov 2026). The client's approved board and paint colours are in the order folder, in the folder named `الوان ...` (for example `الوان الاخشاب متجر مكة المكرمة`: EGGER swatches plus the client's WhatsApp approval). Before a fabrication issue: (1) ask the user which colour goes on which part if the approval does not say (Makkah: H3710 ST12 walnut on carcasses, shelves, doors; U775 ST9 painted-to-match on the light parts; U968 ST9 on plinths and dark parts); (2) put the full code in every material name, e.g. "EGGER 18 H3710 ST12 Natural Carini Walnut", "FR MDF 18 Painted U775 ST9 White Grey", so keynotes and quantities on every sheet show it (never "Approved Decor" or "RAL approved"); keep the EGGER code whole, the ST part is the texture; (3) copy the swatches and the approval into the package folder `Colours (approved)` and put a colour schedule (code, name, swatch, where it goes) in `00 READ ME - Index.pdf`; (4) issue it as a new revision. A part with no approved colour is named "... to confirm", never guessed. Change materials per family with `set_family_material` (read the family again before each change: form ids change on every reload). Example: Makkah Rev 07 (`mak/colours.mjs`, `mak/pkg.mjs`).
- **Carpentry 3D model, always, in the same package folder** (user, 5 Nov 2026): `3D Model (carpentry)<project> Carpentry 3D Model <rev> (solids).dwg`, the carpentry work only (units, cladding, wood beams, fillers, slat walls, free-standing units), as TRUE 3D solids (ACIS), never mesh. Make it with `tools/carpentry_3d.mjs <config>` (a section-boxed 3D view with every non-carpentry category hidden, marble tops, carpets and gypsum ceilings hidden by name or id, then `export_view_dwg` with `solids: "acis"`). Check it with `tools/acad_solids_check.ps1`: it counts 3DSOLID inside every block and must show no POLYFACE or MESH. Madina 1: 1,195 solids, none mesh. Steel or stone parts that live inside a unit family stay with the unit; say so in the index.
- Steel for laser cutting is pre-galvanized sheet, cut after galvanizing. Not hot-dip: it warps thin plate and fills small holes. Do not paint a surface that carries current.
