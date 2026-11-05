// Fabrication sheet for one unit type, to the layout guide in views-and-sheets.md ("Fabrication sheet layout guide"):
// top row Front, Side (with the 1700 mm Saudi figure), Section A, Section B; row two Top View under Front and 1:5 details;
// text column at x 815 with title + QTY, keynotes by material, material quantities and notes; key plan in the title block
// panel with every unit of the type in red; isolated 3D view fitted under the notes. Generalised from Madina 1 j_gen.mjs.
//
// Usage: node tools/fab_sheet.mjs <config.json> <key> [x0,x1,y0,top for the 3D view]
// Config: { doc, prefix ("MAK-SF-ZZ-GF-DR-A-"), titleBlock ("Samaya Factory A0"), planView ("A-GF-PLAN-New"),
//           signoff: [["Designed By", "..."], ...], revisions: [ids], log: "path.json",
//           units: { KEY: { no: 2201, title, group ("2 Fab: Open Shelf Units"), ref: "<Mark of the drawn unit>",
//                           marks: [all marks of this type], size?: "text", note?: "text", details?: true|false } } }
// The unit's frame comes from its instance rotation: 0 = faces +x (west wall), 180 = faces -x (east), 270 = faces -y (rear).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { call as rawC } from "./rvt.mjs";

const [cfgPath, key_, box3d] = process.argv.slice(2);
const C = JSON.parse(readFileSync(cfgPath, "utf8")), t = C.units[key_];
if (!t) throw new Error("no unit key " + key_);
const LOG = C.log, log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : {};
let ROT = null;
const MODEL = new Set(["create_section", "create_dimension_string", "create_keynote", "create_detail_lines"]);
const deep = (v) => Array.isArray(v) ? v.map(deep) : v && typeof v === "object" ? ("x" in v && "y" in v ? { ...v, ...ROT(v) } : Object.fromEntries(Object.entries(v).map(([k, w]) => [k, deep(w)]))) : v;
const call = async (n, a = {}) => { if (ROT && MODEL.has(n)) a = deep(a); a = { document: C.doc, ...a }; try { return await rawC(n, a); } catch (e) { console.log("FAIL", n, e.message.slice(0, 120)); throw e; } };
const setv = (id, n, v) => call("set_parameter", { element_id: id, parameter_name: n, value: String(v) }).catch((e) => console.log("param", n, e.message.slice(0, 90)));
const P = (x, y, z = 0) => ({ x, y, z }), r = Math.round;
const note = (await call("ensure_text_type", { name: "Sheet Note 5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id;
const bold = (await call("ensure_text_type", { name: "Sheet Heading 5.5", size_mm: 5.5, color: { r: 0, g: 0, b: 0 }, bold: true })).id;
const num = (await call("ensure_text_type", { name: "Keynote 6 Bold", size_mm: 6, color: { r: 0, g: 0, b: 0 }, bold: true })).id;
const SN = `${C.prefix}${t.no}`, P_ = `J${t.no}-`;

// Old sheet and views out (a fabrication sheet is replaced, never patched).
const stale = (await call("list_views", {})).views.filter((x) => x.name.startsWith(P_) || x.name === `KP-${t.no}`).map((x) => x.id);
const oldS = (await call("query_elements", { category: "OST_Sheets", parameter_name: "Sheet Number", parameter_value: SN, limit: 5 })).elements.map((e) => e.id);
if (oldS.length) await call("delete_elements", { element_ids: oldS }).catch((e) => console.log("del sheet", e.message.slice(0, 100)));
if (stale.length) await call("delete_elements", { element_ids: stale }).catch((e) => console.log("del views", e.message.slice(0, 100)));

// The drawn unit and its parts (family solids) in world coordinates.
const byMark = async (mark) => { for (const c of ["OST_Casework", "OST_GenericModel", "OST_Furniture"]) { const q = (await call("query_elements", { category: c, parameter_name: "Mark", parameter_value: mark, limit: 20 })).elements; for (const e of q) { const g = await call("get_element", { element_id: e.id }); if (g.parameters.find((p) => p.name === "Mark")?.value === mark) return g; } } return null; };
const g = await byMark(t.ref); if (!g) throw new Error("no unit with mark " + t.ref);
const id = g.id;
const fam = await call("inspect_family", { element_id: id });
const raw = fam.items.filter((f) => (f.class === "FreeFormElement" || f.class === "Extrusion") && f.min);
const instRot = ((g.location?.rotation_deg ?? 0) % 360 + 360) % 360, o = g.location.point;
const rot = t.rot ?? instRot; // t.rot: the face direction when it differs from the instance rotation (a family built in place on a rear wall has rotation 0)
const turn = ([x, y]) => instRot === 90 ? [-y, x] : instRot === 180 ? [-x, -y] : instRot === 270 ? [y, -x] : [x, y];
const parts = raw.map((f) => { const [a, c] = [turn([f.min.x, f.min.y]), turn([f.max.x, f.max.y])]; return { m: f.material ?? "Unassigned", x0: Math.min(a[0], c[0]) + o.x, x1: Math.max(a[0], c[0]) + o.x, y0: Math.min(a[1], c[1]) + o.y, y1: Math.max(a[1], c[1]) + o.y, z0: f.min.z + o.z, z1: f.max.z + o.z }; });
const b = { x0: Math.min(...parts.map((f) => f.x0)), x1: Math.max(...parts.map((f) => f.x1)), y0: Math.min(...parts.map((f) => f.y0)), y1: Math.max(...parts.map((f) => f.y1)), z0: Math.min(...parts.map((f) => f.z0)), z1: Math.max(...parts.map((f) => f.z1)) };
// A rear-wall unit placed at rotation 0 (Makkah OSB-1, AR-B1, SC-C1) needs "rot": 270 in its config, or front and side swap.
const FACE = rot === 0 ? "+x" : rot === 180 ? "-x" : null, Bw = { ...b };
if (FACE) {
  const rr = FACE === "+x" ? ([x, y]) => [-y, x] : ([x, y]) => [y, -x];  // unit frame -> world
  const ri = FACE === "+x" ? ([x, y]) => [y, -x] : ([x, y]) => [-y, x];  // world -> unit frame
  ROT = (p) => { const [x, y] = rr([p.x, p.y]); return { x, y }; };
  const box = (x0, x1, y0, y1) => { const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(ri); return [Math.min(...c.map((q) => q[0])), Math.max(...c.map((q) => q[0])), Math.min(...c.map((q) => q[1])), Math.max(...c.map((q) => q[1]))]; };
  [b.x0, b.x1, b.y0, b.y1] = box(b.x0, b.x1, b.y0, b.y1);
  for (const f of parts) [f.x0, f.x1, f.y0, f.y1] = box(f.x0, f.x1, f.y0, f.y1);
}
const dx = b.x1 - b.x0, dy = b.y1 - b.y0, xc = (b.x0 + b.x1) / 2, yc = (b.y0 + b.y1) / 2;
// Factory standard: joinery stops at least 20 mm under the ceiling (shadow gap). config.ceiling = ceiling height (mm, FFL).
const GAP = C.shadowGap ?? 20;
if (C.ceiling && b.z1 > C.ceiling - GAP + 0.5) throw new Error(`${t.ref} top +${r(b.z1)} is less than ${GAP} mm under the ceiling +${C.ceiling}: fix the family first (shadow gap rule)`);
const nearCeiling = C.ceiling && b.z1 > C.ceiling - 150;

// One scale for the main views, floor to top, so the figure stands on the floor.
const zTop = Math.max(b.z1, 1700) + 100, zBot = -150, M = 200, F = 450;
const W = dx + 2 * M, H = zTop - zBot, D = dy + F + 240, PH = dy + 2 * M;
const fitsRow1 = (q) => 45 + (W + D + dy + 2 * M + W) / q + 40 <= 685;
const s = t.scale ?? [5, 8, 10, 15, 20, 25].find((q) => H / q + PH / q + 60 <= 790 && (W + D) / q <= 740 && (fitsRow1(q) || (2 * H) / q + 110 <= 765)) ?? 25;
const yf = b.y0 - 100, xs = b.x0 - 100;
const sec = async (name, title, start, end, look, depth, scale, top, bottom) => {
  const v = await call("create_section", { start, end, look_direction: look, bottom_mm: bottom, top_mm: top, depth_mm: depth });
  const vid = v.id ?? v.view_id;
  await setv(vid, "View Name", P_ + name); await setv(vid, "Hide at scales coarser than", 2); await setv(vid, "View Scale", scale); await setv(vid, "Detail Level", 3); await setv(vid, "Title on Sheet", title);
  await call("set_view_display", { view_id: vid, style: "HLR" }).catch(() => {});
  return vid;
};
const vFront = await sec("Front Elevation", "Front Elevation", P(b.x0 - M, yf), P(b.x1 + M, yf), P(0, 1, 0), dy + 300, s, zTop, zBot);
const vSide = await sec("Side Elevation", "Side Elevation", P(xs, b.y1 + 240), P(xs, b.y0 - F), P(1, 0, 0), dx + 300, s, zTop, zBot);
const za = b.z0 - 150, zb = b.z1 + 150, xA = t.sectionAt ?? xc;
const vA = await sec("Section A", "Section A", P(xA, b.y1 + M), P(xA, b.y0 - M), P(1, 0, 0), 40, s, zb, za);
const vB = await sec("Section B", "Section B", P(b.x0 - M, yc), P(b.x1 + M, yc), P(0, 1, 0), 40, s, zb, za);
const planId = (await call("list_views", {})).views.find((x) => x.name === C.planView)?.id; if (!planId) throw new Error("no plan view " + C.planView);
const dp = await call("duplicate_view", { view_id: planId, name: P_ + "Top View", option: "Duplicate" });
const vTop = dp.id ?? dp.view_id;
await setv(vTop, "View Scale", s); await setv(vTop, "Detail Level", 3); await setv(vTop, "Title on Sheet", "Top View"); await setv(vTop, "View Template", -1);
await setv(vTop, "Crop View", 1); await setv(vTop, "Annotation Crop", 1);
const pb = (await call("get_element", { element_id: vTop })).bounding_box;
const m_ = M + (FACE ? 150 : 0), B0 = FACE ? Bw : b;
await call("extend_view_crop", { view_id: vTop, left_mm: pb.min.x - (B0.x0 - m_), right_mm: B0.x1 + m_ - pb.max.x, bottom_mm: pb.min.y - (B0.y0 - m_), top_mm: B0.y1 + m_ - pb.max.y });
await call("set_view_range", { view_id: vTop, top_mm: b.z1 + 300, cut_mm: b.z1 + 200, bottom_mm: 0 }).catch((e) => console.log("range", e.message.slice(0, 90)));
const big = t.details !== false && s >= 8 && W / 5 <= 360 ? 5 : 0; // 1:5 details when the unit is no wider than 360 mm on paper at 1:5
// Details are corner details: the right-hand 350 mm of the unit plus 100 clear (full-width 1:5 sections overlapped on A-2002).
const dx0 = Math.max(b.x0 - 100, b.x1 - 350);
const vDT = big ? await sec("Detail Top", "Detail: Top", P(dx0, yc), P(b.x1 + 100, yc), P(0, 1, 0), 40, big, b.z1 + 60, b.z1 - 460) : null;
const vDB = big ? await sec("Detail Base", "Detail: Base", P(dx0, yc), P(b.x1 + 100, yc), P(0, 1, 0), 40, big, b.z0 + 360, b.z0 - 60) : null;
for (const v of [vFront, vSide, vA, vB, vTop, vDT, vDB].filter(Boolean)) {
  await call("isolate_in_view", { view_id: v, element_ids: [id] });
  await call("set_view_categories", { view_id: v, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_Levels", "OST_Grids", "OST_CLines", "OST_RvtLinks"] }).catch(() => {});
}

// Dimensions, 12 mm apart on paper.
const dim = async (v, pts) => { try { await call("create_dimension_string", { view_id: v, points: pts, tick_mm: 25 }); } catch (e) { console.log("dim", e.message.slice(0, 110)); } };
const gap = 12 * s, off = 12 * s, minD = 8 * s;
const flats = [...new Set(parts.filter((f) => f.z1 - f.z0 <= 60 && f.x1 - f.x0 > 100 && f.y1 - f.y0 > 80).map((f) => r(f.z1)))].sort((a, c) => a - c);
const tops_ = flats.filter((z, k) => flats[k + 1] === undefined || flats[k + 1] - z > 40);
const levels = [r(b.z0)]; for (const z of tops_) if (z - levels[levels.length - 1] >= minD && b.z1 - z >= minD) levels.push(z); levels.push(r(b.z1));
const floorDim = b.z0 > 50 ? [0, r(b.z0), r(b.z1)] : [0, r(b.z1)];
await dim(vFront, [P(b.x0, yf, -off), P(b.x1, yf, -off)]);
await dim(vFront, levels.map((z) => P(b.x0 - off, yf, z)));
await dim(vFront, floorDim.map((z) => P(b.x0 - off - gap, yf, z)));
await dim(vSide, [P(xs, b.y1, -off), P(xs, b.y0, -off)]);
await dim(vSide, floorDim.map((z) => P(xs, b.y1 + off, z)));
await dim(vSide, [0, 1700].map((z) => P(xs, b.y0 - F + 30, z)));
await dim(vA, [P(xA, b.y1, za + off), P(xA, b.y0, za + off)]);
await dim(vA, levels.map((z) => P(xA, b.y0 - off, z)));
await dim(vB, [P(b.x0, yc, za + off), P(b.x1, yc, za + off)]);
await dim(vB, levels.map((z) => P(b.x1 + off, yc, z)));
await dim(vTop, [P(b.x0, b.y0 - off), P(b.x1, b.y0 - off)]);
await dim(vTop, [P(b.x0 - off, b.y0), P(b.x0 - off, b.y1)]);
if (big) {
  const top = levels.filter((z) => z >= b.z1 - 460), base = levels.filter((z) => z <= b.z0 + 360);
  // Board edges near the corner, read from the parts, so the detail gives every board thickness.
  const edges = (z) => [...new Set(parts.filter((f) => f.z0 <= z && f.z1 >= z && f.x1 >= dx0).flatMap((f) => [r(f.x0), r(f.x1)]).filter((x) => x >= dx0 && x <= b.x1))].sort((a, c) => a - c);
  const eT = edges(b.z1 - 200), eB = edges(b.z0 + 150);
  if (eT.length > 1) await dim(vDT, eT.map((x) => P(x, yc, b.z1 - 440)));
  if (top.length > 1) await dim(vDT, top.map((z) => P(b.x1 + 60, yc, z)));
  if (eB.length > 1) await dim(vDB, eB.map((x) => P(x, yc, b.z0 - 40)));
  if (base.length > 1) await dim(vDB, base.map((z) => P(b.x1 + 60, yc, z)));
}

// Keynotes by material, leader to that material's largest part on the front. Quantities from the parts.
const by = {};
for (const f of parts) {
  const d = [f.x1 - f.x0, f.y1 - f.y0, f.z1 - f.z0].sort((a, c) => a - c);
  const a = d[0] <= 30 ? (d[1] * d[2]) / 1e6 : (2 * (d[0] * d[1] + d[1] * d[2] + d[0] * d[2])) / 1e6;
  const q = (by[f.m] ??= { area: 0, len: 0, n: 0, big: f, bigA: 0 }); q.area += a; q.len += d[2] / 1000; q.n += 1;
  if ((f.x1 - f.x0) * (f.z1 - f.z0) > q.bigA) { q.bigA = (f.x1 - f.x0) * (f.z1 - f.z0); q.big = f; }
}
const mats = Object.entries(by).sort((p, q) => (q[1].big.z0 + q[1].big.z1) - (p[1].big.z0 + p[1].big.z1));
const key = async (v, at, to, n) => { try { await call("create_keynote", { view_id: v, at, to, text: String(n), text_type_id: num }); } catch (e) { console.log("key", n, e.message.slice(0, 110)); } };
// Leader ends stay inside their part; labels stack upward from the lowest one, 12 mm apart on paper, so no label drops under
// the floor into the overall width dimension (it crossed "1210" on A-2002).
const kx = b.x1 + 0.7 * M;
const tg = mats.map(([, q]) => { const f = q.big; return { f, z: (f.z0 + f.z1) / 2, x: Math.min(f.x1 - 2, Math.max(f.x0 + 2, (f.x0 + f.x1) / 2)) }; });
const lab = tg.map((q) => q.z);
for (let k = lab.length - 2; k >= 0; k--) lab[k] = Math.max(lab[k], lab[k + 1] + 12 * s);
for (let k = 0; k < tg.length; k++) await key(vFront, P(kx, yf, lab[k]), P(tg[k].x, yf, tg[k].z), k + 1);

// Saudi figure on the side view only, 1700 mm, grey shade.
const seg = (a, c) => ({ start: a, end: c }), chain = (pts) => pts.slice(1).map((p, k) => seg(pts[k], p));
await call("ensure_line_style", { name: "Indicative", weight: 1, color: { r: 130, g: 130, b: 130 } });
await call("ensure_line_style", { name: "Figure Shade", weight: 3, color: { r: 200, g: 200, b: 200 } });
const draw = async (v, lines, style) => { const q = await call("create_detail_lines", { view_id: v, lines: lines.filter((l) => Math.hypot(l.start.x - l.end.x, l.start.y - l.end.y, l.start.z - l.end.z) > 2), line_style: style }); if (style === "Indicative") await call("set_element_overrides", { view_id: v, element_ids: q.ids, halftone: true }).catch(() => {}); };
const spline = (pts, n = 7) => { const out = [], m = pts.length, at = (k) => pts[Math.max(0, Math.min(m - 1, k))]; for (let k = 0; k < m - 1; k++) { const [p0, p1, p2, p3] = [at(k - 1), at(k), at(k + 1), at(k + 2)]; for (let q = 0; q < n; q++) { const u = q / n, u2 = u * u, u3 = u2 * u; out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * u3))); } } out.push(pts[m - 1]); return out; };
const SIDE = [spline([[-92, 1630], [-55, 1688], [0, 1700], [50, 1688], [70, 1650]]), spline([[70, 1650], [76, 1610], [94, 1575], [78, 1555], [78, 1530], [64, 1495], [38, 1480]]), spline([[38, 1480], [46, 1420], [92, 1340], [118, 1180], [120, 800], [130, 400], [145, 70]]), [[145, 70], [-125, 70]], spline([[-125, 70], [-115, 500], [-112, 1000], [-118, 1270], [-112, 1320]]), spline([[-92, 1630], [-104, 1540], [-122, 1420], [-132, 1320], [-112, 1290], [-60, 1320], [-30, 1420], [-5, 1540], [48, 1645]]), spline([[-92, 1644], [-20, 1662], [66, 1656]]), spline([[-96, 1628], [-20, 1646], [70, 1640]]), spline([[-5, 1370], [40, 1300], [62, 1100], [64, 890], [78, 810], [48, 780], [14, 800], [-2, 890], [-28, 1100], [-30, 1300]]), spline([[-70, 70], [-75, 0], [150, 0], [180, 18], [150, 45], [120, 70]])];
const YH = b.y0 - 280, PS = ([h, z]) => P(xs, YH + h, z);
const crossings = (poly, v) => { const out = []; for (let k = 0; k < poly.length; k++) { const p = poly[k], q = poly[(k + 1) % poly.length]; if ((p[1] <= v) !== (q[1] <= v)) out.push(p[0] + ((v - p[1]) / (q[1] - p[1])) * (q[0] - p[0])); } out.sort((m, n) => m - n); const iv = []; for (let k = 0; k + 1 < out.length; k += 2) iv.push([out[k], out[k + 1]]); return iv; };
const union = (iv) => { const u = []; for (const c of [...iv].sort((m, n) => m[0] - n[0])) { const l = u[u.length - 1]; if (l && c[0] <= l[1]) l[1] = Math.max(l[1], c[1]); else u.push([...c]); } return u; };
const shade = (polys) => { const out = []; for (let v = 1; v <= 1699; v += Math.max(3, 0.6 * s)) for (let [u, w] of union(polys.flatMap((q) => crossings(q, v)))) { if (w - u > 2) out.push(seg(PS([u, v]), PS([w, v]))); } return out; };
await draw(vSide, shade([[...SIDE[0], ...SIDE[1], ...SIDE[2], ...SIDE[4]], SIDE[5], SIDE[8], SIDE[9]]), "Figure Shade");
await draw(vSide, SIDE.flatMap((l) => chain(l.map(PS))), "Indicative");

// Sheet, per the layout guide.
const tb = (await call("list_element_types", { category: "OST_TitleBlocks" })).types.find((x) => x.name === (C.titleBlock ?? "Samaya Factory A0")).id;
const sheet = (await call("create_sheet", { number: SN, name: t.title, title_block_type_id: tb })).id;
await setv(sheet, "Sheet Group", t.group);
const tbi = (await call("query_elements", { category: "OST_TitleBlocks", view_id: sheet, limit: 5 })).elements[0]?.id;
for (const [n, v] of C.signoff) { await setv(sheet, n, v); if (tbi) await setv(tbi, n, v); }
await call("set_sheet_revisions", { sheet_ids: [sheet], revision_ids: C.revisions });
const wF = W / s, hF = H / s, wS = D / s, hP = PH / s, wA = (dy + 2 * M) / s, wB = W / s, hC = (zb - za) / s;
// The Top View of a side unit is drawn north-up (its crop cannot be turned), so on paper it is as tall as the unit is long:
// size it from the world box, or it runs up into the front elevation (counter D-02, Makkah Rev 07). Details keep their own row.
const wTop = ((FACE ? Bw : b).x1 - (FACE ? Bw : b).x0 + 2 * (M + (FACE ? 150 : 0))) / s; // top view width on paper
const hTop = FACE ? (Bw.y1 - Bw.y0 + 2 * (M + 150)) / s : hP;                         // top view height on paper
const TOP = 810, LEFT = 45, fx = LEFT + wF / 2, fy = TOP - hF / 2, sx = LEFT + wF + 10 + wS / 2, pyD = TOP - hF - 25 - hP / 2, py = Math.max(TOP - hF - 30 - hTop / 2, 45 + hTop / 2);
const place = (v, x, y) => call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(x, y) });
const NOTES = 815, levelY = fy + ((za + zb) / 2 - (zBot + zTop) / 2) / s;
const blocks = [[vFront, wF, fy], [vSide, wS, fy], [vA, wA, levelY], [vB, wB, levelY]];
const used = blocks.reduce((a, [, w]) => a + w, 0), free = NOTES - 25 - LEFT - used;
const L = {};
if (free >= 30) {
  const gp = free / 3; let x = LEFT;
  for (const [k, [v, w, y]] of blocks.entries()) { const cxv = x + w / 2; await place(v, cxv, y); L[["front", "side", "A", "B"][k]] = cxv; x += w + gp; }
  await place(vTop, Math.max(L.front + (FACE ? 15 : 0), LEFT + wTop / 2 + 10), py);
  if (big) { await place(vDT, L.side, pyD); await place(vDB, L.A, pyD); }
} else {
  await place(vFront, fx, fy); await place(vSide, sx, fy); await place(vTop, Math.max(fx, LEFT + wTop / 2 + 10), py);
  let cx = LEFT + wF + 10 + wS + 10, cy = TOP - hC / 2, row2 = false;
  for (const [v, w] of [[vA, wA], [vB, wB]]) { if (!row2 && cx + w > NOTES - 5) { row2 = true; cx = LEFT + wF + 15; cy = Math.min(TOP - hF - 25 - hC / 2, 50 + hC / 2 + 40); } await place(v, cx + w / 2, cy); cx += w + 10; }
  if (big) { await place(vDT, 351, pyD); await place(vDB, 682, pyD); }
}
// Text column.
const txt = (x, y, tx, type = note) => call("create_text_note", { view_id: sheet, location: P(x, y), text: tx, text_type_id: type });
// Keep the approved colour code whole (EGGER "H3710 ST12" is one code: the ST part is the texture), only drop notes in brackets.
const shortM = (m) => m.replace(/\s*\(.*?\)/, "").slice(0, 52);
const qty = (m, q) => /LED|PVC|Edge|Softwood|Angle|Peg\b|Hardwood Peg/.test(m) ? (/Peg/.test(m) ? `${q.n} no.` : `${q.len.toFixed(2)} m`) : /Handle|Support/.test(m) && q.n < 20 ? `${q.n} no.` : `${q.area.toFixed(2)} m2`;
await txt(NOTES, 812, `${t.title.toUpperCase()}   QTY ${t.marks.length}\n${t.size ?? `${r(dx)} x ${r(dy)} x ${r(b.z1 - b.z0)}`}\nUnits: ${t.marks.join(", ")}`, bold);
await txt(NOTES, 770, "KEYNOTES", bold);
await txt(NOTES, 757, [...mats.map(([m], k) => `${k + 1}   ${shortM(m)}`), "Grey: 1700 mm figure, indicative"].join("\n"));
const y2 = 757 - (mats.length + 1) * 7.8 - 20;
await txt(NOTES, y2, "MATERIAL QUANTITIES", bold);
await txt(NOTES, y2 - 12, "(per unit, net, no waste, approx.)");
// The quantity list has the QTY column at x 975, so its names are kept short (the code stays; the keynote list above gives
// the full colour name): "Natural Carini Walnut" -> "Walnut", "Painted" -> "ptd.", at most 40 characters.
const shortQ = (m) => shortM(m).replace(/ Natural Carini Walnut/, " Walnut").replace(/\bPainted\b/, "ptd.").slice(0, 40);
await txt(NOTES, y2 - 28, ["MATERIAL", ...mats.map(([m]) => shortQ(m))].join("\n"));
await txt(975, y2 - 28, ["QTY", ...mats.map(([m, q]) => qty(m, q))].join("\n"));
const notesTxt = `${t.note ? t.note + "\n" : ""}${nearCeiling ? `Top +${(b.z1 / 1000).toFixed(3)}: ${r(C.ceiling - b.z1)} shadow gap\nto the ceiling (${GAP} min.).\n` : ""}All dimensions in mm.\nCheck on site before cutting.\nCurved parts: cut from the CNC file.`;
await txt(NOTES, y2 - 28 - (mats.length + 2) * 7.8 - 8, notesTxt);
const notesBottom = y2 - 28 - (mats.length + 2) * 7.8 - 8 - (notesTxt.split("\n").length + 1) * 7.8;
// Key plan: every unit of this type in red.
const kpD = await call("duplicate_view", { view_id: planId, name: `KP-${t.no}`, option: "Duplicate" }), kp = kpD.id ?? kpD.view_id;
for (const [n, x] of [["View Template", -1], ["View Scale", 100], ["Detail Level", 1], ["Title on Sheet", "Key Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(kp, n, x);
await call("set_view_categories", { view_id: kp, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Grids", "OST_Dimensions", "OST_TextNotes"] }).catch(() => {});
let marks = 0;
for (const mk of t.marks) { const u = await byMark(mk); if (!u?.bounding_box) { console.log("key plan: no", mk); continue; } const bb = u.bounding_box; await call("create_swatch", { view_id: kp, min: P(bb.min.x, bb.min.y), max: P(bb.max.x, bb.max.y), color: { r: 200, g: 30, b: 30 } }); marks++; }
const kv = await call("place_view_on_sheet", { sheet_id: sheet, view_id: kp, location: P(1102, 430) });
await call("set_viewport_no_title", { viewport_id: kv.id }).catch(() => {});
// Isolated 3D view (tools/view3d.mjs: fresh view, section box round the unit's solids, links hidden), fitted under the notes,
// looking from the unit's own front-left corner.
const { unit3d } = await import("./view3d.mjs");
const [X0, X1, Y0, Ytop] = box3d ? box3d.split(",").map(Number) : [NOTES - 20, 1005, 45, Math.min(560, notesBottom - 15)];
const wb = { min: [Bw.x0, Bw.y0, Bw.z0], max: [Bw.x1, Bw.y1, Bw.z1] };
// View direction (eye = centre - dir): eye in front of the unit and to its left. Rot 0 faces +x, 180 faces -x, 270 faces -y, 90 faces +y.
const dirW = FACE === "+x" ? [-1, 1, -1] : FACE === "-x" ? [1, -1, -1] : rot === 90 ? [-1, -1, -1] : [1, 1, -1];
const r3 = await unit3d(call, { name: P_ + "3D View", ids: [id], sheet, area: [X0, X1, Y0, Ytop], dir: dirW, style: "HLR", box: wb });
const v3 = r3.view, s3 = r3.scale;
log[key_] = { sheet, sheetNumber: SN, scale: s, scale3d: s3, keyPlanMarks: marks, views: { vFront, vSide, vA, vB, vTop, vDT, vDB, kp, v3 } };
writeFileSync(LOG, JSON.stringify(log, null, 1));
await call("save_document", { title: C.doc });
console.log("done", key_, SN, "scale 1:" + s, "3D 1:" + s3, "rot", rot, "face", FACE, "key plan", marks + "/" + t.marks.length, "mats", mats.map(([m, q]) => m + "=" + qty(m, q)).join("; "));
