// RULE (user, 12 Nov 2026): "different materials different colors - this is a rule in modelling".
// Reads the shading colours of materials in the model and moves any material that clashes (RGB distance < MIN_DIST) with
// another one in the same set. Materials named with an approved colour code (EGGER H/U/F/W codes, RAL) keep their colour:
// it IS the approved colour; a clash between two approved ones is only reported.
// Used by fab_sheet.mjs for every unit, and by tools/material_colors.mjs for a whole model.
import { call } from "./rvt.mjs";
import { distinctColor, MIN_DIST } from "../revit-mcp/client/materialColors.mjs";

export const APPROVED = /\b([HUFW]\d{3,4}|RAL ?\d{4})\b/;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const unpack = (v) => { const n = Number(v); return [n & 255, (n >> 8) & 255, (n >> 16) & 255]; };   // Revit Color as integer

/** name -> {id, rgb} for every material in the model. */
export async function readColors(doc) {
  const out = new Map();
  for (const e of (await call("query_elements", { document: doc, category: "OST_Materials", limit: 1000 })).elements) {
    const g = await call("get_element", { document: doc, element_id: e.id });
    const c = g.parameters.find((p) => p.name === "Color")?.value;
    if (c != null) out.set(e.name, { id: e.id, rgb: unpack(c) });
  }
  return out;
}

/** Make the materials in `names` (and against all of `all`, a readColors map) distinct. Returns the changes. */
export async function enforceColors(doc, names, all = null, apply = true) {
  all ??= await readColors(doc);
  const set = [...new Set(names)].filter((n) => all.has(n));
  // approved first (they never move), then the rest in a stable order
  set.sort((a, b) => (APPROVED.test(b) - APPROVED.test(a)) || a.localeCompare(b));
  const fixed = [], changes = [];
  for (const n of set) {
    const cur = all.get(n).rgb, clash = fixed.find((f) => dist(all.get(f).rgb, cur) < MIN_DIST);
    if (clash && APPROVED.test(n)) { changes.push({ name: n, clash, note: "both approved colours: check with the designer" }); fixed.push(n); continue; }
    if (clash) {
      const taken = fixed.map((f) => all.get(f).rgb);
      const c = distinctColor(n, { r: cur[0], g: cur[1], b: cur[2] }, taken);
      if (c.r === cur[0] && c.g === cur[1] && c.b === cur[2]) { changes.push({ name: n, clash, note: "no free colour found: check by hand" }); fixed.push(n); continue; }
      if (apply) await call("ensure_material", { document: doc, name: n, color: c, exact_color: true });
      all.get(n).rgb = [c.r, c.g, c.b];
      changes.push({ name: n, clash, from: cur, to: [c.r, c.g, c.b] });
    } else distinctColor(n, { r: cur[0], g: cur[1], b: cur[2] }, fixed.map((f) => all.get(f).rgb)); // register as is
    fixed.push(n);
  }
  return changes;
}
