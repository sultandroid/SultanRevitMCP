// Fabrication sheets to the layout guide: front on top, plan directly under it, side beside it, the rest in the empty area.
// Usage: node j_gen.mjs <key>   Units facing along x set face: "+x" or "-x" in their key; the plan is turned to suit.
import { readFileSync, writeFileSync } from "node:fs";
import { sn } from "./sheetno.mjs";
import { call as rawC } from "./rvt.mjs";
// Units facing along x: ROT maps the unit's own frame (front at -y) to world; model-space calls are rotated.
let ROT = null;
const MODEL = new Set(["create_section", "create_dimension_string", "create_keynote", "create_detail_lines"]);
const deep = (v) => Array.isArray(v) ? v.map(deep) : v && typeof v === "object" ? ("x" in v && "y" in v ? { ...v, ...ROT(v) } : Object.fromEntries(Object.entries(v).map(([k, w]) => [k, deep(w)]))) : v;
const call = async (n, a) => { if (ROT && MODEL.has(n)) a = deep(a); try { return await rawC(n, a); } catch (e) { console.log("FAIL", n, JSON.stringify(a).slice(0, 160)); throw e; } };
import { markUnits } from "./kpmark.mjs";
import { fit3d } from "./fit3d.mjs";

const LOG = "dwg/joinery.json", log = JSON.parse(readFileSync(LOG, "utf8"));
const i = await call("get_project_info"); if (i.title !== (process.env.DOC ?? "Madina1_ARCH_02")) throw new Error("Active document is: " + i.title);
const REV = JSON.parse(readFileSync("dwg/sheets.json", "utf8")).rev, TB = 467161;
const T = {
  TA: { no: 120, title: "Typical Arch Unit", also: "Side Arch Unit", ref: "Arch Typical A", units: ["W-A1", "W-A2", "E-A1", "E-A2", "RL-A1", "RR-A1"], note: "Sides and shelves: two 18 mm EGGER layers,\n36 mm, no recess, one edge band across both.\n" + (process.env.NOTE_HEAD ?? "Arch head: keel arch, rise 630, R 610,\n36 mm on CNC ribs. Marble from +2330.") + "\nWood pegboard one piece, plates split: see MD1-SF-ZZ-GF-DR-A-2104.\nShelf: see MD1-SF-ZZ-GF-DR-A-2103.\nMarble: see MD1-SF-ZZ-GF-DR-A-2106." },
  RA: { no: 121, title: "Rear Arch Unit", ref: "Arch Unit RL-A1", units: ["RL-A1", "RR-A1"] },
  SB: { no: 122, title: "Side Base Cabinet", ref: "Base Cabinet W-B1", face: "+x", units: ["W-B1", "W-B2", "W-B3", "W-B4", "E-B1", "E-B2", "E-B3", "E-B4"], swing: true },
  SL: { no: 124, title: "Side Low Bay", ref: "Low Bay W-L1", face: "+x", units: ["W-L1", "W-L3", "E-L1", "E-L3"], size: "559 x 580 x 1284 (W), 559 x 550 x 1284 (E)" },
  SL2: { no: 151, title: "Middle Side Low Bay", ref: "Low Bay W-L2", face: "+x", units: ["W-L2", "E-L2"], size: "983 x 580 x 1284 (W), 983 x 550 x 1284 (E)", note: "Top and base details: see\nMD1-SF-ZZ-GF-DR-A-2201." },
  RB: { no: 123, title: "Rear Base Cabinet", ref: "Base Cabinet RL-B1", units: ["RL-B1", "RL-B2", "RR-B1", "RR-B2"], swing: true },
  RL: { no: 125, title: "Rear Low Bay", ref: "Low Bay RL-L1", units: ["RL-L1", "RL-L2", "RR-L1", "RR-L2"] },
  MH: { no: 126, title: "Centre Arch Mihrab Unit", also: "Centre Arch Panel", ref: "Centre Arch Mihrab Unit", units: ["MH"] },
  NF: { no: 127, title: "Niche Frame", ref: "Niche Frame NF", units: ["NF"] },
  NS: { no: 128, title: "Niche Shelf Unit", ref: "Niche Shelf Unit NC-L", units: ["NC-L", "NC-R"] },
  NC: { no: 129, title: "Niche Cabinet", ref: "Niche Cabinet NC-C", units: ["NC-C"], swing: true },
  CH: { no: 130, title: "Carpet Hanger", ref: "Carpet Hanger CH", units: ["CH"] },
  CC: { no: 133, title: "Column Cladding", ref: "Column Cladding CC-1", units: ["CC-1"] },
};
const key_ = process.argv[2], t = T[key_]; if (!t) throw new Error("key " + key_);
const setv = (id, n, v) => call("set_parameter", { element_id: id, parameter_name: n, value: v }).catch((e) => console.log("param", n, e.message.slice(0, 90)));
const P = (x, y, z = 0) => ({ x, y, z });
const r = Math.round;
const note = (await call("ensure_text_type", { name: "Joinery Note 3.5", size_mm: 5, color: { r: 0, g: 0, b: 0 } })).id;
const bold = (await call("ensure_text_type", { name: "Joinery Note 4 Bold", size_mm: 5.5, color: { r: 0, g: 0, b: 0 }, bold: true })).id;
const num = (await call("ensure_text_type", { name: "Keynote 5 Bold", size_mm: 6, color: { r: 0, g: 0, b: 0 }, bold: true })).id;

// Old sheet and views out, by name and number, since ids in the log go stale.
const P_ = `J${t.no}-`;
const stale = (await call("list_views", {})).views.filter((x) => x.name.startsWith(P_) || x.name.startsWith(`A-J${t.no}-`) || x.name === `KP-${t.no}` || (key_ === "TA" && x.name === "KP-139")).map((x) => x.id);
const oldS = (await call("query_elements", { category: "OST_Sheets", limit: 1000 })).elements.filter((e) => e.name.startsWith(t.title) || (t.also && e.name.startsWith(t.also)) || JSON.stringify(e).includes(`${sn(t.no)}`)).map((e) => e.id);
if (oldS.length) await call("delete_elements", { element_ids: oldS }).catch((e) => console.log("del sheet", e.message.slice(0, 100)));
if (stale.length) await call("delete_elements", { element_ids: stale }).catch((e) => console.log("del views", e.message.slice(0, 100)));

// The unit and its parts in model coordinates.
const furn = []; for (let o = 0; ; o += 1000) { const q = (await call("query_elements", { category: "OST_Furniture", limit: 1000, offset: o })).elements; furn.push(...q); if (q.length < 1000) break; }
const all = [...furn, ...(await call("query_elements", { category: "OST_GenericModel", limit: 1000 })).elements, ...(await call("query_elements", { category: "OST_Casework", limit: 1000 })).elements];
const el = all.find((e) => e.name === `Madina ${t.ref}` && !e.location?.rotation_deg); if (!el) throw new Error("not found " + t.ref);
const id = el.id, g = await call("get_element", { element_id: id }), B = g.bounding_box;
const b = { x0: B.min.x, x1: B.max.x, y0: B.min.y, y1: B.max.y, z0: B.min.z, z1: B.max.z };
const fam = await call("inspect_family", { element_id: id });
const raw = fam.items.filter((f) => f.class === "FreeFormElement" || f.class === "Extrusion"); // boxes added by edit_family_solids are extrusions
const rot = ((g.location?.rotation_deg ?? 0) % 360 + 360) % 360, o = g.location.point;
const turn = ([x, y]) => rot === 90 ? [-y, x] : rot === 180 ? [-x, -y] : rot === 270 ? [y, -x] : [x, y];
const parts = raw.map((f) => { const [a, c] = [turn([f.min.x, f.min.y]), turn([f.max.x, f.max.y])]; return { m: f.material ?? "Unassigned", x0: Math.min(a[0], c[0]) + o.x, x1: Math.max(a[0], c[0]) + o.x, y0: Math.min(a[1], c[1]) + o.y, y1: Math.max(a[1], c[1]) + o.y, z0: f.min.z + o.z, z1: f.max.z + o.z }; });
const FACE = t.face, Bw = { ...b };
if (FACE) {
  const r = FACE === "+x" ? ([x, y]) => [-y, x] : ([x, y]) => [y, -x];   // unit frame -> world
  const ri = FACE === "+x" ? ([x, y]) => [y, -x] : ([x, y]) => [-y, x];  // world -> unit frame
  ROT = (p) => { const [x, y] = r([p.x, p.y]); return { x, y }; };
  const box = (x0, x1, y0, y1) => { const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(ri); return [Math.min(...c.map((q) => q[0])), Math.max(...c.map((q) => q[0])), Math.min(...c.map((q) => q[1])), Math.max(...c.map((q) => q[1]))]; };
  [b.x0, b.x1, b.y0, b.y1] = box(b.x0, b.x1, b.y0, b.y1);
  for (const f of parts) [f.x0, f.x1, f.y0, f.y1] = box(f.x0, f.x1, f.y0, f.y1);
}
const dx = b.x1 - b.x0, dy = b.y1 - b.y0;
const xc = (b.x0 + b.x1) / 2, yc = (b.y0 + b.y1) / 2;

// Same scale on the main views; floor to top, so the figure stands on the floor.
const zTop = Math.max(b.z1, 1700) + 100, zBot = -150, M = 200, F = 450;
const W = dx + 2 * M, H = zTop - zBot, D = dy + F + 240, PH = dy + 2 * M;
// Sections fit beside the side view in row 1, or else need a second row as tall as the unit under the front view.
const fitsRow1 = (q) => 45 + (W + D + dy + 2 * M + W) / q + 40 <= 685;
const s = [5, 8, 10, 15, 20].find((q) => H / q + PH / q + 60 <= 790 && (W + D) / q <= 740 && (fitsRow1(q) || (2 * H) / q + 110 <= 765));
const yf = b.y0 - 100, xs = b.x0 - 100;
const sec = async (name, title, start, end, look, depth, scale, top, bottom) => {
  const v = await call("create_section", { start, end, look_direction: look, bottom_mm: bottom, top_mm: top, depth_mm: depth });
  const vid = v.id ?? v.view_id;
  await setv(vid, "View Name", P_ + name); await setv(vid, "Hide at scales coarser than", 2); await setv(vid, "View Scale", scale); await setv(vid, "Detail Level", 3); await setv(vid, "Title on Sheet", title);
  return vid;
};
const vFront = await sec("Front Elevation", "Front Elevation", P(b.x0 - M, yf), P(b.x1 + M, yf), P(0, 1, 0), dy + 300, s, zTop, zBot);
const vSide = await sec("Side Elevation", "Side Elevation", P(xs, b.y1 + 240), P(xs, b.y0 - F), P(1, 0, 0), dx + 300, s, zTop, zBot);
const za = b.z0 - 150, zb = b.z1 + 150;
const xA = key_ === "TA" ? xc + 275 : xc;
const vA = await sec("Section A", "Section A", P(xA, b.y1 + M), P(xA, b.y0 - M), P(1, 0, 0), 40, s, zb, za);
const vB = await sec("Section B", "Section B", P(b.x0 - M, yc), P(b.x1 + M, yc), P(0, 1, 0), 40, s, zb, za);
const dp = await call("duplicate_view", { view_id: 312, name: P_ + "Top View", option: "Duplicate" });
const vTop = dp.id ?? dp.view_id;
await setv(vTop, "View Scale", s); await setv(vTop, "Detail Level", 3); await setv(vTop, "Title on Sheet", "Top View");
await setv(vTop, "Crop View", 1); await setv(vTop, "Annotation Crop", 1);
const pb = (await call("get_element", { element_id: vTop })).bounding_box;
if (FACE) { // crop in world, then turn the plan so the unit's front faces down, under the front elevation
  const m = M + 150;
  await call("extend_view_crop", { view_id: vTop, left_mm: pb.min.x - (Bw.x0 - m), right_mm: Bw.x1 + m - pb.max.x, bottom_mm: pb.min.y - (Bw.y0 - m), top_mm: Bw.y1 + m - pb.max.y });
  await call("rotate_view_crop", { view_id: vTop, angle_degrees: FACE === "+x" ? -90 : 90 }).catch(() => console.log("plan crop could not be turned; plan stays north-up"));
} else await call("extend_view_crop", { view_id: vTop, left_mm: pb.min.x - (b.x0 - M), right_mm: b.x1 + M - pb.max.x, bottom_mm: pb.min.y - (b.y0 - M), top_mm: b.y1 + M - pb.max.y });
await call("set_view_range", { view_id: vTop, top_mm: b.z1 + 300, cut_mm: b.z1 + 200, bottom_mm: 0 }).catch((e) => console.log("range", e.message.slice(0, 90)));
const big = s >= 8 && W <= 1200 ? 5 : 0; // 1:5 details only fit for units up to 1.2 m wide
const vDT = big ? await sec("Detail Top", "Detail: Top", P(b.x0 - 100, yc), P(b.x1 + 100, yc), P(0, 1, 0), 40, big, b.z1 + 60, b.z1 - 560) : null;
const vDB = big ? await sec("Detail Base", "Detail: Base", P(b.x0 - 100, yc), P(b.x1 + 100, yc), P(0, 1, 0), 40, big, b.z0 + 460, b.z0 - 60) : null;
for (const v of [vFront, vSide, vA, vB, vTop, vDT, vDB].filter(Boolean)) {
  await call("isolate_in_view", { view_id: v, element_ids: [id] });
  await call("set_view_categories", { view_id: v, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_Levels", "OST_Grids", "OST_CLines", "OST_RvtLinks"] }).catch((e) => console.log("hide", e.message.slice(0, 90)));
}

// Dimensions, 12 mm apart on paper. Thin levels closer than the text are merged.
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
if (key_ === "TA") await dim(vA, [700, 840, Number(process.env.HEAD ?? 2330), 2960].map((z) => P(xA, b.y1 + off, z)));
await dim(vB, [P(b.x0, yc, za + off), P(b.x1, yc, za + off)]);
await dim(vB, levels.map((z) => P(b.x1 + off, yc, z)));
await dim(vTop, [P(b.x0, b.y0 - off), P(b.x1, b.y0 - off)]);
await dim(vTop, [P(b.x0 - off, b.y0), P(b.x0 - off, b.y1)]);

if (big) {
  const top = levels.filter((z) => z >= b.z1 - 560), base = levels.filter((z) => z <= b.z0 + 460);
  await dim(vDT, [P(b.x0, yc, b.z1 - 540), P(b.x1, yc, b.z1 - 540)]);
  if (top.length > 1) await dim(vDT, top.map((z) => P(b.x1 + 60, yc, z)));
  await dim(vDB, [P(b.x0, yc, b.z0 - 40), P(b.x1, yc, b.z0 - 40)]);
  if (base.length > 1) await dim(vDB, base.map((z) => P(b.x1 + 60, yc, z)));
}

// Keynotes by material, leader to that material's largest part on the front. Quantities from the parts.
const by = {};
for (const f of parts) {
  const d = [f.x1 - f.x0, f.y1 - f.y0, f.z1 - f.z0].sort((a, c) => a - c);
  const a = d[0] <= 25 ? (d[1] * d[2]) / 1e6 : (2 * (d[0] * d[1] + d[1] * d[2] + d[0] * d[2])) / 1e6;
  const q = (by[f.m] ??= { area: 0, len: 0, n: 0, big: f, bigA: 0 }); q.area += a; q.len += d[2] / 1000; q.n += 1;
  if ((f.x1 - f.x0) * (f.z1 - f.z0) > q.bigA) { q.bigA = (f.x1 - f.x0) * (f.z1 - f.z0); q.big = f; }
}
const mats = Object.entries(by).sort((p, q) => (q[1].big.z0 + q[1].big.z1) - (p[1].big.z0 + p[1].big.z1)); // top part first, so 1 is at the top
const key = async (v, at, to, n) => { try { await call("create_keynote", { view_id: v, at, to, text: String(n), text_type_id: num }); } catch (e) { console.log("key", n, e.message.slice(0, 110)); } };
// Numbers in one column right of the front view, leaders horizontal to each part, at least 12 mm apart on paper.
const kx = b.x1 + 0.7 * M;
let zPrev = Infinity;
for (let k = 0; k < mats.length; k++) {
  const f = mats[k][1].big, lo = f.z0 + Math.min(5 * s, (f.z1 - f.z0) / 2), hi = f.z1 - Math.min(5 * s, (f.z1 - f.z0) / 2);
  const z = Math.max(Math.min((f.z0 + f.z1) / 2, zPrev - 12 * s, hi), Math.min(lo, zPrev - 12 * s)); zPrev = z;
  const xs = Math.min(f.x1 - 2, Math.max(f.x0 + 2, (f.x0 + f.x1) / 2));
  await key(vFront, P(kx, yf, z + 5 * s), P(xs, yf, z), k + 1); // the number anchor sits 5 mm (paper) above its leader end
}

// Saudi figure on the side view only, 1700 mm, grey shade, facing the unit.
const seg = (a, c) => ({ start: a, end: c });
const chain = (pts) => pts.slice(1).map((p, k) => seg(pts[k], p));
await call("ensure_line_style", { name: "Indicative", weight: 1, color: { r: 130, g: 130, b: 130 } });
await call("ensure_line_style", { name: "Figure Shade", weight: 3, color: { r: 200, g: 200, b: 200 } });
const draw = async (v, lines, style) => {
  const q = await call("create_detail_lines", { view_id: v, lines: lines.filter((l) => Math.hypot(l.start.x - l.end.x, l.start.y - l.end.y, l.start.z - l.end.z) > 2), line_style: style });
  if (style === "Indicative") await call("set_element_overrides", { view_id: v, element_ids: q.ids, halftone: true });
};
const spline = (pts, n = 7) => { const out = [], m = pts.length, at = (k) => pts[Math.max(0, Math.min(m - 1, k))]; for (let k = 0; k < m - 1; k++) { const [p0, p1, p2, p3] = [at(k - 1), at(k), at(k + 1), at(k + 2)]; for (let q = 0; q < n; q++) { const u = q / n, u2 = u * u, u3 = u2 * u; out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * u3))); } } out.push(pts[m - 1]); return out; };
const SIDE = [
  spline([[-92, 1630], [-55, 1688], [0, 1700], [50, 1688], [70, 1650]]),
  spline([[70, 1650], [76, 1610], [94, 1575], [78, 1555], [78, 1530], [64, 1495], [38, 1480]]),
  spline([[38, 1480], [46, 1420], [92, 1340], [118, 1180], [120, 800], [130, 400], [145, 70]]),
  [[145, 70], [-125, 70]],
  spline([[-125, 70], [-115, 500], [-112, 1000], [-118, 1270], [-112, 1320]]),
  spline([[-92, 1630], [-104, 1540], [-122, 1420], [-132, 1320], [-112, 1290], [-60, 1320], [-30, 1420], [-5, 1540], [48, 1645]]),
  spline([[-92, 1644], [-20, 1662], [66, 1656]]),
  spline([[-96, 1628], [-20, 1646], [70, 1640]]),
  spline([[-5, 1370], [40, 1300], [62, 1100], [64, 890], [78, 810], [48, 780], [14, 800], [-2, 890], [-28, 1100], [-30, 1300]]),
  spline([[-70, 70], [-75, 0], [150, 0], [180, 18], [150, 45], [120, 70]]),
];
const YH = b.y0 - 280, PS = ([h, z]) => P(xs, YH + h, z);
const crossings = (poly, v) => { const out = []; for (let k = 0; k < poly.length; k++) { const p = poly[k], q = poly[(k + 1) % poly.length]; if ((p[1] <= v) !== (q[1] <= v)) out.push(p[0] + ((v - p[1]) / (q[1] - p[1])) * (q[0] - p[0])); } out.sort((m, n) => m - n); const iv = []; for (let k = 0; k + 1 < out.length; k += 2) iv.push([out[k], out[k + 1]]); return iv; };
const union = (iv) => { const u = []; for (const c of [...iv].sort((m, n) => m[0] - n[0])) { const l = u[u.length - 1]; if (l && c[0] <= l[1]) l[1] = Math.max(l[1], c[1]); else u.push([...c]); } return u; };
const shade = (polys) => { const out = []; for (let v = 1; v <= 1699; v += Math.max(3, 0.6 * s)) for (let [u, w] of union(polys.flatMap((q) => crossings(q, v)))) { if (w - u > 24.4 && w - u < 25.6) w += 1.3; if (w - u > 2) out.push(seg(PS([u, v]), PS([w, v]))); } return out; };
await draw(vSide, shade([[...SIDE[0], ...SIDE[1], ...SIDE[2], ...SIDE[4]], SIDE[5], SIDE[8], SIDE[9]]), "Figure Shade");
await draw(vSide, SIDE.flatMap((l) => chain(l.map(PS))), "Indicative");

// Sheet, per the layout guide.
const sheet = (await call("create_sheet", { number: `${sn(t.no)}`, name: t.title, title_block_type_id: TB })).id;
for (const [n, v] of [["Designed By", "Lorch"], ["Checked By", "Mohamed Sultan"], ["Approved By", "Anas Matter"]]) await setv(sheet, n, v);
await call("create_text_note", { view_id: sheet, location: P(1027, 672), text: "Samaya Invest", text_type_id: note });
await call("set_sheet_revisions", { sheet_ids: [sheet], revision_ids: [REV, ...(process.env.REV_EXTRA ?? "").split(",").filter(Boolean).map(Number)] });
const wF = W / s, hF = H / s, wS = D / s, hP = PH / s, wA = (dy + 2 * M) / s, wB = W / s, hC = (zb - za) / s;
const TOP = 810, LEFT = 45, // 15 mm clear of the drawing border
     _unused = 0, fx = LEFT + wF / 2, fy = TOP - hF / 2, sx = LEFT + wF + 10 + wS / 2, py = TOP - hF - 25 - hP / 2;
const place = (v, x, y) => call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(x, y) });
// The user's layout (sheet 120): Front, Side, Section A, Section B in one top row, heads aligned, spread evenly up to the
// text column; row 2 holds each plan or detail under the view it belongs to: Top View under Front, details under Side and Section A.
const NOTES = 815, levelY = fy + ((za + zb) / 2 - (zBot + zTop) / 2) / s;
// Widths are the crop widths, which already hold the dimensions and the side view figure.
const blocks = [[vFront, wF, 0, 0, fy], [vSide, wS, 0, 0, fy], [vA, wA, 0, 0, levelY], [vB, wB, 0, 0, levelY]];
const used = blocks.reduce((a, [, w, l, r]) => a + l + w + r, 0), free = NOTES - 25 - LEFT - used;
globalThis.L = {};
console.log("layout", JSON.stringify({ s, wF, wS, wA, wB, used: Math.round(used), free: Math.round(free) }));
if (free >= 30) {
  const gap = free / 3; let x = LEFT;
  for (const [k, [v, w, l, r, y]] of blocks.entries()) { const cxv = x + l + w / 2; await place(v, cxv, y); globalThis.L[["front", "side", "A", "B"][k]] = cxv; x += l + w + r + gap; }
  await place(vTop, globalThis.L.front + (FACE ? 15 : 0), py); // a side unit's plan crop is wider than its front: keep its title off the border
  if (big) { await place(vDT, globalThis.L.side, py); await place(vDB, globalThis.L.A, py); }
} else {
  await place(vFront, fx, fy); await place(vSide, sx, fy); await place(vTop, fx, py);
  let cx = LEFT + wF + 10 + wS + 10, cy = TOP - hC / 2, row2 = false;
  for (const [v, w] of [[vA, wA], [vB, wB]]) {
    if (!row2 && cx + w > NOTES - 5) { row2 = true; cx = LEFT + wF + 15; cy = Math.min(TOP - hF - 25 - hC / 2, 50 + hC / 2 + 40); }
    await place(v, cx + w / 2, cy); cx += w + 10;
  }
  globalThis.L = { front: fx, side: sx, A: 351, B: 682 };
  if (big) { await place(vDT, 351, py); await place(vDB, 682, py); }
}
const v3ds = (await call("list_views", {})).views.filter((x) => x.view_type === "ThreeD");
const v3dBase = v3ds.find((x) => x.name === "3D all") ?? v3ds.find((x) => x.name === "{3D}"); // the isometric cover view
if (v3dBase) {
  let v3;
  if (FACE) { // isometric from the unit's own front-left corner
    const c = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, zc = (b.z0 + b.z1) / 2, e = ROT({ x: c.x - 3000, y: c.y - 3000 }), tg = ROT(c);
    const v = await rawC("create_3d_view", { name: P_ + "3D View", eye: { ...e, z: zc + 2500 }, target: { ...tg, z: zc }, style: "ShadingWithEdges" }); v3 = v.id ?? v.view_id;
  } else { const d3 = await call("duplicate_view", { view_id: v3dBase.id, name: P_ + "3D View", option: "Duplicate" }); v3 = d3.id ?? d3.view_id; }
  await setv(v3, "View Scale", 15); await setv(v3, "Detail Level", 3); await setv(v3, "Title on Sheet", "3D View");
  await call("isolate_in_view", { view_id: v3, element_ids: [id] });
  await place(v3, 929, 300);
  // Scale the 3D view to fill the free area under the notes column (the user's rule for each unit's first sheet).
  globalThis.fit3dArgs = [sheet, v3, id];
  globalThis.view3d = v3;
} else console.log("no 3D view in the model");
if (key_ === "TA") {
  // Exploded view: parts pulled apart along the depth, in assembly order. Outlines only, drawn from the typical's sizes.
  const exAll = (await call("query_elements", { category: "OST_Furniture", limit: 1000 })).elements.filter((e) => e.name.includes("Arch Exploded"));
  const exG = await Promise.all(exAll.map((e) => call("get_element", { element_id: e.id })));
  const exBase = exG.find((g) => (g.location?.rotation_deg ?? 0) === 0 && Math.abs(g.location.point.x + 13787.5) < 1) ?? exG[0];
  const extra = exG.filter((g) => g.id !== exBase.id).map((g) => g.id);
  if (extra.length) await call("delete_elements", { element_ids: extra });
  const exType = (await call("list_element_types", { category: "OST_Furniture" })).types.find((x) => x.family === "Madina Arch Exploded").id;
  const lvl1 = (await call("list_levels")).levels.find((l) => l.elevation_mm === 0).id;
  const evs = [], ANG = [[0, "Exploded View, Front"], [180, "Exploded View, Rear"]], insts = [exBase.id];
  for (let k = 1; k < 2; k++) insts.push((await call("place_family_instance", { family_type_id: exType, location: { x: -8000, y: 2820, z: exBase.location.point.z }, level_id: lvl1, rotation_deg: ANG[k][0], structural_type: "NonStructural" })).id);
  await call("isolate_in_view", { view_id: globalThis.view3d, element_ids: [id] });
  for (let k = 0; k < 2; k++) {
    // A fresh isometric on each copy: "3D all" carries a section box round the shop, which leaves the exploded copies outside it.
    const eb = (await call("get_element", { element_id: insts[k] })).bounding_box, ec = { x: (eb.min.x + eb.max.x) / 2, y: (eb.min.y + eb.max.y) / 2, z: (eb.min.z + eb.max.z) / 2 };
    const dE = await rawC("create_3d_view", { name: P_ + ANG[k][1], eye: { x: ec.x - 3000, y: ec.y - 3000, z: ec.z + 2500 }, target: ec, style: "ShadingWithEdges" }), vv = dE.id ?? dE.view_id;
    await call("set_view_categories", { view_id: vv, hide: ["OST_RvtLinks"] }).catch(() => {});
    await setv(vv, "View Scale", 10); await setv(vv, "Detail Level", 3); await setv(vv, "Title on Sheet", ANG[k][1]);
    await call("isolate_in_view", { view_id: vv, element_ids: [insts[k]] });
    evs.push(vv);
  }
  const oldE = (await call("query_elements", { category: "OST_Sheets", limit: 1000 })).elements.filter((e) => e.name === "Typical Arch Exploded View").map((e) => e.id);
  if (oldE.length) await call("delete_elements", { element_ids: oldE }).catch(() => {});
  const sheetE = (await call("create_sheet", { number: "MD1-SF-ZZ-GF-DR-A-2102", name: "Typical Arch Exploded View", title_block_type_id: TB })).id;
  for (const [n, v] of [["Designed By", "Lorch"], ["Checked By", "Mohamed Sultan"], ["Approved By", "Anas Matter"]]) await setv(sheetE, n, v);
  await call("create_text_note", { view_id: sheetE, location: P(1027, 672), text: "Samaya Invest", text_type_id: note });
  await call("set_sheet_revisions", { sheet_ids: [sheetE], revision_ids: [REV, ...(process.env.REV_EXTRA ?? "").split(",").filter(Boolean).map(Number)] });
  for (const [k, [x, y]] of [[200, 430], [540, 430]].entries()) await call("place_view_on_sheet", { sheet_id: sheetE, view_id: evs[k], location: P(x, y) });
  await call("create_text_note", { view_id: sheetE, location: P(764, 810), text: "ASSEMBLY ORDER", text_type_id: bold });
  await call("create_text_note", { view_id: sheetE, location: P(764, 795), text: ["1  Arch frame, steel angles, marble top below", "2  Rear metal plates, 2 halves", "3  Driver and wiring", "4  Front metal plates, 2 halves, on the wood board", "5  Wood pegboard, one piece, and lower panel", "6  Pegs", "7  Shelves", "8  Marble L, on the wood L fixed in the arch frame"].join(String.fromCharCode(10)), text_type_id: note });
  const kpE = await call("duplicate_view", { view_id: 312, name: "KP-139", option: "Duplicate" }), ke = kpE.id ?? kpE.view_id;
  for (const [n, x] of [["View Scale", 100], ["Detail Level", 1], ["Title on Sheet", "Key Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(ke, n, x);
  const kbe = (await call("get_element", { element_id: ke })).bounding_box;
  await call("extend_view_crop", { view_id: ke, left_mm: kbe.min.x + 100, right_mm: 6880 - kbe.max.x, bottom_mm: kbe.min.y + 100, top_mm: 5700 - kbe.max.y });
  await call("set_view_categories", { view_id: ke, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Grids"] }).catch(() => {});
  await markUnits(ke, /Arch Typical A/);
  await call("place_view_on_sheet", { sheet_id: sheetE, view_id: ke, location: P(1102, 430) });
  log.TE = { sheet: sheetE }; writeFileSync(LOG, JSON.stringify(log));

  // Plan detail at the side: stop on the side, pegboard on the stop, 18 mm free behind it.
  const dv = (await call("create_drafting_view", { name: P_ + "Detail Pegboard", scale: 2 })).id;
  await setv(dv, "Title on Sheet", "Detail: Pegboard at the Side");
  const sg = (a, c) => ({ start: P(a[0], a[1]), end: P(c[0], c[1]) }), rc = (x0, y0, x1, y1) => [sg([x0, y0], [x1, y0]), sg([x1, y0], [x1, y1]), sg([x1, y1], [x0, y1]), sg([x0, y1], [x0, y0])];
  await call("ensure_line_style", { name: "Detail Cut", weight: 5, color: { r: 0, g: 0, b: 0 } });
  await call("create_detail_lines", { view_id: dv, lines: [...rc(0, 0, 18, 170), ...rc(18, 0, 36, 170), ...rc(36, 2, 38, 32), ...rc(38, 32, 230, 34), ...rc(38, 34, 230, 52), ...rc(38, 52, 230, 60), ...rc(38, 0, 230, 2), sg([0, 0], [230, 0])], line_style: "Detail Cut" });
  const lb = async (at, to, tx) => { try { await call("create_keynote", { view_id: dv, at: P(at[0], at[1]), to: P(to[0], to[1]), text: tx, text_type_id: note }); } catch (e) { console.log("lb", e.message.slice(0, 90)); } };
  await lb([70, 150], [18, 120], "Side, double 18 mm");
  await lb([120, 110], [37, 15], "Steel angle, fixed to the side");
  await lb([120, 85], [150, 56], "EGGER, 8 mm, face of the pegboard");
  await lb([270, 45], [200, 43], "FR MDF, 18 mm, on 2 mm plate");
  await lb([270, -30], [150, 16], "30 mm space, rear plate behind");
  await place(dv, globalThis.L.side ?? 268, py);
}
const txt = (x, y, tx, type = note) => call("create_text_note", { view_id: sheet, location: P(x, y), text: tx, text_type_id: type });
const shortM = (m) => m.replace(/\s*ST\d+/, "").replace(/\s*\(.*?\)/, "").slice(0, 46);
await txt(NOTES, 812, `${t.title.toUpperCase()}   QTY ${t.units.length}\n${t.size ?? `${r(dx)} x ${r(dy)} x ${r(b.z1 - b.z0)}`}\nUnits: ${t.units.join(", ")}`, bold);
await txt(NOTES, 770, "KEYNOTES", bold);
await txt(NOTES, 757, [...mats.map(([m], k) => `${k + 1}   ${shortM(m)}`), "Grey: 1700 mm figure, indicative"].join("\n"));
const y2 = 757 - (mats.length + 1) * 7.8 - 20;
await txt(NOTES, y2, "MATERIAL QUANTITIES", bold);
await txt(NOTES, y2 - 12, "(per unit, net, no waste, approx.)");
await txt(NOTES, y2 - 28, ["MATERIAL", ...mats.map(([m]) => shortM(m).slice(0, 40))].join("\n"));
await txt(975, y2 - 28, ["QTY", ...mats.map(([m, q]) => /LED|PVC|Edge|Softwood/.test(m) ? `${q.len.toFixed(2)} m` : /Support|Knob|Handle/.test(m) ? `${q.n} no.` : `${q.area.toFixed(2)} m2`)].join("\n"));
await txt(NOTES, y2 - 28 - (mats.length + 2) * 7.8 - 8, `${t.note ? t.note + "\n" : ""}All dimensions in mm.\nCheck on site before fabrication.\nCurved parts measured by their\nbounding size: confirm with CNC.`);
globalThis.notesBottom = y2 - 28 - (mats.length + 2) * 7.8 - 8 - ((t.note ? t.note.split(String.fromCharCode(10)).length : 0) + 5) * 7.8;
const kpD = await call("duplicate_view", { view_id: 312, name: `KP-${t.no}`, option: "Duplicate" });
const kp = kpD.id ?? kpD.view_id;
for (const [n, x] of [["View Scale", 100], ["Detail Level", 1], ["Title on Sheet", "Key Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(kp, n, x);
const kb = (await call("get_element", { element_id: kp })).bounding_box;
await call("extend_view_crop", { view_id: kp, left_mm: kb.min.x + 100, right_mm: 6880 - kb.max.x, bottom_mm: kb.min.y + 100, top_mm: 5700 - kb.max.y });
await call("set_view_categories", { view_id: kp, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Grids"] }).catch(() => {});
if (key_ === "TA") await markUnits(kp, /Arch Typical A/);
else if (key_ === "MH") await markUnits(kp, /^Madina Centre Arch Mihrab Unit$/);
else await markUnits(kp, new RegExp(t.units.map((u) => "(Arch Unit|Base Cabinet|Low Bay|Arch Panel|Niche Frame|Niche Shelf Unit|Niche Cabinet|Carpet Hanger|Column Cladding) " + u + "$").join("|")));
const kv = await call("place_view_on_sheet", { sheet_id: sheet, view_id: kp, location: P(1102, 430) });
await call("set_viewport_no_title", { viewport_id: kv.id }).catch(() => console.log("key plan title stays until add-in install"));
log[key_] = { sheet, vFront, vSide, vA, vB, vTop, vDT, vDB, vKey: kp }; writeFileSync(LOG, JSON.stringify(log));
// Free area for the 3D view: optional 3rd argument x0,x1,y0,y1 in sheet mm, read off the render.
if (globalThis.fit3dArgs) console.log("3D", JSON.stringify(await fit3d(...globalThis.fit3dArgs, process.argv[3] ? process.argv[3].split(",").map(Number) : [NOTES - 60, 1005, 45, Math.min(560, (globalThis.notesBottom ?? 575) - 15)])));
console.log("done", key_, "scale", s, "levels", levels.join(","), "rot", rot, "mats", mats.map(([m, q]) => m + "=" + q.area.toFixed(2)).join("; "));
