// Madina 2: every Mark becomes the item's name (user, 12 Nov 2026: "mark names should refer to the item name, not just codes").
// Old code -> new name; the map is kept in marks_map.json so sheets, BOM and fab_config can follow.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import fs from "node:fs";
const D = { document: "Madina2_ARCH_01" };
const before = JSON.parse(fs.readFileSync("projects/madina2/marks_before.json", "utf8"));
const fix = { "AR-1": "East Arch 1", "AR-2": "East Arch 2", "AR-3": "East Arch 3", "AW-A-1": "West Arch A1", "AW-A-2": "West Arch A2", "AW-B": "West Arch B",
  "RA-A-1": "Rear Arch A1", "RA-A-2": "Rear Arch A2", "RA-B": "Rear Arch B", "RA-B-BL": "Rear Arch B Back Sides",
  "AB-AW-A-1": "West Arch Back Panel A1", "AB-AW-A-2": "West Arch Back Panel A2", "AB-AW-B": "West Arch Back Panel B", "AB-RA-A-1": "Rear Arch Back Panel A1", "AB-RA-A-2": "Rear Arch Back Panel A2",
  "BC-A-1": "Base Cabinet A1", "BC-A-2": "Base Cabinet A2", "BC-C-1": "Base Cabinet C1", "BC-C-2": "Base Cabinet C2", "BC-D-1": "Base Cabinet D1",
  "BK-E": "East Back Cladding", "CC-P": "Column Pegboard Cladding", "CF-1": "Ceiling Wood Frame", "TF-1": "Tray Wood Frame", "CH-1": "Carpet Hanger",
  "CL": "Front Filler", "FL-A": "Rear Corner Filler", "D-01": "Island Display", "D-02": "Cashier Counter", "D-02-F": "Cashier Display Fridge",
  "E-C1": "East Back Counter", "ES-1": "East Shelf", "FS-1": "Services Cabinet", "HG-E": "East Arch Hangers", "ST-E": "East Steel Frame",
  "OS-A-1": "Open Shelf A1", "OS-A-2": "Open Shelf A2", "OS-B": "Open Shelf B", "OS-C-1": "Open Shelf C1", "OS-C-2": "Open Shelf C2",
  "OS-E": "East Pegboard 1", "OS-D-1-PB": "East Pegboard 2", "OS-D-2-PB": "East Pegboard 3",
  "OSB-1": "Open Base Unit 1", "OSB-2": "Open Base Unit 2", "OSB-3": "Open Base Unit 3", "OSB-T": "Open Base Unit Top",
  "SC-A-1": "Spandrel Cladding A1", "SC-A-2": "Spandrel Cladding A2", "SC-B-1": "Spandrel Cladding B1", "SC-B-2": "Spandrel Cladding B2",
  "SC-C": "Spandrel Cladding C", "SC-D": "Spandrel Cladding D", "SC-E": "Spandrel Cladding E", "SC-F": "Spandrel Cladding F", "SC-G": "Spandrel Cladding G" };
// L fascias: LF-<wall>-<n>-<part>
const wall = { A: "East", B: "West", C: "Rear Centre", D: "Rear", E: "West End" }, part = { M: "Marble", S: "Soffit", F: "Front" };
for (const m of Object.keys(before)) { const r = m.match(/^LF-([A-E])(?:-(\d))?-([MSF])$/); if (r) fix[m] = `${wall[r[1]]} Fascia${r[2] ? " " + r[2] : ""} ${part[r[3]]}`; }
const map = {}, missing = [];
for (const [m, list] of Object.entries(before)) { if (/^Oak Joint Strip/.test(m)) continue; const n = fix[m]; if (!n) { missing.push(m); continue; } map[m] = n;
  for (const [id] of list) await call("set_parameter", { ...D, element_id: id, parameter_name: "Mark", value: n }); }
fs.writeFileSync("projects/madina2/marks_map.json", JSON.stringify(map, null, 1));
console.log("renamed", Object.keys(map).length, "missing", missing.join(", ") || "none");
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-30));
