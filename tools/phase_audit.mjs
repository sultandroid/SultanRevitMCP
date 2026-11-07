// Phase audit, read-only. Checks a model against the phase rules in standards/sultan-standards.json (phases) and
// skills/samaya-revit/references/phases.md.
//   node tools/phase_audit.mjs "<full path to model.rvt>" [--ext] [--out report.json]
// --ext: the model is an existing-condition (EXT) model, so every element must be on phase Existing.
// Opens the model if it is not open and closes it again afterwards (close only what you opened). Never saves.
import { writeFileSync } from "node:fs";
import { call as raw } from "./rvt.mjs";
import { S } from "./standards.mjs";

const args = process.argv.slice(2), path = args.find((a) => !a.startsWith("--") && !/\.json$/i.test(a));
const ext = args.includes("--ext"), outIx = args.indexOf("--out"), out = outIx >= 0 ? args[outIx + 1] : null;
if (!path) { console.log('usage: node tools/phase_audit.mjs "<model.rvt>" [--ext] [--out report.json]'); process.exit(1); }
const call = (c, p = {}) => raw(c, { document: path, ...p });
const P = S.phases, ST = P.status_parameter.name, SRC = P.verification_parameter.name, MAT = P.maturity_parameter.name;
const cats = [...new Set(Object.values(S.coordination.disciplines).flatMap((d) => d.categories))];

const opened = !(await raw("list_documents", {})).documents.some((d) => d.path?.toLowerCase() === path.toLowerCase());
if (opened) await raw("open_document", { path, activate: false });
const report = { model: path, ext, checked_at: new Date().toISOString(), elements: 0, by_phase: {}, issues: [], views: { checked: 0, no_phase_filter: [] }, parameters_bound: {} };
const issue = (kind, e, detail) => report.issues.push({ kind, id: e.id, category: e.category, name: e.name, detail });
try {
  for (const c of cats) {
    let q; try { q = await call("query_elements", { category: c.replace(/^OST_/, ""), limit: 5000 }); } catch { try { q = await call("query_elements", { category: c, limit: 5000 }); } catch { continue; } }
    for (const it of q.elements || []) {
      const e = await call("get_element", { element_id: it.id }), p = Object.fromEntries(e.parameters.map((x) => [x.name, x.value]));
      report.elements++;
      const created = p["Phase Created"], demolished = p["Phase Demolished"], status = p[ST], source = p[SRC];
      for (const k of [ST, SRC, MAT]) if (k in p) report.parameters_bound[k] = true;
      report.by_phase[created ?? "none"] = (report.by_phase[created ?? "none"] || 0) + 1;
      const el = { id: e.id, category: e.category, name: e.name };
      if (!created) { issue("no_phase", el, "Phase Created is empty"); continue; }
      if (ext && created !== P.names[0]) issue("ext_not_existing", el, `EXT model element on ${created}`);
      if (created === P.names[0]) {
        if (!(ST in p)) { if (!report.parameters_bound[ST]) issue("status_parameter_missing", el, `${ST} not bound`); }
        else if (!status) issue("existing_without_status", el, `${ST} empty`);
        else if (!/^Existing|^Temporary/.test(status)) issue("status_phase_mismatch", el, `Existing element with ${ST}=${status}`);
        if (SRC in p && !source) issue("existing_without_source", el, `${SRC} empty (Survey / Site-Verified / Record-Drawing / Assumed)`);
        if (/Remove|Relocate/.test(status || "") && !demolished) issue("status_phase_mismatch", el, `${status} but Phase Demolished is empty`);
        if (/Retain/.test(status || "") && demolished) issue("status_phase_mismatch", el, `Existing-Retain but demolished in ${demolished}`);
      } else {
        if (status && /^Existing/.test(status)) issue("status_phase_mismatch", el, `${created} element with ${ST}=${status}`);
        if (demolished && created === demolished) issue("created_and_demolished_same_phase", el, created);
      }
    }
  }
  const vs = await call("list_views", {}); const views = vs.views || vs;
  for (const v of views) {
    const type = v.type || v.view_type || "";
    if (v.is_template || !/Plan|ThreeD|Section|Elevation/i.test(type)) continue;
    const e = await call("get_element", { element_id: v.id }), p = Object.fromEntries(e.parameters.map((x) => [x.name, x.value]));
    report.views.checked++;
    if (!p["Phase Filter"] || p["Phase Filter"] === "None") report.views.no_phase_filter.push(`${v.id} ${v.name}`);
  }
} finally {
  if (opened) await raw("close_document", { title: path.split(/[\\/]/).pop().replace(/\.rvt$/i, ""), save: false }).catch((e) => report.close_note = e.message);
}
const kinds = {}; for (const i of report.issues) kinds[i.kind] = (kinds[i.kind] || 0) + 1;
report.summary = { elements: report.elements, by_phase: report.by_phase, issues: kinds, views_without_phase_filter: report.views.no_phase_filter.length, sf_parameters_bound: Object.keys(report.parameters_bound) };
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary));
