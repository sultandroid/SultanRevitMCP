---
name: samaya-costing
description: Samaya Factory take-off, costing and pricing workbooks for a job (site hoarding, fences, fit-out items) - quantities from the Revit model, an Arabic cost workbook with live formulas (المدخلات، تحليل البنود، البنود، الحساسية، الاستفسارات), the approved pricing policy (overhead 12%, transport 3%, margin 25%, VAT 15%) and a pricing-notes file. Use whenever the user asks for a take-off, BOQ, quantities, cost, costing, pricing, quotation, عرض سعر, تسعير, حصر كميات or تكلفة for a Samaya Factory project, even if they only say "make the sheet like before".
---

# Samaya Factory take-off, costing and pricing

One method for every job, first used on DAS (hoarding tender, Oct 2026) and KAC (hoarding, Nov 2026). The user wants the same three files each time, in the same shape.

## The three files

| File | Where | What |
|---|---|---|
| `COST-<PRJ>-<ITEM> RevNN (مصدر الحساب).xlsx` | project `03_Cost\` (tender jobs: the tender folder root) | Arabic cost and price workbook, live formulas |
| `<PRJ>_<Item>_Quantities_RevNN.xlsx` | `Revit Files\Excel Sch\` | Take-off from the model (English) |
| `ملاحظات التسعير RevNN.md` | next to the cost workbook | Pricing notes in Arabic: items table, price structure, included / excluded, assumptions, sensitivity, sources |

Keep the JSON inputs next to them (`cost_spec.json`, `takeoff.json`) so a revision is a re-run, not a re-type.

## Pricing policy (approved)

- Overhead **12%**, transport **3%**, margin **25%**, VAT **15%**.
- **Selling price = direct x (1 + overhead + transport) x (1 + margin)** = direct x 1.4375. VAT on top.
- Never change the policy in a sheet without the user saying so; it lives in the inputs sheet, one cell each.

## Cost workbook sheets (in this order, right-to-left, Arial)

1. **المدخلات** - every unit price with its **source** (supplier quote, market link, or the DAS/KAC reference). A price with no source is tagged `assumed` (shown red) and listed in the inquiries. The policy cells sit under the prices, with the selling factor as a formula. **Prices are edited here only.**
2. **تحليل البنود** - for each item, the cost of ONE unit by component: input price (formula link) x quantity per unit = direct per unit, x factor = sale per unit, and each component's share.
3. **البنود** - item, description, unit, quantity, **source of the quantity** (model / drawing / client text), direct and sale per unit (links to the analysis), direct total, sale before VAT, VAT, total, and the grand total row.
4. **الحساسية** - the total before VAT for a few values of the inputs that move the price most (e.g. bought-in units, printing, labour, member spacing). Mark the base value bold.
5. **الاستفسارات** - every priced assumption: topic, problem, what was priced, who decides (client, designer, purchasing, site), impact.

Build it with `tools/costing/build_cost_workbook.ps1 -Spec cost_spec.json -Out "<file>.xlsx"`. The spec holds `title, code, date, status, policy, inputs[{key,name,unit,price,source}], items[{code,desc,unit,qty,qty_note,components[{name,input,per_unit}]}], sensitivity_rows[{label,value,total,diff,base}], inquiries[{topic,issue,assumption,owner,impact}]`. Compute `sensitivity_rows` in the spec script with the same formula as the workbook, and check that the workbook total printed by the builder equals your own total before sending.

## Take-off (quantities workbook)

- **From the model, net, no waste** - lengths are member centrelines; say so on the sheet. Read counts and lengths from the set-out data the model was built from (or schedules), never by eye.
- Sheets: **Steel** (component, section, count, total length, kg/m, weight; plates; total; weight by section), **Face, base, doors** (areas, sheets, blocks/barriers, frames, braced bays, doors), **Anchors**.
- SHS weight per metre = (b² - (b-2t)²) x 7.85e-3 kg/m (b, t in mm).
- Pricing area for a hoarding = **net length (after door openings) x full height**; the printed/painted face = net length x face height. Plywood bought = whole sheets per run segment (portrait 1220 x 2440).
- Build it with `tools/costing/build_quantities_workbook.ps1 -Takeoff takeoff.json -Out <file> -Title "<PRJ> - ... - TAKE-OFF FROM THE MODEL (model, rev, date)"`.

## Items (how to split)

- One **per m²** item for the built wall/face (frame, face, finish, labour together), plus a **per linear metre** figure in the notes.
- **Per number** items for bought-in units (NJ barriers on the line, NJ ballast, doors, gates) - they swing the price and get their own line.
- Anything in the brief whose position or scope is unknown is a **provisional lump sum** item, said so in the description.

## Reference unit prices (SAR, Oct-Nov 2026 - re-check each job)

| Item | Unit | Price | Source |
|---|---|---|---|
| Plywood 18 mm WBP | m² | 52 | market: sheet 1220x2440 about 155 SAR |
| Steel tube 40x40x1.25 | m | 7.40 | mawad.com (40x40x1.2 = 36.80 / 6 m) |
| Steel tube 50x50x3 | m | 26 | assumed (4.43 kg/m x about 5.9 SAR/kg) |
| Fabricated plates / beams | kg | 6 | assumed, market 5,500-6,500 SAR/t fabricated and installed |
| Reinforced concrete C30 for bases | m³ | 850 | ready-mix 190-320 + rebar + formwork + labour |
| Primer + 2 coats | m² | 16 | assumed |
| Cast vinyl print + UV laminate, fixed | m² | 55 | market from 45 SAR/m² |
| Access / light scaffold up to 6 m (above 6 m: 15) | m² | 9 | DAS |
| Installation labour (frame + face) | m² | 55 | assumed |
| Consumables and welding | m² | 7.5 | assumed |
| Anchor M12 | no. | 6 | assumed |
| NJ barrier 1000x800x500, ready-made | no. | 380 (+60 handling) | assumed - get a supplier quote (buy or rent) |
| NJ concrete barrier 50x85x100 cm (KAC PO P02874, Shield Capital, 5 Nov 2026) | no. | 45 (+25 transport, unload, place) | Odoo PO (draft) - confirm buy or rent; read POs from Odoo read-only with the access file |
| Steel site gate double 2600x2500 / door single 1200x2500 | no. | 4,500 / 2,200 | assumed - workshop quote |

## Notes file (ملاحظات التسعير)

Same headings every time: header (code, date, status), البنود table (direct and sale per unit, totals, VAT), price per linear metre, هيكل السعر, ما يشمله السعر, ما لا يشمله (graphic design, electrics, earthworks, permits, removal unless asked), افتراضات مؤثرة, الحساسية, المصادر, الملفات.

## Always

1. Quantities come from the model or the drawings, and each item says where its quantity came from.
2. No price without a source; every `assumed` price is an inquiry.
3. Re-run the take-off and the cost workbook after any design change (spacing, sections, ballast) - the KAC frames went 3.0 m to 2.0 m and the ballast changed twice in one day.
4. Check the builder's printed total against your own before reporting it.

## Scripting lessons

- PowerShell 5 reads a script without a UTF-8 BOM as ANSI: any Arabic in a `.ps1` breaks quotes. Save with a BOM.
- PowerShell variable names ignore case: a loop `$c` overwrites `$C`. Use distinct names.
- Excel COM: pass numbers as `[double]` and text as `[string]`; do the what-if sums in the spec script, not by poking Excel cells in a loop.

## Projects

- **DAS** (Dar Al Salam, advertising hoarding tender, 30 Oct 2026): `G:\My Drive\02_Tenders_Costing\DAS — ...\COST-DAS-FENCE Rev01 (مصدر الحساب).xlsx`, 5,380 m², 2,904,635 SAR incl. VAT.
- **KAC** (King Abdullah Humanitarian Foundation, site hoarding, 5 Nov 2026): `G:\My Drive\01_Projects\King Abdullah Center — SIC-004-MUM-MMH\03_Cost\`, 71.5 m x 2.5 m, NJ base and NJ ballast, 179,154 SAR incl. VAT (preliminary, supplier prices assumed). Rev03 (6 Nov 2026, final design: h 2.59, triangle frames, 108 NJ at the PO price): 106,188 SAR incl. VAT.
