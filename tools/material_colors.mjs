// Check / fix the "different materials, different colours" rule (user, 12 Nov 2026) on a whole model.
// Usage: node tools/material_colors.mjs <document title> [--apply] [--all]
//   default: only materials used by family instances (Casework, Generic Models, Furniture, Specialty Equipment);
//   --all: every material in the model; --apply: move the clashing colours (otherwise report only).
import { call } from "./rvt.mjs";
import { readColors, enforceColors, APPROVED } from "./matcolor_lib.mjs";
import { MIN_DIST } from "../revit-mcp/client/materialColors.mjs";

const [doc, ...flags] = process.argv.slice(2);
if (!doc) throw new Error("usage: node tools/material_colors.mjs <document> [--apply] [--all]");
const all = await readColors(doc);
let names = [...all.keys()];
if (!flags.includes("--all")) {
  const used = new Set(), seen = new Set();
  for (const c of ["OST_Casework", "OST_GenericModel", "OST_Furniture", "OST_SpecialityEquipment"]) {
    for (const e of (await call("query_elements", { document: doc, category: c, limit: 1000 })).elements) {
      if (!e.family || seen.has(e.family)) continue; seen.add(e.family);
      const f = await call("inspect_family", { document: doc, element_id: e.id }).catch(() => null);
      for (const it of f?.items ?? []) if (it.material) used.add(it.material);
    }
  }
  names = names.filter((n) => used.has(n));
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pairs = [];
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (dist(all.get(names[i]).rgb, all.get(names[j]).rgb) < MIN_DIST) pairs.push([names[i], names[j]]);
console.log(`${names.length} materials checked, ${pairs.length} clashing pairs`);
for (const [a, b] of pairs) console.log(`  ${a} [${all.get(a).rgb}]  ~  ${b} [${all.get(b).rgb}]${APPROVED.test(a) && APPROVED.test(b) ? "  (both approved)" : ""}`);
for (const ch of await enforceColors(doc, names, all, flags.includes("--apply"))) console.log(flags.includes("--apply") ? "  fixed" : "  would fix", ch.name, ch.from ? `[${ch.from}] -> [${ch.to}]` : ch.note);
