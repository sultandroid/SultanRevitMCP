// Unit costs for the Materials total tab (user 12 Nov 2026: "in sheet materials total please add the cost").
// Odoo read only: product cost (standard_price) and the latest vendor price (product.supplierinfo) in purchase UOM.
import fs from "node:fs"; import { kw } from "./odoo.mjs";
const T = JSON.parse(fs.readFileSync("g_tot.json", "utf8")).slice(1);
const ids = T.map((r) => r[1]).filter(Boolean);
const pp = await kw("product.product", "read", [ids], { fields: ["standard_price", "uom_id", "uom_po_id", "product_tmpl_id", "currency_id"] });
const cur = (await kw("res.company", "search_read", [[]], { fields: ["currency_id"], limit: 1 }))[0].currency_id[1];
const sup = await kw("product.supplierinfo", "search_read", [[["product_tmpl_id", "in", pp.map((p) => p.product_tmpl_id[0])]]], { fields: ["product_tmpl_id", "price", "min_qty", "date_start", "partner_id", "product_uom"], order: "id desc" });
const out = {};
for (const p of pp) { const s = sup.find((x) => x.product_tmpl_id[0] === p.product_tmpl_id[0]);
  out[p.id] = { cost: p.standard_price, vendor: s ? s.price : null, vendorUom: s?.product_uom?.[1] ?? null, uom: p.uom_id[1], po: p.uom_po_id?.[1] }; }
fs.writeFileSync("costs.json", JSON.stringify({ currency: cur, prices: out }, null, 1));
console.log("currency", cur);
for (const r of T) { const c = out[r[1]]; console.log(String(r[1]).padEnd(6), (c ? `cost ${c.cost} vendor ${c.vendor} [${c.uom}${c.vendorUom ? " / " + c.vendorUom : ""}]` : "NEW").padEnd(60), r[3].slice(0, 55)); }
