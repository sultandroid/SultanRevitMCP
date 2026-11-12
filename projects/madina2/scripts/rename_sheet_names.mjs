// Madina 2: sheet names as item names, no unit codes (user, 12 Nov 2026: "rename all").
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" };
const N = { 646360: "Open Shelf A", 647233: "Open Shelf B", 648069: "Open Shelf C", 650626: "Bay Divider A", 654684: "Front Pier Cladding",
  683090: "West Arch A", 683849: "West Arch B", 684597: "Rear Arch A", 695287: "Tray Wood Frame", 714264: "Spandrel Cladding A",
  715791: "Spandrel Cladding C", 721756: "Wall Cladding", 755814: "Base Cabinet A", 756875: "Base Cabinet C", 757801: "Base Cabinet D",
  759580: "Island Display", 761126: "East Back Counter", 771269: "Bay Divider B", 789786: "East Arch", 796852: "Spandrel Cladding D",
  797666: "Spandrel Cladding E", 798480: "Spandrel Cladding F", 801122: "East Pegboards 2 and 3", 802029: "East Pegboard 1",
  804371: "Spandrel Cladding B", 805174: "Spandrel Cladding G", 1107543: "Rear Arch B", 1116136: "East Fascia",
  1117020: "West Fascia", 1117890: "Rear Centre Fascia", 1118756: "Rear Fascia", 1119630: "West End Fascia", 1129111: "Front Filler",
  1404807: "East Back Counter - Steel Frame", 1421963: "Cashier Counter", 1429227: "Ceiling Wood Frame" };
for (const [id, name] of Object.entries(N)) await call("set_parameter", { ...D, element_id: +id, parameter_name: "Sheet Name", value: name }).catch((e) => console.log(id, e.message.slice(0, 80)));
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-40));
