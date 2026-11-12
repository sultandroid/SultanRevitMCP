// Google Sheet layout of the Madina 2 Odoo BOM ("Madina 2 - Odoo MO BOM (standard products)",
// 1QYOt0vMbp_3IWObH-z9tBoZqQbOSiyjtFQxPX2oFT8E) from items.json + lines.json (bom.mjs). Writes g_*.json: the rows for the
// tabs Products, BOMs, BOM lines, Materials total. Products keep the order already in the sheet (old_products.json, the
// codes in column A) so the photos in columns G/H stay on their rows; new products go at the end; a product no longer in
// the model stays with "REMOVED" so nothing below it moves.
import fs from "node:fs"; import { kw } from "./odoo.mjs";
const items = JSON.parse(fs.readFileSync("items.json", "utf8")), lines = JSON.parse(fs.readFileSync("lines.json", "utf8"));
const old = fs.existsSync("old_products.json") ? JSON.parse(fs.readFileSync("old_products.json", "utf8")) : [];
const pcodeOf = (code) => code.replace(/-\d+x\d+x\d+/, "");
const cats = Object.fromEntries((await kw("product.category", "read", [[...new Set(items.map((i) => i.categ))]], { fields: ["complete_name"] })).map((c) => [c.id, c.complete_name]));
const prods = new Map();
for (const it of items) { const pc = pcodeOf(it.code); const p = prods.get(pc) ?? { pc, name: it.odooName.replace(/ - \d+ x \d+ x \d+ cm$/, ""), categ: cats[it.categ] ?? it.categ, n: 0 }; p.n++; prods.set(pc, p); }
for (const p of prods.values()) { const r = await kw("product.template", "search_read", [[["default_code", "=", p.pc]]], { fields: ["id"], limit: 1 }); p.inOdoo = r.length ? "Exists #" + r[0].id : "NEW"; }
const order = [...old, ...[...prods.keys()].filter((k) => !old.includes(k))];
const P = [["Product code", "Odoo product name (same in Arabic and English)", "Odoo category (existing)", "Route (Operations)", "BOMs (sizes)", "In Odoo", "Photo (from the model)"]];
order.forEach((pc, i) => { const p = prods.get(pc), r = i + 2;
  P.push(p ? [pc, p.name, p.categ, "Manufacture", `=COUNTIF(BOMs!B:B,A${r})`, p.inOdoo, `${pc}.png`] : [pc, "", "", "", `=COUNTIF(BOMs!B:B,A${r})`, "REMOVED - not in the model (12 Nov 2026)", ""]); });
const B = [["BOM reference", "Product code", "Size (W x D x H) - goes in the MO description", "Qty (Madina 2)", "Madina 2 marks (parts inside)", "Weight (kg, approx.)", "Volume (m3, overall)"],
  ...items.map((i) => [i.code, pcodeOf(i.code), i.size, i.qty, i.marksTxt, i.weight, i.volume])];
const L = [["BOM reference", "Component status", "Odoo id", "Component code", "Component", "Qty per unit", "UOM", "Qty x units", "Note"],
  ...lines.map((l) => [l.code, l.status, l.id, l.ccode, l.cname, l.qty, l.uom, l.total, l.note])];
const tot = new Map(); for (const l of lines) { const t = tot.get(l.cname) ?? { ...l, total: 0 }; t.total += l.total; tot.set(l.cname, t); }
const T = [["Component status", "Odoo id", "Component code", "Component", "Total qty (project)", "UOM"],
  ...[...tot.values()].sort((a, b) => a.status.localeCompare(b.status) || a.cname.localeCompare(b.cname)).map((t) => [t.status, t.id, t.ccode, t.cname, +t.total.toFixed(4), t.uom])];
for (const [f, v] of [["g_products.json", P], ["g_boms.json", B], ["g_lines.json", L], ["g_tot.json", T]]) fs.writeFileSync(f, JSON.stringify(v));
console.log("products", P.length - 1, "(new:", order.filter((k) => !old.includes(k)).join(", ") || "none", "; removed:", old.filter((k) => !prods.has(k)).join(", ") || "none", ") boms", B.length - 1, "lines", L.length - 1, "components", T.length - 1);
