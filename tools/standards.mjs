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

/**
 * Colours coordination views. Precedence (sultan-standards.json coordination._note): 1 existing work grey halftone,
 * 2 reservations / gross envelopes transparent, 3 sub-discipline colour by category (each category in a discipline gets
 * its specific sub_colours[c].color and optional transparency, falling back to d.color). Filters 1-3 need the SF_ parameters
 * (ensurePhaseParameters); a model without them still gets sub-discipline colours and the result says which filters were skipped.
 * Never touches OST_RvtLinks: host filters and category overrides already reach links shown By Host View.
 */
export async function colourByDiscipline(call, viewIds) {
  const views = [viewIds].flat().map(Number), done = [];
  for (const [key, f] of Object.entries(S.coordination.filters)) {
    const r = await call("ensure_view_filter", { view_ids: views, name: f.name, parameter: f.parameter, rule: f.rule, value: f.value,
      ...(f.halftone ? { halftone: true } : {}), ...(f.color ? { color: rgb(f.color) } : {}), ...(f.transparency != null ? { transparency: f.transparency } : {}),
      ...(f.line_pattern ? { line_pattern: f.line_pattern } : {}) }).catch((e) => ({ skipped: e.message.slice(0, 100) }));
    done.push({ filter: key, ...r });
  }
  for (const [name, d] of Object.entries(S.coordination.disciplines)) {
    let changed = 0; const skipped = [];
    for (const view_id of views) for (const c of d.categories) {
      const sub = d.sub_colours?.[c];
      const col = Array.isArray(sub) ? sub : (sub?.color ?? d.color);
      const transparency = !Array.isArray(sub) && sub?.transparency != null ? sub.transparency : undefined;
      const r = await call("set_view_overrides", {
        view_id,
        categories: [c],
        color: rgb(col),
        ...(transparency != null ? { transparency } : {}),
      }).catch(() => null);
      if (r && r.changed) changed++; else skipped.push(c);
    }
    if (d.sub_filters) {
      for (const [fkey, sf] of Object.entries(d.sub_filters)) {
        const rf = await call("ensure_view_filter", {
          view_ids: views, name: sf.name, parameter: sf.parameter, rule: sf.rule, value: sf.value,
          ...(sf.categories ? { categories: sf.categories } : {}),
          ...(sf.color ? { color: rgb(sf.color) } : {}),
          ...(sf.transparency != null ? { transparency: sf.transparency } : {}),
          ...(sf.line_pattern ? { line_pattern: sf.line_pattern } : {}),
        }).catch((e) => ({ skipped: e.message.slice(0, 100) }));
        done.push({ sub_filter: `${name}.${fkey}`, ...rf });
      }
    }
    done.push({ discipline: name, changed, skipped: [...new Set(skipped)] });
  }
  return done;
}

/** Binds SF_PhaseStatus, SF_ExistingSource and SF_Maturity (fixed GUIDs) to every coordination category the model has. */
export async function ensurePhaseParameters(call) {
  const P = S.phases, all = [...new Set(Object.values(S.coordination.disciplines).flatMap((d) => d.categories))];
  const parameters = [P.status_parameter, P.verification_parameter, P.maturity_parameter].map((x) => ({ name: x.name, guid: x.guid }));
  const results = [];
  for (const c of all) results.push({ c, r: await call("bind_shared_parameters", { parameters, categories: [c], expand_categories: true }).catch((e) => ({ error: e.message.slice(0, 80) })) });
  return { bound: results.filter((x) => !x.r.error).map((x) => x.c), skipped: results.filter((x) => x.r.error).map((x) => `${x.c}: ${x.r.error}`) };
}

/** The colour key line for a coordination sheet (discipline summary). */
export const colourKey = () => [
  "Existing: grey halftone", "Reservation: transparent, dashed",
  ...Object.entries(S.coordination.disciplines).map(([n, d]) => `${d.code} ${n.replace(/_/g, " ")}: RGB ${d.color.join(" ")}`)].join("   ");

/** Detailed sub-discipline colour key (all disciplines, or filtered by discipline code/name). */
export const subColourKey = (filterDiscipline) => {
  const lines = [];
  for (const [name, d] of Object.entries(S.coordination.disciplines)) {
    if (filterDiscipline && d.code !== filterDiscipline && name !== filterDiscipline) continue;
    const subs = Object.entries(d.sub_colours ?? {}).map(([cat, sc]) => {
      const col = Array.isArray(sc) ? sc : sc.color;
      const lbl = Array.isArray(sc) ? cat.replace(/^OST_/, "") : (sc.label ?? cat.replace(/^OST_/, ""));
      return `${lbl}: RGB ${col.join(" ")}`;
    });
    lines.push(`${d.code} ${name.replace(/_/g, " ")} -> ` + subs.join(" | "));
  }
  return lines.join("\n");
};

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
  else if (cmd === "coord") console.log(JSON.stringify(await colourByDiscipline(call, arg.split(",").map(Number))), "\n" + colourKey());
  else if (cmd === "sub-colours") console.log(subColourKey(arg));
  else if (cmd === "phase-params") console.log(JSON.stringify(await ensurePhaseParameters(call)));
  else console.log("usage: node tools/standards.mjs styles | coord <view id[,view id...]> | sub-colours [code] | phase-params");
}
