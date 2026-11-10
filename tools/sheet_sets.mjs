// Saved sheet sets for export and print, from the sheet packages (every project).
// Usage: node tools/sheet_sets.mjs "<model title>"   (run tools/sheet_groups.mjs first)
// Makes, in the model: "<CODE> 00 ALL", one set per Sheet Package ("<CODE> 02 FAB"), and one per fabrication item group
// ("<CODE> 02 FAB - Arch Units"). Revit's Export PDF / DWG and Print dialogs list them under "Selected views/sheets".
import { call, useDocument } from "./rvt.mjs";

const [title] = process.argv.slice(2);
if (!title) { console.log('Usage: node tools/sheet_sets.mjs "<model title>"'); process.exit(1); }
useDocument(title);
const sheets = (await call("query_elements", { category: "OST_Sheets", limit: 1000 })).elements;
const rows = [];
for (const s of sheets) {
  const el = await call("get_element", { element_id: s.id });
  const v = (n) => el.parameters?.find((p) => p.name === n)?.value ?? "";
  rows.push({ id: s.id, no: v("Sheet Number"), pkg: v("Sheet Package"), grp: v("Sheet Group") });
}
const code = rows[0]?.no.split("-")[0] ?? "SET";
const sets = new Map([[`${code} 00 ALL`, rows]]);
const add = (k, r) => { if (!sets.has(k)) sets.set(k, []); sets.get(k).push(r); };
for (const r of rows) {
  if (!r.pkg) { console.log("no package:", r.no, "(run sheet_groups.mjs)"); continue; }
  add(`${code} ${r.pkg}`, r);
  const item = /^2 Fab: (.+)$/.exec(r.grp)?.[1];
  if (item) add(`${code} ${r.pkg} - ${item}`, r);
}
for (const [name, rs] of [...sets].sort((a, b) => a[0].localeCompare(b[0]))) {
  const res = await call("save_sheet_set", { name, sheet_ids: rs.map((r) => r.id) });
  console.log(name.padEnd(36), res.sheets, "sheets", rs.map((r) => r.no.slice(-6)).sort().join(" "));
}
console.log(JSON.stringify(await call("save_document", { title })).slice(-30));
