// Madina 2 D-02 v2 (user, 11 Nov 2026): "all ss but front wood FR MDF to be painted to match the design".
// Inside all stainless 304 brushed 1.2 (bottom, shelf, north end, drawer box); customer face (x 0) and south end (y 0) FR MDF 18
// painted to the designer's finish: sand body with rust / green / rust bands on the customer face (the bands of the original
// earth plaster design), floor to under the top; staff side stays as E-C1 (stainless doors, drawer, access panel, kick).
// No sub-board: the travertine sits on the SHS top ring with a middle cross rail (as the E-C1 sink bay).
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" }, id = 574311;
const ST = "SHS 40x40x2 Steel Approved", FT = "Adjustable Leg Steel 50", CORE = "MR MDF 16 Door Core",
  SS = "Stainless Steel 304 Brushed 1.2", KICK = "Stainless Steel 304 Brushed Kick 1.2 on MR MDF", MB = "Marble Tuscany Travertine 20 Approved",
  GR = "Grommet 60 Black", HD = "Bar Handle Stainless 304 Brushed", HG = "Hinge 35 Half Overlay Approved", HP = "Hinge Plate Approved",
  POS = "POS Terminal By Others", DUCT = "Cable Duct PVC 80x40 White", TRAY = "Cable Tray Steel Perforated 100x50",
  SAND = "FR MDF 18 Painted Sand As Approved", RUST = "Paint Rust As Approved", GREEN = "Paint Green As Approved";
for (const [n, c] of [[SAND, { r: 214, g: 190, b: 150 }], [RUST, { r: 160, g: 82, b: 50 }], [GREEN, { r: 112, g: 130, b: 92 }]])
  if (!(await call("query_elements", { ...D, category: "Materials", parameter_name: "Name", parameter_value: n, limit: 5 })).elements.some((e) => e.name === n))
    await call("ensure_material", { ...D, name: n, color: c });
const B = (x0, y0, z0, x1, y1, z1, material) => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, material });
const add = [];
const PX = [[75, 115], [585, 625]], PY = [[75, 115], [1085, 1125]];
for (const [x0, x1] of PX) for (const [y0, y1] of PY) add.push(B(x0, y0, 50, x1, y1, 940, ST), B(x0 + 7, y0 + 7, 0, x1 - 8, y1 - 8, 50, FT));
for (const [z0, z1] of [[50, 90], [940, 980]]) {
  for (const [x0, x1] of PX) add.push(B(x0, 115, z0, x1, 1085, z1, ST));
  for (const [y0, y1] of PY) add.push(B(115, y0, z0, 585, y1, z1, ST));
}
add.push(B(115, 580, 940, 585, 620, 980, ST));                                   // middle cross rail under the travertine
// inside, stainless 1.2: bottom on the ring (notched round the posts), shelf with 40 front upstand, north end, drawer box
add.push(B(115, 75, 90, 585, 1125, 92, SS), B(75, 115, 90, 115, 1085, 92, SS), B(585, 115, 90, 625, 1085, 92, SS));
add.push(B(115, 115, 440, 545, 1085, 442, SS), B(543, 115, 442, 545, 1085, 480, SS));
add.push(B(18, 1198, 50, 682, 1200, 980, SS));
add.push(B(250, 125, 810, 680, 515, 812, SS), B(250, 125, 812, 680, 127, 895, SS), B(250, 513, 812, 680, 515, 895, SS), B(250, 127, 812, 252, 513, 895, SS));
// customer face and south end: FR MDF 18 painted, floor (10 scribe gap) to under the top; design bands painted on the face
add.push(B(0, 0, 10, 18, 1200, 980, SAND), B(18, 0, 10, 682, 18, 980, SAND));
for (const [z0, z1, m] of [[10, 120, RUST], [310, 410, GREEN], [620, 710, RUST]]) add.push(B(-1, 0, z0, 0, 1200, z1, m));
// staff side (x 682-700) as E-C1: 2 doors, cash drawer, removable cable access panel; stainless kick 40 back
const front = (y0, y1, z0, z1) => add.push(B(682, y0, z0, 698, y1, z1, CORE), B(698, y0, z0, 700, y1, z1, SS));
front(20, 598, 100, 788); front(602, 1180, 100, 788); front(20, 520, 802, 898); front(524, 1180, 802, 898);
add.push(B(630, 18, 0, 660, 1198, 100, KICK));
add.push(B(700, 560, 300, 725, 590, 700, HD), B(700, 612, 300, 725, 642, 700, HD), B(700, 70, 835, 725, 470, 865, HD));
for (const z of [200, 655]) add.push(B(669, 30, z, 682, 65, z + 35, HG), B(669, 1135, z, 682, 1170, z + 35, HG), B(640, 18, z, 690, 30, z + 32, HP), B(640, 1166, z, 690, 1178, z + 32, HP));
// travertine 20 on the top ring, 20 overhang on the customer face and south end
add.push(B(-20, -20, 980, 700, 1200, 1000, MB));
// cashier wire management
add.push(B(535, 1000, 980, 595, 1060, 1000, GR), B(545, 990, 92, 585, 1070, 940, DUCT), B(130, 130, 880, 230, 1070, 930, TRAY));
add.push(B(370, 150, 1000, 670, 450, 1030, POS));
const old = (await call("inspect_family", { ...D, element_id: id })).items.filter((i) => /FreeForm|Extrusion/.test(i.class)).map((i) => i.id);
const r = await call("edit_family_solids", { ...D, element_id: id, delete_form_ids: old, add });
console.log("deleted", r.deleted, "added", r.added?.length);
await call("set_parameter", { ...D, element_id: id, parameter_name: "Comments", value: "Cashier counter D-02, 700 x 1200, top +1.000 (user, 11 Nov 2026): SHS 40x40x2 frame on 4 adjustable feet as the back counter E-C1. Inside all stainless 304 brushed 1.2 (bottom, shelf, north end, drawer box). Customer face and south end FR MDF 18 painted to the design: sand body, rust / green / rust bands on the customer face (colour codes to confirm). Staff side: 2 stainless doors (MR MDF 16 core), cash drawer, removable stainless cable access panel, bar handles, stainless kick. Tuscany travertine 20 top on the steel top ring (middle cross rail), 20 overhang on the customer sides. Wire management: 60 grommet by the fridge end, PVC duct 80x40 to the floor box (power + data by MEP), steel cable tray under the top. POS by others. Display fridge D-02-F at the north end." });
const g = await call("get_element", { ...D, element_id: id }); console.log(JSON.stringify(g.bounding_box));
const fi = await call("inspect_family", { ...D, element_id: id }); console.log([...new Set(fi.items.map((i) => i.material).filter(Boolean))].join(" | "));
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-40));
