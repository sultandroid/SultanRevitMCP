// Arrangement sheets for every wooden unit type: per side, the type in full black, others halftone; chains for each unit, the type's total and the wall between the existing-wall grids;
// a size table read from the model, for fabrication to check before cutting. Usage: node arr_units.mjs [115,116,117]
import { readFileSync, writeFileSync } from "node:fs";
import { sn } from "./sheetno.mjs";
import { call } from "./rvt.mjs";
import { markUnits } from "./kpmark.mjs";
const i = await call("get_project_info"); if (i.title !== "Madina1_ARCH_02") throw new Error(i.title);
const REV = JSON.parse(readFileSync("dwg/sheets.json", "utf8")).rev, TB = 467161, NL = String.fromCharCode(10);
const SHEETS = [
  { no: 115, name: "Arch Unit Arrangement", re: /^Madina Arch Unit (W|E|RL|RR)-A\d$|^Madina Arch Typical A$/ },
  { no: 116, name: "Low Bay Arrangement", re: /^Madina Low Bay (W|E|RL|RR)-L\d$/ },
  { no: 157, name: "Wall Cladding Arrangement", re: /^(W|E|RL|RR) (Strip (Cladding|Backing|Closure)|Top Support)$/ },
  { no: 117, name: "Rear Centre Unit Arrangement", re: /^Madina (Centre Arch Mihrab Unit|Niche Shelf Unit NC-[LR])$/ },
].filter((s) => !process.argv[2] || process.argv[2].split(",").includes(String(s.no)));
const P = (x, y, z = 0) => ({ x, y, z });
const setv = (id, k, v) => call("set_parameter", { element_id: id, parameter_name: k, value: v }).catch(() => {});
const note = (await call("ensure_text_type", { name: "Joinery Note 3.5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id;
const bold = (await call("ensure_text_type", { name: "Joinery Note 4 Bold", size_mm: 5.5, color: { r: 0, g: 0, b: 0 }, bold: true })).id;
const HIDE = (await call("ensure_line_style", { name: "Dim Reference Hidden", weight: 1, color: { r: 254, g: 254, b: 254 } })).id;
// Existing wall faces (the grids): west 255, east 6525, front 660, rear 5505.
const SIDES = [
  { key: "W", sgn: -1, title: "West Side", start: P(1600, 5000), end: P(500, 5000), look: P(-1, 0), depth: 1500, line: [P(1600, 5700), P(1600, 450)], u: (b) => [b.min.y, b.max.y], at: (u, z) => P(1000, u, z), wall: [660, 5505], grids: [660, 3082.5, 5505], test: (b) => b.max.x < 1500 && b.max.y < 4800 },
  { key: "E", sgn: 1, title: "East Side", line: [P(5200, 450), P(5200, 5700)], look: P(1, 0), depth: 1500, u: (b) => [b.min.y, b.max.y], at: (u, z) => P(5800, u, z), wall: [660, 5505], grids: [660, 3082.5, 5505], test: (b) => b.min.x > 5300 && b.max.y < 4800 },
  { key: "R", sgn: -1, title: "Rear Side", line: [P(50, 4300), P(6730, 4300)], look: P(0, 1), depth: 1400, u: (b) => [b.min.x, b.max.x], at: (u, z) => P(u, 4900, z), wall: [255, 6525], grids: [255, 3390, 6525], test: (b) => b.min.y > 4500 },
];
const all = []; for (const c of ["OST_Furniture", "OST_Casework", "OST_GenericModel"]) for (let o = 0; ; o += 1000) { const q = (await call("query_elements", { category: c, limit: 1000, offset: o })).elements; all.push(...q); if (q.length < 1000) break; }
for (const S of SHEETS) {
  const oldS = (await call("query_elements", { category: "OST_Sheets", limit: 500 })).elements.filter((e) => e.name === S.name).map((e) => e.id); if (oldS.length) await call("delete_elements", { element_ids: oldS });
  const oldV = (await call("list_views", {})).views.filter((v) => v.name.startsWith(`A${S.no}-`) || v.name === `KP-${S.no}`).map((v) => v.id); if (oldV.length) await call("delete_elements", { element_ids: oldV });
  const units = []; for (const e of all.filter((x) => S.re.test(x.name))) { const g = await call("get_element", { element_id: e.id }), b = g.bounding_box, mk = g.parameters?.find((p) => p.name === "Mark")?.value; if (b && !units.some((u) => u.id === e.id)) units.push({ id: e.id, n: mk || e.name.replace(/^Madina /, ""), b }); }
  const keep = new Set(units.map((u) => u.id)), views = [], table = [];
  for (const s of SIDES) {
    const run = units.filter((u) => s.test(u.b)).sort((a, b) => s.u(a.b)[0] - s.u(b.b)[0]); if (!run.length) continue;
    const v = (await call("create_section", { start: s.line[0], end: s.line[1], look_direction: s.look, bottom_mm: -700, top_mm: 3250, depth_mm: s.depth, name: `A${S.no}-${s.title}`, scale: 15 })).id;
    await setv(v, "Title on Sheet", `${s.title}: ${S.name.replace(" Arrangement", "")}`); await setv(v, "Detail Level", 3); await setv(v, "Hide at scales coarser than", "1 : 2");
    await call("set_view_categories", { view_id: v, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_Levels", "OST_Ceilings"], show: ["OST_Grids"] }).catch(() => {});
    const others = []; for (const c of ["OST_Furniture", "OST_GenericModel", "OST_Casework", "OST_LightingFixtures", "OST_ElectricalFixtures", "OST_Walls", "OST_Doors", "OST_SpecialityEquipment", "OST_CommunicationDevices", "OST_FireAlarmDevices", "OST_SecurityDevices", "OST_DataDevices"]) for (const e of (await call("query_elements", { category: c, view_id: v, limit: 1000 }).catch(() => ({ elements: [] }))).elements) if (!keep.has(e.id)) others.push(e.id);
    for (let k = 0; k < others.length; k += 300) await call("set_element_overrides", { view_id: v, element_ids: others.slice(k, k + 300), halftone: true });
    // On the rear centre sheet the chain follows the main units only (NC-L, NF, NC-R); the second chain gives the opening: frame, cabinet, frame.
    const main = S.no === 117 ? run.filter((u) => /^(NC-L|MH|NC-R)$/.test(u.n)) : run;
    const raw = [...new Set(main.flatMap((u) => s.u(u.b).map((x) => Math.round(x * 10) / 10)))].sort((a, b) => a - b);
    // Drop edges that would leave a segment under 60 mm, whose number cannot fit; the size table gives those parts.
    const edges = [raw[0]]; for (const x of raw.slice(1)) { if (x - edges[edges.length - 1] >= 60) edges.push(x); else if (x === raw[raw.length - 1]) edges[edges.length - 1] = x; }
    // References stay at the floor (or +3000 for grids) and the line is offset, so chains have extension legs; sgn turns "down" into the view's own offset direction.
    const dim = (pts, z, down) => call("create_dimension_string", { view_id: v, points: pts.map((u) => s.at(u, z)), offset_mm: s.sgn * down, witness: true, tick_mm: 25 }).catch((e) => console.log("dim", e.message.slice(0, 70)));
    await dim(edges, 0, 150);                                      // each unit and the gaps between
    await dim(S.no === 117 ? [2665.5, 2785.5, 3994.5, 4114.5] : [edges[0], edges[edges.length - 1]], 0, 330); // this type end to end; on 117 the niche opening
    await dim([s.wall[0], edges[0], edges[edges.length - 1], s.wall[1]], 0, 510); // wall to wall, with the space either side
    await dim(s.grids, 3000, -150);                                    // grid to grid, always
    for (const e of (await call("query_elements", { category: "OST_Lines", view_id: v, limit: 500 })).elements) if (Math.abs((e.location?.length_mm ?? 0) - 25) < 0.5) await call("set_parameter", { element_id: e.id, parameter_name: "Line Style", value: HIDE }).catch(() => {});
    views.push(v);
    for (const u of run) { const [a, b] = s.u(u.b), w = b - a, d = s.key === "R" ? u.b.max.y - u.b.min.y : u.b.max.x - u.b.min.x; table.push([s.title.replace(" Side", ""), u.n.replace(/^(Arch Unit|Low Bay|Arch Panel|Niche Frame|Niche Shelf Unit|Niche Cabinet|Carpet Hanger|Column Cladding) /, ""), w.toFixed(1), Math.round(u.b.max.z - u.b.min.z), Math.round(d), Math.round(u.b.min.z)]); }
  }
  const sheet = (await call("create_sheet", { number: `${sn(S.no)}`, name: S.name, title_block_type_id: TB })).id;
  for (const [k, x] of [["Designed By", "Lorch"], ["Checked By", "Mohamed Sultan"], ["Approved By", "Anas Matter"]]) await setv(sheet, k, x);
  await call("create_text_note", { view_id: sheet, location: P(1027, 672), text: "Samaya Invest", text_type_id: note });
  await call("set_sheet_revisions", { sheet_ids: [sheet], revision_ids: [REV, ...(process.env.REV_EXTRA ?? "").split(",").filter(Boolean).map(Number)] });
  const SPOTS = views.length === 1 ? [[516, 590]] : views.length === 2 ? [[268, 635], [764, 635]] : [[268, 635], [764, 635], [330, 265]];
  for (const [k, v] of views.entries()) await call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(...SPOTS[k]) });
  // Size table: every unit, read from the model.
  const tx = views.length === 1 ? 30 : 620, ty = views.length === 1 ? 330 : 430;
  await call("create_text_note", { view_id: sheet, location: P(tx, ty), text: "UNIT SIZES, FROM THE MODEL", text_type_id: bold });
  const cols = [["SIDE", 0], ["UNIT", 60], ["WIDTH", 130], ["HEIGHT", 185], ["DEPTH", 240], ["FROM FFL", 290]];
  for (const [k, [h, dx]] of cols.entries()) await call("create_text_note", { view_id: sheet, location: P(tx + dx, ty - 16), text: [h, ...table.map((r) => String(r[k]))].join(NL), text_type_id: note });
  await call("create_text_note", { view_id: sheet, location: P(tx, ty - 34 - 6.7 * (table.length + 1)), text: ["Top chain: grid to grid. Bottom chains, top down: each unit and the gaps;", "this unit type end to end;", "wall to wall between the existing-wall grids, with the space either side.", "This type in full, other units halftone and indicative.", "All dimensions in mm. Check on site before fabrication."].join(NL), text_type_id: note });
  // Display space on open shelves, measured by shelf_vol.mjs.
  const SV = JSON.parse(readFileSync("dwg/shelf_vol.json", "utf8")).filter((u) => table.some((t) => t[1] === u.mark));
  if (SV.length) {
    const y0 = ty - 60 - 6.7 * (table.length + 5);
    await call("create_text_note", { view_id: sheet, location: P(tx, y0), text: "DISPLAY SPACE FOR THE SHOP, OPEN SHELVES", text_type_id: bold });
    const dc = [["UNIT", 0], ["SPACES", 60], ["INSIDE W x D", 110], ["CLEAR HEIGHTS", 190], ["m3", 320]];
    const rowsV = SV.map((u) => [u.mark, u.spaces, `${u.w} x ${u.d}`, u.hs, u.v.toFixed(3)]);
    for (const [k, [h, dx]] of dc.entries()) await call("create_text_note", { view_id: sheet, location: P(tx + dx, y0 - 16), text: [h, ...rowsV.map((r) => String(r[k])), k === 0 ? "Total" : k === 4 ? SV.reduce((a, u) => a + u.v, 0).toFixed(3) : ""].join(NL), text_type_id: note });
  }
  const kd = await call("duplicate_view", { view_id: 312, name: `KP-${S.no}`, option: "Duplicate" }), kp = kd.id ?? kd.view_id;
  for (const [k, x] of [["View Scale", 100], ["Detail Level", 1], ["Title on Sheet", "Key Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(kp, k, x);
  const kb = (await call("get_element", { element_id: kp })).bounding_box;
  await call("extend_view_crop", { view_id: kp, left_mm: kb.min.x + 100, right_mm: 6880 - kb.max.x, bottom_mm: kb.min.y + 100, top_mm: 5700 - kb.max.y });
  await call("set_view_categories", { view_id: kp, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Grids"] }).catch(() => {});
  await markUnits(kp, S.re);
  const kv = await call("place_view_on_sheet", { sheet_id: sheet, view_id: kp, location: P(1102, 430) });
  await call("set_viewport_no_title", { viewport_id: kv.id }).catch(() => {});
  const im = await call("export_view_image", { view_id: sheet, pixel_size: 2400 }); writeFileSync(`j_${S.no}.png`, Buffer.from(im.data_base64, "base64"));
  console.log("sheet", S.no, "views", views.length, "units", table.length);
}
console.log(JSON.stringify(await call("save_document", { title: "Madina1_ARCH_02" })).slice(-30));
