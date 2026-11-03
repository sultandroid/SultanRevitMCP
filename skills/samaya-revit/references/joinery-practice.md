# Joinery practice

Use this to detail how a unit is really built. Sizes here are normal shop practice, not project requirements. Note them as assumed until the workshop confirms them.

## Boards

- **EGGER boards come only in 18 mm and 8 mm. Never use 20 or 25 mm EGGER.** Thicker looks need built-up edges or a frame. Sheets are commonly 2800 x 2070 mm. Check the grade, FR or MR, against the project.
- Use one piece wherever the size fits. Plan any joint on a centre line or behind a unit.
- Grain direction is set by the sheet. Keep it the same on panels that are seen together.
- Cut edges that show get matching ABS or PVC edge, 1 to 2 mm. Hidden edges still get sealed in damp locations.
- **Design for production: sizes in whole centimetres.** Unit widths, depths, heights and positions end in 0 (920, not 925 or 851). Model the real size; never only round the displayed dimension, or the drawing lies. Exceptions are material thicknesses and joints (18, 8, 3 mm), and site fillers that take up what remains against existing walls.
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
- **Back panels fit from the front, after the unit is installed.** A wood pegboard is 18 mm FR MDF plus 8 mm EGGER face, 26 mm, drilled together with standard holes, 5 mm at 25 mm pitch with a solid 50 mm border. It rests on 18 mm stops fixed inside the sides, with 18 mm free behind it and 2 mm clearance each side. Plan installation order when detailing.
- Lit shelves have fixed positions. Coordinate LED, wire and supports: pegs stop behind the LED channel, and the wire comes through one set hole behind the shelf and runs hidden inside the double layer.
- Pegboard shelf pegs are hardwood. A lit shelf takes power through the pegs: wood board in one piece, only the metal plates behind it split into two low-voltage halves, access through a removable lower panel, brass strips on the live pegs and in the shelf grooves. It needs an electrical engineer's review and a tested sample.
- Parts for a workshop get their own cut sheet and 1:1 DXF: one file per plate, with size, quantity, material and hole schedule. Split parts to fit the workshop's sheet and the install order.
- Steel for laser cutting is pre-galvanized sheet, cut after galvanizing. Not hot-dip: it warps thin plate and fills small holes. Do not paint a surface that carries current.
