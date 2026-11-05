// Metal factory sheet for the factory pegboard system (tools/pegboard_system.mjs, Madina 1 standard): the split steel plates
// with their Ø21 hole grid, the side angles, a plan detail of the build-up, a cut list, notes and key plan, plus one 1:1 DXF
// per plate type for the laser. Plate sizes and the hole grid are read from each open shelf unit family (its board and plate
// solids) and the grid rule in pegboard_system.mjs, so the sheet always matches the model.
//
// Usage: node tools/pegboard_metal_sheet.mjs <config.json>
// Config: the fab_sheet.mjs config plus
//   metal: { no: 2401, title: "Pegboard Steel Plates", group: "2 Fab: Metal Parts", units: ["OS-A", ...] (keys in units),
//            dxfDir: "<folder for the DXF files>", dxfPrefix: "MAK" }
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { call as rawC } from "./rvt.mjs";
import { SPEC } from "./pegboard_system.mjs";

const C = JSON.parse(readFileSync(process.argv[2], "utf8")), M = C.metal;
const call = async (n, a = {}) => { try { return await rawC(n, { document: C.doc, ...a }); } catch (e) { console.log("FAIL", n, e.message.slice(0, 120)); throw e; } };
const setv = (id, n, v) => call("set_parameter", { element_id: id, parameter_name: n, value: String(v) }).catch((e) => console.log("param", n, e.message.slice(0, 90)));
const P = (x, y, z = 0) => ({ x, y, z }), r = Math.round, f1 = (v) => (Math.round(v * 10) / 10).toString();
const LOG = C.log, log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : {};
const SN = `${C.prefix}${M.no}`, P_ = `M${M.no}-`;
const note = (await call("ensure_text_type", { name: "Sheet Note 5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id;
const bold = (await call("ensure_text_type", { name: "Sheet Heading 5.5", size_mm: 5.5, color: { r: 0, g: 0, b: 0 }, bold: true })).id;

// Old sheet and views out.
const stale = (await call("list_views", {})).views.filter((x) => x.name.startsWith(P_) || x.name === `KP-${M.no}`).map((x) => x.id);
const oldS = (await call("query_elements", { category: "OST_Sheets", parameter_name: "Sheet Number", parameter_value: SN, limit: 5 })).elements.map((e) => e.id);
if (oldS.length) await call("delete_elements", { element_ids: oldS }).catch(() => {});
if (stale.length) await call("delete_elements", { element_ids: stale }).catch(() => {});

const byMark = async (mark) => { for (const c of ["OST_Casework", "OST_GenericModel", "OST_Furniture"]) { const q = (await call("query_elements", { category: c, parameter_name: "Mark", parameter_value: mark, limit: 20 })).elements; for (const e of q) { const g = await call("get_element", { element_id: e.id }); if (g.parameters.find((p) => p.name === "Mark")?.value === mark) return g; } } return null; };

// Plate data per unit type, from the family solids (family coordinates; only sizes are used, so rotation does not matter).
const types = [];
for (const key of M.units) {
  const t = C.units[key], g = await byMark(t.ref); if (!g) throw new Error("no unit " + t.ref);
  const items = (await call("inspect_family", { element_id: g.id })).items.filter((f) => (f.class === "FreeFormElement" || f.class === "Extrusion") && f.min);
  const sz = (f) => [f.max.x - f.min.x, f.max.y - f.min.y, f.max.z - f.min.z];
  const steel = items.filter((f) => /steel/i.test(f.material ?? ""));
  const core = items.filter((f) => /pegboard core|FR MDF 18 Pegboard/i.test(f.material ?? "")).sort((a, c) => sz(c)[2] - sz(a)[2])[0];
  if (!core || !steel.length) throw new Error(`${t.ref}: no pegboard board or steel parts in the family`);
  // along-unit axis: the long horizontal side of the board
  const ax = sz(core)[0] > sz(core)[1] ? "x" : "y";
  const plates = steel.filter((f) => sz(f)[ax === "x" ? 0 : 1] > 100), angles = steel.filter((f) => sz(f)[ax === "x" ? 0 : 1] <= 5);
  const py0 = core.min[ax], py1 = core.max[ax], Cc = (py0 + py1) / 2, zP0 = core.min.z, zP1 = core.max.z;
  const cols = []; for (let k = 0; 25 + 50 * k <= (py1 - py0) / 2 - 45; k++) cols.push(25 + 50 * k);  // from the centre line
  const rows = []; for (let z = zP0 + 27.5; z <= zP1 - 25; z += SPEC.PITCH) rows.push(z);
  const pl = plates.find((f) => f.max[ax] <= Cc + 1) ?? plates[0];
  const pz0 = pl.min.z, pW = r(pl.max[ax] - pl.min[ax]), pH = r(pl.max.z - pl.min.z);
  // holes in the left plate, plate origin at its bottom-left; the right plate is the same plate turned 180 degrees
  const hx = cols.map((c) => (Cc - c) - pl.min[ax]).sort((a, c) => a - c), hz = rows.map((z) => z - pz0);
  const ang = angles[0], aL = ang ? r(ang.max.z - ang.min.z) : pH, aD = ang ? r(Math.max(sz(ang)[0], sz(ang)[1])) : 34;
  types.push({ key, t, n: t.marks.length, pW, pH, hx, hz, aL, aD, holes: hx.length * hz.length, boardW: r(py1 - py0) });
  console.log(key, "plate", pW, "x", pH, "holes", hx.length, "x", hz.length, "angle", aD, "x", aL, "board", r(py1 - py0));
}

// DXF, 1:1 mm, one file per plate type: outline + holes (R12 ASCII, LINE and CIRCLE only, readable by any laser software).
if (M.dxfDir) {
  mkdirSync(M.dxfDir, { recursive: true });
  for (const T of types) {
    const e = [], L = (a, b, c, d, lay = "CUT") => e.push(`0\nLINE\n8\n${lay}\n10\n${a}\n20\n${b}\n30\n0\n11\n${c}\n21\n${d}\n31\n0`);
    L(0, 0, T.pW, 0); L(T.pW, 0, T.pW, T.pH); L(T.pW, T.pH, 0, T.pH); L(0, T.pH, 0, 0);
    for (const x of T.hx) for (const z of T.hz) e.push(`0\nCIRCLE\n8\nCUT\n10\n${f1(x)}\n20\n${f1(z)}\n30\n0\n40\n${SPEC.HOLE_R}`);
    const f = `${M.dxfDir}/${M.dxfPrefix ?? "PRJ"}-${T.key}-PLATE-2mm.dxf`;
    writeFileSync(f, `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${e.join("\n")}\n0\nENDSEC\n0\nEOF\n`);
    T.dxf = f.split("/").pop();
    console.log("dxf", f);
  }
}

// Drafting views: per type the plate (1:5) with its hole grid and the side angle beside it.
const S5 = 5, txt3 = (await call("ensure_text_type", { name: "Sheet Note 3.5", size_mm: 3.5, color: { r: 0, g: 0, b: 0 } })).id;
const dim = (v, pts, off) => {
  const u = pts.filter((q, k) => k === 0 || Math.hypot(q.x - pts[k - 1].x, q.y - pts[k - 1].y) > 1); // no zero-length steps
  return u.length < 2 ? null : call("create_dimension_string", { view_id: v, points: u, offset_mm: off, witness: true, tick_mm: 6 }).catch((e) => console.log("dim", e.message.slice(0, 90)));
};
const rect = (x0, y0, x1, y1) => [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]].map(([a, b, c, d]) => ({ start: P(a, b), end: P(c, d) }));
const lines = (v, ls) => call("create_detail_lines", { view_id: v, lines: ls });
const views = [];
for (const T of types) {
  const v = (await call("create_drafting_view", { name: `${P_}${T.key} Plate`, scale: S5 })).id;
  await setv(v, "Title on Sheet", `${T.key} Steel Plate`);
  const ls = rect(0, 0, T.pW, T.pH);
  for (const x of T.hx) for (const z of T.hz) ls.push({ start: P(x - SPEC.HOLE_R, z), end: P(x + SPEC.HOLE_R, z), mid: P(x, z + SPEC.HOLE_R) }, { start: P(x + SPEC.HOLE_R, z), end: P(x - SPEC.HOLE_R, z), mid: P(x, z - SPEC.HOLE_R) });
  const ax0 = T.pW + 180; ls.push(...rect(ax0, 0, ax0 + T.aD, T.aL));                   // side angle, 2 per unit
  for (let k = 0; k < ls.length; k += 400) await lines(v, ls.slice(k, k + 400));
  const off = 12 * S5;
  await dim(v, [P(0, 0), P(T.pW, 0)], -2 * off);
  await dim(v, [P(0, 0), ...T.hx.map((x) => P(x, 0)), P(T.pW, 0)], -off);
  await dim(v, [P(0, 0), P(0, T.pH)], 2 * off);
  await dim(v, [P(0, 0), P(0, T.hz[0]), P(0, T.hz.at(-1)), P(0, T.pH)], off);
  await dim(v, [P(ax0, 0), P(ax0 + T.aD, 0)], -off);
  await dim(v, [P(ax0 + T.aD, 0), P(ax0 + T.aD, T.aL)], -off);
  const tn = (x, y, s) => call("create_text_note", { view_id: v, location: P(x, y), text: s, text_type_id: txt3 });
  await tn(30, T.pH + 120, `Plate 2 mm, ${T.pW} x ${T.pH}\n${T.hz.length} rows x ${T.hx.length} = ${T.holes} holes Ø21\nRows ${T.hz.length - 1} x 50 = ${(T.hz.length - 1) * 50}`);
  await tn(ax0 - 20, T.pH + 120, `Side angle\n2 mm, ${T.aD} leg\nL = ${T.aL}`);
  views.push({ v, w: (T.pW + 180 + T.aD + 2 * 120) / S5, h: (T.pH + 400) / S5 });
}

// Plan detail of the build-up at 1:2: the side (angle, plates, space, board) and the centre split of the plates.
const S2 = 1, vd = (await call("create_drafting_view", { name: `${P_}Build-up`, scale: S2 })).id;
await setv(vd, "Title on Sheet", "Build-up (plan) 1:1");
{
  const L = [], X = [0, SPEC.PLATE, SPEC.PLATE + SPEC.SPACE, 2 * SPEC.PLATE + SPEC.SPACE, 2 * SPEC.PLATE + SPEC.SPACE + SPEC.FR, 2 * SPEC.PLATE + SPEC.SPACE + SPEC.FR + SPEC.EG]; // 0 2 32 34 52 60
  // y = depth (0 = back of unit, up = towards the room); x = along the unit. Side panel at x -18..0.
  L.push(...rect(-18, -10, 0, X[5] + 40));                                   // side panel EGGER 18
  L.push(...rect(0, X[0], SPEC.ANGLE, X[3]));                                // side angle 2 x 34 (on the side)
  L.push(...rect(SPEC.ANGLE, X[0], 140, X[1]), ...rect(SPEC.ANGLE, X[2], 140, X[3])); // rear and front plate, left half
  L.push(...rect(SPEC.ANGLE, X[3], 140, X[4]), ...rect(SPEC.ANGLE, X[4], 140, X[5])); // FR MDF 18 + EGGER 8
  // centre split, drawn 120 to the right with a break: plates stop 2.5 each side of the centre, board runs through
  const c = 260; L.push(...rect(c - 80, X[0], c - 2.5, X[1]), ...rect(c + 2.5, X[0], c + 80, X[1]), ...rect(c - 80, X[2], c - 2.5, X[3]), ...rect(c + 2.5, X[2], c + 80, X[3]));
  L.push(...rect(c - 80, X[3], c + 80, X[4]), ...rect(c - 80, X[4], c + 80, X[5]));
  for (const x of [150, 170]) L.push({ start: P(x, -15), end: P(x, X[5] + 15) });  // break lines
  await lines(vd, L);
  await dim(vd, X.map((y) => P(-18, y)), 40);
  await dim(vd, [P(c - 2.5, 0), P(c + 2.5, 0)], -25);
  const tn = (x, y, s) => call("create_text_note", { view_id: vd, location: P(x, y), text: s, text_type_id: txt3 });
  await tn(-60, X[5] + 50, "Side panel EGGER 18");
  await tn(10, -25, "Side angle 2 mm");
  await tn(40, X[5] + 40, "EGGER 8 face\nFR MDF 18 core");
  await tn(40, 22, "30 space (wiring)");
  await tn(c - 70, -25, "5 gap: left and right\nplates must not touch");
}

// Sheet.
const tb = (await call("list_element_types", { category: "OST_TitleBlocks" })).types.find((x) => x.name === (C.titleBlock ?? "Samaya Factory A0")).id;
const sheet = (await call("create_sheet", { number: SN, name: M.title, title_block_type_id: tb })).id;
await setv(sheet, "Sheet Group", M.group);
const tbi = (await call("query_elements", { category: "OST_TitleBlocks", view_id: sheet, limit: 5 })).elements[0]?.id;
for (const [n, v] of C.signoff) { await setv(sheet, n, v); if (tbi) await setv(tbi, n, v); }
await call("set_sheet_revisions", { sheet_ids: [sheet], revision_ids: C.revisions });
const place = (v, x, y) => call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(x, y) });
const NOTES = 815, TOP = 810;
{ const used = views.reduce((a, q) => a + q.w, 0), gp = Math.max(10, (NOTES - 25 - 45 - used) / Math.max(1, views.length - 1)); let x = 45;
  for (const q of views) { await place(q.v, x + q.w / 2, TOP - q.h / 2); x += q.w + gp; } }
const lowest = TOP - Math.max(...views.map((q) => q.h)) - 30;
await place(vd, 420, Math.min(lowest - 120, 230));
// Text column: title, cut list, notes.
const T_ = (x, y, s, ty = note) => call("create_text_note", { view_id: sheet, location: P(x, y), text: s, text_type_id: ty });
const allUnits = types.reduce((a, T) => a + T.n, 0);
await T_(NOTES, 812, `${M.title.toUpperCase()}\nFor the metal factory\nOpen shelf units: ${allUnits} (${types.map((T) => `${T.key} x${T.n}`).join(", ")})`, bold);
await T_(NOTES, 760, "CUT LIST (steel sheet 2 mm, black)", bold);
const rowsTxt = types.flatMap((T) => [`${T.key} plate  ${T.pW} x ${T.pH}`, `${T.key} side angle  ${T.aD} leg x ${T.aL}`]);
const qtyTxt = types.flatMap((T) => [`${4 * T.n} no.`, `${2 * T.n} no.`]);
await T_(NOTES, 746, ["PART", ...rowsTxt].join("\n"));
await T_(975, 746, ["QTY", ...qtyTxt].join("\n"));
const yN = 746 - (rowsTxt.length + 2) * 7.8 - 10;
const notes = [
  "Each unit has 4 plates: front and rear,",
  "each split in a left and a right half.",
  "Right half = left half turned 180 deg.",
  "Holes Ø21 at 50 x 50, laser cut.",
  "Wood board is drilled through the",
  "front plate (use it as the template).",
  "Left and right halves must not touch:",
  "5 mm gap. They carry low voltage to",
  "the shelf lights. Insulated fixings.",
  "Electrical engineer to approve, and",
  "make one tested sample first.",
  "Deburr all holes and edges.",
  "Finish: black powder coat.",
  "DXF files (1:1, mm):",
  ...types.map((T) => "  " + (T.dxf ?? "-")),
  "All dimensions in mm.",
  "Check sizes on the units before cutting.",
].join("\n");
await T_(NOTES, yN, "NOTES", bold);
await T_(NOTES, yN - 13, notes);
// Key plan: all the open shelf units in red.
const planId = (await call("list_views", {})).views.find((v) => v.name === C.planView).id;
const kpD = await call("duplicate_view", { view_id: planId, name: `KP-${M.no}`, option: "Duplicate" }), kp = kpD.id ?? kpD.view_id;
for (const [n, x] of [["View Template", -1], ["View Scale", 100], ["Detail Level", 1], ["Title on Sheet", "Key Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(kp, n, x);
await call("set_view_categories", { view_id: kp, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Grids", "OST_Dimensions", "OST_TextNotes"] }).catch(() => {});
let marks = 0;
for (const T of types) for (const mk of T.t.marks) { const u = await byMark(mk); if (!u?.bounding_box) continue; const bb = u.bounding_box; await call("create_swatch", { view_id: kp, min: P(bb.min.x, bb.min.y), max: P(bb.max.x, bb.max.y), color: { r: 200, g: 30, b: 30 } }); marks++; }
const kv = await call("place_view_on_sheet", { sheet_id: sheet, view_id: kp, location: P(1102, 430) });
await call("set_viewport_no_title", { viewport_id: kv.id }).catch(() => {});
log["METAL"] = { sheet, sheetNumber: SN, keyPlanMarks: marks, types: types.map(({ t, ...q }) => ({ ...q, hx: undefined, hz: undefined })) };
writeFileSync(LOG, JSON.stringify(log, null, 1));
await call("save_document", { title: C.doc });
console.log("done", SN, "key plan", marks, "units");
