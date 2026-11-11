// Wall section sheet: the carpentry package goes BY SECTION first (user, Madina 2, 11 Nov 2026: "each sheet for carpentry
// work should be by section not by item, to add measurements for complete view 1st, then we add details per item if needed").
// One sheet per wall: a section looking at the wall with every unit on it, unit widths chained wall to wall (floor units,
// upper units, overall), the levels chained at the side, each unit named by its Mark, a plan strip under it with the depths,
// the list of items with their detail sheets, and the key plan. Units are found by rays, so nothing is typed by hand.
//
// usage: node tools/wall_section_sheet.mjs <fab_config.json> <KEY> [--dry]
// config.sections.KEY = { no, title, group, wall: "-x"|"+x"|"-y"|"+y" (the side of the shop the wall is on),
//                         face (wall face coordinate), from, to (world extent along the wall), reach (how far units stand
//                         off the wall, default 1500), ignore: [regex of names to leave out], note }
import { readFileSync } from "node:fs";
import { call as rawC } from "./rvt.mjs";

const [cfgPath, KEY] = process.argv.slice(2), DRY = process.argv.includes("--dry");
const C = JSON.parse(readFileSync(cfgPath, "utf8")), S = C.sections?.[KEY];
if (!S) throw new Error("no section " + KEY);
const call = async (n, a = {}) => rawC(n, { document: C.doc, ...a });
const setv = (id, n, v) => call("set_parameter", { element_id: id, parameter_name: n, value: String(v) }).catch((e) => console.log("param", n, e.message.slice(0, 90)));
const r = Math.round, P = (x, y, z = 0) => ({ x, y, z });
const SN = `${C.prefix}${S.no}`, PFX = `S${S.no}-`, REACH = S.reach ?? 1500, IGN = S.ignore ? new RegExp(S.ignore.join("|")) : null;

// Wall frame: u along the wall (left to right as seen from the shop), w out from the wall face into the shop.
const FR = { "-x": { N: [1, 0], R: [0, 1] }, "+x": { N: [-1, 0], R: [0, -1] }, "+y": { N: [0, -1], R: [1, 0] }, "-y": { N: [0, 1], R: [-1, 0] } }[S.wall];
const axis = FR.R[0] ? "x" : "y", nAx = FR.N[0] ? "x" : "y";
const O = { x: FR.N[0] ? S.face : 0, y: FR.N[1] ? S.face : 0 };
const W = (u, w, z = 0) => P(O.x + FR.R[0] * u + FR.N[0] * w, O.y + FR.R[1] * u + FR.N[1] * w, z);
const toU = (p) => FR.R[0] * (p.x - O.x) + FR.R[1] * (p.y - O.y), toW = (p) => FR.N[0] * (p.x - O.x) + FR.N[1] * (p.y - O.y);
const [u0, u1] = [toU(P(S.wall.includes("x") ? 0 : S.from, S.wall.includes("x") ? S.from : 0)), toU(P(S.wall.includes("x") ? 0 : S.to, S.wall.includes("x") ? S.to : 0))].sort((a, b) => a - b);
const ray = async (o, d, max = 9000) => (await call("probe_ray", { origin: o, direction: d, max_distance_mm: max, limit: 300, target: "family" })).hits;
const isUnit = (h) => !h.link && /Casework|Generic Models|Furniture|Specialty/.test(h.category) && !(IGN && IGN.test(h.name));

// 1. Units on the wall: rays from the shop straight at the wall over a grid.
const units = new Map();
const add = (h) => { const u = units.get(h.element_id) ?? { id: h.element_id, name: h.name, pts: [] }; u.pts.push({ u: toU(h.point), w: toW(h.point), z: h.point.z }); units.set(h.element_id, u); };
for (let u = u0 + 25; u < u1; u += 75) for (const z of [120, 500, 1000, 1500, 2000, 2350, 2650, 2900]) {
  const o = W(u, REACH, z), hs = await ray(o, { x: -FR.N[0], y: -FR.N[1], z: 0 }, REACH + 50);
  for (const h of hs) if (isUnit(h)) add(h);
}
// thin flat parts (soffits, shelves, tops) are missed by level rays: also look straight down at a few depths
for (let u = u0 + 25; u < u1; u += 75) for (const w of [REACH * 0.2, REACH * 0.45, REACH * 0.7]) {
  for (const h of await ray(W(u, w, (C.ceiling ?? 3000) - 5), { x: 0, y: 0, z: -1 }, 3100)) if (isUnit(h)) add(h);
}
// Each unit's real extent: along the wall through its own points, and up/down at its middle.
for (const U of units.values()) {
  const mid = U.pts[Math.floor(U.pts.length / 2)], us = [], zs = [], ws = U.pts.map((p) => p.w);
  for (const p of [mid, U.pts[0], U.pts[U.pts.length - 1]]) {
    for (const h of await ray(W(u0 - 3000, p.w, p.z), { x: FR.R[0], y: FR.R[1], z: 0 }, u1 - u0 + 6000)) if (h.element_id === U.id) us.push(toU(h.point));
    for (const h of await ray(W(p.u, p.w, -500), { x: 0, y: 0, z: 1 }, 5000)) if (h.element_id === U.id) zs.push(h.point.z);
  }
  U.ua = Math.min(...us, ...U.pts.map((p) => p.u)); U.ub = Math.max(...us, ...U.pts.map((p) => p.u));
  U.za = Math.min(...zs, ...U.pts.map((p) => p.z)); U.zb = Math.max(...zs, ...U.pts.map((p) => p.z));
  U.wa = Math.min(...ws); U.wb = Math.max(...ws);
  const g = await call("get_element", { element_id: U.id }); U.mark = g.parameters.find((p) => p.name === "Mark")?.value || U.name.replace(/^\S+\s/, "");
}
const list = [...units.values()].filter((U) => isFinite(U.ua)).sort((a, b) => a.ua - b.ua);
// ceiling over the run
let ceil = null;
for (const h of await ray(W((u0 + u1) / 2, 300, 1500), { x: 0, y: 0, z: 1 }, 3000)) if (/Ceiling/i.test(h.name)) { ceil = h.point.z; break; }
ceil = S.ceiling ?? C.ceiling ?? ceil ?? 3000;   // the finished ceiling of the shop, not a slab found above a column
const front = Math.max(...list.map((U) => U.wb));
// a tall unit that spans other tall units (one family for both rear corner fillers) is not a bay
const tall0 = list.filter((U) => U.za < 80 && U.zb > 2000);
const tall = tall0.filter((T) => !tall0.some((o) => o !== T && (o.ua + o.ub) / 2 > T.ua && (o.ua + o.ub) / 2 < T.ub && o.ub - o.ua < T.ub - T.ua)), base = list.filter((U) => U.za < 80 && U.zb <= 2000);
const bays = tall.map((T) => ({ T, ua: T.ua, ub: T.ub, units: [T] }));
for (const U of list.filter((U) => !tall.includes(U))) { const c = (U.ua + U.ub) / 2, b = bays.find((B) => c > B.ua && c < B.ub); if (b) b.units.push(U); else bays.push({ ua: U.ua, ub: U.ub, units: [U] }); }
bays.sort((a, b) => a.ua - b.ua);
// label blocks: bays whose middles are close share one block (two blocks at one place overprint)
for (let i = bays.length - 1; i > 0; i--) { const a = bays[i - 1], b = bays[i]; if (Math.abs((a.ua + a.ub) / 2 - (b.ua + b.ub) / 2) < 400) { a.units.push(...b.units); a.ua = Math.min(a.ua, b.ua); a.ub = Math.max(a.ub, b.ub); bays.splice(i, 1); } }
const maxLines = Math.max(...bays.map((B) => new Set(B.units.map((U) => U.mark)).size));
console.log(`${KEY}: ${list.length} units, run ${r(u1 - u0)}, units stand ${r(front)} off the wall, ceiling +${r(ceil)}`);
for (const U of list) console.log(`  ${U.mark.padEnd(12)} u ${r(U.ua)}..${r(U.ub)}  z ${r(U.za)}..${r(U.zb)}  w ${r(U.wa)}..${r(U.wb)}  ${U.name}`);
if (DRY) process.exit(0);

// 2. Scale: the largest that fits the section plus the plan strip in the drawing area left of the text column.
const PLAN_D = front + 300, RUN = u1 - u0 + 900, HT = ceil + 260 + 330 + 700;
const s = [8, 10, 12, 15, 20, 25].find((q) => RUN / q <= 760 && HT / q + PLAN_D / q + 75 <= 775) ?? 25;

// 3. Old sheet and views out.
const stale = (await call("list_views", {})).views.filter((x) => x.name.startsWith(PFX) || x.name === `KP-${S.no}`).map((x) => x.id);
const oldS = (await call("query_elements", { category: "OST_Sheets", parameter_name: "Sheet Number", parameter_value: SN, limit: 5 })).elements.map((e) => e.id);
if (oldS.length) await call("delete_elements", { element_ids: oldS }).catch(() => {});
if (stale.length) await call("delete_elements", { element_ids: stale }).catch(() => {});

// 4. The section, looking at the wall.
const cut = front + 150, zBot = -700, zTop = ceil + 150 + (maxLines * 8.5 + 6) * s;
const sec = await call("create_section", { start: W(u0 - 600, cut), end: W(u1 + 300, cut), look_direction: { x: -FR.N[0], y: -FR.N[1], z: 0 }, bottom_mm: zBot, top_mm: zTop, depth_mm: cut + 600 });
const vS = sec.id ?? sec.view_id;
for (const [n, v] of [["View Name", PFX + "Wall Section"], ["Title on Sheet", S.title], ["View Scale", s], ["Detail Level", 3], ["Hide at scales coarser than", 2]]) await setv(vS, n, v);
await call("set_view_display", { view_id: vS, style: "HLR" }).catch(() => {});
await call("set_view_categories", { view_id: vS, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Levels"] }).catch(() => {});

// Chains (points on the cut plane): floor units, upper units, overall; levels at the left.
const DIMS = [], OVERALL = [];
const dim = async (v, pts, overall = false) => { const d = await call("create_dimension_string", { view_id: v, points: pts, tick_mm: 2.5 * s }).catch((e) => console.log("dim", e.message.slice(0, 90))); if (d?.id) (overall ? OVERALL : DIMS).push(d.id); return d; };
const dimType = async (name) => (await call("list_element_types", { family: "Linear Dimension Style", limit: 100 })).types.find((x) => x.name === name)?.id;
const chain = (vals, min = 60) => { const v = [...vals].sort((a, b) => a - b), out = [v[0]]; for (const x of v.slice(1)) { if (x - out[out.length - 1] >= min) out.push(x); } if (out.length > 1 && v[v.length - 1] - out[out.length - 1] > 1) out[out.length - 1] = v[v.length - 1]; return out; };
const floorU = list.filter((U) => U.za < 80), upperU = list.filter((U) => U.za >= 80);   // floorU kept for the plan
const zc = new Proxy([], { get: (_, i) => -140 - 12 * s * Number(i) });   // chain rows 12 mm apart on paper
const archLike = list.filter((U) => !tall.includes(U) && U.za < 2000 && U.zb > 2000 && U.ub - U.ua > 300 && /Arch Unit|Arch Screen/.test(U.name));
const chains = [[tall.concat(archLike), "arches, piers and fillers"], [base, "base units"]];
let k = 0;
for (const [set] of chains) { if (!set.length) continue; const pts = chain([u0, u1, ...set.flatMap((U) => [U.ua, U.ub])]); await dim(vS, pts.map((u) => W(u, cut, zc[k]))); k++; }
// overall: the set (first unit to last unit) and wall to wall, in the bold overall style (user: "the overall dims to catch
// the eye for the boundary of the set"); overall height of the set on the right, levels on the left
const setA = Math.min(...list.map((U) => U.ua)), setB = Math.max(...list.map((U) => U.ub)), setTop = Math.max(...list.map((U) => Math.min(U.zb, ceil)));
if (setB - setA < u1 - u0 - 5) { await dim(vS, [W(setA, cut, zc[k]), W(setB, cut, zc[k])], true); k++; }
await dim(vS, [W(u0, cut, zc[k]), W(u1, cut, zc[k])], true);
const lv = chain([0, ceil, ...list.flatMap((U) => [U.za, U.zb])].filter((z) => z >= 0 && z <= ceil), 12 * s);
await dim(vS, lv.map((z) => W(u0 - 250, cut, z)));
await dim(vS, [W(u1 + 180, cut, 0), W(u1 + 180, cut, setTop)], true);
// Marks over the units, in up to 3 rows so they do not run into each other (5 mm text: about 3.1 mm a character).
const note = (await call("ensure_text_type", { name: "Sheet Note 5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id;
const red = (await call("ensure_text_type", { name: "Sheet Note 5 Red", size_mm: 5, color: { r: 220, g: 0, b: 0 } })).id;
const bold = (await call("ensure_text_type", { name: "Sheet Heading 5.5", size_mm: 5.5, color: { r: 0, g: 0, b: 0 }, bold: true })).id;
for (const B of bays) {
  const mk = [...new Set(B.units.sort((a, b) => b.zb - a.zb).map((U) => U.mark))], cu = (B.ua + B.ub) / 2;
  const wTxt = Math.max(...mk.map((m) => m.length)) * 3.1 * s;
  await call("create_text_note", { view_id: vS, location: W(cu - wTxt / 2, cut, ceil + 150 + mk.length * 8.5 * s), text: mk.join("\n"), text_type_id: note }).catch((e) => console.log("label", e.message.slice(0, 80)));
}
// 5. Plan strip under it: a plan cut at +1.000, cropped to the wall zone and turned so the wall runs left to right on top.
const lvl = (await call("list_levels", {})).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const fp = await call("create_floor_plan", { level_id: lvl, name: PFX + "Plan" }), vP = fp.id ?? fp.view_id;
for (const [n, v] of [["View Template", -1], ["View Scale", s], ["Detail Level", 3], ["Title on Sheet", "Plan at +1.000"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(vP, n, v);
await call("set_view_categories", { view_id: vP, hide: ["OST_Levels", "OST_Grids"] }).catch(() => {});
await call("set_view_display", { view_id: vP, style: "HLR" }).catch(() => {});
await call("set_view_range", { view_id: vP, top_mm: 2500, cut_mm: 1000, bottom_mm: 0 }).catch(() => {});
await call("set_view_categories", { view_id: vP, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines"] }).catch(() => {});
const c1 = W(u0 - 600, -350), c2 = W(u1 + 300, PLAN_D);
const ang = { "+y": 0, "-x": 90, "+x": -90, "-y": 180 }[S.wall];
{ // the crop box turns about its centre: set it turned the other way first, so it lands on the wall zone
  const mx = (c1.x + c2.x) / 2, my = (c1.y + c2.y) / 2, hx = Math.abs(c1.x - c2.x) / 2, hy = Math.abs(c1.y - c2.y) / 2, q = Math.abs(ang) === 90;
  const ex = q ? hy : hx, ey = q ? hx : hy;
  await call("set_view_crop", { view_id: vP, min_mm: P(mx - ex, my - ey), max_mm: P(mx + ex, my + ey) }).catch((e) => console.log("plan crop", e.message.slice(0, 90)));
}
let turned = ang === 0;
if (!turned) turned = await call("rotate_view_crop", { view_id: vP, angle_degrees: ang }).then(() => true).catch((e) => { console.log("plan turn", e.message.slice(0, 90)); return false; });
// depth chains in the plan, one per bay at its middle: wall face, then each distinct unit front in that bay
await dim(vP, [W(u1 + 150, 0, 0), W(u1 + 150, front, 0)], true);
for (const B of bays.filter((B) => B.ub - B.ua > 150)) {
  const ws = chain([0, ...B.units.map((U) => U.wb)], 12 * s); if (ws.length < 2) continue;
  await dim(vP, ws.map((w) => W((B.ua + B.ub) / 2, w, 0)));
}

{ const std = await dimType("Samaya ISO 129-1 Blue 5mm"), ov = (await dimType("Samaya ISO 129-1 Blue 7mm Overall")) ?? std;
  for (const id of DIMS) if (std) await call("set_element_type", { element_id: id, type_id: std }).catch(() => {});
  for (const id of OVERALL) if (ov) await call("set_element_type", { element_id: id, type_id: ov }).catch(() => {}); }

// 6. Sheet.
const tb = (await call("list_element_types", { category: "OST_TitleBlocks" })).types.find((x) => x.name === (C.titleBlock ?? "Samaya Factory A0")).id;
const sheet = (await call("create_sheet", { number: SN, name: S.title, title_block_type_id: tb })).id;
await setv(sheet, "Sheet Group", S.group ?? "2 Fab: 0 Wall Sections");
const tbi = (await call("query_elements", { category: "OST_TitleBlocks", view_id: sheet, limit: 5 })).elements[0]?.id;
for (const [n, v] of C.signoff) { await setv(sheet, n, v); if (tbi) await setv(tbi, n, v); }
await call("set_sheet_revisions", { sheet_ids: [sheet], revision_ids: S.revisions ?? C.revisions });
const place = (v, x, y) => call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(x, y) });
const wS = (u1 - u0 + 900) / s, hS = (zTop - zBot) / s, hP = (PLAN_D + 350) / s, cx = 30 + Math.max(wS, 200) / 2;
await place(vS, cx, 810 - hS / 2);
if (turned) await place(vP, cx, 810 - hS - 45 - hP / 2);
// text column: title, items with their detail sheets, notes
const sheets = [];
for (const e of (await call("query_elements", { category: "OST_Sheets", limit: 400 })).elements) {
  const g = await call("get_element", { element_id: e.id }); const num = g.parameters.find((p) => p.name === "Sheet Number")?.value ?? "";
  if (!/-A-2\d{3}$/.test(num)) continue;
  const tok = (g.parameters.find((p) => p.name === "Sheet Name")?.value ?? e.name).split(" ").pop();
  sheets.push({ tok, num: num.replace(C.prefix, "A-").replace(/^.*-A-/, "A-") });
}
const detailOf = (mark) => sheets.filter((x) => mark === x.tok || mark.startsWith(x.tok + "-")).sort((a, b) => b.tok.length - a.tok.length)[0]?.num ?? "-";
const NOTES = 815, txt = (x, y, t, ty = note) => call("create_text_note", { view_id: sheet, location: P(x, y), text: t, text_type_id: ty });
await txt(NOTES, 812, `${S.title.toUpperCase()}\nRun ${r(u1 - u0)} wall to wall, scale 1:${s}\nAll units on this wall, as built`, bold);
// BOM by item category, one row per unit type on this wall: type, qty, size W x D x H, detail sheet (user: "BOM to be added
// per item categories by unit").
const CATS = [[/Arch Unit|Arch Screen|Back Legs/, "ARCH UNITS"], [/L Fascia/, "L FASCIA HEADS (WOOD + MARBLE)"], [/Spandrel/, "SPANDREL CLADDING"],
  [/Open Shelf Unit|Pegboard Filler/, "SHELF AND PEGBOARD UNITS"], [/Base Cabinet|Open Shelf Base|Counter/, "BASE UNITS AND COUNTERS"],
  [/Filler/, "FILLERS"], [/Column Cladding|Back Panel|Cladding/, "CLADDING AND BACK PANELS"], [/Services Cabinet/, "SERVICES CABINETS"], [/Carpet Hanger|Hanger/, "FITTINGS"]];
const catOf = (n) => CATS.find(([re]) => re.test(n))?.[1] ?? "OTHER";
const byType = new Map();
for (const U of list) { const k = U.name; const g = byType.get(k) ?? { name: k, units: [] }; g.units.push(U); byType.set(k, g); }
const label = (g) => { const ms = g.units.map((U) => U.mark); if (ms.length === 1) return ms[0]; let p = ms[0]; for (const m of ms) while (!m.startsWith(p)) p = p.slice(0, -1); return p.replace(/-$/, "") || ms[0]; };
const rowsB = [];
// size from the family's own solids (exact), turned into the wall frame: W along the wall, D out from it, H
const famSize = async (U) => {
  const it = (await call("inspect_family", { element_id: U.id })).items.filter((i) => i.material && i.min && /FreeForm|Extrusion|Blend|Sweep|Revolution/.test(i.class));
  if (!it.length) return `${r(U.ub - U.ua)} x ${r(U.wb - U.wa)} x ${r(Math.min(U.zb, ceil) - U.za)}`;
  const ex = (k) => Math.max(...it.map((i) => i.max[k])) - Math.min(...it.map((i) => i.min[k]));
  const g = await call("get_element", { element_id: U.id }), rd = (((g.location?.rotation_deg ?? 0) % 180) + 180) % 180;
  const lx = rd === 90 ? ex("y") : ex("x"), ly = rd === 90 ? ex("x") : ex("y");   // world x and y extents
  const Wd = axis === "x" ? lx : ly, Dd = axis === "x" ? ly : lx;
  return `${r(Wd)} x ${r(Dd)} x ${r(ex("z"))}`;
};
for (const [, cat] of [...CATS, [null, "OTHER"]]) {
  const gs = [...byType.values()].filter((g) => catOf(g.name) === cat).sort((a, b) => a.units[0].ua - b.units[0].ua);
  if (!gs.length) continue;
  rowsB.push({ head: cat });
  for (const g of gs) { const U = g.units[0]; rowsB.push({ m: label(g), q: g.units.length, sz: await famSize(U), sh: detailOf(U.mark) }); }
}
const marks = [...new Set(list.map((U) => U.mark))];
await txt(NOTES, 772, "BOM BY CATEGORY, PER UNIT", bold);
await txt(NOTES, 760, "TYPE", bold); await txt(NOTES + 58, 760, "QTY", bold); await txt(NOTES + 75, 760, "W x D x H", bold); await txt(NOTES + 140, 760, "SHEET", bold);
let yb = 748;
for (const row of rowsB) {
  if (row.head) { yb -= 3; await txt(NOTES, yb, row.head, bold); yb -= 8.5; continue; }
  await txt(NOTES, yb, row.m); await txt(NOTES + 60, yb, String(row.q)); await txt(NOTES + 75, yb, row.sz); await txt(NOTES + 140, yb, row.sh); yb -= 7.8;
}
const yN = yb - 10;
const noteTxt = `${S.note ? S.note + "\n" : ""}Bold dimensions: overall set and wall
to wall, overall height and depth.
Widths chained: arches, piers and fillers;
base units. Levels at the left from FFL.
Sizes W x D x H as built, in mm.
Item details: see the detail sheets.
Check on site.`;
await txt(NOTES, yN, noteTxt);
// Photos of the finish materials on this wall (user: "add photo for the materials used in this sheet"), from the approved
// colour folder: config.materialPhotos = [{ match: regex on the material name, file: image path or null, label }].
if (C.materialPhotos?.length) {
  const famMats = new Map(), used = new Set();
  for (const U of list) { const fam = U.name; if (!famMats.has(fam)) famMats.set(fam, [...new Set((await call("inspect_family", { element_id: U.id })).items.filter((i) => i.material).map((i) => i.material))]); famMats.get(fam).forEach((m) => used.add(m)); }
  const photos = C.materialPhotos.filter((p) => [...used].some((m) => new RegExp(p.match, "i").test(m)));
  // paint (user: "and paint code and color"): config.paints = [{ match, code, name, rgb: [r,g,b] | null }] -> a solid swatch
  // on the sheet (create_swatch), labelled with the code and colour name; no approved code: red "code to confirm"
  for (const pt of C.paints ?? []) {
    if (![...used].some((m) => new RegExp(pt.match, "i").test(m))) continue;
    photos.push({ file: null, rgb: pt.rgb, label: pt.code ? `${pt.code}\n${pt.name}` : `${pt.name}\nto confirm`, red: !pt.code });
  }
  const yP0 = yN - (noteTxt.split("\n").length + 1) * 7.8 - 8;
  if (photos.length) {
    await txt(NOTES, yP0, "FINISH MATERIALS AND PAINT (APPROVED)", bold);
    const PW = 44, GAP = 5;
    for (const [k, p] of photos.entries()) {
      const cx = NOTES + PW / 2 + (k % 4) * (PW + GAP), cy = yP0 - 14 - PW / 2 - Math.floor(k / 4) * (PW + 22);
      if (p.file) await call("place_image", { view_id: sheet, path: p.file, center: P(cx, cy), width_mm: PW, height_mm: PW }).catch((e) => console.log("photo", p.label, e.message.slice(0, 90)));
      else if (p.rgb) await call("create_swatch", { view_id: sheet, min: P(cx - PW / 2, cy - PW / 2), max: P(cx + PW / 2, cy + PW / 2), color: { r: p.rgb[0], g: p.rgb[1], b: p.rgb[2] } }).catch((e) => console.log("swatch", e.message.slice(0, 80)));
      else await txt(cx - PW / 2 + 2, cy + 6, p.red ? "colour\nto confirm" : "photo\nto follow", p.red ? red : note);
      await txt(cx - PW / 2, cy - PW / 2 - 3, p.label, p.red ? red : note);
    }
  }
}
// key plan: the wall zone in red
const planId = (await call("list_views", {})).views.find((x) => x.name === C.planView)?.id;
const kpD = await call("duplicate_view", { view_id: planId, name: `KP-${S.no}`, option: "Duplicate" }), kp = kpD.id ?? kpD.view_id;
for (const [n, x] of [["View Template", -1], ["View Scale", 100], ["Detail Level", 1], ["Title on Sheet", "Key Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(kp, n, x);
await call("set_view_categories", { view_id: kp, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Grids", "OST_Dimensions", "OST_TextNotes"] }).catch(() => {});
const k1 = W(u0, 0), k2 = W(u1, front);
await call("create_swatch", { view_id: kp, min: P(Math.min(k1.x, k2.x), Math.min(k1.y, k2.y)), max: P(Math.max(k1.x, k2.x), Math.max(k1.y, k2.y)), color: { r: 200, g: 30, b: 30 } });
const kv = await call("place_view_on_sheet", { sheet_id: sheet, view_id: kp, location: P(1102, 430) });
await call("set_viewport_no_title", { viewport_id: kv.id }).catch(() => {});
await call("save_document", {});
console.log("done", KEY, SN, "scale 1:" + s, "units", list.length, "marks", marks.length, "plan turned", turned);
