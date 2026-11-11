// Madina 2 D-02 cashier counter rebuilt as the back counter E-C1 (user, 11 Nov 2026): "stainless steel as per the back counter,
// marble top and wire management for the cashier". Family coords: x 0 = customer face (west), x 700 = staff face (east);
// y 0 = south (customer) end, y 1200 = north end against the display fridge D-02-F; z up, top +1.000.
// SHS 40x40x2 frame on 4 adjustable feet behind the kick; customer face and south end: MR MDF 16 panels with brushed
// stainless 304 1.2 skins; staff side: 2 stainless doors (MR MDF 16 core), cash drawer, removable stainless cable access
// panel; stainless kick recessed 40; MR 18 sub-top + Tuscany travertine 20 top (20 overhang on the customer sides);
// cable management: 60 grommet by the fridge end, vertical PVC duct 80x40 down to the floor box (by MEP), steel cable tray
// under the top along the counter.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" }, id = 574311;
const ST = "SHS 40x40x2 Steel Approved", FT = "Adjustable Leg Steel 50", MR = "EGGER White Carcass 18 MR", CORE = "MR MDF 16 Door Core",
  SS = "Stainless Steel 304 Brushed 1.2", KICK = "Stainless Steel 304 Brushed Kick 1.2 on MR MDF", MB = "Marble Tuscany Travertine 20 Approved",
  GR = "Grommet 60 Black", HD = "Bar Handle Stainless 304 Brushed", HG = "Hinge 35 Half Overlay Approved", HP = "Hinge Plate Approved",
  POS = "POS Terminal By Others", DUCT = "Cable Duct PVC 80x40 White", TRAY = "Cable Tray Steel Perforated 100x50";
for (const [n, c] of [[DUCT, { r: 240, g: 240, b: 240 }], [TRAY, { r: 150, g: 150, b: 150 }]])
  if (!(await call("query_elements", { ...D, category: "Materials", parameter_name: "Name", parameter_value: n, limit: 5 })).elements.some((e) => e.name === n))
    await call("ensure_material", { ...D, name: n, color: c });
const B = (x0, y0, z0, x1, y1, z1, material) => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, material });
const add = [];
// frame: posts x 75-115 / 585-625, y 75-115 / 1085-1125; bottom ring z 50-90, top ring z 922-962
const PX = [[75, 115], [585, 625]], PY = [[75, 115], [1085, 1125]];
for (const [x0, x1] of PX) for (const [y0, y1] of PY) add.push(B(x0, y0, 50, x1, y1, 922, ST), B(x0 + 7, y0 + 7, 0, x1 - 8, y1 - 8, 50, FT));
for (const [z0, z1] of [[50, 90], [922, 962]]) {
  for (const [x0, x1] of PX) add.push(B(x0, 115, z0, x1, 1085, z1, ST));     // long rails
  for (const [y0, y1] of PY) add.push(B(115, y0, z0, 585, y1, z1, ST));      // cross rails
}
// MR bottom board on the bottom ring, notched round the posts; one shelf
add.push(B(115, 75, 90, 585, 1125, 108, MR), B(75, 115, 90, 115, 1085, 108, MR), B(585, 115, 90, 625, 1085, 108, MR));
add.push(B(115, 115, 440, 545, 1085, 458, MR));
// customer face (x 0) and south end (y 0): stainless skin on MR MDF 16, z 100-962
add.push(B(0, 18, 100, 2, 1200, 962, SS), B(2, 18, 100, 18, 1200, 962, CORE));
add.push(B(0, 0, 100, 700, 2, 962, SS), B(0, 2, 100, 700, 18, 962, CORE));
// north end against the fridge: MR 18 panel
add.push(B(18, 1182, 50, 682, 1200, 962, MR));
// kick, 40 back from each face
add.push(B(40, 40, 0, 70, 1182, 100, KICK), B(70, 40, 0, 630, 70, 100, KICK), B(630, 40, 0, 660, 1182, 100, KICK));
// staff side (x 682-700): 2 doors, cash drawer, cable access panel; skin on the outside face
const front = (y0, y1, z0, z1) => add.push(B(682, y0, z0, 698, y1, z1, CORE), B(698, y0, z0, 700, y1, z1, SS));
front(20, 598, 100, 788); front(602, 1180, 100, 788);          // doors
front(20, 520, 802, 898);                                        // cash drawer
front(524, 1180, 802, 898);                                      // removable cable access panel (push catches)
add.push(B(250, 125, 810, 680, 515, 828, MR), B(250, 125, 828, 680, 143, 895, MR), B(250, 497, 828, 680, 515, 895, MR), B(250, 143, 828, 268, 497, 895, MR)); // drawer box
add.push(B(700, 560, 300, 725, 590, 700, HD), B(700, 612, 300, 725, 642, 700, HD), B(700, 70, 835, 725, 470, 865, HD)); // handles
for (const z of [200, 655]) add.push(B(669, 30, z, 682, 65, z + 35, HG), B(669, 1135, z, 682, 1170, z + 35, HG), B(640, 18, z, 690, 30, z + 32, HP), B(640, 1170, z, 690, 1182, z + 32, HP));
// top: MR 18 sub-top, travertine 20 with 20 overhang on the customer face and south end
add.push(B(0, 0, 962, 700, 1200, 980, MR), B(-20, -20, 980, 700, 1200, 1000, MB));
// cashier wire management
add.push(B(535, 1000, 962, 595, 1060, 1000, GR));                // 60 grommet in the top, staff side by the fridge end
add.push(B(545, 990, 108, 585, 1070, 922, DUCT));                // vertical duct to the floor box (power + data by MEP)
add.push(B(130, 130, 860, 230, 1070, 910, TRAY));                // cable tray under the top along the counter
add.push(B(370, 150, 1000, 670, 450, 1030, POS));                // POS by others
const fi = await call("inspect_family", { ...D, element_id: id });
const old = fi.items.filter((i) => /FreeForm|Extrusion/.test(i.class)).map((i) => i.id);
const r = await call("edit_family_solids", { ...D, element_id: id, delete_form_ids: old, add });
console.log("deleted", r.deleted, "added", r.added?.length);
const g = await call("get_element", { ...D, element_id: id });
await call("set_parameter", { ...D, element_id: id, parameter_name: "Comments", value: "Cashier counter D-02, 700 x 1200, top +1.000, built as the back counter E-C1 (user, 11 Nov 2026): SHS 40x40x2 frame on 4 adjustable feet; customer face and south end brushed stainless 304 1.2 on MR MDF 16; staff side 2 stainless doors (MR MDF 16 core), cash drawer, removable stainless cable access panel, bar handles; stainless kick recessed 40; MR 18 sub-top + Tuscany travertine 20 top (20 overhang on the customer sides). Wire management: 60 grommet in the top by the fridge end, vertical PVC duct 80x40 to the floor box (power + data by MEP), steel cable tray under the top. POS by others. Display fridge D-02-F stands at the north end." });
console.log(JSON.stringify(g.bounding_box));
console.log(JSON.stringify(await call("save_document", { title: D.document })).slice(-40));
