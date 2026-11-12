// Materials total tab, full rows A:J (user 12 Nov 2026: cost, then "round up the qty as per unit we buy, I can't buy .25 of a
// sheet"): net qty (incl. 10% waste) -> buy qty rounded UP to the purchase unit (whole sheets, bars, units, m, m2; m3 to 0.01)
// as a formula, unit cost from Odoo (product cost, else vendor price, SAR), cost = buy qty x unit cost (formula).
import fs from "node:fs";
const T = JSON.parse(fs.readFileSync("g_tot.json", "utf8")).slice(1), C = JSON.parse(fs.readFileSync("costs.json", "utf8")).prices;
const head = ["Component status", "Odoo id", "Component code", "Component", "Net qty (incl. 10% waste)", "Buy qty (purchase unit)", "UOM", "Unit cost (SAR)", "Cost (SAR, buy qty)", "Price source"];
const rows = T.map((r, i) => { const n = i + 2, c = C[r[1]];
  const price = c ? (c.cost > 0 ? +c.cost.toFixed(2) : c.vendor > 0 ? c.vendor : "") : "";
  const src = !c ? "NEW item - price to confirm" : c.cost > 0 ? "Odoo product cost" : c.vendor > 0 ? "Odoo vendor price" : "no price in Odoo - confirm";
  return [r[0], r[1], r[2], r[3], r[4], `=IF(G${n}="m³",ROUNDUP(E${n},2),ROUNDUP(E${n},0))`, r[5], price, `=IF(H${n}="","",F${n}*H${n})`, src]; });
const last = T.length + 1;
const total = ["", "", "", "MATERIAL COST - buy quantities (whole purchase units), excl. VAT (SAR)", "", "", "", "TOTAL (priced lines)", `=SUM(I2:I${last})`, `=COUNTIF(H2:H${last},"")&" lines without a price"`];
fs.writeFileSync("g_mat.json", JSON.stringify({ head, rows, total, totalRow: last + 2 }));
console.log(JSON.stringify([head, ...rows]), "TOTALROW", last + 2);
