# Metal hoarding

How Samaya Factory builds site hoarding, by height. Taken from our past designs and their structural calculation reports (user, 5 Nov 2026). Use it to set up any hoarding model, section or tender. **Steel sizes can change per project, but the system stays the same.** Every new job still needs its own calculation for its wind speed and soil.

Source files (Al Khozama tender folder): `Samaya\Tenders\2025\PHI\Al Khozama\Design\`
- `6M FINAL.pdf`: typical 6 m drawing (front, back, top, section, plywood and base plate details).
- `CALCULATION REPORT -HOARDING 6.00M HEIGHT.pdf` and `... 8.00M HEIGHT.pdf`: EXPO 2030 Riyadh, client Binyah, April 2025.
- `CALCULATION SHEET - HOARDING -4.20m HEIGHT.pdf` and `HOARDING 3.00M HEIGHT.pdf`: KAFD, consultant Machinery Source.
- `STRUCTURAL ANALYSIS  REPORT - MAIN SIGNAGE.pdf`: Myan Yard sign, 6.3 m wide x 9 m high.

**Rules from the user (5 Nov 2026), for every hoarding:**
- **Height is the total height from ground level,** everything included. A "4.88 m" hoarding tops out at +4.880, not 4.88 m above the 150 mm gap. The plywood runs from +0.150 to the top, so its panel is 150 mm less than the stated height.
- **One concrete base per frame, all of it above the ground.** No part of it below FGL. The whole frame, front post and back brace or back column, stands on that one base. Never a separate footing under each member.
- **Horizontal tubes (rails) at 1220 mm centres maximum** (one at every plywood sheet edge), spaced evenly from a rail at the bottom of the plywood to one at the top. This replaces an earlier 600 mm rule from the same day.
- **Frames and concrete bases at 3.0 m centres** (centre to centre), as in the factory typicals.
- **Front frame continuous:** rails run unbroken past the posts, from corner to corner. Close every side end with a corner panel (plywood on rails, no post) back to the corner post. No gaps in the face.
- **Bracing to the standard: an X-braced bay every 5 frames** (factory typical, SHS 50x50x2.5), plus one at each end of every side. Keep braced bays out of height transitions.
- **Corners:** one corner frame per corner: corner post behind both faces, back brace on the corner bisector, and one base shaped to the corner (parallelogram along both faces, all behind the rails). Rails of both sides fix to the corner post. **Concrete bases may never overlap**: move the first frame of each side out from the corner (3.0 m or more; the sharp corner on DAS needed 4.7 m) and check every base outline against its neighbours before issue.
- **Height changes are smooth** where the client's design shows it: a cosine S-curve over the stated length (DAS: 24.0 m = 8 bays of 3.0 m), one family per bay so the plywood top, rails and post height follow the curve; mirrored set for the other walking direction.
- **Base sizes are not copied blindly:** a typical's base was designed for its own frame spacing and wind. Check overturning (base weight against wind moment, FOS 1.5) for the job's wind pressure, or mark the size ASSUMED for the structural engineer.
- **Ground levels:** survey points rarely carry levels. Ask for a level survey; until then model flat at FGL and say so in red.
- **Plywood in standard sheets, 1220 x 2440, laid PORTRAIT** (full 2440 height, 1220 wide; user, DAS, 5 Nov 2026: plywood is normally fixed lengthwise, never landscape), from +0.150 and from the start corner of each side. Rows break at +2.590, +5.030; top row cut to the height line (and to the curve in transitions). Horizontal rails stay at 1220 c/c max, so every horizontal joint sits on a rail.
- **Vertical joints:** an SHS 40x40 stud at every 2nd vertical joint (2440 c/c). The joints between, with no tube behind, get a **100 mm wide strip of 18 mm plywood** screwed behind the joint, in pieces between the rails. Take off the strips in metres and in sheets (one sheet = 12 strips x 2440 = 29.3 m).
- **Back brace plate at least 200 mm from every edge of the concrete.** On corner bases, slide the plate in along the bisector until it clears; make the corner base big enough (DAS: 2.2 m along each face) that the brace keeps a sensible slope.
- **Trim and connect, never overlap:** the back brace is cut square to a 10 mm end plate bolted to the post back flange (4 M16, 8.8) and cut level onto its base plate (6 mm fillet all round). Rails welded to the post front flange (4 mm). No member runs into another.
- **L-anchors, M20 L-bolt type 400:** 4 per plate, 400 mm leg in the concrete, 100 mm hook turned in, 50 mm from the plate edges, double nut. Cast in.
- **Draw real sections:** IPE posts and braces as true I-profiles, SHS as hollow tubes, plates and anchors modelled, so the model gives the steel takeoff (count, length, kg) by component. Issue a quantities sheet (A-1901) and an Excel takeoff, and a connection details sheet (A-1301) cut from the typical bay at 1:5.
- **Analytical model for Robot (user, DAS, 5 Nov 2026: "make analytical so we can use Robot to calculate the steel as per the Saudi code").** Build it in its own structural model `Rvt\STR\<PRJ>_STR_01.rvt` from `Structural Analysis-DefaultMetric.rte`, never in the ARCH model: the architectural template has no boundary-condition types, so supports cannot be made there. Model typical 5-bay segments per type (6 frames, X-brace in the middle bay), off site. Posts are IPE *column* types (IPE-Column.rfa; a framing type is refused for the column role), split at every rail, brace and X-brace node. Braces and X-braces pinned both ends; rails SHS on the post line, continuous; pinned supports at both base plates. Loads to SBC 301-2018 (ASCE 7-16 ch. 29, solid freestanding wall): Kd 0.85, G 0.85, Cf 1.30 for s/h = 1 and long walls, case C for free ends (x 0.8 for s/h = 1, x 0.6 with return corners). Line loads on the rails = p x tributary height; dead 0.15 kN/m² on the face, self-weight added by Robot. Cases D1, W1 (from the street), W2 (from the site), W3 (case C); combinations 1.4D, 1.2D + 1.0W, 0.9D + 1.0W (ULS) and D + 0.6W (SLS). Write the inputs, pressures and Robot steps to `Excel Sch\<PRJ>_STR_Loads_SBC301_RevNN.xlsx`. The wind speed and exposure stay ASSUMED until checked on the SBC 301 map for the site or confirmed by the user (Riyadh, DAS: user kept 45 m/s, 5 Nov 2026). Scripts: DAS session `das_str_build.mjs`.
- **Sheet views are Hidden Line, black and white** (see `views-and-sheets.md`). Elevations show **no sheet joints** (user, DAS, 5 Nov 2026: "hide the lines between elements, they are too many"): plywood, studs, strips and corner panels get a white line colour in each elevation (`set_element_overrides` with `line_color` 255,255,255), and one face outline per side is drawn as detail lines ("DAS Outline", weight 3): bottom at +0.150, the top line following the heights, and both ends. Draw it one segment per call, since a chain of joined detail lines can fail with "Can't keep elements joined". Rebuilding the plywood deletes any dimension that referenced it: re-create those dimensions after every rebuild. Elevations sheet: one elevation per row, every side shown (DAS: S, N, E, W at 1:140 on one A0). Details sheet: add a Hidden Line 3D of the typical bay in the free space.

## Pick the system by height

| Height | System | Base |
|---|---|---|
| Up to about 4.2 m | Light tube frame: a post every 1 m, a raking prop every second post | Precast Jersey-type concrete block, 1.0 m long, bolted with anchors |
| Above 4 m (our typical: 6 m and 8 m) | **Lattice frame**: front column and back column joined by diagonals, every 3 m | One RCC footing under each frame |

## Above 4 m: lattice frame (the standard typical)

From the 6 m typical drawing, checked against the 6 m and 8 m calculations.

**Frame (one every 3000 mm along the hoarding)**
- Front column and back column, MS tube **60x60**. The drawing shows 60x60x3; **the calculation uses 60x60x4.0**, so use 4.0 unless a new calculation says otherwise.
- The back column leans in: the frame is about 1.2 to 1.55 m deep at the base and about 0.6 m deep at the top (6 m frame).
- Diagonals, MS tube 50x50x3.0 (drawing, and 8 m calculation). Other frame members, MS tube 50x50x2.5.
- Base member: IPE 220 on top of the footing, carrying both columns.
- Base plate 300x300x14 mm, 6 anchors M20 x 500 mm, grade 8.8 (drawing). The 6 m calculation checked a 12 mm plate with Hilti HIT-HY 200-R V3 + HAS-U 5.8 M20 chemical anchors; use what the job's calculation checks.

**Face**
- Horizontal rails, MS tube 50x50x2.5, at 1220 mm (one at every plywood sheet edge).
- 18 mm plywood sheets, 1220 x 2440, fixed to the rails.
- Back X-bracing, MS tube 50x50x2.5, in one bay **every 5 frames**.
- Top: optional solar panel and solar light on a 50x50x2 angle beam.

**Footing (one per frame)**

| Height | Footing L x W x H | Columns on it | Steel | Notes |
|---|---|---|---|---|
| 6 m | 1800 x 1000 x 800 (drawing); calculation used 2000 x 1000 x 800 | Two, about 900 apart | Top and bottom mesh, T12 @ 200 | Mostly above ground: about 100 mm set in, 700 mm above |
| 8 m | 2300 x 1400 x 1000 | Two, 1000 apart | Per calculation | About 100 mm set in, 900 mm above |

- Footing length runs across the hoarding (front to back), so it holds the frame against wind.
- Under it: 100 mm blinding (BCC) on a polyethylene sheet.
- Concrete C30 (fcu 30). Soil bearing assumed 150 kN/m² (SLS), friction angle 20, base friction 0.5. Ask for a soil report; if there is none, say these are assumed.

**Steel notes on every hoarding drawing**
1. Steel grade S275 (fy 275 N/mm²).
2. All welds 4 mm unless noted (6 mm on the signage).
3. Anchor bolts high strength, grade 8.8.
4. All dimensions in millimetres, levels in metres.

## Up to about 4.2 m: light frame

- **3.0 m (KAFD):** frame of MS tube 50x50x3.2 and 40x40x3.0, panels 3.0 m wide, rails at 1220. Base: precast concrete block 1000 long, 500 wide, 850 high (0.29 m³, 7.4 kN). Checked: overturning safety 2.48, sliding 1.64.
- **4.2 m (KAFD):** posts MS tube 40x40x3.0 every 1.0 m, rails and props 30x30x2.5, rails at about 1.5 m, a raking prop on every second post. Base: concrete block 1000 long, 425 wide, 755 high (0.205 m³, 5.1 kN). Anchors Hilti HST3 M16, 85 mm in, plate 8 mm.

## Design loads we have used

| Job | Code | Wind speed | Exposure | Wind pressure used | Dead load on face |
|---|---|---|---|---|---|
| 3.0 m KAFD | ASCE 7-05 | 50 m/s (180 km/h) | C | 0.83 kN/m² | 0.15 kN/m² (18 mm plywood 0.14 + banner) |
| 4.2 m KAFD | ASCE 7-05 | 50 m/s | C | 0.76 kN/m² | 0.37 kN/m² |
| 6 m EXPO | ASCE 7-05 | 45 m/s (160 km/h) | C/D | **1.70 kN/m² design** (0.81 calculated) | 0.37 kN/m² (sheet, banner, services) |
| 8 m EXPO | ASCE 7-05 | 45 m/s | C/D | **1.70 kN/m² design** (0.87 calculated) | 0.37 kN/m² |
| 9 m sign, Myan Yard | ASCE 7-05 | 45 m/s | C | 0.49 push, 0.37 suction | 0.24 kN/m² (aluminium + acrylic) |

- Wind factors used: Kd 0.85 (open signs), Kzt 1, G 0.85, GCpi 0 (open).
- Load cases: DL, WL +Z, WL -Z; combinations 1.0 DL + 1.0 WL and **0.6 DL + 1.0 WL** (the uplift case that decides the footing).
- Highest steel use found: 8 m front column 60x60x4 at 0.91 of capacity. Taller than 8 m needs a bigger column, not just more frames.
- New codes: Saudi work is now to SBC 301. Take the wind speed from SBC 301 for the site; the reports above used ASCE 7-05.

## Signage (for reference)

Myan Yard main sign, 6.3 x 9.0 m: columns steel pipe 244.5 x 5.0 and 193.7 x 5.0, face frame MS tube 40x40x2.5, holding-down bolts M20 grade 8.8, 600 long in C30, 6 mm welds.

## Modelling a hoarding in Revit

- **Levels:** `FGL +0.000` (finished ground), the bottom of the face (often +0.150) and one level per top height, named with the total height, such as `Top Run A +4.880`.
- **Rebuilding a module family by its own name updates every placed copy,** but if its lowest corner moves (for example the base goes from -0.100 to FGL), reset "Offset from Host" on all copies, or they float or sink by that amount.
- **Set-out:** walk each side anticlockwise, face on the boundary, frames inside; module origin = bottom corner of the face at the bay start; rotation = side direction. Share the spare length between the two corner panels of each side. Elevations along a side: `create_section` takes depth in mm (9 m = 9000), and looks into the site with look_direction = minus the outward normal.
- **One family per type of frame module:** a frame with its footing and one bay of rails (the plywood is laid per side so sheet joints run true). Copy the module along the plan at the frame spacing. Footings are Generic Model families so the concrete shows its hatch in section. A trimmed brace is built from three plates (web and two flanges), each a polygon in the frame plane cut by the end-plate face and the base-plate top.
- **Detail views:** cut connection sections on the anchor line, looking back at the steel (a cut through the post web turns post, end plate and brace into one black shape; cut through the flanges for the end plate). A 3D top view with a section box gives the base plan with the anchor layout.
- **Materials and hatch:** concrete crosshatch 45 at 4 mm, steel solid, plywood lines 0 at 1 mm (see `material-hatching.md`).
- **Typical section per type** at 1:25: heights, footing size, frame depth and spacing, member sizes, base plate and anchors, and a red note for anything assumed.
- **Plan** from the site survey coordinates. Mark each run with its type, and show where the height changes.
- **Always note:** "Design to be checked by a structural engineer for the site wind speed and soil." Never issue a hoarding drawing as structurally designed without a calculation.

## Project notes

- **DAS, Dar Al Salam (Nov 2026, client Naif Alrajhi Investment):** heights 4.88 and 7.32 m. The tender spec asks for H 10" and H 12" beams with back supports, each on concrete ("خرسانة اصل ودعامة"). Our spec proposal (user, 5 Nov 2026), now in the model:

  | | Type A, 4.88 m | Type B, 7.32 m | Type C, 7.32 → 4.88 m |
  |---|---|---|---|
  | Post | IPE 160 or SHS 100x100x4 | IPE 200 to 220 or SHS 150x150x5 | as B at the high end, as A at the low end |
  | Back brace | SHS 80x80x4 to its own pad | SHS 100x100x4 to its own pad | as B |
  | Spacing | 2.5 m | 2.0 to 2.5 m | 2.0 to 2.5 m |
  | Footings | small cast-in pad under the post and under the brace | larger pad under each | as B |
  | Face | 18 mm WBP plywood on 40x40 tube rails | same | same |
  | Finish | primer + 2 coats, front vinyl with UV laminate | same | same |

  **Base rule (user, 5 Nov 2026): only one concrete base per frame, above the ground.** The post and the brace both stand on it; never a separate pad under each. The whole base stands on the ground (none below FGL).

  **Back support is the same section as the column (user, 5 Nov 2026):** IPE 160 for A, IPE 220 for B and C, replacing the SHS braces in the table above.

  Modelled (end of 5 Nov 2026): IPE 160 / IPE 220 posts and back braces at 3.0 m, base plates 300 (A) and 400 (B, C) x 20 with 4 anchors. Bases from the factory typicals, standing on the ground: A 1800 x 1000 x 800 (top +0.800), B and C 2300 x 1400 x 1000 (top +1.000); a quick overturning check shows these are too small at 1.70 kN/m², so they stay ASSUMED for the engineer. Tops +4.880 and +7.320; rails at 1173 (A) and 1188 (B, C). All four corners 7.32 m with smooth 24 m transitions (6 in all). Site plan from the Balady survey report: 141 A, 83 B, 48 transition bays, 4 corner frames, 8 corner panels, 49 X-braced bays; zero base overlaps. Sheets A-1001 site plan, A-1101 typical sections, A-1102 elevations, rev 01 "Tender issue - for review". The base front face sits right behind the rails; the plywood runs down in front of it to +0.150. The post plate's front edge is flush with the post, so it sits fully on the base. This post-and-brace system is lighter to build than the lattice typical; the structural engineer chooses between them per job.
