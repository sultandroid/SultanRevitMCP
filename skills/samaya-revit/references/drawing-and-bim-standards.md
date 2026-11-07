# Drawing and BIM standards

Samaya Factory work follows the ISO drawing and information standards below. Where a project's employer or consultant sets different requirements, theirs win: ask.

**The tools apply these from one file:** `standards/sultan-standards.json`, through `tools/standards.mjs`. It holds the ISO map, line widths and styles, text types, dimension style, scales, sheet grid and numbering, discipline colours for coordination, MECH system colours, IEC 60445 circuit colours, phases, 3D view settings and joinery defaults.
- `ensureStyles(call)` puts every text type and line style in a model.
- `colourByDiscipline(call, viewIds)` colours coordination views with the discipline and sub-discipline colour system, and `colourKey()` / `subColourKey()` give the legend lines for the sheet. See "Coordination colours" below.
- `ensurePhaseParameters(call)` binds SF_PhaseStatus, SF_ExistingSource and SF_Maturity (see `phases.md`).

## Coordination colours and sub-colour system

Colour is for coordination views only. Sheets stay black on white.

**Precedence** (view filters, top wins):
1. **Existing work:** grey `[160, 160, 160]` halftone, by `SF_PhaseStatus` beginning with "Existing".
2. **Reservations:** 60% transparent with dashed edges, by `SF_Maturity` beginning with "Res".
3. **Gross envelopes:** 40% transparent, by `SF_Maturity` = "Gross".
4. **Sub-discipline colour by category:** each discipline has a base Okabe-Ito family hue plus distinct `sub_colours` per Revit category (`OST_*`) so elements within the same discipline never blend together.

Existing services are grey, not their discipline colour. A place-holder never looks like a final design.

**Base discipline palette:** Okabe-Ito, safe for colour-blind readers.

| Code | Discipline | Base family | Base RGB |
|---|---|---|---|
| A | architecture / fit-out | warm sand | `215, 200, 165` |
| S | structure | yellow / gold | `240, 228, 66` |
| X | exhibition / joinery / furniture | wood / brown | `150, 105, 70` |
| M | mechanical (HVAC) | blue / sky blue | `0, 114, 178` |
| P | plumbing | bluish green / teal | `0, 158, 115` |
| F | fire protection | vermillion | `213, 94, 0` |
| E | electrical | orange / amber | `230, 159, 0` |
| T | ELV / AV / fire alarm | reddish purple / violet | `204, 121, 167` |

**Sub-colour rules across all disciplines** (`coordination.disciplines.<name>.sub_colours` in `sultan-standards.json`, applied automatically by `colourByDiscipline`):
- **Ceiling colours are always different from flooring:** in Architecture (`A`), flooring (`OST_Floors`) is light warm sand (`230, 215, 185`), walls (`OST_Walls`) are medium stone (`195, 175, 135`), ceilings (`OST_Ceilings`) are cool slate-blue (`175, 195, 210`), doors (`OST_Doors`) are bronze-oak (`155, 115, 65`), windows/curtain panels (`OST_Windows` `150, 210, 225`, `OST_CurtainWallPanels` `165, 215, 230`) are 35% transparent aqua glass, mullions (`OST_CurtainWallMullions`) are dark bronze (`115, 100, 80`), stairs (`OST_Stairs`) are `180, 150, 110`, railings (`OST_Railings`) are `130, 115, 95`, and roofs (`OST_Roofs`) are `175, 160, 135`.
- **Structure (`S`):** structural columns (`OST_StructuralColumns`) `240, 228, 66`, secondary columns (`OST_Columns`) `225, 205, 55`, beams/framing (`OST_StructuralFraming`) `205, 175, 30`, foundations (`OST_StructuralFoundation`) `165, 145, 35`.
- **Exhibition / Joinery (`X`):** joinery/casework (`OST_Casework`) walnut `135, 80, 45`, freestanding furniture (`OST_Furniture`) warm camel `190, 140, 85`, furniture systems (`OST_FurnitureSystems`) teak `165, 110, 65`, specialty rigs (`OST_SpecialityEquipment`) espresso `105, 55, 30`, plinths/graphic volumes (`OST_GenericModel`) terracotta `210, 160, 115`.
- **Mechanical (`M`):** HVAC equipment (`OST_MechanicalEquipment`) deep navy `0, 75, 135`, rigid ducts (`OST_DuctCurves`) `0, 114, 178`, flex ducts (`OST_FlexDuctCurves`) `55, 155, 215`, fittings (`OST_DuctFitting`) `25, 135, 200`, accessories (`OST_DuctAccessory`) `0, 95, 155`, air terminals/diffusers (`OST_DuctTerminal`) bright sky blue `86, 180, 233`, insulation (`OST_DuctInsulations`) `145, 205, 240` (30% transparent).
- **Plumbing (`P`):** fixtures/drains (`OST_PlumbingFixtures`) deep emerald `0, 115, 80`, rigid pipes (`OST_PipeCurves`) `0, 158, 115`, flex pipes (`OST_FlexPipeCurves`) `65, 195, 155`, fittings (`OST_PipeFitting`) `30, 175, 130`, valves/accessories (`OST_PipeAccessory`) `0, 95, 65`, insulation (`OST_PipeInsulations`) `130, 215, 185` (30% transparent).
- **Fire protection (`F`):** sprinklers (`OST_Sprinklers`) vermillion `213, 94, 0` (with fire pipework `235, 120, 30` and cabinets/extinguishers `175, 65, 0` when separated).
- **Electrical (`E`):** DBs/panels (`OST_ElectricalEquipment`) burnt orange `190, 105, 0`, cable trays (`OST_CableTray`) `215, 135, 10`, tray fittings (`OST_CableTrayFitting`) `195, 120, 15`, conduits (`OST_Conduit`) `205, 145, 35`, conduit fittings (`OST_ConduitFitting`) `180, 125, 25`, power sockets/floor boxes (`OST_ElectricalFixtures`) `230, 159, 0`, luminaires (`OST_LightingFixtures`) bright gold `250, 195, 45`, switches/sensors (`OST_LightingDevices`) pale gold `255, 215, 95`.
- **ELV / AV / Fire Alarm (`T`):** fire alarm devices (`OST_FireAlarmDevices`) crimson-rose `215, 70, 115`, security/CCTV (`OST_SecurityDevices`) deep plum `145, 70, 140`, AV/projectors/displays (`OST_AudioVisualDevices`) magenta `185, 75, 150`, PA/communication (`OST_CommunicationDevices`) `204, 121, 167`, data/Wi-Fi (`OST_DataDevices`) lavender `190, 140, 210`, telephone (`OST_TelephoneDevices`) `175, 125, 185`, call points (`OST_NurseCallDevices`) `225, 155, 190`.

**Federated models:** host-view filters and category overrides also act on links shown By Host View, so one set colours a whole federation. **Never colour or halftone the Revit Links category.** It greys every link; the old "existing = OST_RvtLinks halftone" rule did exactly that and is withdrawn.

**MEP system colours** (supply, return, outside air, exhaust, chilled water, domestic water, drainage, sprinkler) are for MEP shaded and 3D views, not coordination views. Set them on the Revit duct and pipe system types where possible.
- `isoScale()` picks a scale; `sheetNumber()` builds an ISO 19650 sheet number.

When a standard changes, change the JSON and this page together, and no tool keeps its own copy of a value.

This is a working summary, not the text of the standards. Editions change, so check the current edition before quoting a clause number on a submission. Items marked *check* have not been confirmed against the standard.

## Standards map

| Topic | Standard |
|---|---|
| Lines | ISO 128-2 |
| Views, sections, cuts | ISO 128-3 |
| Projection methods | ISO 5456 |
| Dimensioning | ISO 129-1 |
| Sheet sizes and layout | ISO 5457 |
| Title block | ISO 7200 |
| Scales | ISO 5455 |
| Lettering | ISO 3098 |
| Leader and reference lines | ISO 128-2 (ISO 128-22 was withdrawn into it; confirm the current edition, 2020 or 2022) |
| Part references (keynote numbers) | ISO 6433 *check edition* |
| Electrical symbols | IEC 60617 |
| Safety signs | ISO 7010 |
| Information management | ISO 19650 parts 1 to 6 |
| Open model exchange | ISO 16739-1 (IFC) |
| Level of information need | ISO 7817 *check* |
| Construction classification | ISO 12006-2 |
| CAD layers | ISO 13567 |

## ISO 128 on sheets

- **Black on white.** Drawings do not rely on colour to carry meaning. Use line type, line weight and hatching. Technical sheets, including MEP, use hidden line views, not shaded ones. The exceptions are 3D and exploded views on fabrication sheets, which are for understanding, not measuring. The user asked for them shaded.
- **Line widths** come from one series with a ratio of about 1 to 1.4: 0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1.0, 1.4, 2.0 mm. Use a thick to thin ratio of at least 2 to 1 on a sheet.
- **Line types and meaning:**
  - Continuous thick: cut outlines and visible edges.
  - Continuous thin: dimension lines, leaders, hatching.
  - Dashed: hidden edges, door swings, concealed services.
  - Long dash dot thin: centre lines, grid lines.
  - Long dash dot with thick ends: cutting planes.
- **Hatching:** thin lines, normally at 45 degrees. Neighbouring parts run opposite ways or at different spacing. See `material-hatching.md`.
- **Sections:** a cutting plane with its reference at each end, and a matching section title on the view.
- **Same scale, projected views:** front, plan and side line up. See the layout guide in `views-and-sheets.md`.
- **Lettering:** one upright sans serif font, with no overlap on lines or other text. Minimum printed height is 2.5 mm; our sheet standard uses 5 mm.
- **Leader lines** (ISO 128-2): continuous thin lines, drawn at an angle to the hatching and outlines they touch, never parallel to them. They end in a dot inside a surface, an arrowhead on an outline, and with no end on a dimension line. They do not cross each other.
- **Part references** (ISO 6433): numbers arranged in aligned rows or columns outside the view, in a consistent sequence, all the same size, with a matching key or parts list. Our house practice adds horizontal leaders in two columns, numbered in reading order: see `views-and-sheets.md`.
- **Dimensions** in mm without the unit, with one consistent style and terminator. Do not repeat a dimension without reason.

## Electrical symbols

Use IEC 60617 symbols, never invented marks or library family graphics (the US receptacle families print "GFCI"): luminaire as a circle with a cross, linear luminaire as a line with end bars, socket outlet as a semicircle with its line to the wall and an earth bar, turned to face away from its wall, loudspeaker and camera as a box with horn or lens, distribution board as a half-hatched rectangle. Exit signs follow ISO 7010 E001. ISO 6790, the fire protection plan symbols, is withdrawn: mark fire alarm symbols as to be checked against the civil defence code. Draw the symbols with detail lines at each device, hide the device categories in that view, and put a graphic legend in a drafting view at the plan scale, with mark, description and quantity, on every electrical sheet. Check any project-specific symbol against the CAD legend before issue.

## Device layout

- **Ceiling devices follow the ceiling design,** not the room outline. Find each ceiling level (tray, band, bulkhead) and put lights, speakers, detectors, emergency lights and cameras on one grid within each zone, aligned with the downlights and symmetric about the zone's centre lines. Never leave them at scattered CAD points.
- **Dimension every layout** from the unit faces, the ceiling zone edges and the centre lines, in the house dimension type. Hide the reference marks `create_dimension_string` draws.
- **Sockets for display units go on the inner face of the unit's back panel,** not on the room face in front of the unit. Check the panel face with `probe_ray`.
- **Background music speakers:** one ceiling speaker covers about 3 x 3 m at even level from a 3 m ceiling. Size the count to the floor area, not the CAD count, and check the amplifier: total tap watts times about 1.25.

## Circuit colours

Circuit layouts are the exception to black only: colour lines by phase using IEC 60445 conductor colours, L1 brown, L2 black, L3 grey, neutral blue, earth green and yellow. Line type shows the system. On a single-phase supply all circuits are the line colour, brown. Label each circuit with its number, phase where there is more than one, and system, and show the key in the legend. No ISO standard assigns colours by circuit type.

## Supply checks without site data

When the fault level or feeder length is not known, do not hold the issue. Put limits on the DB schedule instead, and mark them to be checked on site:

- Main breaker breaking capacity: state the rating, for example a 10 kA MCB to IEC 60898-1, and the step up if the site is higher, for example an MCCB at 25 kA.
- Feeder: state the maximum length for the chosen size. Use the cable's mV/A/m times the breaker rating, against a drop budget for the feeder of about 2% so the final circuits stay within IEC 60364-5-52 (3% lighting, 5% other). Give the next size up and its limit.

## ISO 19650 on projects

- **Common data environment:** information moves through work in progress, shared, published and archived.
- **Status and revision:** each issued container carries a suitability status and a revision. Typical codes: S0 work in progress, S1 coordination, S2 information, S3 review and comment, S4 stage approval, A published. These come from national annex guidance, such as the UK's, so confirm the set on each project.
- **File naming:** fields separated by hyphens: project, originator, volume or system, level, type, role, number. Status and revision can be in the name or held as metadata, depending on the annex. Agree this in the project's information standard.
- **Discipline models:** separate files by discipline, linked and not merged. Each discipline owns its model.
- **Level of information need:** define for each deliverable the geometry, data and documents required. Do not model more than that.
- **Responsibility:** every element and sheet has an owner, and sign-off is recorded.

Today's Madina 1 sheet numbers, such as `MD1-ID-GF-131`, are a project convention and not a full ISO 19650 name. Agree the naming before applying it to an existing project, and do not rename sheets without the user's approval.

## IFC

- Export with the agreed IFC version and model view, and record them on the transmittal.
- Every element needs the correct IFC class. Check the mapping for custom families, because direct shapes and generic models export with weak classes. Casework, lights and electrical items should map to their real classes.
- Materials, levels and property sets must be correct before export. Use `Pset_` properties where they apply and keep the same marks and names in the model and schedules.
- Check an export in a separate viewer before sending it.
- IFC is the exchange file. The native Revit model stays the source.

## Check before issue

1. Lines, hatches and text follow the rules above, with no colour carrying meaning on technical sheets.
2. Status, revision and sign-off are filled in.
3. Sheet and file names follow the project's agreed format.
4. The key plan is correct.
5. Quantities agree with the model.
6. Assumptions are labelled, and nothing unverified is presented as measured.

## Sources

- ISO 128-3 scope: https://www.iso.org/standard/69130.html
- BSI on the ISO 128 revision: https://www.bsigroup.com/en-VN/blog/manufacturing-blog/when-six-became-one--in-the-presentation-of-lines
- UK national annex guidance: https://www.cdbb.cam.ac.uk/files/national_annex_guidance.pdf
- Status codes: https://help.autodesk.com/cloudhelp/ENU/Docs-Files/files/file-naming-standard/Status_Codes.html
