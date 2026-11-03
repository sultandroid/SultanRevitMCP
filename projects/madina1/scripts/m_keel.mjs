// Typical arch unit as a keel arch (العقد المدبب المنكسر ذو الصدر): two arcs of radius R centred on the springing line, then straight tangents to the apex.
// The marble fascia starts at the springing. Offsets of the line (veneer, ply, ribs, inner face) keep the arc centres and run the straight part parallel.
// Usage: node m_keel.mjs <opt1|opt2> plan | typ | exp
//   opt1: 920 wide, apex 2960, rise 630, R 610, fascia from +2330 (Madina 1 designer shape).
//   opt2: 920 wide, apex 2960, rise 560, R 400, fascia from +2400 (heights as built).
import { writeFileSync } from "node:fs";
import { call } from "./rvt.mjs";

const OPTS = { opt1: { rise: 630, R: 610, doc: "Madina1_ARCH_02", sub: "" }, opt2: { rise: 560, R: 400, doc: "Madina1_ARCH_02_Keel-Option2", sub: "\\Keel Option 2" } };
const optKey = process.argv[2], mode = process.argv[3] ?? "plan", OPT = OPTS[optKey];
if (!OPT) throw new Error("Option is opt1 or opt2");
const TEMPLATES = "C:\\ProgramData\\Autodesk\\RVT 2026\\Family Templates\\English\\";
const DIR = "C:\\Users\\user\\OneDrive - SAMAYA INVESTMENT\\Samaya\\Technical Office\\Bim Unit\\Knowledge Econmic City_ShopFit projects\\Madina 1\\Revit Files\\Rfa" + OPT.sub;
const A = 30, T = 36, FACE = 100, MARBLE = 20, BK = 18, SOFFIT = 18, BASE = 700, THK = 36, PLY = 18, PVC = 2, G0 = 15, GW = 12, GH = 10, PEG_T = 26;
const APEX = 2960, SPRING = APEX - OPT.rise;
const RUNS = [
  { id: "T", world: (u, d, z) => ({ x: u, y: 4820 + d, z }), dirD: { x: 0, y: 1, z: 0 }, dirU: { x: 1, y: 0, z: 0 }, along: "x", plane: (d) => ({ y: 4820 + d }), deep: 620, peg: 560, apex: APEX, head: SPRING, fronts: [150, 150, 150, 30], arches: [["TA", 1212.5, 2132.5]] },
];
const rd = (v) => Math.round(v * 100) / 100, rdp = (p) => [rd(p[0]), rd(p[1])];

// One side of the keel line set in by k from the outer line, from the springing (u = leg) up to the axis. sg = -1 left, +1 right.
function keelSide(a, b, apex, rise, R, k, sg) {
  const W = b - a, zs = apex - rise, t = Math.atan2(rise, W / 2 - R) + Math.acos(R / Math.hypot(W / 2 - R, rise));
  const r = R - k, n = Math.max(8, Math.ceil((Math.PI - t) / ((2 * Math.PI) / 180))), L = [];
  for (let i = 0; i <= n; i++) { const ang = Math.PI - (i * (Math.PI - t)) / n; L.push([a + R + r * Math.cos(ang), zs + r * Math.sin(ang)]); }
  const [pu, pz] = L[L.length - 1];
  L.push([(a + b) / 2, pz + (((a + b) / 2 - pu) / Math.sin(t)) * -Math.cos(t)]);
  return sg < 0 ? L : L.map(([u, z]) => [a + b - u, z]);
}
const lenAt = (L) => { const s = [0]; for (let i = 1; i < L.length; i++) s.push(s[i - 1] + Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1])); return s; };
const along = (L, f) => { const s = lenAt(L), x = f * s[s.length - 1]; let i = 1; while (i < L.length - 1 && s[i] < x) i++; const q = (x - s[i - 1]) / (s[i] - s[i - 1] || 1); return [L[i - 1][0] + q * (L[i][0] - L[i - 1][0]), L[i - 1][1] + q * (L[i][1] - L[i - 1][1])]; };
const crossAt = (L, z) => { for (let i = 1; i < L.length; i++) if ((L[i - 1][1] - z) * (L[i][1] - z) <= 0 && L[i][1] !== L[i - 1][1]) return L[i - 1][0] + ((z - L[i - 1][1]) / (L[i][1] - L[i - 1][1])) * (L[i][0] - L[i - 1][0]); return L[0][0]; };

function build(w, id, a, b) {
  const box = (u0, u1, z0, z1, d0, d1, mat) => ({ profile: [[u0, z0], [u1, z0], [u1, z1], [u0, z1]].map(([u, z]) => w.world(rd(u), d0, rd(z))), direction: w.dirD, length_mm: d1 - d0, mat });
  const poly = (pts, d0, d1, mat) => ({ profile: pts.map(([u, z]) => w.world(u, d0, z)), direction: w.dirD, length_mm: d1 - d0, mat });
  const S = (k, sg) => keelSide(a, b, w.apex, OPT.rise, OPT.R, k, sg), spring = w.apex - OPT.rise, iu0 = a + T, iu1 = b - T;
  const line = (k) => [...S(k, -1), ...S(k, 1).slice(0, -1).reverse()];
  const ring = (kO, kI) => { const oL = S(kO, -1), oR = S(kO, 1), iL = S(kI, -1), iR = S(kI, 1); return [...oL, ...oR.slice(0, -1).reverse(), ...iR, ...iL.slice(0, -1).reverse()].map(rdp); };
  const under = w.head, clear = (under - BASE - 4 * THK) / 5;
  const t1 = 910, tops = [0, 1, 2, 3].map((i) => t1 + i * 350);
  const parts = [];
  const add = (name, solids) => parts.push({ name: `${id} ${name}`, solids });
  const SK = 1, PLY_B = 5, RIB_T = 18;
  const leg = (u0) => [box(u0, u0 + 18, BASE, spring, A + PVC, w.deep, "oak"), box(u0 + 18, u0 + 36, BASE, spring, A + PVC, w.deep, "oak"), box(u0, u0 + 36, BASE, spring, A, A + PVC, "pvc")];
  add("Side Leg L", leg(a));
  add("Side Leg R", leg(b - T));
  const skin = SK + PLY_B, kOut = skin, kIn = T - skin;
  const dF = A + SK, dB = w.deep - RIB_T, dM = (dF + dB) / 2;
  add("Arch Rib Front", [poly(ring(kOut, kIn), dF, dF + RIB_T, "fr")]);
  add("Arch Rib Middle", [poly(ring(kOut, kIn), dM, dM + RIB_T, "fr")]);
  add("Arch Rib Back", [poly(ring(kOut, kIn), dB, dB + RIB_T, "fr")]);
  const spacers = []; for (const sg of [-1, 1]) { const O = S(kOut, sg), I = S(kIn, sg); for (let i = 1; i <= 4; i++) { const f0 = i / 5, f1 = f0 + 0.04; spacers.push(poly([along(O, f0), along(O, f1), along(I, f1), along(I, f0)].map(rdp), dF + RIB_T, dB, "fr")); } }
  add("Arch Spacers", spacers);
  add("Arch Bending Ply Outer", [poly(ring(SK, kOut), A + SK, w.deep, "ply")]);
  add("Arch Bending Ply Inner", [poly(ring(kIn, T - SK), A + SK, w.deep, "ply")]);
  add("Arch Veneer", [poly(ring(0, SK), A, w.deep, "veneer"), poly(ring(T - SK, T), A, w.deep, "veneer"), poly(ring(0, T), A, A + SK, "veneer")]);
  const Z0 = w.head, Z1 = Z0 + MARBLE, Z2 = Z1 + SOFFIT, inner = line(T), iL = S(T, -1), iR = S(T, 1);
  const atZ = (z) => [crossAt(iL, z), crossAt(iR, z)];
  const headAt = (z) => { const [uL, uR] = atZ(z); return [[uL, z], ...inner.filter((p) => p[1] > z + 0.5), [uR, z]].map(rdp); };
  const across = (pts, z) => { const [uL, uR] = atZ(z); return { profile: pts.map(([d, zz]) => w.world(rd(uL), d, rd(zz))), direction: w.dirU, length_mm: rd(uR - uL) }; };
  const F = FACE, B1 = FACE + MARBLE;
  add("Head Marble", [poly(headAt(Z1), F, B1, "marble"), { ...across([[F, Z0], [B1, Z1], [F, Z1]], Z1), mat: "marble" }]);
  add("Head Marble Soffit", [{ ...across([[F, Z0], [B1 + 40, Z0], [B1 + 40, Z0 + 10], [B1 + 52, Z0 + 10], [B1 + 52, Z0], [w.deep, Z0], [w.deep, Z1], [B1, Z1]], Z1), mat: "marble" }]);
  add("Head Top Panel", [{ ...across([[B1, Z1], [w.deep, Z1], [w.deep, Z2], [B1, Z2]], Z2), mat: "back" }]);
  add("Head Backing", [poly(headAt(Z2), B1, B1 + BK, "back")]);
  add("Head LED", [box(iu0 + 5, iu1 - 5, Z0 + 8, Z0 + 10, B1 + 42, B1 + 50, "led")]);
  // Pegboard: from the lower panel to the underside of the marble head, with the designer's hole grid centred across it.
  const C = (a + b) / 2, P = 50, HR = 10.5, ROW0 = 870.5, LOW = 840, columns = []; for (let k = 0; k < 8; k++) columns.push(C - 25 - P * k, C + 25 + P * k);
  const hole = (cu, z, d) => Array.from({ length: 8 }, (_, k) => { const t = ((k + 0.5) * Math.PI) / 4; return w.world(rd(cu + HR * Math.cos(t)), d, rd(z + HR * Math.sin(t))); });
  const rows = []; for (let z = ROW0; z <= under - 25; z += P) rows.push(z);
  const vents = [720, 770, 820];
  const halfHoles = (sg, d) => rows.flatMap((z) => columns.filter((u) => (u - C) * sg > 0).map((u) => hole(u, z, d)));
  const u0 = iu0 + 2, u1 = iu1 - 2, gap = 5;
  const allHoles = (d) => rows.flatMap((z) => columns.map((u) => hole(u, z, d)));
  add("Pegboard EGGER", [{ ...box(u0, u1, LOW + 3, under, w.peg, w.peg + 8, "oak"), holes: allHoles(w.peg) }]);
  add("Pegboard FR MDF", [{ ...box(u0, u1, LOW + 3, under, w.peg + 8, w.peg + 26, "fr"), holes: allHoles(w.peg + 8) }]);
  const half = (sg, x0, x1) => { const nm = sg < 0 ? "Left" : "Right"; add("Front Plate " + nm, [{ ...box(x0, x1, LOW + 3, under, w.peg + 26, w.peg + 28, "metal"), holes: halfHoles(sg, w.peg + 26) }]); add("Rear Plate " + nm, [{ ...box(x0, x1, LOW + 3, under, w.deep - 2, w.deep, "metal"), holes: halfHoles(sg, w.deep - 2) }]); };
  half(-1, u0, C - gap); half(1, C + gap, u1);
  const ventHoles = (d) => vents.flatMap((z) => columns.map((u) => hole(u, z, d)));
  add("Lower Panel EGGER", [{ ...box(u0, u1, BASE + 3, LOW, w.peg, w.peg + 8, "oak"), holes: ventHoles(w.peg) }]);
  add("Lower Panel FR MDF", [{ ...box(u0, u1, BASE + 3, LOW, w.peg + 8, w.peg + 26, "fr"), holes: ventHoles(w.peg + 8) }]);
  add("Steel Angles", [box(iu0, iu0 + 2, BASE, under, w.peg + 28, w.deep, "metal"), box(iu1 - 2, iu1, BASE, under, w.peg + 28, w.deep, "metal")]);
  const roundAt = (cu, cz, r, d0, d1, mat) => ({ profile: Array.from({ length: 16 }, (_, k) => w.world(rd(cu + r * Math.cos((2 * Math.PI * k) / 16)), d0, rd(cz + r * Math.sin((2 * Math.PI * k) / 16)))), direction: w.dirD, length_mm: d1 - d0, mat });
  const pegs = []; for (const top of tops) for (const off of [-275, -75, 75, 275]) { const cz = top - 36 + 9 - 12.5; pegs.push(roundAt(C + off, cz, 12.5, w.peg - 360, w.peg, "peg_wood"), roundAt(C + off, cz, 10, w.peg, w.deep, "peg_wood")); }
  add("Pegs", pegs);
  const sec = (pts, mat) => ({ profile: pts.map(([d, z]) => w.world(rd(iu0 + 4), d, z)), direction: w.dirU, length_mm: rd(iu1 - iu0 - 8), mat });
  tops.forEach((top, s) => {
    const low = rd(top - THK), mid = rd(top - PLY), f = w.peg - 400, p = f + PVC, g0 = f + G0, g1 = g0 + GW, back = w.peg;
    add(`Shelf ${s + 1}`, [sec([[p, top], [back, top], [back, mid], [p, mid]], "oak"), sec([[p, mid], [back, mid], [back, low], [g1, low], [g1, rd(low + GH)], [g0, rd(low + GH)], [g0, low], [p, low]], "oak"), sec([[f, top], [p, top], [p, low], [f, low]], "pvc")]);
    add(`Shelf ${s + 1} LED`, [sec([[g0, low], [g1, low], [g1, rd(low + GH)], [g0, rd(low + GH)]], "led")]);
  });
  return { parts, tops, clear, holes: rows.length * columns.length, under, spring, outer: line(0), inner };
}
const plans = RUNS.flatMap((w) => w.arches.map(([id, a, b]) => ({ w, id, ...build(w, id, a, b) })));
for (const p of plans) {
  const apexOut = Math.max(...p.outer.map((q) => q[1])), apexIn = Math.max(...p.inner.map((q) => q[1]));
  console.log(optKey, p.id, "springing", p.spring, "apex", apexOut.toFixed(1), "inner apex", apexIn.toFixed(1), "pegboard to", p.under, "shelf tops", p.tops.join(", "), "top shelf to fascia", p.under - p.tops[3], "holes", p.holes, "parts", p.parts.length);
}
if (mode === "plan") { writeFileSync(`dwg/keel_${optKey}.json`, JSON.stringify(plans.map((p) => ({ outer: p.outer, inner: p.inner, spring: p.spring })))); process.exit(0); }

const guard = async () => { const { title } = await call("get_project_info"); if (title !== OPT.doc) throw new Error("Active document is: " + title); };
await guard();
const mat = async (name, r, g, b) => (await call("ensure_material", { name, color: { r, g, b } })).id;
const M = { fr: await mat("FR MDF 18 mm CNC Skeleton", 150, 120, 95), ply: await mat("Bending Plywood 5 mm", 205, 175, 135), veneer: await mat("Veneer Painted to match H1113", 150, 110, 75), oak: await mat("EGGER H1113 ST10 Brown Kansas Oak", 150, 110, 75), peg: await mat("Pegboard MDF 18 - H1113 Brown Kansas Oak", 165, 122, 84), pvc: await mat("PVC Edge 2 mm - matching H1113", 138, 100, 68), led: await mat("LED Strip Warm White", 255, 214, 140), metal: await mat("Steel Plate 2 mm Black", 35, 35, 35), peg_wood: await mat("Hardwood Peg", 170, 125, 80), marble: await mat("Marble Arch Head 20 mm Tuscany Travertine", 236, 229, 214), back: await mat("Arch Head Backing 18 mm MDF", 225, 219, 208) };
const level = (await call("list_levels")).levels.find((l) => l.elevation_mm === 0).id;
const NOTE = `Typical arch: 920 wide, 590 deep, top +2960. Keel arch (عقد مدبب منكسر ذو الصدر), rise ${OPT.rise}, R ${OPT.R}; marble fascia from +${SPRING}. Sides and shelves double 18 mm, one edge band. L-shaped marble 20 mm, LED recessed. Six units.`;
const off = (n) => /Rear Plate/.test(n) ? 800 : /Front Plate/.test(n) ? -350 : /Pegboard|Lower Panel/.test(n) ? -700 : /Pegs/.test(n) ? -1100 : /Shelf/.test(n) ? -1500 : /Head (Marble|LED)/.test(n) ? -2100 : 0;
const SHIFT = -15000, mv = (q, dy) => ({ ...q, x: q.x + SHIFT, y: q.y + dy });
for (const p of plans) {
  // Same family name, loaded over the old one: the six placed units keep their position, mark and tags and take the new shape.
  const ex = mode === "exp", cat = ex ? "OST_Furniture" : "OST_Casework", famName = ex ? "Madina Arch Exploded" : "Madina Arch Typical A";
  const before = (await call("query_elements", { category: cat, limit: 1000 })).elements.filter((e) => e.family === famName);
  if (!before.length) throw new Error("No placed " + famName);
  const ids = [];
  for (const part of p.parts) {
    const dy = ex ? off(part.name) : 0;
    const solids = part.solids.map(({ mat: k, profile, holes, ...s }) => ({ ...s, profile: ex ? profile.map((q) => mv(q, dy)) : profile, ...(holes ? { holes: ex ? holes.map((h) => h.map((q) => mv(q, dy))) : holes } : {}), material_id: M[k] }));
    ids.push((await call("create_direct_shape", { category: "OST_Furniture", name: part.name, comments: ex ? "Exploded view only" : p.id, solids })).id);
  }
  await guard();
  const r = await call("make_unit_family", { element_ids: ids, family_name: famName, template_path: TEMPLATES + "Metric Furniture.rft", save_dir: DIR, level_id: level, mark: ex ? "TA-X" : "TA", comments: ex ? "Copy of the typical arch, pulled apart, for the exploded view only. Not a unit to build." : NOTE });
  // The extra instance make_unit_family places is not needed: the six existing ones already carry the new family.
  // The Furniture template has no camera; the family goes back to Casework afterwards, as the old one was.
  if (!ex) await call("set_family_category", { element_id: r.id, category: "OST_Casework", save_dir: DIR });
  await call("delete_elements", { element_ids: [r.id] });
  const after = (await call("query_elements", { category: cat, limit: 1000 })).elements.filter((e) => e.family === famName);
  console.log(famName, "family", r.family, "solids", r.solids, "origin", r.origin_mm.map(Math.round).join(","), "instances before", before.length, "after", after.length);
  for (const e of after) { const g = await call("get_element", { element_id: e.id }); const b = g.bounding_box; console.log(" ", e.id, g.parameters.find((q) => q.name === "Mark")?.value, [b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z].map(Math.round).join(" ")); }
}
