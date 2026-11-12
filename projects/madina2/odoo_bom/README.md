# Madina 2 Odoo BOM (standard products)

Google Sheet: "Madina 2 - Odoo MO BOM (standard products)" (Drive id 1QYOt0vMbp_3IWObH-z9tBoZqQbOSiyjtFQxPX2oFT8E).
First built 11 Nov 2026 in another session (scratchpad), moved here and updated 12 Nov 2026.

Run in this folder, Revit open with Madina2_ARCH_01 (npm i once):
1. `node units.mjs units.json` - every Madina2 family, its parts (material + size) and count
2. `node assign.mjs` - which fascia / back panel belongs to which arch (arch assemblies)
3. `node bom.mjs` - BOM per item in Odoo purchase UOM (+10% waste), Odoo ids (read only), xlsx copy in Madina 2/Odoo BOM
4. `node gsheet.mjs` - rows for the Sheet tabs (g_*.json); old_products.json keeps the Products row order so the photos stay
5. write g_*.json to the Sheet (Products A:F, BOMs, BOM lines, Materials total); never touch Products G:H (photos)

odoo.mjs reads the Odoo key from the local access file (never committed, never printed). Nothing is created in Odoo.
Rules: standard products (no project in the name), code JN-<type>-<W>x<D>x<H>-<material> in cm; steel parts that are all
"Steel Painted Black" are told apart by shape (SHS, rods, flat bars, angles, mesh) in bom.mjs rule().
6. `node costs.mjs` then `node gcost.mjs` - unit costs from Odoo (product cost, else vendor price, SAR) for Materials total G:I, cost = qty x unit as a formula, total row 2 below the last line; blank = price to confirm
