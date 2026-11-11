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
const byMark = async (mark) => { for (const c of ["OST_Casework", "OST_GenericModel", "OST_Furniture", "OST_SpecialityEquipment"]) { const q = (await call("query_elements", { category: c, parameter_name: "Mark", parameter_value: mark, limit: 20 })).elements; for (const e of q) { const g = await call("get_element", { element_id: e.id }); if (g.parameters.find((p) => p.name === "Mark")?.value === mark) return g; } } return null; };
const g = await byMark(t.ref); if (!g) throw new Error("no unit with mark " + t.ref);
const id = g.id;
const fam = await call("inspect_family", { element_id: id });
const raw = fam.items.filter((f) => (f.class === "FreeFormElement" || f.class === "Extrusion") && f.min);
const instRot = ((g.location?.rotation_deg ?? 0) % 360 + 360) % 360, o = g.location.point;
const rot = t.rot ?? instRot; // t.rot: the face direction when it differs from the instance rotation (a family built in place on a rear wall has rotation 0)
const turn = ([x, y]) => instRot === 90 ? [-y, x] : instRot === 180 ? [-x, -y] : instRot === 270 ? [y, -x] : [x, y];
const parts = raw.map((f) => { const [a, c] = [turn([f.min.x, f.min.y]), turn([f.max.x, f.max.y])]; return { own: id, m: f.material ?? "Unassigned", x0: Math.min(a[0], c[0]) + o.x, x1: Math.max(a[0], c[0]) + o.x, y0: Math.min(a[1], c[1]) + o.y, y1: Math.max(a[1], c[1]) + o.y, z0: f.min.z + o.z, z1: f.max.z + o.z }; });
// t.with: marks of separate families that belong to this item (Makkah AR-B1 ring, rebuilt smooth as its own family): they
// are drawn, isolated and counted with it.
const IDS = [id];
for (const mk of t.with ?? []) {
  const g2 = await byMark(mk); if (!g2) { console.log("with: no", mk); continue; }
  IDS.push(g2.id);
  const r2 = ((g2.location?.rotation_deg ?? 0) % 360 + 360) % 360, o2 = g2.location.point;
  const tn = ([x, y]) => r2 === 90 ? [-y, x] : r2 === 180 ? [-x, -y] : r2 === 270 ? [y, -x] : [x, y];
  for (const f of (await call("inspect_family", { element_id: g2.id })).items.filter((f) => (f.class === "FreeFormElement" || f.class === "Extrusion") && f.min)) {
    const [a, c] = [tn([f.min.x, f.min.y]), tn([f.max.x, f.max.y])];
    parts.push({ own: g2.id, m: f.material ?? "Unassigned", x0: Math.min(a[0], c[0]) + o2.x, x1: Math.max(a[0], c[0]) + o2.x, y0: Math.min(a[1], c[1]) + o2.y, y1: Math.max(a[1], c[1]) + o2.y, z0: f.min.z + o2.z, z1: f.max.z + o2.z });
  }
}
// Family coordinates + location are not always where the solids are: families made by make_unit_family from the casework
// template sit 44.7 mm off along their local x (Madina 2 RA-B-BL and the LF -M marble, 11 Nov 2026: the sheet said 1606 wide
// for a 1561 arch). Measure each instance with rays along x, y and z and shift its parts by the value most rays agree on.
{
  const { hitsAlong, setDoc } = await import("./fitlib.mjs"); setDoc(C.doc);
  const AXS = ["x", "y", "z"];
  for (const own of IDS) {
    const ps = parts.filter((f) => f.own === own), d = { x: 0, y: 0, z: 0 };
    for (const a of AXS) {
      const [p1, p2] = AXS.filter((k) => k !== a), sz = (f) => (f[p1 + "1"] - f[p1 + "0"]) * (f[p2 + "1"] - f[p2 + "0"]);
      const votes = [];
      for (const p of [...ps].sort((u, v) => sz(v) - sz(u)).slice(0, 8)) for (const fr of [0.5, 0.25, 0.75]) {
        const q = { [a]: (p[a + "0"] + p[a + "1"]) / 2, [p1]: p[p1 + "0"] + fr * (p[p1 + "1"] - p[p1 + "0"]), [p2]: p[p2 + "0"] + fr * (p[p2 + "1"] - p[p2 + "0"]) };
        const on = ps.filter((f) => f[p1 + "0"] <= q[p1] && f[p1 + "1"] >= q[p1] && f[p2 + "0"] <= q[p2] && f[p2 + "1"] >= q[p2]);
        const h = await hitsAlong(own, { x: q.x + d.x, y: q.y + d.y, z: q.z + d.z }, a);
        if (h && on.length) votes.push(Math.round((h.lo - (Math.min(...on.map((f) => f[a + "0"])) + d[a])) * 2) / 2);
      }
      if (!votes.length) continue;
      const cnt = new Map(); for (const v of votes) cnt.set(v, (cnt.get(v) ?? 0) + 1);
      const [best, n] = [...cnt].sort((u, v) => v[1] - u[1])[0];
      // only a clear majority counts (loose boxes of curved parts give scattered votes), and only a small shift
      if (Math.abs(best) > 0.5 && Math.abs(best) <= 100 && n >= Math.max(3, votes.length / 2)) d[a] += best;
      else if (Math.abs(best) > 0.5) console.log("placement check", own, a, "no clear shift", JSON.stringify([...cnt].slice(0, 6)));
    }
    if (AXS.some((a) => d[a])) { console.log("placement fix", own, JSON.stringify(d)); for (const f of ps) for (const a of AXS) { f[a + "0"] += d[a]; f[a + "1"] += d[a]; } }
  }
}
const b = { x0: Math.min(...parts.map((f) => f.x0)), x1: Math.max(...parts.map((f) => f.x1)), y0: Math.min(...parts.map((f) => f.y0)), y1: Math.max(...parts.map((f) => f.y1)), z0: Math.min(...parts.map((f) => f.z0)), z1: Math.max(...parts.map((f) => f.z1)) };
// A rear-wall unit placed at rotation 0 (Makkah OSB-1, AR-B1, SC-C1) needs "rot": 270 in its config, or front and side swap.
// rot 90 = faces +y (a free-standing unit whose working face looks away from the front wall, Makkah FS-1): the unit frame is
// the world turned 180, so the front elevation looks at the +y face (without this it looked through the open back).
const FACE = rot === 0 ? "+x" : rot === 180 ? "-x" : rot === 90 ? "+y" : null, Bw = { ...b };
const SIDEW = FACE === "+x" || FACE === "-x"; // side-wall units: their plan is drawn north-up, so it stands turned on paper
if (FACE) {
  const rr = FACE === "+x" ? ([x, y]) => [-y, x] : FACE === "+y" ? ([x, y]) => [-x, -y] : ([x, y]) => [y, -x];  // unit frame -> world
  const ri = FACE === "+x" ? ([x, y]) => [y, -x] : FACE === "+y" ? ([x, y]) => [-x, -y] : ([x, y]) => [-y, x];  // world -> unit frame
  ROT = (p) => { const [x, y] = rr([p.x, p.y]); return { x, y }; };
  const box = (x0, x1, y0, y1) => { const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(ri); return [Math.min(...c.map((q) => q[0])), Math.max(...c.map((q) => q[0])), Math.min(...c.map((q) => q[1])), Math.max(...c.map((q) => q[1]))]; };
  [b.x0, b.x1, b.y0, b.y1] = box(b.x0, b.x1, b.y0, b.y1);
  for (const f of parts) [f.x0, f.x1, f.y0, f.y1] = box(f.x0, f.x1, f.y0, f.y1);
}
const dx = b.x1 - b.x0, dy = b.y1 - b.y0, xc = (b.x0 + b.x1) / 2, yc = (b.y0 + b.y1) / 2;
// yL: where Section B, the location section and the space probes cut. Mid-depth by default; t.locDepth (mm behind the
// front face) for a unit whose back half wraps existing structure, so they cut through the shop part (Makkah FS-1).
const yL = t.locDepth != null ? b.y0 + t.locDepth : yc;
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
// Workshop drawings follow ISO 128 (user, Makkah FS-1, 10 Nov 2026: "ISO 128 hatches, not colouring"): hidden line, each
// material told apart by its cut hatch (material-hatching.md), with a materials legend of hatch swatches. t.style overrides.
const STYLE = t.style ?? "HLR";
// Cut hatch per material, the Samaya table in material-hatching.md; applied to every material of the unit before the views.
const HATCH = (m) => /Steel|Metal|Alumin|LED|Profile|Rail\b/i.test(m) ? { solid: true }
  : /Veneer\b|HPL|PVC|ABS|Edge/i.test(m) && !/Softwood/i.test(m) ? { solid: true }
  : /Softwood|Plinth|Skirting|Frame/i.test(m) ? { cross: true, angle_degrees: 45, spacing_mm: 2.5 }
  : /Ply/i.test(m) ? { angle_degrees: 0, spacing_mm: 1 }
  : /Marble|Stone|Corian|Solid Surface|Granite/i.test(m) ? { angle_degrees: 45, spacing_mm: 4 }
  : /Glass/i.test(m) ? { angle_degrees: 60, spacing_mm: 1 }
  : /MDF|Display Bars|Slat/i.test(m) ? { angle_degrees: 135, spacing_mm: 1.5 }
  : { angle_degrees: 45, spacing_mm: 1.5 };                                            // EGGER and other boards
const hatchName = (h) => h.solid ? null : `Hatch ${h.cross ? "Cross " : ""}${h.angle_degrees} ${h.spacing_mm}`;
for (const m of new Set(parts.map((f) => f.m))) await call("set_material_hatch", { material: m, ...HATCH(m) }).catch((e) => console.log("hatch", m, e.message.slice(0, 80)));
const sec = async (name, title, start, end, look, depth, scale, top, bottom) => {
  const v = await call("create_section", { start, end, look_direction: look, bottom_mm: bottom, top_mm: top, depth_mm: depth });
  const vid = v.id ?? v.view_id;
  await setv(vid, "View Name", P_ + name); await setv(vid, "Hide at scales coarser than", 2); await setv(vid, "View Scale", scale); await setv(vid, "Detail Level", 3); await setv(vid, "Title on Sheet", title);
  await call("set_view_display", { view_id: vid, style: STYLE }).catch(() => {});
  return vid;
};
const vFront = await sec("Front Elevation", "Front Elevation", P(b.x0 - M, yf), P(b.x1 + M, yf), P(0, 1, 0), dy + 300, s, zTop, zBot);
const vSide = await sec("Side Elevation", "Side Elevation", P(xs, b.y1 + 240), P(xs, b.y0 - F), P(1, 0, 0), dx + 300, s, zTop, zBot);
const za = b.z0 - 150, zb = b.z1 + 150, xA = t.sectionAt ?? xc;
const vA = await sec("Section A", "Section A", P(xA, b.y1 + M), P(xA, b.y0 - M), P(1, 0, 0), 40, s, zb, za);
const vB = await sec("Section B", "Section B", P(b.x0 - M, yL), P(b.x1 + M, yL), P(0, 1, 0), 40, s, zb, za);
const planId = (await call("list_views", {})).views.find((x) => x.name === C.planView)?.id; if (!planId) throw new Error("no plan view " + C.planView);
const dp = await call("duplicate_view", { view_id: planId, name: P_ + "Top View", option: "Duplicate" });
const vTop = dp.id ?? dp.view_id;
await setv(vTop, "View Scale", s); await setv(vTop, "Detail Level", 3); await setv(vTop, "Title on Sheet", "Top View"); await setv(vTop, "View Template", -1);
await call("set_view_display", { view_id: vTop, style: STYLE }).catch(() => {});
await setv(vTop, "Crop View", 1); await setv(vTop, "Annotation Crop", 1);
const pb = (await call("get_element", { element_id: vTop })).bounding_box;
const m_ = M + (SIDEW ? 150 : 0), B0 = FACE ? Bw : b;
await call("extend_view_crop", { view_id: vTop, left_mm: pb.min.x - (B0.x0 - m_), right_mm: B0.x1 + m_ - pb.max.x, bottom_mm: pb.min.y - (B0.y0 - m_), top_mm: B0.y1 + m_ - pb.max.y });
await call("set_view_range", { view_id: vTop, top_mm: b.z1 + 300, cut_mm: b.z1 + 200, bottom_mm: 0 }).catch((e) => console.log("range", e.message.slice(0, 90)));
const big = t.details !== false && s >= 8 && W / 5 <= 360 ? 5 : 0; // 1:5 details when the unit is no wider than 360 mm on paper at 1:5
// Details are corner details: the right-hand 350 mm of the unit plus 100 clear (full-width 1:5 sections overlapped on A-2002).
const dx0 = Math.max(b.x0 - 100, b.x1 - 350);
const vDT = big ? await sec("Detail Top", "Detail: Top", P(dx0, yc), P(b.x1 + 100, yc), P(0, 1, 0), 40, big, b.z1 + 60, b.z1 - 460) : null;
const vDB = big ? await sec("Detail Base", "Detail: Base", P(dx0, yc), P(b.x1 + 100, yc), P(0, 1, 0), 40, big, b.z0 + 360, b.z0 - 60) : null;
// t.lDetail = { at: [x, y] on the sheet, scale (2), back (160), up (120), title }: a large section through the front bottom
// corner (Section A's cut, cropped), for a stone L glued on the wood (Madina 2 marble heads: 45 mitre, bird's-nose R10).
const vL = t.lDetail ? await sec("L Corner", t.lDetail.title ?? "Detail: L Corner", P(xA, b.y0 + (t.lDetail.back ?? 160)), P(xA, b.y0 - 40), P(1, 0, 0), 40, t.lDetail.scale ?? 2, b.z0 + (t.lDetail.up ?? 120), b.z0 - 40) : null;
for (const v of [vFront, vSide, vA, vB, vTop, vDT, vDB, vL].filter(Boolean)) {
  await call("isolate_in_view", { view_id: v, element_ids: IDS });
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
await dim(vB, [P(b.x0, yL, za + off), P(b.x1, yL, za + off)]);
await dim(vB, levels.map((z) => P(b.x1 + off, yL, z)));
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
await call("set_sheet_revisions", { sheet_ids: [sheet], revision_ids: t.revisions ?? C.revisions }); // t.revisions: the revisions this sheet carries when they differ from the set default
const wF = W / s, hF = H / s, wS = D / s, hP = PH / s, wA = (dy + 2 * M) / s, wB = W / s, hC = (zb - za) / s;
// The Top View of a side unit is drawn north-up (its crop cannot be turned), so on paper it is as tall as the unit is long:
// size it from the world box, or it runs up into the front elevation (counter D-02, Makkah Rev 07). Details keep their own row.
const wTop = ((FACE ? Bw : b).x1 - (FACE ? Bw : b).x0 + 2 * (M + (SIDEW ? 150 : 0))) / s; // top view width on paper
const hTop = SIDEW ? (Bw.y1 - Bw.y0 + 2 * (M + 150)) / s : hP;                         // top view height on paper
const TOP = 810, LEFT = 45, fx = LEFT + wF / 2, fy = TOP - hF / 2, sx = LEFT + wF + 10 + wS / 2, pyD = TOP - hF - 25 - hP / 2, py = Math.max(TOP - hF - 30 - hTop / 2, 45 + hTop / 2);
const place = (v, x, y) => call("place_view_on_sheet", { sheet_id: sheet, view_id: v, location: P(x, y) });
const NOTES = 815, levelY = fy + ((za + zb) / 2 - (zBot + zTop) / 2) / s;
const blocks = [[vFront, wF, fy], [vSide, wS, fy], [vA, wA, levelY], [vB, wB, levelY]];
const used = blocks.reduce((a, [, w]) => a + w, 0), free = NOTES - 25 - LEFT - used;
const L = {};
if (free >= 30) {
  const gp = free / 3; let x = LEFT;
  for (const [k, [v, w, y]] of blocks.entries()) { const cxv = x + w / 2; await place(v, cxv, y); L[["front", "side", "A", "B"][k]] = cxv; x += w + gp; }
  await place(vTop, Math.max(L.front + (SIDEW ? 15 : 0), LEFT + wTop / 2 + 10), py);
  if (big) { await place(vDT, L.side, pyD); await place(vDB, L.A, pyD); }
} else {
  await place(vFront, fx, fy); await place(vSide, sx, fy); await place(vTop, Math.max(fx, LEFT + wTop / 2 + 10), py);
  let cx = LEFT + wF + 10 + wS + 10, cy = TOP - hC / 2, row2 = false;
  for (const [v, w] of [[vA, wA], [vB, wB]]) { if (!row2 && cx + w > NOTES - 5) { row2 = true; cx = LEFT + wF + 15; cy = Math.min(TOP - hF - 25 - hC / 2, 50 + hC / 2 + 40); } await place(v, cx + w / 2, cy); cx += w + 10; }
  L.row2Right = row2 ? cx : null; // where the location views may start when a section dropped to row two
  if (big) { await place(vDT, 351, pyD); await place(vDB, 682, pyD); }
}
// Text column.
const txt = (x, y, tx, type = note) => call("create_text_note", { view_id: sheet, location: P(x, y), text: tx, text_type_id: type });
// Keep the approved colour code whole (EGGER "H3710 ST12" is one code: the ST part is the texture), only drop notes in brackets.
const shortM = (m) => m.replace(/\s*\(.*?\)/, "").slice(0, 52);
// A rail ring plus its posts is one welded set for the metal factory: count it as a set, not by area.
const qty = (m, q) => /Rail\b/.test(m) ? "1 set" : /LED|PVC|Edge|Softwood|Angle|Peg\b|Hardwood Peg/.test(m) ? (/Peg/.test(m) ? `${q.n} no.` : `${q.len.toFixed(2)} m`) : /Handle|Support/.test(m) && q.n < 20 ? `${q.n} no.` : `${q.area.toFixed(2)} m2`;
await txt(NOTES, 812, `${t.title.toUpperCase()}   QTY ${t.marks.length}\n${t.size ?? `${r(dx)} x ${r(dy)} x ${r(b.z1 - b.z0)}`}\nUnits: ${t.marks.join(", ")}`, bold);
// Materials legend: each keynote with its ISO 128 cut hatch swatch (the same hatch the sections show).
await txt(NOTES, 770, "MATERIALS (KEYNOTE, CUT HATCH)", bold);
// Filled regions cannot be drawn on a sheet, so the swatches live in a 1:1 drafting view placed beside the rows.
const RW = 9;
const lg = await call("create_drafting_view", { name: P_ + "Materials Legend", scale: 1 }), vLg = lg.id;
for (const [k, [m]] of mats.entries()) {
  const yk = -k * RW, h = HATCH(m);
  await call("create_swatch", { view_id: vLg, min: P(0, yk - 6), max: P(16, yk), color: h.solid ? { r: 0, g: 0, b: 0 } : { r: 128, g: 128, b: 128 }, ...(h.solid ? {} : { fill_pattern: hatchName(h) }) }).catch((e) => console.log("swatch", e.message.slice(0, 80)));
  // the legend rows start 20 mm right of the text column: keep them clear of the title block (about 46 characters)
  const lab = shortM(m); if (lab.length > 46) console.log("LEGEND NAME TOO LONG, shorten the material name:", lab);
  await txt(NOTES + 20, 757 - k * RW + 0.5, `${k + 1}   ${lab.slice(0, 46)}`);
}
const lgv = await call("place_view_on_sheet", { sheet_id: sheet, view_id: vLg, location: P(NOTES + 8, 757 - ((mats.length - 1) * RW + 6) / 2) }).catch((e) => console.log("legend", e.message.slice(0, 80)));
if (lgv?.id) await call("set_viewport_no_title", { viewport_id: lgv.id }).catch(() => {});
await txt(NOTES + 20, 757 - mats.length * RW + 0.5, "Grey: 1700 mm figure, indicative");
const y2 = 757 - (mats.length + 1) * RW - 20;
await txt(NOTES, y2, "MATERIAL QUANTITIES", bold);
await txt(NOTES, y2 - 12, "(per unit, net, no waste, approx.)");
// The quantity list has the QTY column at x 975, so its names are kept short (the code stays; the keynote list above gives
// the full colour name): "Natural Carini Walnut" -> "Walnut", "Painted" -> "ptd.", at most 40 characters.
const shortQ = (m) => shortM(m).replace(/ Natural Carini Walnut/, " Walnut").replace(/\bPainted\b/, "ptd.").slice(0, 40);
await txt(NOTES, y2 - 28, ["MATERIAL", ...mats.map(([m]) => shortQ(m))].join("\n"));
await txt(975, y2 - 28, ["QTY", ...mats.map(([m, q]) => qty(m, q))].join("\n"));
const notesTxt = `${t.note ? t.note + "\n" : ""}${nearCeiling ? `Top +${(b.z1 / 1000).toFixed(3)}: ${r(C.ceiling - b.z1)} shadow gap\nto the ceiling (${GAP} min.).\n` : ""}All dimensions in mm.\nCheck on site before cutting.${t.cnc === false ? "" : "\nCurved parts: cut from the CNC file."}`;
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
const r3 = await unit3d(call, { name: P_ + "3D View", ids: IDS, sheet, area: [X0, X1, Y0, Ytop], dir: dirW, style: STYLE, box: wb });
const v3 = r3.view, s3 = r3.scale;
// Location: every item drawn in its place, not alone (user, 6 Nov 2026). A section through the unit's bay and a plan, NOT
// isolated, with the unit in red, its neighbours, wall, floor and ceiling, and dimensions of the space it has: width between
// its neighbours, height to whatever is above it, depth to the wall and the clear walkway in front. Neighbours are found by
// rays from each face (probe_ray), so the views say what the unit really touches.
const toW = (p) => (ROT ? { ...p, ...ROT(p) } : p);
const SKIP = /Room|Line|Camera|Level|Grid|Section Box|Area|Space|Light|Electric|Fixture|Device|Terminal|Duct|Sprinkler|Pipe|Conduit|Cable|Data|Communication|Fire/i;
const probe = async (o, d, max = 4000) => {
  const r = await call("probe_ray", { origin: toW(o), direction: { ...toW({ x: d.x, y: d.y }), z: d.z ?? 0 }, max_distance_mm: max, limit: 12 }).catch(() => ({ hits: [] }));
  const h = (r.hits ?? []).filter((x) => x.element_id !== id && !SKIP.test(x.category ?? "") && x.distance_mm > 0)[0];
  if (!h) return null;
  let label = h.link ? `${/wall/i.test(h.name ?? "") ? "existing wall" : (h.name ?? h.category) + " (existing)"}` : h.name ?? h.category;
  if (!h.link) { const e = await call("get_element", { element_id: h.element_id }).catch(() => null); const mk = e?.parameters?.find((p) => p.name === "Mark")?.value; if (mk) label = mk; else if (/Ceiling/i.test(h.category ?? "")) label = "ceiling"; }
  // short labels so the SPACE note stays clear of the 3D view: drop project-name prefixes of existing elements
  label = String(label).replace(/^(Madina|Makkah|Existing)\s+(Existing\s+)?/i, "").slice(0, 32);
  return { d: Math.max(0, h.distance_mm - 1), label };
};
const zm = (b.z0 + b.z1) / 2;
// probe_ray sees only what the {3D} view shows: switch its section box off while probing, then back on (Revit keeps the box).
const v3d = (await call("list_views", {})).views.find((v) => v.name === "{3D}")?.id;
const boxOn = v3d ? (await call("get_element", { element_id: v3d })).parameters.find((p) => p.name === "Section Box")?.value === "Yes" : false;
if (boxOn) await setv(v3d, "Section Box", 0);
const NB = {
  left: await probe(P(b.x0 + 1, yL, zm), { x: -1, y: 0 }), right: await probe(P(b.x1 - 1, yL, zm), { x: 1, y: 0 }),
  up: await probe(P(xc, yL, b.z1 - 1), { x: 0, y: 0, z: 1 }, 2000), back: await probe(P(xc, b.y1 - 1, zm), { x: 0, y: 1 }, 3000),
  front: await probe(P(xc, b.y0 + 1, Math.min(zm, 900)), { x: 0, y: -1 }, 6000),
};
if (boxOn) await setv(v3d, "Section Box", 1);
const xL = NB.left ? b.x0 - NB.left.d : null, xR = NB.right ? b.x1 + NB.right.d : null;
const zU = NB.up ? b.z1 + NB.up.d : C.ceiling ?? null, yB = NB.back ? b.y1 + NB.back.d : null, yF = NB.front ? b.y0 - NB.front.d : null;
// context: 700 beyond the neighbours each side; in plan the walkway in front is shown up to 1500 (its full length is in the note)
const LX0 = Math.min(xL ?? b.x0, b.x0) - 400, LX1 = Math.max(xR ?? b.x1, b.x1) + 400, LZ1 = Math.max(C.ceiling ?? 0, zU ?? 0, b.z1 + 300) + 250;
const yFs = yF != null && b.y0 - yF <= 1500 ? yF : null;
const PY1 = (yB ?? b.y1 + 300) + 250, PY0 = (yFs ?? b.y0 - 1500) - 250;
// the plan is drawn north-up: for a side unit its width runs up the paper
const wPl = (SIDEW ? PY1 - PY0 : LX1 - LX0), hPlan = (SIDEW ? LX1 - LX0 : PY1 - PY0);
// free area for the two views: under Section B (or beside the top view), above the bottom margin, left of the 3D view
// Row two holds the top view (and in the second layout a dropped section): the location views go to the right of what is there.
const rx0 = free >= 30 ? (big ? L.A + 75 : Math.max(L.side, LEFT + wTop + 25)) : Math.max(LEFT + wTop + 25, (L.row2Right ?? 0) + 15) + (big ? 0 : 0), rx1 = NOTES - 35;
const ry1 = TOP - hF - 40, ry0 = 50;
const SCALES = [10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];
const sStack = SCALES.find((q) => Math.max(LX1 - LX0, wPl) / q <= rx1 - rx0 && (LZ1 + 150) / q + hPlan / q + 90 <= ry1 - ry0);
// Second place: the empty band under row two, full width (left margin to the text column), section and plan side by side
// with the SPACE note on their right. Used when it draws them bigger (user, Makkah FS-1, 10 Nov 2026: "location views
// bigger in the free space").
const row2Bot = Math.min(py - hTop / 2, big ? pyD - 520 / big / 2 : Infinity) - 30;
const gx0 = LEFT, gx1 = NOTES - 35 - 125, gy1 = row2Bot - 10, gy0 = 50;
const sBand = SCALES.find((q) => (LX1 - LX0) / q + wPl / q + 30 <= gx1 - gx0 && Math.max(LZ1 + 150, hPlan) / q + 40 <= gy1 - gy0);
const BAND = sBand != null && (sStack == null || sBand < sStack);
const sL = BAND ? sBand : sStack;
let locNote = "";
if (sL) {
  const vLS = await sec("Location Section", "Location Section", P(LX0, yL), P(LX1, yL), P(0, 1, 0), (yB ?? b.y1 + 300) - yL + 80, sL, LZ1, -150);
  await call("set_view_categories", { view_id: vLS, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_Levels", "OST_Grids", "OST_CLines"] }).catch(() => {});
  const lp = await call("duplicate_view", { view_id: planId, name: P_ + "Location Plan", option: "Duplicate" }), vLP = lp.id ?? lp.view_id;
  for (const [n, x] of [["View Template", -1], ["View Scale", sL], ["Detail Level", 2], ["Title on Sheet", "Location Plan"], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(vLP, n, x);
  await call("set_view_categories", { view_id: vLP, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_TextNotes", "OST_Grids"] }).catch(() => {});
  // cut through the middle of the unit, so the plan shows its footprint and what stands beside it at that height
  await call("set_view_range", { view_id: vLP, top_mm: zm + 200, cut_mm: zm, bottom_mm: 0 }).catch(() => {});
  const c1 = toW(P(LX0, PY0)), c2 = toW(P(LX1, PY1)), qb = (await call("get_element", { element_id: vLP })).bounding_box;
  const bx0 = Math.min(c1.x, c2.x), bx1 = Math.max(c1.x, c2.x), by0 = Math.min(c1.y, c2.y), by1 = Math.max(c1.y, c2.y);
  await call("extend_view_crop", { view_id: vLP, left_mm: qb.min.x - bx0, right_mm: bx1 - qb.max.x, bottom_mm: qb.min.y - by0, top_mm: by1 - qb.max.y }).catch((e) => console.log("loc crop", e.message.slice(0, 80)));
  for (const v of [vLS, vLP]) await call("set_element_overrides", { view_id: v, element_ids: IDS, line_color: { r: 210, g: 20, b: 20 }, line_weight: 6 }).catch(() => {});
  // dimensions: width chain under the floor line, height chain on the right, depth chain in plan through the unit centre
  // A chain segment under 8 mm on paper has no room for its figure (CC-1 Makkah: 0, 2 and 112 printed over each other):
  // drop the inner point of such a segment; the SPACE note still gives every gap.
  const thin = (v) => { const out = []; for (const a of v) { if (out.length && Math.abs(a - out[out.length - 1]) < 8 * sL) { if (a === v[v.length - 1]) out[out.length - 1] = a; continue; } out.push(a); } return out; };
  const wx = thin([xL, b.x0, b.x1, xR].filter((x) => x != null));
  await dim(vLS, wx.map((x) => P(x, yL, -90)));
  if (xL != null && xR != null) await dim(vLS, [P(xL, yL, LZ1 - 90), P(xR, yL, LZ1 - 90)]);
  const hz = [...new Set([0, r(b.z0), r(b.z1), zU != null ? r(zU) : null, C.ceiling && (zU == null || Math.abs(zU - C.ceiling) > 5) ? C.ceiling : null].filter((z) => z != null))].sort((a, c) => a - c);
  await dim(vLS, hz.map((z) => P(LX1 - 150, yL, z)));
  await dim(vLP, wx.map((x) => P(x, b.y0 - 150, 0)));
  const dyz = thin([yB, b.y1, b.y0, yFs].filter((y) => y != null));
  if (dyz.length > 2) await dim(vLP, dyz.map((y) => P(xc, y, 0)));
  const hS = (LZ1 + 150) / sL, hPl = hPlan / sL, cxL = (rx0 + rx1) / 2;
  let noteXY = null;
  if (BAND) { // side by side, both standing on one line at the bottom of the band
    const wS = (LX1 - LX0) / sL, gapB = (gx1 - gx0 - wS - wPl / sL) / 3, base = gy0 + 25;
    await place(vLS, gx0 + gapB + wS / 2, base + hS / 2);
    await place(vLP, gx0 + 2 * gapB + wS + wPl / sL / 2, base + hPl / 2);
    noteXY = [gx1 + 10, base + Math.max(hS, hPl)];
  } else {
    await place(vLS, cxL, ry1 - hS / 2 - 2);
    await place(vLP, cxL, ry1 - hS - 25 - hPl / 2);
  }
  const w = (k, n) => (NB[k] ? `${n} ${NB[k].label} at ${r(NB[k].d)}` : `${n} nothing within reach`);
  locNote = [`SPACE: ${xL != null && xR != null ? r(xR - xL) : "-"} wide x ${yB != null ? r(yB - b.y0) : "-"} deep x ${zU != null ? r(zU) : "-"} high`, `(floor to ${NB.up?.label ?? "ceiling"})`,
    w("left", "Left:"), w("right", "Right:"), w("up", "Above:"), w("back", "Behind:"), w("front", "In front (walkway):")].join("\n");
  if (noteXY) await txt(noteXY[0], noteXY[1], locNote.replace(/ \(floor/, "\n(floor").replace(/ wide x /, " wide x\n"));
  // the location column is about 110 mm wide at 5 mm text: wrap each line at 26 characters, or it runs into the notes column
  // (Madina 2 D-02, 11 Nov 2026: "SPACE: 3796 wide x - deep x 3000 high" ran over the material quantities)
  else await txt(rx0, Math.max(ry1 - hS - 30 - hPl - 22, 95), locNote.split("\n").map((ln) => ln.split(" ").reduce((o, wd) => { const last = o[o.length - 1]; if (last && (last + " " + wd).length <= 26) o[o.length - 1] = last + " " + wd; else o.push(wd); return o; }, []).join("\n  ")).join("\n"));
} else console.log("location views: no room on the sheet, scale not found");
// Cut plan through a unit that wraps existing structure (user, Makkah FS-1, 10 Nov 2026: "a plan showing where the existing
// column touches the unit from inside"). Config t.cutPlan = { z, at: [x, y] on the sheet, scale, title, margin,
// dims: [[[x, y], ...], ...] chains in WORLD mm, labels: [{ at: [x, y], text }] in world mm }. The existing structure shows
// through the link in halftone; the unit is cut at z. World points go straight to Revit (no unit-frame turn).
let vCP = null;
if (t.cutPlan) {
  const cp = t.cutPlan, cs = cp.scale ?? 8, mg = cp.margin ?? 250;
  const d = await call("duplicate_view", { view_id: planId, name: P_ + "Cut Plan", option: "Duplicate" }); vCP = d.id ?? d.view_id;
  for (const [n, x] of [["View Template", -1], ["View Scale", cs], ["Detail Level", 3], ["Title on Sheet", cp.title ?? `Plan at +${(cp.z / 1000).toFixed(3)}`], ["Crop View", 1], ["Annotation Crop", 1]]) await setv(vCP, n, x);
  await call("set_view_categories", { view_id: vCP, hide: ["OST_Sections", "OST_Elev", "OST_Callouts", "OST_CLines", "OST_Grids"] }).catch(() => {});
  await call("set_view_range", { view_id: vCP, top_mm: cp.z + 300, cut_mm: cp.z, bottom_mm: 0 }).catch(() => {});
  await call("set_view_display", { view_id: vCP, style: STYLE }).catch(() => {});
  const g0 = await call("get_element", { element_id: id }), wb2 = g0.bounding_box, qb = (await call("get_element", { element_id: vCP })).bounding_box;
  await call("extend_view_crop", { view_id: vCP, left_mm: qb.min.x - (wb2.min.x - mg), right_mm: wb2.max.x + mg - qb.max.x, bottom_mm: qb.min.y - (wb2.min.y - mg), top_mm: wb2.max.y + mg - qb.max.y }).catch((e) => console.log("cut plan crop", e.message.slice(0, 80)));
  for (const ch of cp.dims ?? []) await rawC("create_dimension_string", { document: C.doc, view_id: vCP, points: ch.map(([x, y]) => ({ x, y, z: 0 })), tick_mm: 25 }).catch((e) => console.log("cut dim", e.message.slice(0, 80)));
  for (const lb of cp.labels ?? []) await rawC("create_text_note", { document: C.doc, view_id: vCP, location: { x: lb.at[0], y: lb.at[1], z: 0 }, text: lb.text, text_type_id: note }).catch((e) => console.log("cut label", e.message.slice(0, 80)));
  await place(vCP, cp.at[0], cp.at[1]);
}
// dimensions after isolation (isolate_in_view hides whatever exists when it runs, dimensions too)
if (vL) for (const ch of [[P(xA, b.y0, b.z0 - 15), P(xA, b.y0 + 20, b.z0 - 15)], [P(xA, b.y0 - 15, b.z0), P(xA, b.y0 - 15, b.z0 + 20)]]) await call("create_dimension_string", { view_id: vL, points: ch, tick_mm: 12 }).catch((e) => console.log("L dim", e.message.slice(0, 80)));
if (vL) await place(vL, t.lDetail.at[0], t.lDetail.at[1]);
log[key_] = { sheet, sheetNumber: SN, scale: s, scale3d: s3, keyPlanMarks: marks, location: { scale: sL, NB }, views: { vFront, vSide, vA, vB, vTop, vDT, vDB, vL, kp, v3 } };
writeFileSync(LOG, JSON.stringify(log, null, 1));
await call("save_document", { title: C.doc });
console.log("done", key_, SN, "scale 1:" + s, "3D 1:" + s3, "rot", rot, "face", FACE, "key plan", marks + "/" + t.marks.length, "mats", mats.map(([m, q]) => m + "=" + qty(m, q)).join("; "));
