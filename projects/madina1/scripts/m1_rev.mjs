import { call } from "./rvt.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const S = JSON.parse(readFileSync("dwg/sheets.json", "utf8"));
const i = await call("get_project_info"); if (i.title !== "Madina1_ARCH_02") throw new Error(i.title);
if (!S.rev04) {
  const r = await call("create_revision", { date: "03 Nov 2026", description: "Arches changed to keel arch, marble fascia from +2.330", issued_by: "Samaya Factory", issued_to: "Insignia Design Group" });
  S.rev04 = r.id; writeFileSync("dwg/sheets.json", JSON.stringify(S)); console.log("revision", r.id, "number", r.number);
}
const all = (await call("query_elements", { category: "OST_Sheets", limit: 1000 })).elements;
const ids = [];
for (const e of all) { const g = await call("get_element", { element_id: e.id }); const no = g.parameters.find((q) => q.name === "Sheet Number")?.value ?? ""; if (/A-(2100|2101|2102|2106)$/.test(no)) ids.push(e.id); }
console.log(JSON.stringify(await call("set_sheet_revisions", { sheet_ids: ids, revision_ids: [S.rev, S.rev04] })));
