// Finds a project's order folder in Samaya/Orders/<year> by the store's Arabic name, so every fabrication package goes to the
// right order (user, 6 Nov 2026: "add the package to each folder in samaya\orders\2026, find project folder name in arabic").
// The map is the project -> words of its Arabic folder name; the order number is not needed (it is read from the folder).
// Usage: import { orderFolder } from "./order_folder.mjs"; orderFolder("Makkah") -> ".../Orders/2026/040 متجر مكة المكرمة"
//        node tools/order_folder.mjs [project]   (lists the map and what each name finds)
import { readdirSync, existsSync } from "node:fs";

export const ORDERS_ROOT = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Orders";
// Arabic words that must all appear in the order folder name (KEC mall stores, Nov 2026).
export const PROJECTS = {
  "Madina 1": ["متجر", "المدينة", "1"],
  "Madina 2": ["متجر", "المدينة", "2"],
  "Makkah": ["متجر", "مكة"],
  "Qahwatina": ["قهوتنا"],
};
const norm = (s) => s.normalize("NFC").replace(/[\u064B-\u065F]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه");

/** The order folder of a project (newest year first). Throws when none or more than one matches. */
export function orderFolder(project, year = null) {
  const words = PROJECTS[project]; if (!words) throw new Error(`no Arabic name for "${project}" in tools/order_folder.mjs`);
  const years = year ? [String(year)] : readdirSync(ORDERS_ROOT).filter((y) => /^\d{4}$/.test(y)).sort().reverse();
  for (const y of years) {
    const root = `${ORDERS_ROOT}/${y}`; if (!existsSync(root)) continue;
    const hits = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && words.every((w) => norm(d.name).split(/\s+/).some((t) => t === norm(w) || (w.length > 2 && t.includes(norm(w))))));
    if (hits.length > 1) throw new Error(`${project}: more than one order folder in ${y}: ${hits.map((h) => h.name).join(" | ")}`);
    if (hits.length === 1) return `${root}/${hits[0].name}`;
  }
  throw new Error(`${project}: no order folder found under ${ORDERS_ROOT}`);
}

/** The fabrication package folder inside the order folder (factory standard name). */
export const packageFolder = (project, year) => `${orderFolder(project, year)}/Final Fabrications Drawings`;

if (process.argv[1]?.endsWith("order_folder.mjs")) {
  for (const p of process.argv[2] ? [process.argv[2]] : Object.keys(PROJECTS)) {
    try { const f = orderFolder(p); console.log(p.padEnd(10), "->", f.split("/").pop(), existsSync(`${f}/Final Fabrications Drawings`) ? "(package: yes)" : "(package: none yet)"); }
    catch (e) { console.log(p.padEnd(10), "!", e.message); }
  }
}
