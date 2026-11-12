// New revision for the mark-name change, added to every sheet whose text or name changed (keeps the revisions already on it).
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import fs from "node:fs";
const D = { document: "Madina2_ARCH_01" };
const all0 = (await call("list_revisions", D)).revisions;
const m = { id: all0.find((r) => /codes to item names/.test(r.description)).id }; // made on the first run
const all = (await call("list_revisions", D)).revisions, byNo = Object.fromEntries(all.map((r) => [r.number, r.id]));
const names = new Set(["Arch Set-Out - Keel Arch", "Arch Study - Elevations", "Base Cabinet Arrangement", "Coordinated Ceiling Plan", "Reflected Ceiling Plan",
  "East Wall Section", "Front Wall Section", "Rear Wall Section", "West Wall Section"]);
const renamed = JSON.parse(fs.readFileSync(new URL("./rename_sheet_names.mjs", import.meta.url), "utf8").match(/const N = (\{[\s\S]*?\});/)[1].replace(/(\d+):/g, '"$1":'));
const sheets = (await call("query_elements", { ...D, category: "OST_Sheets", limit: 300 })).elements.filter((e) => names.has(e.name) || renamed[e.id]);
for (const s of sheets) {
  // the live bridge cannot read a sheet's own revisions, so a cloud round the drawing title adds this one and keeps the rest
  await call("create_revision_cloud", { ...D, view_id: s.id, revision_id: m.id, comments: "Mark and sheet names: codes to item names", points: [{ x: 1020, y: 190 }, { x: 1182, y: 190 }, { x: 1182, y: 240 }, { x: 1020, y: 240 }] });
}
const c = JSON.parse(fs.readFileSync("projects/madina2/fab_config.json", "utf8"));
c.bom.revisions = [...new Set([...c.bom.revisions, m.id])];
for (const u of Object.values(c.units)) if (u.revisions) u.revisions = [...new Set([...u.revisions, m.id])];
fs.writeFileSync("projects/madina2/fab_config.json", JSON.stringify(c, null, 2));
console.log("rev", m.id, all.find((x) => x.id === m.id)?.number, "sheets", sheets.length);
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-40));
