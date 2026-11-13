# Lockers

Read this before modelling, detailing or pricing any locker: staff and visitor lockers, changing room lockers, bag stores,
lobby lockers. It holds the rules locker makers build to, and the checks our tool runs. Plain English, site-engineer tone.

Tools: `tools/locker_system.mjs` (makes every part and fitting of a locker run from a spec) and `tools/locker_check.mjs`
(checks a locker against the rules below, PASS / WARN / FAIL per rule). First used on Aseer Museum LB1.01_SW_04 (Nov 2026).

## Order of work

1. **Model the designer's locker first, exactly as drawn** (as-designed V-01). Do not mix our changes into it.
2. **Run `locker_check.mjs` on it.** Every FAIL and WARN is a point for the Samaya study.
3. **Build the study (V-02) with `locker_system.mjs`**, applying the rules below, in its own study model so it never overlaps V-01.
4. Issue the study as a proposal with a "changes from the design" table. The designer approves before the workshop builds it.

## Modules and sizes

| Item | Locker makers' practice | Note |
|---|---|---|
| Column width | 300, 350 or 400 mm | Exterus, Helmsman. Clear inside about 280 to 380. |
| Depth | 300, 450 or 500 mm | Coat hanging needs 450 or more. |
| Height | 1800 to 1860 overall on a plinth or legs | Half-height and 2, 3, 4, 6 tier versions in the same height. |
| Block width | n x W - (n - 1) x partition | Exterus 12 mm compact: 300, 588, 876 ... |
| Partitions | One shared partition between columns | A designer may show double linings (Aseer NRS: 2 x 12 plywood); keep it if the design says so. |

Repeat one compartment size wherever possible: one door size, one hinge set, one lock.

## Doors

- **Door gap 3 mm** all round and between doors (2 to 4 mm accepted). Keep the same gap at bands and laterals.
- **Door thickness must suit the hinge.** A standard 35 mm cup hinge (cup about 11 to 13 deep) needs a door 16 mm or
  thicker (Blum CLIP top 71B3550: 16 to 26 mm). Thinner doors (10 to 13 mm compact laminate, Viroc 12) take a **thin-door
  35 mm cup hinge with a shallow cup** (Hettich Sensys 8646i / 8676: doors 10 to 19 mm, cup 7.8 deep) or a knuckle / piano hinge.
- **Weight:** door weight = W x H x t x density. Viroc 1350 kg/m3, compact HPL about 1400, MDF 750, plywood 600. Use it to count hinges.
- **Edges:** sanded and sealed on cement board and MDF; compact laminate edges are left as cut (polished).
- **Number:** every door carries its number (recessed oval plate, max 4 digits, or engraved), same corner on every door.

### Board thickness that really exists

| Board | Thicknesses on the market (mm) | Sheet |
|---|---|---|
| Viroc (cement-bonded particle board) | 8, 10, 12, 16, 19, 22, 25, 28, 32. **No 18 mm.** | 2600 x 1250, 3000 x 1250 |
| Compact HPL | 10, 12, 13 (locker doors), 6 to 8 (bodies) | 3050 x 1300, 4100 x 1850 |
| EGGER board | 8, 18 only (joinery-practice.md) | 2800 x 2070 |

The checker fails a door or panel whose thickness is not on this list for its material.

## Hinges

| Door | Hinge | Count (factory default, check the maker's chart) |
|---|---|---|
| 16 to 26 mm board (Viroc 16/19, MDF, plywood) | Concealed 35 mm cup, 110 deg, soft close | 2 up to 900 high and 6 kg; 3 up to 1600 or 12 kg; 4 up to 2000 |
| 10 to 15 mm compact HPL or Viroc | Thin-door concealed hinge, 35 mm cup 7.8 deep (Hettich Sensys 8646i), or stainless 5-knuckle | Same counts |
| Heavy use (schools, sport) | Stainless piano hinge, full height | 1 |

- Hinge centres 80 to 100 mm from the top and bottom of the door; a third hinge in the middle.
- Cup boring distance 3 to 5 mm from the door edge. The cup depth must leave at least 3 mm of board behind it.
- **In cement board and MDF, screws go into threaded or press-in inserts**, never straight into the board.
- 110 deg opening so a door clears the wall or the next door; at a corner, check the door against the return.
- Hinges on the same side in a run unless the plan needs a pair to open apart.

## Locks

- Standard: key cam lock (about 20 mm hole), master keyed. Options: hasp and padlock, coin, combination, digital, RFID.
- The cam closes onto a **keeper plate** (2 mm steel, folded, powder coated) fixed to the partition or frame.
- Lock on the side away from the hinge, centre about 30 mm from the door edge.
- Lock height: in the reach range for the accessible lockers (below). Same height on every door of a row.

## Air, rails and hooks

- **Every compartment needs air in and out.** Gaps alone are not enough behind solid doors: add vent holes or slots at the
  bottom and top of each compartment (door, back or side). Factory default: 6 holes of 8 mm, top and bottom, in the back lining.
- **Coat rail** in every compartment 450 mm deep or more and 700 mm clear height or more. **Hooks** on both sides of tall
  compartments (Helmsman practice).

## Base and top

- Plinth or adjustable legs, 60 to 150 high; legs in wet areas. Keep a shadow gap at the floor where the design shows one.
- A flat top over about 1800 collects dust and bags: in changing rooms use a sloping top (30 to 45 deg). In a museum lobby
  keep the designer's flat top and close it with a cap.

## Fixing and stability

- EN 16121:2023 (non-domestic storage furniture: safety, strength, durability, stability) with tests in EN 16122.
- **Fix every tall unit to the wall** at the top, at least two fixings per column, into the wall structure or a batten.
- Free-standing back-to-back units are bolted together and to the floor.

## Accessibility

- At least 5 % of lockers, and at least one, accessible: lock and lowest shelf or hook between 380 and 1220 mm above the
  floor, operable with one hand without tight grasping, clear floor space 760 x 1220 in front (ADA 2010 225.2.1, 811 storage,
  308 reach ranges). Check the Saudi Building Code (SBC 201) accessibility chapter on each project; until read, use these values.
- UK sport guidance suggests 10 % full-height lockers for mobility aids. Mark the accessible lockers on the plan.

## Viroc specifics

- Density 1350 +/- 50 kg/m3 (EN 323). Heavy: count hinges by weight.
- Pre-drill every fixing. Viroc installation guide (2020, cladding): fixings at least **35 mm from long edges and 50 mm
  from ends**, max 600 c/c. Use it for joinery too; where a hinge or lock must sit closer, bond it or use an insert and ask Viroc.
- Seal cut edges. Use inserts for hinges and locks.

## What the checker tests (`locker_check.mjs`)

| Id | Rule | Result |
|---|---|---|
| L01 | Door thickness exists for its material | FAIL if not on the list |
| L02 | Hinge type suits door thickness | FAIL: 35 mm cup on a door under 16 mm |
| L03 | Hinge count by door height and weight | FAIL if fewer than the rule |
| L04 | Door gap 2 to 4 mm | WARN outside |
| L05 | Clear inside width 280 to 380, depth 300 or more | WARN outside |
| L06 | Coat rail where depth 450+ and height 700+ | WARN if missing |
| L07 | Ventilation in every compartment | WARN if missing |
| L08 | Accessible lockers: 5 % and at least 1 with the lock in 380 to 1220 | FAIL if too few |
| L09 | Wall fixing on every tall unit | FAIL if missing |
| L10 | Inserts for hinges and locks in cement board or MDF | WARN if missing |
| L11 | Number plate on every door | WARN if missing |
| L12 | One door size per row type (repeat sizes) | WARN for more than 3 sizes |

## Sources

- [Exterus changing room lockers (12 mm Fundermax compact, widths 300/350/400, blocks, 1860 x 500)](https://hefitness.se/produktfiler/exterus_changing_room_lockers11.pdf)
- [Helmsman laminate lockers specification (sizes, number plates, coat rails 450+ deep, hooks, cam lock / hasp)](https://helmsman.co.uk/wp-content/uploads/dlm_uploads/2021/01/Laminate-Lockers-Specification-Sheet-1.pdf)
- [Geschwender lockers (10 mm HPL doors, 6 mm body)](https://source.thenbs.com/product/geschwender-lockers/cFJkdCn5deJ9KWNAPxNcA8)
- [List Industries quiet lockers (vent perforations top and bottom)](https://sweets.construction.com/manufacturer/list-industries-inc-nst724/products/quiet---whisper-quiet-kd-wardrobe-lockers-our-silent-approach-to-locker-design-nst634814-p)
- [EN 16121:2023 non-domestic storage furniture](https://standards.iteh.ai/catalog/standards/cen/2cc5e087-c513-4571-aa5e-58a14f98c1d8/pren-16121)
- [ADA reach ranges and lockers](https://www.access-board.gov/ada/guides/chapter-3-operable-parts/), [lockers.com ADA guide](https://lockers.com/salsbury-locker-blog/what-makes-a-locker-ada-compliant)
- [Leisure centre guide: 10 % full-height lockers (Sport England)](https://www.barbourproductsearch.info/CubicleCentre-leisure-centre-guide%20UPDATED%20pdf-file089476.pdf)
- [Viroc installation guidelines 2020 (edge distances)](https://public.bowens.com.au/product-info-files/V/VIROC123012B_C22C8C41F83DA37C45FA765AF7F3CD149C72DAB9_INSTALLATION-GUIDELINES.PDF)
- [Viroc data sheet: thicknesses, sheet sizes, density](https://www.eboss.co.nz/assets/literature/67/35808/data-sheet-viroc-dossier-tecnico-en-2.pdf)
- [Blum hinge planning: count by front height and weight](https://publications.blum.com/2024/catalogue/id/123/), [Blum CLIP top BLUMOTION](https://www.blum.com/au/en/products/hingesystems/clip-top-blumotion/overview/)
- [Hettich Sensys thin-door hinge 8646i (doors 10 to 19 mm, cup 35 x 7.8)](https://www.ostermann.eu/en_GB/product/thin-door-hinge-hettich-sensys-8646i-with-silent-system-with-self-closing-feature-110-nickel-plated)
- [ASSA ABLOY locker camlock 8450](https://www.assaabloy.com/se/en/solutions/products/cabinet-locks/locker-locks/camlocks/medium-security/camlock-8450), [Hafele cylinder cam lock 235.03, master key options](https://files.hafele.co.uk/CatalogFiles/www/18T8-39.PDF)
- [Salsbury / lockers.com wood lockers (hat shelf, shoe shelf, double-prong hook per tier)](https://www.lockers.com/assets/2/6/locker_wood.pdf)

Values without a source (hinge positions, vent holes, screw edge distance, lock offset) are factory practice: say so on the
sheet as assumed until the hardware supplier confirms.


