# Saudi Building Code (SBC) Checks for Drawings

Use this file for anything that is built into, fixed to, or powered from a building in Saudi Arabia: shop drawings, fit-out, joinery, metalwork, glazing, showcases fixed to the structure, signage, lighting and MEP interfaces.

## Edition and Authority

- The SBC 2024 edition became mandatory on 30 June 2025. Projects that reached their authority or design milestones under SBC 2018 before the change may stay on SBC 2018. Record which edition the project uses; it is usually stated in the contract or the design basis report.
- Official source: the Saudi Building Code National Committee (`https://sbc.gov.sa`). Check the edition and any amendments there before a compliance claim.
- Authorities having jurisdiction (AHJ) commonly include the municipality (Balady platform) for permits, the General Directorate of Civil Defense for fire and life safety, and the client's own approval body. The contract names who approves what.
- The SBC is largely based on the ICC International Codes with Saudi changes. Do not assume an IBC/IFC clause number or value is the same in the SBC. Cite the SBC part and chapter, and give a clause number only after reading it in the edition in force; otherwise write `clause TBD - verify in SBC <edition>`.
- A drawing can show that a requirement was considered. Only the responsible engineer, the consultant and the AHJ can confirm compliance. Never write "SBC compliant" on a drawing without that approval.

## SBC Parts (2024 numbering)

| Part | Subject | Typical use in shop drawings |
|---|---|---|
| SBC 201 | General building code | Occupancy, interior finishes, glass and glazing, accessibility, guards, materials |
| SBC 301 | Loads | Dead, live, wind, seismic loads on fixed items, guards and suspended items |
| SBC 302 | Construction | Site safety, temporary works |
| SBC 303 | Soils and foundations | Footings for external or heavy items |
| SBC 304 | Concrete | Anchors into concrete, concrete plinths |
| SBC 305 | Masonry | Fixing into blockwork |
| SBC 306 | Steel | Steel frames, connections, welding basis |
| SBC 401 | Electrical | Lighting, power to fixtures, earthing, cable routes |
| SBC 501 | Mechanical | HVAC interfaces, ventilation of enclosures |
| SBC 601 / 602 | Energy conservation | Lighting power, envelope items |
| SBC 701 / 702 | Sanitary and private sewage | Plumbing interfaces |
| SBC 801 | Fire | Fire protection, egress, fire-rated assemblies, interior finish classes |
| SBC 901 | Existing buildings | Work in existing or heritage buildings |
| SBC 1001 | Green building | Material and environmental requirements where adopted |
| SBC 1101 / 1102 | Residential | Residential projects |

The 2024 update also added new codes (including seismic design of steel and repair of existing concrete). Check the official list for the full set.

## Checks by Item Type

Each check gives a rule ID, what the drawing must show, and what stays `TBD` until someone qualified confirms it.

### `SBC_FIRE_FINISH` (SBC 801, SBC 201 interior finishes)

- Show the reaction-to-fire class or test standard of every exposed finish, panel, fabric, timber and plastic, taken from the approved material submittal.
- Show fire-rated walls, doors, ceilings and penetrations that the item touches, and how the item keeps the rating (fire-stopping, rated fixings, no unsealed penetrations).
- Keep exits, exit signs, sprinkler heads, smoke detectors, fire alarm devices and extinguisher cabinets clear; show clearances taken from the fire strategy or the MEP drawings.
- `TBD` until the fire consultant or the approved fire strategy confirms classes and clearances.

### `SBC_GLAZING` (SBC 201 glass and glazing chapter)

- Show glass type (toughened, laminated, heat-strengthened), make-up, thickness, edge work and the governing product standard (for example EN 12150, EN 14449) from the approved glass submittal.
- Mark glass in human-impact locations (doors, low-level panels, guards, display cases people can lean on) and show that it is safety glass.
- Show support and fixing method, setting blocks, gaskets and deflection limits where the glass is structural or a guard.
- `TBD` until the glass supplier's calculation and the consultant approve thickness and fixing.

### `SBC_ACCESSIBILITY` (SBC 201 accessibility chapter)

- Show heights and reach for counters, controls, displays, labels and interactive items, and clear floor space in front of them, from the approved accessibility design or the project specification.
- Show circulation widths and turning spaces next to the item.
- Do not quote accessibility dimensions from memory; take them from the project accessibility drawings or the SBC chapter in force.

### `SBC_STRUCTURAL_FIXING` (SBC 301, 304, 305, 306)

- Show load path from the item to the building structure: fixing type, size, spacing, embedment, edge distance, substrate.
- Show the design loads used or reference the calculation that has them (dead, live, horizontal crowd load on guards and display cases, seismic for tall or suspended items).
- Post-installed anchors need an approved product with its technical assessment; keep values `TBD` until approved.
- Welding follows the code in the specification (often AWS D1.1 or the ISO/EN equivalent); the weld symbol system must match (`KSA_WELD_SYMBOL_SYSTEM`).
- `not evaluated` for strength until a qualified structural engineer's calculation exists.

### `SBC_ELECTRICAL` (SBC 401, SASO product rules)

- Supply is 230 V single-phase / 400 V three-phase at 60 Hz; confirm the site supply, as some older buildings still have 127/220 V.
- Show luminaires, drivers, transformers, switches and sockets with type, rating, IP rating, location of drivers and access for service.
- Show cable routes, containment, separation from heat and sharp edges, earthing and bonding of metal parts.
- Sockets and plugs follow SASO 2203 (BS 1363 type, 13 A). Regulated electrical products need SASO conformity (SABER platform).
- `TBD` until the MEP consultant approves loads, circuits and protection.

### `SBC_MECHANICAL_INTERFACE` (SBC 501)

- Show ventilation openings, heat sources inside enclosures, and clearances to diffusers, grilles and access panels from the MEP drawings.

### `SBC_EXISTING_BUILDING` (SBC 901)

- For work in existing or heritage buildings, show what is retained, the fixing method into existing fabric, and any limits set by the heritage or conservation authority.

## Fit-Out and Exhibit Items

- Loose furniture and movable displays may sit outside some SBC parts, but fire classes of materials, electrical safety and stability still apply. Record which parts the consultant says apply.
- Display cases and showcases: glass (`SBC_GLAZING`), fixing and stability (`SBC_STRUCTURAL_FIXING`), lighting and power (`SBC_ELECTRICAL`), and materials near objects as the conservation specification requires. Conservation requirements come from the project specification, not the SBC.
- Where a project-specific skill exists (for example a museum submittal skill with its own title block and numbering), its project rules win over the general rules here.

## Reporting

For each building-installed item, report:

- SBC edition used and who confirmed it.
- Each applicable rule ID with `PASS`, `FAIL`, `TBD` or `NOT_APPLICABLE`, the evidence (drawing, submittal, calculation, approval reference), and who must close any `TBD`.
- A clear statement that the drawing shows design intent for review and does not certify compliance.
