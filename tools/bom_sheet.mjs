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
const old = (await call("query_elements", { category: "OST_Sheets", parameter_name: "Sheet Number", parameter_value: SN, limit: 5 })).elements.map((e) => e.id).concat((await call("query_elements", { category: "OST_Sheets", parameter_name: "Sheet Number", parameter_value: SN + "A", limit: 5 })).elements.map((e) => e.id));
if (old.length) await call("delete_elements", { element_ids: old }).catch(() => {});
const stale = (await call("list_views", {})).views.filter((x) => x.name === `KP-${NO}` || x.name === `KP-${NO}A`).map((x) => x.id);
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
await txt(bx, y, `TOTAL: ${nU} units in ${nT} types, plus ${nHW} fixings.\nSizes are the family's own size (W along its wall, D out from it, H).\nWHERE: the wall it stands on (E/W/R/F when on more), or Free.\nMarks of every unit: see the wall section sheets A-1201 to A-1204.\nRaw materials as bought (sheets, m2, m3, lengths, rolls, litres,
pieces): see sheet A-${NO}A.`);
// RAW MATERIALS, as we buy them (user: "raw materials to be its UOM as we buy it and to be sum"): every solid of every unit
// is classed by the purchase rules in standards/sultan-standards.json (purchase.rules; a project may override with bom.purchase):
// boards in sheets of their stock size, stone and glass in m2, solid timber in m3, softwood and steel in stock lengths, edging
// and LED in rolls, paint in litres (area x coats / coverage), hardware in pieces. One line per material and thickness, summed
// over the whole shop; BUY = net + waste, rounded up to what is bought; totals per UOM at the end.
const STD = JSON.parse(readFileSync(new URL("../standards/sultan-standards.json", import.meta.url), "utf8")).purchase ?? {};
const PR = { ...STD, ...(B.purchase ?? {}) }, WASTE = 1 + (PR.waste_pct ?? 10) / 100, RULES = (PR.rules ?? []).map((q) => ({ ...q, re: new RegExp(q.match, "i") }));
const PAINT = PR.paint ? { ...PR.paint, re: new RegExp(PR.paint.match, "i") } : null;
// the item we buy: raw boards are bought raw and finished here, so painted, cut and drilled versions sum into one line
const RAWM = (PR.raw?.map ?? []).map((q) => ({ ...q, re: new RegExp(q.match, "i") })), STRIP = PR.raw?.strip ? new RegExp(PR.raw.strip, "gi") : null;
const rawName = (m) => RAWM.find((q) => q.re.test(m))?.item ?? (STRIP ? m.replace(STRIP, " ").replace(/\s+/g, " ").trim() || m : m);
const ruleOf = (m) => RULES.find((q) => q.re.test(m)) ?? { uom: "m2", by: "area", round: 0.1, other: true };
const raw = new Map();
const line = (key, m, rule, th) => { const q = raw.get(key) ?? { m, rule, th, area: 0, vol: 0, len: 0, n: 0 }; raw.set(key, q); return q; };
const mainTh = new Map();   // material -> thickness with the most area among its flat parts
{ const acc = new Map(); for (const U of units) for (const it of U.F.items) { const m = rawName(short(it.m)); if (it.d[0] > 40) continue; const k = m + "|" + Math.round(it.d[0]); acc.set(k, (acc.get(k) ?? 0) + it.d[1] * it.d[2]); }
  for (const [k, a] of acc) { const [m, th] = k.split("|"); if (!mainTh.has(m) || a > mainTh.get(m)[1]) mainTh.set(m, [Number(th), a]); } }
for (const U of units) for (const it of U.F.items) {
  const m0 = short(it.m), hw = U.cat === "HARDWARE AND FIXINGS", m = hw ? m0 : rawName(m0), [d0, d1, d2] = it.d;
  const rule = hw ? { uom: "pcs", by: "count" } : RULES.find((q) => q.re.test(m0) && /Top/.test(q.match)) ?? ruleOf(m);
  const th = rule.by === "area" && rule.stock ? (d0 <= 40 ? Math.round(d0) : mainTh.get(m)?.[0] ?? Math.round(Math.min(d0, 40))) : null;
  const q = line(m + "|" + (th ?? ""), m, rule, th);
  if (rule.by === "count") q.n += 1; else if (rule.by === "length") q.len += d2 / 1000; else if (rule.by === "volume") q.vol += (d0 * d1 * d2) / 1e9; else q.area += (d1 * d2) / 1e6;
  if (!hw && PAINT && PAINT.re.test(m0)) { const pk = /\bRAL\b/i.test(m0) ? "RAL" : m0.replace(/^.*?\b(Paint|ptd\.)\s*/i, "").trim() || m0; line("PAINT|" + pk, "Paint " + pk + " (code to confirm)", { uom: PAINT.uom, by: "paint" }, null).area += (d1 * d2) / 1e6; }
}
const up = (v, step) => Math.ceil(v / step - 1e-9) * step;
const buyOf = (q) => {
  const R = q.rule;
  if (R.by === "count") return { net: String(q.n), buy: q.n };
  if (R.by === "paint") { const l = (q.area * (PAINT.coats ?? 2)) / (PAINT.coverage_m2_per_l ?? 10); return { net: q.area.toFixed(1) + " m2", buy: Math.ceil(l * WASTE) }; }
  if (R.by === "volume") return { net: q.vol.toFixed(3) + " m3", buy: up(q.vol * WASTE, R.round ?? 0.01).toFixed(2) };
  if (R.by === "length") return { net: q.len.toFixed(1) + " m", buy: R.stock ? Math.ceil((q.len * WASTE) / R.stock) : up(q.len * WASTE, 1) };
  return { net: q.area.toFixed(2) + " m2", buy: R.stock ? Math.ceil((q.area * WASTE) / R.stock) : up(q.area * WASTE, R.round ?? 0.1).toFixed(1) };
};
const ORDER = ["sheet", "m2", "m3", "pcs 4", "pcs 6", "roll", "L", "pcs"];
const rank = (u) => { const i = ORDER.findIndex((o) => u.startsWith(o)); return i < 0 ? 99 : i; };
const rawRows = [...raw.values()].filter((q) => q.area + q.vol + q.len + q.n > 1e-6).map((q) => ({ ...q, ...buyOf(q) }))
  .sort((a, b) => rank(a.rule.uom) - rank(b.rule.uom) || a.rule.uom.localeCompare(b.rule.uom) || a.m.localeCompare(b.m) || (a.th ?? 0) - (b.th ?? 0));
// totals per UOM (sheets of one size together, and so on)
const totals = new Map(); for (const q of rawRows) totals.set(q.rule.uom, (totals.get(q.rule.uom) ?? 0) + Number(q.buy));
// on its own continuation sheet (number + "A"): the whole purchase list needs more room than the BOM leaves
const SNA = SN + "A";
for (const e of (await call("query_elements", { category: "OST_Sheets", parameter_name: "Sheet Number", parameter_value: SNA, limit: 5 })).elements) await call("delete_elements", { element_ids: [e.id] }).catch(() => {});
const sheetA = (await call("create_sheet", { number: SNA, name: (B.title ?? "Overall BOM - Carpentry").replace(/ - Carpentry$/, "") + " - Raw Materials", title_block_type_id: tb })).id;
await setv(sheetA, "Sheet Group", B.group ?? "2 Fab: 0 Wall Sections");
{ const ti = (await call("query_elements", { category: "OST_TitleBlocks", view_id: sheetA, limit: 5 })).elements[0]?.id; for (const [n, v] of C.signoff) { await setv(sheetA, n, v); if (ti) await setv(ti, n, v); } }
await call("set_sheet_revisions", { sheet_ids: [sheetA], revision_ids: B.revisions ?? C.revisions });
const txtA = (x, yy, s, ty = note) => (String(s ?? "").trim() ? call("create_text_note", { view_id: sheetA, location: P(x, yy), text: String(s), text_type_id: ty }) : null);
await txtA(30, 818, `RAW MATERIALS AS BOUGHT, TOTAL FOR THE SHOP: summed over all ${units.length - units.filter((U) => U.cat === "HARDWARE AND FIXINGS").length} units and their fixings (BUY = net + ${PR.waste_pct ?? 10}% waste)`, bold);
{
  const txt = txtA;
  const spots = [[30, 790], [30 + BW, 790]];
  let si = 0, [rx, ry] = spots[0];
  const head = async (title) => {
    for (const [x, h] of [[0, "RAW MATERIAL"], [222, "THK"], [248, "NET"], [300, "BUY"], [330, "UOM"]]) await txt(rx + x, ry, h, bold); ry -= LH + 2; };
  const next = async () => { if (ry < BOT + LH) { if (++si >= spots.length) return false; [rx, ry] = spots[si]; await head(false); } return true; };
  await head(true);
  for (const q of rawRows) {
    if (!(await next())) { console.log("raw materials table too long for the sheet"); break; }
    await txt(rx, ry, (q.rule.other ? q.m + " (no buy rule)" : q.m).slice(0, 62)); if (q.th) await txt(rx + 222, ry, String(q.th));
    await txt(rx + 248, ry, q.net); await txt(rx + 300, ry, String(q.buy)); await txt(rx + 330, ry, q.rule.uom); ry -= LH;
  }
  ry -= 4;
  if (await next()) { await txt(rx, ry, "TOTALS TO BUY", bold); ry -= LH + 1; }
  for (const [u, v] of [...totals].filter(([u]) => /^(sheet|pcs [0-9]|roll|L$|m3)/.test(u)).sort((a, b) => rank(a[0]) - rank(b[0]))) { if (!(await next())) break; await txt(rx, ry, u); await txt(rx + 300, ry, Number.isInteger(v) ? String(v) : v.toFixed(2)); ry -= LH; }
  if (await next()) await txt(rx, ry - 4, "Net from the model (one face; curved parts by their box). Buy units\nand sheet sizes: standards purchase rules; confirm with purchasing.");
}
// key plan: every unit in red
const planId = (await call("list_views", {})).views.find((x) => x.name === C.planView)?.id;
const kpD = await call("duplicate_view", { view_id: planId, name: `KP-${NO}`, option: "Duplicate" }), kp = kpD.id ?? kpD.view_id;
for (const [n, x] of [["View Template", -1], ["View Scale", 100], ["Detail Level", 1], ["Title on Sheet", "Key Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(kp, n, x);
await call("set_view_categories", { view_id: kp, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Grids", "OST_Dimensions", "OST_TextNotes"] }).catch(() => {});
for (const U of units.filter((U) => U.H > 300 && U.cat !== "HARDWARE AND FIXINGS")) await call("create_swatch", { view_id: kp, min: P(U.c.x - U.wx / 2, U.c.y - U.wy / 2), max: P(U.c.x + U.wx / 2, U.c.y + U.wy / 2), color: { r: 200, g: 30, b: 30 } }).catch(() => {});
const kv = await call("place_view_on_sheet", { sheet_id: sheet, view_id: kp, location: P(1102, 430) });
await call("set_viewport_no_title", { viewport_id: kv.id }).catch(() => {});
{ const kpA = (await call("duplicate_view", { view_id: kp, name: `KP-${NO}A`, option: "WithDetailing" }).catch(() => null)) ?? null;
  const ka = kpA?.id ?? kpA?.view_id; if (ka) { await setv(ka, "Title on Sheet", "Key Plan"); const kva = await call("place_view_on_sheet", { sheet_id: sheetA, view_id: ka, location: P(1102, 430) }); await call("set_viewport_no_title", { viewport_id: kva.id }).catch(() => {}); } }
await call("save_document", {});
console.log("done", SN, "units", units.length, "types", rows.size, "blocks", (bx - 30) / BW + 1);
