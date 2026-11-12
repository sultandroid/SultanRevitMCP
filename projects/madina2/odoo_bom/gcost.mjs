// Rows G:I for the Materials total tab: unit cost (SAR, Odoo product cost, else latest vendor price), cost = qty x unit
// (formula, so a price typed in later updates it), price source. Blank price = not in Odoo / no price: fill by hand.
import fs from "node:fs";
const T = JSON.parse(fs.readFileSync("g_tot.json", "utf8")).slice(1), C = JSON.parse(fs.readFileSync("costs.json", "utf8")).prices;
const rows = T.map((r, i) => { const n = i + 2, c = C[r[1]];
  const price = c ? (c.cost > 0 ? +c.cost.toFixed(2) : c.vendor > 0 ? c.vendor : "") : "";
  const src = !c ? "NEW item - price to confirm" : c.cost > 0 ? "Odoo product cost" : c.vendor > 0 ? "Odoo vendor price" : "no price in Odoo - confirm";
  return [price, `=IF(G${n}="","",E${n}*G${n})`, src]; });
const last = T.length + 1;
fs.writeFileSync("g_cost.json", JSON.stringify({ head: [["Unit cost (SAR)", "Cost (SAR)", "Price source"]], rows, total: [["TOTAL (priced lines)", `=SUM(H2:H${last})`, `=COUNTIF(G2:G${last},"")&" lines without a price"`]], totalRow: last + 2 }));
console.log(JSON.stringify(rows), last + 2);
