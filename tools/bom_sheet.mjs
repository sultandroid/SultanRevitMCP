// Overall carpentry BOM sheet (user, Madina 2, 11 Nov 2026: "make separate sheet for overall BOM"): every unit in the
// model, by item category, one row per unit type: type, qty, marks, size W x D x H (from the family's own solids), main
// materials, where it stands (wall or free-standing), detail sheet. Totals per category and for the shop. Key plan with
// every unit in red. Read from the model, never typed.
//
// usage: node tools/bom_sheet.mjs <fab_config.json> [--dry]
// config.bom = { no, title, group, walls: { west: x, east: x, rear: y, front: y }, ignore: [regex], revisions? }
import { readFileSync } from "node:fs";
import { call as rawC } from "./rvt.mjs";

const [cfgPath] = process.argv.slice(2), DRY = process.argv.includes("--dry");
const C = JSON.parse(readFileSync(cfgPath, "utf8")), B = C.bom ?? {};
const call = async (n, a = {}) => rawC(n, { document: C.doc, ...a }).catch((e) => { console.log("FAIL", n, e.message.slice(0, 120)); throw e; });
const setv = (id, n, v) => call("set_parameter", { element_id: id, parameter_name: n, value: String(v) }).catch((e) => console.log("param", n, e.message.slice(0, 90)));
const r = Math.round, P = (x, y, z = 0) => ({ x, y, z });
const NO = B.no ?? 1200, SN = `${C.prefix}${NO}`, IGN = B.ignore ? new RegExp(B.ignore.join("|")) : null;

// 1. Every unit: casework, generic models and furniture made by us (new construction), not links.
const all = [];
for (const cat of ["OST_Casework", "OST_GenericModel", "OST_Furniture", "OST_SpecialityEquipment"]) {
  const q = await call("query_elements", { category: cat, limit: 1000 }).catch(() => ({ elements: [] }));
  for (const e of q.elements) if (e.family && !(IGN && IGN.test(e.family))) all.push(e);
}
const CATS = [[/Confirmat|Dowel|Screw|Plug|Self Drill|Bolt|Bracket|Rivet|Anchor/i, "HARDWARE AND FIXINGS"], [/Island|Display|Cashier/, "FREE-STANDING DISPLAYS AND COUNTERS"], [/Arch Unit|Arch Screen|Back Legs/, "ARCH UNITS"], [/L Fascia/, "L FASCIA HEADS (WOOD + MARBLE)"], [/Spandrel/, "SPANDREL CLADDING"],
  [/Open Shelf Unit|Pegboard Filler/, "SHELF AND PEGBOARD UNITS"], [/Base Cabinet|Open Shelf Base|Counter/, "BASE UNITS AND COUNTERS"],
  [/Filler/, "FILLERS"], [/Divider/, "BAY DIVIDERS"],
  [/Column Cladding|Back Panel|Cladding/, "CLADDING AND BACK PANELS"], [/Services Cabinet/, "SERVICES CABINETS"],
  [/Wood Frame|Ceiling|Tray/, "CEILING WOOD FRAMES"], [/Carpet Hanger|Hanger/, "FITTINGS"]];
const catOf = (n) => CATS.find(([re]) => re.test(n))?.[1] ?? "OTHER";
const HW = /Hinge|Handle|Grommet|Pin|LED|Edge|Sink|Batten|Core|Former|Backing|Skirting|Plate|Peg\b|Steel/i;   // not a finish
const fams = new Map(), units = [];
for (const e of all) {
  const g = await call("get_element", { element_id: e.id });
  const pv = (n) => g.parameters.find((p) => p.name === n)?.value;
  if (/Existing/i.test(pv("Phase Created") ?? "") || pv("SF_PhaseStatus") === "Existing") continue;
  if (!fams.has(e.family)) {
    const it = (await call("inspect_family", { element_id: e.id })).items.filter((i) => i.material && i.min);
    if (!it.length) { fams.set(e.family, null); continue; }
    const ex = (k, f) => f(...it.map((i) => (f === Math.max ? i.max[k] : i.min[k])));
    const box = { x0: ex("x", Math.min), x1: ex("x", Math.max), y0: ex("y", Math.min), y1: ex("y", Math.max), z0: ex("z", Math.min), z1: ex("z", Math.max) };
    const mats = [...new Set(it.map((i) => i.material))];
    fams.set(e.family, { box, mats, items: it.map((i) => ({ m: i.material, d: ["x", "y", "z"].map((k) => i.max[k] - i.min[k]).sort((a, b) => a - b) })) });
  }
  const F = fams.get(e.family); if (!F) continue;
  const rd = (((g.location?.rotation_deg ?? 0) % 360) + 360) % 360, L = g.location?.point ?? P(0, 0);
  const lx = F.box.x1 - F.box.x0, ly = F.box.y1 - F.box.y0, turned = rd === 90 || rd === 270;
  const wx = turned ? ly : lx, wy = turned ? lx : ly;                      // world x and y extents
  const cxl = (F.box.x0 + F.box.x1) / 2, cyl = (F.box.y0 + F.box.y1) / 2, th = (rd * Math.PI) / 180;
  const c = P(L.x + cxl * Math.cos(th) - cyl * Math.sin(th), L.y + cxl * Math.sin(th) + cyl * Math.cos(th));
  // where it stands: the nearest wall within reach, else free-standing; W is the size along that wall
  const Wl = B.walls ?? {}, near = [["West", Math.abs(c.x - (Wl.west ?? -1e9)), "y"], ["East", Math.abs(c.x - (Wl.east ?? 1e9)), "y"], ["Rear", Math.abs(c.y - (Wl.rear ?? 1e9)), "x"], ["Front", Math.abs(c.y - (Wl.front ?? -1e9)), "x"]].sort((a, b) => a[1] - b[1])[0];
  const wall = near[1] < (B.reach ?? 1500) ? near[0] : "Free";
  const along = wall === "Free" ? (wx >= wy ? "x" : "y") : near[2];
  units.push({ F, id: e.id, fam: e.family, mark: pv("Mark") || e.family.split(" ").pop(), cat: catOf(e.family), wall, c, W: along === "x" ? wx : wy, D: along === "x" ? wy : wx, H: F.box.z1 - F.box.z0, wx, wy, mats: F.mats });
}
// rows: one per family (unit type)
const rows = new Map();
for (const U of units) { const k = U.fam; const g = rows.get(k) ?? { fam: k, cat: U.cat, units: [] }; g.units.push(U); rows.set(k, g); }
const label = (g) => { const ms = g.units.map((U) => U.mark); if (ms.length === 1) return ms[0]; let p = ms[0]; for (const m of ms) while (!m.startsWith(p)) p = p.slice(0, -1); return p.replace(/-$/, "") || ms[0]; };
const short = (m) => m.replace(/\s*-\s*BC-C Review/, "").replace(/\s*\(.*?\)/g, "").replace(/\bApproved\b/g, "").replace(/\bPainted\b/, "ptd.").replace(/\s+/g, " ").trim();
// detail sheets: the last word of each A-2xxx sheet name is the mark it details
const sheets = [];
for (const e of (await call("query_elements", { category: "OST_Sheets", limit: 400 })).elements) {
  const g = await call("get_element", { element_id: e.id }); const num = g.parameters.find((p) => p.name === "Sheet Number")?.value ?? "";
  if (!/-A-[12]\d{3}$/.test(num) || /-A-1[0-1]\d{2}$/.test(num)) continue;
  sheets.push({ tok: (g.parameters.find((p) => p.name === "Sheet Name")?.value ?? e.name).split(" ").pop(), num: num.replace(/^.*-A-/, "A-") });
}
const detailOf = (mark) => sheets.filter((x) => mark === x.tok || mark.startsWith(x.tok + "-")).sort((a, b) => b.tok.length - a.tok.length)[0]?.num ?? "-";
const order = [...CATS.map(([, n]) => n).filter((n) => !/HARDWARE/.test(n)), "OTHER", "HARDWARE AND FIXINGS"];
// fixings come as many small families of one kind (turned copies): one row per kind, sizes not needed
for (const [k, g] of [...rows]) if (g.cat === "HARDWARE AND FIXINGS") { const key = "HW:" + (g.units[0].mats[0] ?? g.fam).replace(/^HW\s+/, ""); rows.delete(k); const h = rows.get(key) ?? { fam: key, cat: g.cat, units: [], hw: true }; h.units.push(...g.units); rows.set(key, h); }
const table = [];
for (const cat of order) {
  const gs = [...rows.values()].filter((g) => g.cat === cat).sort((a, b) => (a.hw ? a.fam : label(a)).localeCompare(b.hw ? b.fam : label(b)));
  if (!gs.length) continue;
  table.push({ head: cat, n: gs.reduce((a, g) => a + g.units.length, 0) });
  for (const g of gs) {
    const U = g.units[0], ws = [...new Set(g.units.map((V) => V.wall))], walls = ws.length > 1 ? ws.map((w) => w[0]).join("/") : ws[0];
    const fin = U.mats.filter((m) => !HW.test(m)).map(short).slice(0, 2).join(" + ");
    if (g.hw) { table.push({ t: "HW", q: g.units.length, marks: "", sz: "-", mat: g.fam.slice(3), wall: walls, sh: "details" }); continue; }
    table.push({ t: label(g), q: g.units.length, marks: g.units.map((V) => V.mark).sort().join(", "), sz: `${r(Math.max(...g.units.map((V) => V.W)))} x ${r(Math.max(...g.units.map((V) => V.D)))} x ${r(Math.max(...g.units.map((V) => V.H)))}`, mat: fin, wall: walls, sh: detailOf(U.mark) });
  }
}
console.log(`${units.length} units, ${rows.size} types`);
for (const row of table) console.log(row.head ? `== ${row.head} (${row.n})` : `  ${row.t.padEnd(10)} ${String(row.q).padStart(2)}  ${row.sz.padEnd(18)} ${row.wall.padEnd(12)} ${row.sh.padEnd(7)} ${row.mat}`);
if (DRY) process.exit(0);

// 2. Sheet: the table across the drawing area (5 mm text, 5.5 mm bold headings), in two blocks when it is long.
const old = (await call("query_elements", { category: "OST_Sheets", parameter_name: "Sheet Number", parameter_value: SN, limit: 5 })).elements.map((e) => e.id);
if (old.length) await call("delete_elements", { element_ids: old }).catch(() => {});
const stale = (await call("list_views", {})).views.filter((x) => x.name === `KP-${NO}`).map((x) => x.id);
if (stale.length) await call("delete_elements", { element_ids: stale }).catch(() => {});
const note = (await call("ensure_text_type", { name: "Sheet Note 5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id;
const bold = (await call("ensure_text_type", { name: "Sheet Heading 5.5", size_mm: 5.5, color: { r: 0, g: 0, b: 0 }, bold: true })).id;
const tb = (await call("list_element_types", { category: "OST_TitleBlocks" })).types.find((x) => x.name === (C.titleBlock ?? "Samaya Factory A0")).id;
const sheet = (await call("create_sheet", { number: SN, name: B.title ?? "Overall BOM - Carpentry", title_block_type_id: tb })).id;
await setv(sheet, "Sheet Group", B.group ?? "2 Fab: 0 Wall Sections");
const tbi = (await call("query_elements", { category: "OST_TitleBlocks", view_id: sheet, limit: 5 })).elements[0]?.id;
for (const [n, v] of C.signoff) { await setv(sheet, n, v); if (tbi) await setv(tbi, n, v); }
await call("set_sheet_revisions", { sheet_ids: [sheet], revision_ids: B.revisions ?? C.revisions });
const txt = (x, y, t, ty = note) => (String(t ?? "").trim() ? call("create_text_note", { view_id: sheet, location: P(x, y), text: String(t), text_type_id: ty }) : null);
// columns (sheet mm from the block's left edge); a block is 495 wide, two blocks fit the drawing area left of the title block
const COL = { t: 0, q: 52, sz: 70, wall: 138, sh: 174, mat: 202 }, LH = 7.8, TOP = 790, BOT = 40, BW = 495;
const fitMat = (m) => (m.length > 48 ? m.slice(0, 47) + "." : m);
const nHW = units.filter((U) => U.cat === "HARDWARE AND FIXINGS").length, nU = units.length - nHW, nT = [...rows.values()].filter((g) => !g.hw).length;
await txt(30, 818, `${(B.title ?? "Overall BOM - Carpentry").toUpperCase()}: ${nU} units in ${nT} types + ${nHW} fixings, all walls and free-standing`, bold);
let bx = 30, y = TOP;
const header = async () => { for (const [k, h] of [["t", "TYPE"], ["q", "QTY"], ["sz", "W x D x H (mm)"], ["wall", "WHERE"], ["sh", "SHEET"], ["mat", "MAIN FINISH"]]) await txt(bx + COL[k], y, h, bold); y -= LH + 3; };
let yLeft = null;
await header();
// two balanced blocks, broken before a category heading near the middle
const hgt = (row) => (row.head ? LH + 4 : LH), total = table.reduce((a, row) => a + hgt(row), 0);
let acc = 0, brk = -1, best = 1e9;
for (const [i, row] of table.entries()) { if (row.head && Math.abs(acc - total / 2) < best) { best = Math.abs(acc - total / 2); brk = i; } acc += hgt(row); }
if (total < TOP - BOT - 60) brk = -1;
for (const [i, row] of table.entries()) {
  const need = row.head ? LH + 6 : LH;
  if (i === brk || y - need < BOT) { if (bx === 30) yLeft = y; bx += BW; y = TOP; await header(); }
  if (row.head) { y -= 3; await txt(bx, y, `${row.head}  (${row.n})`, bold); y -= LH + 1; continue; }
  await txt(bx + COL.t, y, row.t); await txt(bx + COL.q, y, String(row.q)); await txt(bx + COL.sz, y, row.sz);
  await txt(bx + COL.wall, y, row.wall); await txt(bx + COL.sh, y, row.sh); await txt(bx + COL.mat, y, fitMat(row.mat)); y -= LH;
}
y -= 8;
await txt(bx, y, `TOTAL: ${nU} units in ${nT} types, plus ${nHW} fixings.\nSizes are the family's own size (W along its wall, D out from it, H).\nWHERE: the wall it stands on (E/W/R/F when on more), or Free.\nMarks of every unit: see the wall section sheets A-1201 to A-1204.\nHardware, cores, formers and battens are listed on the detail sheets.`);
// RAW MATERIALS (user: "add table for total per raw materials"): net take-off from every unit's solids. Boards and stone:
// m2 of the two big faces' side (one face), thickness = the smallest size, sheets of 2440 x 1220 (net, no waste); linear
// parts (battens, skirting, edging, LED, handles): m along the longest size; hardware and fittings: count. Curved parts
// count their box, so arch skins and formers read a little high: the CNC nesting gives the exact sheets.
const LIN = /Batten|Skirting|Edge|LED|Bar Handle|Softwood(?!.*Core)/i, CNT = /Hinge|Screw|Dowel|Plug|Grommet|Pin|Plate|Sink|Confirmat|Bolt/i;
const raw = new Map();
for (const U of units) for (const it of U.F.items) {
  const m = short(it.m), q = raw.get(m) ?? { m, area: 0, len: 0, n: 0, th: new Set() };
  if (CNT.test(m) || U.cat === "HARDWARE AND FIXINGS") q.n += 1;
  else if (LIN.test(m) && it.d[1] < 120) q.len += it.d[2] / 1000;
  else { q.area += (it.d[1] * it.d[2]) / 1e6; q.th.add(Math.round(it.d[0])); }
  raw.set(m, q);
}
const rawRows = [...raw.values()].sort((a, b) => (a.n ? 2 : a.len ? 1 : 0) - (b.n ? 2 : b.len ? 1 : 0) || b.area - a.area || b.len - a.len || b.n - a.n);
const BOARD = /MDF|EGGER|Pegboard|Carcass|Plywood|Veneer|Top|Board/i;
{
  // fill the free space under the left block first, then under the right block
  const spots = [[30, (yLeft ?? y) - 14], [30 + BW, y - 70]];
  let si = 0, [rx, ry] = spots[0];
  const head = async (title) => { if (title) { await txt(rx, ry, "RAW MATERIALS, TOTAL FOR THE SHOP (net)", bold); ry -= LH + 4; }
    for (const [x, h] of [[0, "MATERIAL"], [240, "THK"], [282, "QTY"], [318, "UNIT"], [345, "2440x1220"]]) await txt(rx + x, ry, h, bold); ry -= LH + 2; };
  await head(true);
  for (const q of rawRows) {
    if (ry < BOT + LH) { if (++si >= spots.length) { console.log("raw materials table too long for the sheet"); break; } [rx, ry] = spots[si]; await head(false); }
    const ths = [...q.th].filter((v) => v > 0 && v < 100).sort((a, b) => a - b), th = ths.length > 2 ? `${ths[0]}-${ths[ths.length - 1]}` : ths.join("/");
    const [qty, unit] = q.n ? [String(q.n), "no."] : q.len ? [q.len.toFixed(1), "m"] : [q.area.toFixed(2), "m2"];
    await txt(rx, ry, q.m.slice(0, 66)); if (!q.n && !q.len && th) await txt(rx + 240, ry, th);
    await txt(rx + 282, ry, qty); await txt(rx + 318, ry, unit);
    if (!q.n && !q.len && BOARD.test(q.m) && q.area > 0.05) await txt(rx + 345, ry, String(Math.ceil(q.area / 2.977)));
    ry -= LH;
  }
  if (ry > BOT + 2 * LH) await txt(rx, ry - 4, "Net areas from the model (one face), no waste. Sheets: 2440 x 1220,\nnet; add the factory waste. Curved parts count their box.");
}
// key plan: every unit in red
const planId = (await call("list_views", {})).views.find((x) => x.name === C.planView)?.id;
const kpD = await call("duplicate_view", { view_id: planId, name: `KP-${NO}`, option: "Duplicate" }), kp = kpD.id ?? kpD.view_id;
for (const [n, x] of [["View Template", -1], ["View Scale", 100], ["Detail Level", 1], ["Title on Sheet", "Key Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(kp, n, x);
await call("set_view_categories", { view_id: kp, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Grids", "OST_Dimensions", "OST_TextNotes"] }).catch(() => {});
for (const U of units.filter((U) => U.H > 300 && U.cat !== "HARDWARE AND FIXINGS")) await call("create_swatch", { view_id: kp, min: P(U.c.x - U.wx / 2, U.c.y - U.wy / 2), max: P(U.c.x + U.wx / 2, U.c.y + U.wy / 2), color: { r: 200, g: 30, b: 30 } }).catch(() => {});
const kv = await call("place_view_on_sheet", { sheet_id: sheet, view_id: kp, location: P(1102, 430) });
await call("set_viewport_no_title", { viewport_id: kv.id }).catch(() => {});
await call("save_document", {});
console.log("done", SN, "units", units.length, "types", rows.size, "blocks", (bx - 30) / BW + 1);
