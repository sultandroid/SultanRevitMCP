// Locker system generator (references/lockers.md). Makes every board part and every fitting of a locker installation from
// a spec, in the parts format the factory BOM and Revit scripts use: { code, name, mat, run, note, min:[x,y,z], max:[x,y,z] }
// in the item's local frame (mm). Fittings follow the locker makers' rules: hinge count by door height and weight, cam lock
// + keeper plate, coat rail and hooks where deep and tall enough, vents, number plates, inserts, wall fixings.
//
// Usage:  node tools/locker_system.mjs <spec.json> <out.json>            (no Revit)
//         import { buildLockers, hingeCount, placeInRevit } from "./locker_system.mjs"
// Spec (see projects/... examples):
// { item, title, source, origin:[x,y,z], build:"lined",
//   materials: { door:{name,kind,t}, clad:{name,kind,t}, edge?:{name,kind,t} (edging strips, else clad), body:{name,kind,t}, lining:{name,kind,t}, frame:{name,kind,t}, steel:{name} },
//   levels: { soft:[0,40], base:[40,58], bandBottom:[15,58], rows:[[70,447],...], topPly:[2057,2075], topCap:[2088,2100], height:2100 },
//   depth:  { overall:570, keep:"overall"|"inside", inside:470 },          // front zone = door t + gap + edging + 3
//   door:   { gap:3, edging:12, hinge:"cup35"|"cup26"|"knuckle"|"piano" },
//   lock:   { type:"cam", fromEdge:30, height:"centre"|number, keeper:true },
//   fittings: { coatRail:"auto"|false, hooks:"auto"|false, vents:{holes:6,dia:8}|false, numbers:true, inserts:true, wallFixingsPerColumn:2 },
//   runs: [ { id, p0:[x,y], u:[ux,uy], v:[vx,vy], u0, u1, comps:{first,n,step,w}|[[a,b],..], doors:{start,widths:[..]},
//             endsExposed:["L"|"R"], cavity?:{gap:69, post:40} } ],
//   blocks: [ { run, code, name, mat:"body"|..., min, max } ] }

const BOARD_KINDS = { viroc: [8, 10, 12, 16, 19, 22, 25, 28, 32], compact: [6, 8, 10, 12, 13], egger: [8, 18], plywood: [4, 6, 9, 12, 15, 18, 21, 24], mdf: [6, 9, 12, 16, 18, 22, 25], softwood: null };
const DENSITY = { viroc: 1350, compact: 1400, mdf: 750, plywood: 600, egger: 650, softwood: 500 };
export { BOARD_KINDS, DENSITY };

/** Hinges per door: factory default from the hinge makers' rule (height and weight), lockers.md. */
export function hingeCount(h, kg) {
  if (h <= 900 && kg <= 6) return 2;
  if (h <= 1600 && kg <= 12) return 3;
  if (h <= 2000) return 4;
  return 5;
}

export function buildLockers(S) {
  const M = S.materials, L = S.levels, F = S.fittings ?? {}, D = S.door ?? {}, K = S.lock ?? {};
  const doorT = M.door.t, gap = D.gap ?? 3, edging = D.edging ?? 12, lin = M.lining.t, p18 = M.body.t, post = M.frame.t ?? 40;
  const front = doorT + gap + edging + 3;                       // NRS front zone 12 + 3 + 12 + 3 = 30
  const inside = S.depth.keep === "inside" ? S.depth.inside : S.depth.overall - front - lin - p18 - post;
  const parts = [], fittings = [], doors = [], comps = [];
  const R = (n) => Math.round(n * 10) / 10;
  const box = (code, name, mat, run, a, b, za, zb, note = "") => {
    const lo = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(za, zb)], hi = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(za, zb)];
    parts.push({ code, name, mat: M[mat]?.name ?? mat, run, note, min: lo.map(R), max: hi.map(R) });
  };
  const fit = (code, name, run, a, b, za, zb, extra = {}) => {
    const lo = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(za, zb)], hi = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(za, zb)];
    fittings.push({ code, name, run, min: lo.map(R), max: hi.map(R), ...extra });
  };
  // door rows from the compartment rows: doors stop 3 above the bottom band and meet on the shelf centres with a gap
  // whole millimetres: each joint sits on the shelf centre, the door below stops at floor(centre - gap/2), the next starts a gap above
  const rows = L.rows, dRows = [];
  rows.forEach(([a, b], i) => {
    const lo = i === 0 ? L.bandBottom[1] + gap : dRows[i - 1][1] + gap;
    const hi = i === rows.length - 1 ? L.topPly[0] - gap : Math.floor((b + rows[i + 1][0]) / 2 - gap / 2);
    dRows.push([lo, hi]);
  });

  for (const run of S.runs) {
    const xy = (u, v) => [run.p0[0] + run.u[0] * u + run.v[0] * v, run.p0[1] + run.u[1] * u + run.v[1] * v];
    const B = (code, name, mat, ua, ub, va, vb, za, zb, note) => box(code, name, mat, run.id, xy(ua, va), xy(ub, vb), za, zb, note);
    const Fi = (code, name, ua, ub, va, vb, za, zb, extra) => fit(code, name, run.id, xy(ua, va), xy(ub, vb), za, zb, extra);
    const cs = Array.isArray(run.comps) ? run.comps : Array.from({ length: run.comps.n }, (_, i) => [run.comps.first + i * run.comps.step, run.comps.first + i * run.comps.step + run.comps.w]);
    const ds = []; { let u = run.doors.start; for (const w of run.doors.widths) { ds.push([u, u + w]); u += w + gap; } }
    const v0 = front, v1 = front + inside, vlb = v1 + lin, vp = vlb + p18, vpost = vp + post;
    // doors + their fittings
    ds.forEach(([a, b], ci) => dRows.forEach(([za, zb], ri) => {
      const h = zb - za, w = b - a, kg = (h * w * doorT * (DENSITY[M.door.kind] ?? 1000)) / 1e9, n = hingeCount(h, kg);
      B("DR", `Locker door ${R(h)} high`, "door", a, b, 0, doorT, za, zb, `${n} hinges + lock`);
      const hingeSide = (run.hingeSide ?? "L") === "L" ? a : b, lockSide = hingeSide === a ? b : a, sgn = hingeSide === a ? 1 : -1;
      const hz = n === 2 ? [za + 90, zb - 90] : [za + 90, (za + zb) / 2, zb - 90].concat(n > 3 ? [za + (zb - za) * 0.66] : []).slice(0, n);
      for (const z of hz) Fi("HG", D.hinge === "thin35" ? "Hinge, thin-door 35 cup 7.8 deep" : D.hinge === "cup26" ? "Hinge, thin-door 26 cup" : D.hinge === "knuckle" ? "Hinge, stainless knuckle" : "Hinge, 35 cup 110 deg soft close", hingeSide + sgn * 3, hingeSide + sgn * 40, doorT, doorT + 16, z - 22, z + 22);
      const lh = K.height === "centre" || K.height == null ? (za + zb) / 2 : za + K.height;
      Fi("LK", "Key cam lock", lockSide - sgn * (K.fromEdge ?? 30) - 10, lockSide - sgn * (K.fromEdge ?? 30) + 10, -2, doorT + 18, lh - 10, lh + 10, { lockZ: R(lh) });
      if (K.keeper !== false) Fi("KP", "Keeper plate 2 mm", lockSide - sgn * 6, lockSide - sgn * 46, doorT + gap, doorT + gap + 40, lh - 25, lh + 25);
      doors.push({ run: run.id, col: ci, row: ri, w: R(w), h: R(h), t: doorT, kind: M.door.kind, kg: R(kg), hinges: n, hinge: D.hinge ?? "cup35", lockZ: R(lh), number: F.numbers !== false, inserts: !!F.inserts });
    }));
    // compartments: NRS lined build (each compartment lined all round, double linings between)
    for (const [a, b] of cs) for (const [ri, [za, zb]] of rows.entries()) {
      B("LB", "Lining back", "lining", a, b, v1, vlb, za, zb);
      B("LF", "Lining floor", "lining", a - lin, b + lin, v0, v1, za - lin, za);
      B("LC", "Lining ceiling", "lining", a - lin, b + lin, v0, v1, zb, zb + lin);
      B("LS", "Lining side", "lining", a - lin, a, v0, v1, za, zb);
      B("LS", "Lining side", "lining", b, b + lin, v0, v1, za, zb);
      const c = { run: run.id, w: b - a, d: inside, h: zb - za, rail: false, hooks: 0, vents: 0 };
      if ((F.coatRail ?? "auto") && inside >= 450 && zb - za >= 700) { Fi("CR", "Coat rail 20 dia", a + 5, b - 5, v0 + inside / 2 - 10, v0 + inside / 2 + 10, zb - 80, zb - 60); c.rail = true; }
      if ((F.hooks ?? "auto") && zb - za >= 700) { Fi("HK", "Hook", a, a + 30, v0 + 100, v0 + 130, zb - 200, zb - 140); Fi("HK", "Hook", b - 30, b, v0 + 100, v0 + 130, zb - 200, zb - 140); c.hooks = 2; }
      if (F.vents) c.vents = 2 * (F.vents.holes ?? 6);
      comps.push(c);
    }
    // edging on partition and shelf fronts, structure, bands, laterals, base frame, posts
    const edgeU = [...new Set(cs.flatMap(([a, b]) => [R(a - lin), R(b)]))].sort((p, q) => p - q), used = new Set();
    for (const u of edgeU) { if (used.has(u)) continue; const tw = edgeU.find((w) => Math.abs(w - (u + lin)) < 0.6); used.add(u); if (tw != null) used.add(tw);
      B("ED", "Edging, partition front", M.edge ? "edge" : "clad", u, u + (tw != null ? 2 * lin : lin), v0 - edging, v0, rows[0][0] - lin, rows.at(-1)[1] + lin); }
    for (let i = 0; i < rows.length - 1; i++) B("EH", "Edging, shelf front", M.edge ? "edge" : "clad", run.u0, run.u1, v0 - edging, v0, rows[i][1], rows[i + 1][0]);
    B("PB", "Structure back", "body", run.u0, run.u1, vlb, vp, L.base[0], L.topPly[1]);
    B("PS", "Structure base", "body", run.u0, run.u1, v0 - edging, vlb, L.base[0], L.base[1]);
    B("PT", "Structure top", "body", run.u0, run.u1, v0 - edging, vlb, L.topPly[0], L.topPly[1]);
    B("BB", "Bottom band", "clad", run.u0, run.u1, 0, M.clad.t, L.bandBottom[0], L.bandBottom[1]);
    B("BT", "Top band", "clad", run.u0, run.u1, 0, M.clad.t, L.topPly[0], L.height);
    B("TC", "Top cap return 80", "clad", run.u0, run.u1, M.clad.t, 80, L.topCap[0], L.topCap[1]);
    B("TP", "Top cladding", "lining", run.u0, run.u1, 80, vpost, L.topCap[0], L.topCap[1]);
    B("LT", "Lateral strip", "clad", run.u0, ds[0][0] - gap, 0, M.clad.t, L.bandBottom[1], L.topPly[0]);
    B("LT", "Lateral strip", "clad", ds.at(-1)[1] + gap, run.u1, 0, M.clad.t, L.bandBottom[1], L.topPly[0]);
    B("SB", "Base rail front", "frame", run.u0, run.u1, 15, 15 + post, L.soft[0], L.soft[1]);
    B("SB", "Base rail back", "frame", run.u0, run.u1, vlb, vlb + post, L.soft[0], L.soft[1]);
    const posts = [run.u0 + 30, ...cs.slice(0, -1).map(([, b], i) => (b + cs[i + 1][0]) / 2 - post / 2), run.u1 - post];
    for (const p of posts) B("SP", "Back post", "frame", p, p + post, vp, vpost, L.soft[1], L.topPly[1]);
    if (run.cavity) for (const p of posts) B("SP", "Wall post (second line)", "frame", p, p + post, vpost + run.cavity.gap, vpost + run.cavity.gap + run.cavity.post, L.soft[1], L.topPly[1]);
    for (const side of run.endsExposed ?? []) {
      const ue = side === "L" ? run.u0 : run.u1, s = side === "L" ? 1 : -1;
      B("EP", "End structure", "body", ue + s * M.clad.t, ue + s * (M.clad.t + p18), M.clad.t, vpost, L.base[0], L.topPly[1]);
      B("EC", "End cladding", "clad", ue, ue + s * M.clad.t, 0, vpost, L.bandBottom[0], L.height);
    }
    // wall fixings: per column at the top of the back posts
    for (const p of posts) for (let k = 0; k < (F.wallFixingsPerColumn ?? 0) && k < 1; k++) Fi("WF", "Wall fixing bracket", p, p + post, vpost, vpost + 2, L.topPly[1] - 60, L.topPly[1] - 20);
  }
  for (const b of S.blocks ?? []) box(b.code, b.name, b.mat, b.run, b.min, b.max, b.min[2], b.max[2]);

  // hardware list (counts) from the fittings and rules
  const n = (c) => fittings.filter((f) => f.code === c).length;
  const hingeName = D.hinge === "thin35" ? "Thin-door concealed hinge, 35 mm cup 7.8 deep, doors 10-19 mm, 110 deg, soft close (Hettich Sensys 8646i or equal)" : D.hinge === "cup26" ? "Concealed hinge for 10-13 mm doors, 26 mm cup, 110 deg (make approved)" : D.hinge === "knuckle" ? "Stainless 5-knuckle locker hinge (make approved)" : "Concealed hinge 35 mm cup, 110 deg, soft close (make approved)";
  const hardware = [
    { item: hingeName, qty: n("HG"), unit: "nr", note: "count by door height and weight (lockers.md)" },
    { item: "Key cam lock, master keyed (make approved)", qty: n("LK"), unit: "nr", note: "lock height " + [...new Set(doors.map((d) => d.lockZ))].join(" / ") + " from FFL" },
    { item: "Keeper plate, 2 mm steel folded, powder coated", qty: n("KP"), unit: "nr", note: "to suit the selected lock" },
    { item: "Locker number plate, recessed (max 4 digits)", qty: doors.length, unit: "nr", note: "top right corner" },
    ...(n("CR") ? [{ item: "Coat rail 20 dia stainless, with end brackets", qty: n("CR"), unit: "nr", note: "compartments 450+ deep, 700+ high" }] : []),
    ...(n("HK") ? [{ item: "Coat hook, stainless", qty: n("HK"), unit: "nr", note: "both sides of tall compartments" }] : []),
    ...(F.vents ? [{ item: `Vent holes ${F.vents.dia ?? 8} dia in back lining (top and bottom)`, qty: comps.reduce((a, c) => a + c.vents, 0), unit: "holes", note: `${F.vents.holes ?? 6} top + ${F.vents.holes ?? 6} bottom per compartment` }] : []),
    ...(F.inserts ? [{ item: "Threaded inserts M5 for hinges and locks (cement board)", qty: n("HG") * 4 + n("LK") * 0 + n("KP") * 2, unit: "nr", note: "4 per hinge (cup + plate), 2 per keeper plate" }] : []),
    ...(n("WF") ? [{ item: "Wall fixing bracket + anchor", qty: n("WF"), unit: "nr", note: "every back post, top" }] : []),
  ];
  return { item: S.item, title: S.title, source: S.source, origin: S.origin, materials: Object.fromEntries(Object.entries(M).map(([k, v]) => [k, v.name])),
    front, inside: R(inside), doorRows: dRows, parts, fittings, doors, comps, hardware, doorsCount: doors.length, tall: doors.filter((d) => d.h > 700).length, spec: S };
}

/** Place the result in Revit: one direct shape per run (parts + fittings), made into a Generic Model family (cuts in plan and
 *  section; make_unit_family Casework does not cut in plan), then set the instance on its level with offset 0. */
export async function placeInRevit(call, R, { rft, saveDir, levelId, levelElevation = 0, familyPrefix, materialIds, fittingMaterialId, groups }) {
  const [OX, OY, OZ] = R.origin, W = (x, y, z) => ({ x: OX + x, y: OY + y, z: OZ + z });
  const out = {};
  for (const [g, runs] of Object.entries(groups)) {
    const items = [...R.parts.filter((p) => runs.includes(p.run)).map((p) => ({ ...p, mid: materialIds[p.mat] })),
      ...R.fittings.filter((f) => runs.includes(f.run)).map((f) => ({ ...f, mid: fittingMaterialId }))];
    const solids = items.map((p) => ({ profile: [W(p.min[0], p.min[1], p.min[2]), W(p.max[0], p.min[1], p.min[2]), W(p.max[0], p.max[1], p.min[2]), W(p.min[0], p.max[1], p.min[2])],
      direction: { x: 0, y: 0, z: 1 }, length_mm: p.max[2] - p.min[2], material_id: p.mid }));
    const fam = `${familyPrefix}_${g}`;
    const ds = (await call("create_direct_shape", { category: "OST_GenericModel", name: fam, solids })).id;
    const r = await call("make_unit_family", { template_path: rft, family_name: fam, save_dir: saveDir, level_id: levelId, mark: `${R.item}-${g}`, element_ids: [ds] });
    await call("set_parameter", { element_id: r.id, parameter_name: "Elevation from Level", value: "0 mm" }).catch(() => null);
    out[g] = { id: r.id, family: r.family, parts: items.length };
  }
  return out;
}

if (process.argv[1]?.endsWith("locker_system.mjs") && process.argv.length > 3) {
  const { readFileSync, writeFileSync } = await import("node:fs");
  const res = buildLockers(JSON.parse(readFileSync(process.argv[2], "utf8")));
  writeFileSync(process.argv[3], JSON.stringify(res, null, 0));
  console.log(res.item, "parts", res.parts.length, "fittings", res.fittings.length, "doors", res.doorsCount, "tall", res.tall, "front", res.front, "inside", res.inside);
  for (const h of res.hardware) console.log(" ", h.qty, h.unit, h.item);
}



