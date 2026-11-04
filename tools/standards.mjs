// Applies standards/sultan-standards.json in Revit, so tools never hard-code a colour, weight, text size or scale.
// Usage: import { S, ensureStyles, colourByDiscipline, isoScale, sheetNumber } from "./standards.mjs";
//        node tools/standards.mjs styles            (adds every text type and line style to the active model)
//        node tools/standards.mjs coord <view id>   (colours a coordination view by discipline)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const S = JSON.parse(readFileSync(new URL("../standards/sultan-standards.json", import.meta.url), "utf8"));
const rgb = ([r, g, b]) => ({ r, g, b });

/** Every text type and line style of the standard, created or updated in the model. Returns their ids by name. */
export async function ensureStyles(call) {
  const ids = {};
  for (const t of S.text.types) ids[t.name] = (await call("ensure_text_type", { name: t.name, size_mm: t.size_mm, color: rgb(t.color), bold: !!t.bold })).id;
  for (const l of S.lines.styles) {
    const a = { name: l.name, weight: l.weight, color: rgb(l.color), ...(l.pattern ? { pattern: l.pattern } : {}) };
    ids[l.name] = (await call("ensure_line_style", a).catch(() => call("ensure_line_style", { name: l.name, weight: l.weight, color: rgb(l.color) }))).id;
  }
  return ids;
}

/** Colours one coordination view by discipline. Categories missing from the model are skipped. */
export async function colourByDiscipline(call, viewId) {
  const done = [];
  for (const [name, d] of Object.entries(S.coordination.disciplines)) {
    const r = await call("set_view_overrides", { view_id: viewId, categories: d.categories, ...(d.halftone ? { halftone: true } : { color: rgb(d.color) }) }).catch((e) => ({ error: e.message.slice(0, 80) }));
    done.push({ discipline: name, ...r });
  }
  return done;
}

/** The one-line colour key for a coordination sheet. */
export const colourKey = () => Object.entries(S.coordination.disciplines).map(([n, d]) => `${n[0].toUpperCase()}${n.slice(1)}: ${d.halftone ? "grey halftone" : `RGB ${d.color.join(" ")}`}`).join("   ");

/** Smallest ISO 5455 scale (1:n) at which `size_mm` fits in `space_mm`; with `fill`, the whole-number scale that fills it (house rule). */
export function isoScale(size_mm, space_mm, fill = false) {
  const need = size_mm / space_mm;
  if (fill) return Math.ceil(need);
  return S.scales.iso_5455.find((s) => s >= need) ?? S.scales.iso_5455[S.scales.iso_5455.length - 1];
}

/** ISO 19650 sheet number, e.g. sheetNumber("MD1", "GF", "A", 2101) -> "MD1-SF-ZZ-GF-DR-A-2101". */
export const sheetNumber = (project, level, role, number) => S.sheets.number_pattern.replace("{project}", project).replace("{level}", level).replace("{role}", role).replace("{number:4}", String(number).padStart(4, "0"));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { call } = await import("./rvt.mjs");
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "styles") console.log(JSON.stringify(await ensureStyles(call)));
  else if (cmd === "coord") console.log(JSON.stringify(await colourByDiscipline(call, Number(arg))), "\n" + colourKey());
  else console.log("usage: node tools/standards.mjs styles | coord <view id>");
}
