// Sheet groups for any Samaya Factory model (general, every project).
// Usage: node tools/sheet_groups.mjs "<model title>" [--dry]
// 1. Adds the "Sheet Group" project parameter to sheets if the model lacks it.
// 2. Sets every sheet's group from its ISO 19650 number (role letter + number series, see views-and-sheets.md).
//    A fabrication sheet (A-2000 to A-2999) keeps an existing "2 Fab: <item>" group; without one it gets "2 Fab".
// 3. Reports whether the Project Browser groups sheets by "Sheet Group". The API cannot create that rule:
//    the user sets it once per model (or once in the template, so new projects inherit it).
import { call, useDocument } from "./rvt.mjs";

const [title, flag] = process.argv.slice(2);
if (!title) { console.log('Usage: node tools/sheet_groups.mjs "<model title>" [--dry]'); process.exit(1); }
const dry = flag === "--dry";
useDocument(title);

// Group from the short code, e.g. "A-1002" -> "1 Arch GA". Order of the groups = order of the set.
export function groupFor(code, existing = "") {
  const m = /([A-Z])-(\d{4})$/.exec(code);
  if (!m) return null;
  const [, role, digits] = m, n = Number(digits);
  if (role === "A") {
    if (n < 1000) return "0 General";
    if (n < 2000) return "1 Arch GA";
    if (n < 3000) return /^2 Fab/.test(existing) ? existing : "2 Fab";
    return "1 Arch GA";
  }
  return { E: "3 Electrical", M: "4 Mechanical", P: "4 Plumbing", Z: "5 Coordination", S: "6 Structural" }[role] ?? null;
}

if (!dry) await call("ensure_project_parameters", { category: "OST_Sheets", parameters: [{ name: "Sheet Group" }] }).catch((e) => console.log("param:", e.message));
const sheets = (await call("query_elements", { category: "OST_Sheets", limit: 1000 })).elements;
const rows = [];
for (const s of sheets) {
  const el = await call("get_element", { element_id: s.id });
  const val = (n) => el.parameters?.find((p) => p.name === n)?.value ?? "";
  const number = val("Sheet Number"), current = val("Sheet Group");
  const group = groupFor(number, current);
  let status = "ok";
  if (!group) status = "UNKNOWN NUMBER (not ISO): set by hand";
  else if (group !== current) {
    status = dry ? `would set (was "${current}")` : `set (was "${current}")`;
    if (!dry) await call("set_parameter", { element_id: s.id, parameter_name: "Sheet Group", value: group });
  }
  rows.push([number, s.name, group ?? "-", status]);
}
rows.sort((a, b) => a[0].localeCompare(b[0]));
for (const r of rows) console.log(r.join("  |  "));
const b = await call("sheet_browser_info", {});
console.log(`\nProject Browser (sheets): "${b.organisation}", folders: ${b.folders.map((f) => f.parameter).join(" > ") || "none"}`);
if (!b.groups_by_sheet_group) console.log(
  "ACTION FOR THE USER (once per model; the API cannot do it): Project Browser > right-click Sheets (all) > Browser Organization > New \"Samaya Sheet Groups\" > Folders: Sheet Group > Sorting: Sheet Number ascending > select it and OK.");
if (!dry && rows.some((r) => r[3].startsWith("set"))) console.log(JSON.stringify(await call("save_document", { title })).slice(-30));
