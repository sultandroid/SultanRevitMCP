# The study before modelling (user, 12 Nov 2026: "when modelling we have to study the design and the fabrication")

Write `STUDY.md` beside the piece's scripts and copy it to the client's Drive folder. Agree its decisions with the user (and the designer through INPUT REQUIRED) before modelling. Example: `indora-furniture/revit/centre-table/STUDY.md`.

## 1. Function: think as the end user
- Height against the room's use: dining 740-760, desk 740, coffee / centre 400-450 (sofa seat about 450), side 500-600, console 800-900. A drawn height that does not fit the use is a question for the designer, never a silent change.
- Edges, points and corners at knee and child height (brass pyramids, sharp glass): blunt or round them.
- Stability: weight of every part (density beech 700, ply 650, MDF 750, glass 2500, brass 8500, steel 7850); tipping load at the rim = weight x (base radius) / (rim radius - base radius). Under about 80 kg: widen or weight the base.
- Every joint at the floor or a base: no recess or gap that collects dust. No covers or shoes over a leg foot (the factory rejected a brass shoe on CT-01).
- Legs on a base: make the base in 2 layers. Leg foot cut level, glued on the upper layer and screwed from below (no holes, no bolts); then the lower layer glued and screwed under it hides the screws; a brass ring in a groove at the layer joint hides the joint line (CT-01, factory's method).
- Levelling: any base on the floor gets adjustable glides (M8, ±5) under the load points; keep the drawn heights by thinning the lowest part.
- Loose parts (glass): what stops them sliding; how they are cleaned.
- Delivery and access: largest size against a 900 door and the lift; total weight; make it knock-down (bolts, inserts, barrel nuts) when it does not pass whole.

- Hanging a removable wall panel: the factory uses a solid wood French cleat (البتينجانة, 2 strips at 45 deg + a foot spacer), not aluminium Z-clips. A crown (البرنيطة) is press-fitted on clips (كبس), not on a cleat (TV-01, 12 Nov 2026).
- Brass trim on wood: a flat bar (e.g. 5 x 3) rolled to the curve and glued with epoxy in a groove after the wood is assembled and finished; never a wide ring cut from sheet (waste) (CT-01).

## 1b. Clash check before sheets (CT-01, 12 Nov 2026)
- Check every curved member against the notch it sits in at the top and bottom of each layer: a leaning, curved leg moves inward below the top, so the notch must be cut to that curve (per layer). A flat member needs parallel notch sides, not radial ones.
- Every "housed" end (rails into a ring) gets its housing cut in the model, not an overlap.
- Screws on sheets: one line each, head to point (factory: "only line"); check each stays inside the member for its full length (a leaning leg: place them toward its outer side).
- A notch that holds a curved member follows its curve (cut layer by layer from the member's template): no stepped gaps.
- A round piece: one exploded view and one 3D angle are enough; more angles only crowd the sheet.

## 2. Proportions
- Compare every member with its neighbours (legs against ring and column, rails against panels). A thin member reads weak: match widths where the design allows; keep one member clearly the strongest.
- Check the designer's own numbers against the model (arc lengths, overall sizes): a mismatch shows a detail you missed (CT-01: arc 842/852 against 816 meant the legs sit 20 into the base).

## 3. Fabrication, part by part
For each part write the process and the machine:
- Solid wood: planer, thicknesser, jointer; edge-glued panels in the cold press; wood moves 2-3 mm per 700 across the grain: fix it with slotted holes, never glue it full face to brass, glass or steel.
- Round frames: segments in two layers, joints staggered, cold press, then CNC (never four mitred rails).
- Curved members: bent lamination (strips 3-4 mm on a CNC-cut former, UF / PVA D3, vacuum or manual press with cauls) so the grain follows the curve. A curve cut from a straight blank has short grain and breaks.
- CNC router: circles, rebates, lips, notches, pockets, formers; compression bit on veneered faces.
- Metal and glass go to their trades: say thickness, edge, holes (corner radius R10 on square holes in tempered glass).
- Paint and lacquer: spray booth, system and sheen.

## 4. Veneer work
- Species and thickness; brittle veneers (ebony) flattened with softener and pressed flat first; joints taped with gummed tape.
- Flat faces in the hot press (UF, about 95 C, 5 min); curved faces with fleece-backed veneer in a band clamp with a flexible caul or a vacuum bag on a former. No contact cement on solid wood.
- Grain direction with the substrate's grain; veneer joints off the substrate joints; long runs joined where something hides the joint (behind legs).
- Order: glue up, flatten, hot-press, CNC (cuts the veneer clean), edge veneer, sand flush, then cut hidden notches.
- Finish: grain filler on open grain, sealer, sand 320, top coat to the approved sample.

## 4a. Thick shelves and panels (torsion box)
- A thick fixed shelf (40 to 60) is a hollow box: oak-veneered MDF 12 skins top and bottom on a softwood core frame all round (back, front, ends) with inner rails no more than 250 apart.
- Solid front edge = lipping (قشاط), usually 12 thick, glued onto the softwood front rail and the skin edges. Lipping never sits over a void: there is always softwood behind it.
- Model it as built (skins, core rails, lipping) so every section shows the hollow, and give one typical detail for all of them; the cut list keeps the lipping as its own part.
- LED groove under a hollow shelf: in the bottom skin under the softwood front rail; the lead goes up into the void and out at the back.

## 4b. Use study for screens (TV units, media walls)
- Study the use, not only the box: a SEATED viewer (sofa seat about 430, eye about 1150) at the distance from the furniture plan, never a standing figure.
- Distance for a 4K screen: horizontal field 40 deg (near) to 30 deg (far): D = (screen width / 2) / tan(20 or 15 deg). 65 inch: 2.0 to 2.7 m.
- Height: screen centre not more than 15 deg above the seated eye line; side seats within 30 deg of the axis; check how much a recessed screen edge is hidden at 30 and 45 deg.
- Put it on its own sheet (section with sight lines and angles, plan with the viewing zone, size vs distance table) and send red questions to the designer when the sofa distance, height or screen size does not fit. Tool: indora-furniture revit/tv-unit/viewing.mjs.

## 4c. Detail sheets show where each cut is taken
- Every detail sheet carries a key elevation with cut marks (section line + look arrows, plan cut line, callout box) tagged with the detail ids. Tool: indora-furniture revit/tv-unit/keymarks.mjs. Tags never sit on drawing lines.

## 5. Assembly
Order of assembly, every fixing reachable, which joints are glued (permanent) and which bolted (knock-down), what is fitted last (glass).

## 6. Decisions
List each open decision and who owns it: designer (looks, size, material) or factory (method, fixing). Model only after they are answered or a default is agreed.
