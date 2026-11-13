// Joinery rule audit for any item described as a parts list (the same JSON that builds the Revit family and the BOM):
// { item, title, parts: [{ code, name, mat, min:[x,y,z], max:[x,y,z] }], hardware: [{ item, qty, unit }] } in mm.
// Rules J01-J10 (references/joinery-check.md). Output: [{ id, rule, result: PASS|WARN|FAIL|INFO, detail }].
// Usage: node tools/joinery_check.mjs [--config cfg.json] [--json out.json] <parts.json> [...]
//        import { checkJoinery } from "./joinery_check.mjs"
import { BOARD_KINDS, DENSITY, hingeCount } from "./locker_system.mjs";

// Defaults; a project config overrides any key. Values marked (confirm) are to check with the supplier or on site.
export const DEFAULTS = {
  stock: {   // sheet sizes L x W, first = normal stock; later ones = larger standard sheets (check local stock)
    viroc: [[2600, 1250], [3000, 1250]], plywood: [[2440, 1220]], mdf: [[2440, 1220], [2800, 2070]],
    compact: [[3050, 1300]], egger: [[2800, 2070]], solid_surface: [[3660, 760]], softwood: 4800,
  },
  thickness: { solid_surface: [6, 12, 19] },
  // Viroc: Investwood TDS 2022.1 - sheets 2600 / 3000 x 1250 (all colours), E class 1 >= 4500, class 2 4000-4500 MPa.
  E: { viroc: 4000, plywood: 5000, mdf: 2500, compact: 9000, egger: 3000, solid_surface: 8000, softwood: 11000 },   // MPa bending, conservative
  density: { solid_surface: 1700, steel: 7850 },
  shelf: { q_kN_m2: 1.5, limit: 300, warn: 400, min_len: 300 },   // uniform load; deflection limit span / limit (FAIL), / warn (WARN)
  access: { door_w: 1000, door_h: 2100, max_kg_two_men: 100 },     // site door (confirm) and two-person lift
  tall_mm: 1200,
};

export const kindOf = (mat = "") => /viroc/i.test(mat) ? "viroc" : /valchromat|mdf/i.test(mat) ? "mdf" : /plywood|ply\b/i.test(mat) ? "plywood"
  : /compact|hpl/i.test(mat) ? "compact" : /egger/i.test(mat) ? "egger" : /solid surface|corian/i.test(mat) ? "solid_surface"
  : /softwood|timber|batten/i.test(mat) ? "softwood" : /steel|foot/i.test(mat) ? "steel" : "other";

const merge = (a, b) => { const o = { ...a }; for (const k in b ?? {}) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge(a[k] ?? {}, b[k]) : b[k]; return o; };
const sz = (p) => (p.cut ? [...p.cut].map(Number) : [0, 1, 2].map((i) => p.max[i] - p.min[i]));   // shaped parts carry their cut size
const thinAxis = (p) => { const s = sz(p); return s.indexOf(Math.min(...s)); };
const r = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

/** Groups layers bonded face to face (same footprint, touching through the thickness) into panels: a 43 sandwich = 1 panel. */
export function panels(parts) {
  const boards = parts.filter((p) => !p.profile && !["steel", "other", "softwood"].includes(kindOf(p.mat)));   // shaped parts are not grouped
  const used = new Set(), out = [];
  for (const p of boards) {
    if (used.has(p)) continue;
    const a = thinAxis(p), others = [0, 1, 2].filter((i) => i !== a), layers = [p]; used.add(p);
    let grew = true;
    while (grew) {
      grew = false;
      for (const q of boards) {
        if (used.has(q) || thinAxis(q) !== a) continue;
        // Same kit piece (module tag) and overlapping footprint, so a core cut in two still joins its faces;
        // without tags the footprints must overlap by 90 % of the smaller one (a plywood layer set back from a front edge).
        const ov = others.every((i) => Math.min(q.max[i], p.max[i]) - Math.max(q.min[i], p.min[i]) > 1);
        const area = (r) => others.reduce((acc, i) => acc * (r.max[i] - r.min[i]), 1);
        const common = others.reduce((acc, i) => acc * Math.max(0, Math.min(q.max[i], p.max[i]) - Math.max(q.min[i], p.min[i])), 1);
        if (p.module && q.module ? !(p.module === q.module && ov) : common < 0.9 * Math.min(area(p), area(q))) continue;
        if (layers.some((l) => Math.abs(l.max[a] - q.min[a]) < 0.6 || Math.abs(q.max[a] - l.min[a]) < 0.6)) { layers.push(q); used.add(q); grew = true; }
      }
    }
    const min = [0, 1, 2].map((i) => Math.min(...layers.map((l) => l.min[i]))), max = [0, 1, 2].map((i) => Math.max(...layers.map((l) => l.max[i])));
    out.push({ axis: a, layers: layers.sort((x, y) => x.min[a] - y.min[a]), min, max, code: p.code, name: p.name });
  }
  return out;
}

export function checkJoinery(D, cfg = {}) {
  const C = merge(DEFAULTS, cfg), out = [], parts = D.parts ?? [], hw = D.hardware ?? [];
  const add = (id, rule, result, detail) => out.push({ id, rule, result, detail });
  const P = panels(parts);
  const dens = (k) => C.density[k] ?? DENSITY[k] ?? 700;
  const kg = (p) => (sz(p).reduce((a, b) => a * b, 1) / 1e9) * dens(kindOf(p.mat));   // uses the cut size for shaped parts

  // J01 every part fits a board (or a length) of its material
  const big = [], larger = [];
  for (const p of parts) {
    const k = kindOf(p.mat), s = sz(p).sort((a, b) => b - a);
    if (k === "softwood") { if (s[0] > C.stock.softwood) big.push(`${p.name} ${r(s[0])} long`); continue; }
    const st = C.stock[k]; if (!st) continue;
    const fits = (b) => s[0] <= b[0] && s[1] <= b[1];
    if (fits(st[0])) continue;
    const i = st.findIndex(fits);
    if (i > 0) larger.push(`${p.code} ${p.name} ${r(s[0])}x${r(s[1])} needs ${st[i].join(" x ")}`);
    else big.push(`${p.code} ${p.name} ${r(s[0])}x${r(s[1])} (${k})`);
  }
  const uniq = (a) => [...new Set(a)];
  add("J01", "Every part fits a stock board or length", big.length ? "FAIL" : larger.length ? "WARN" : "PASS",
    big.length ? `${big.length} parts bigger than any board, need a joint: ${uniq(big).slice(0, 4).join("; ")}`
      : larger.length ? `${larger.length} parts need the larger standard sheet (check local stock): ${uniq(larger).slice(0, 4).join("; ")}` : "all parts fit the normal sheets");

  // J02 thickness made for the material
  const badT = uniq(parts.filter((p) => { const k = kindOf(p.mat), t = r(Math.min(...sz(p)), 1), list = C.thickness[k] ?? BOARD_KINDS[k]; return list && !list.includes(t); })
    .map((p) => `${kindOf(p.mat)} ${r(Math.min(...sz(p)), 1)} (${p.name})`));
  add("J02", "Board thickness exists on the market", badT.length ? "FAIL" : "PASS", badT.length ? badT.slice(0, 4).join("; ") : "all thicknesses made");

  // J03 shelf / top deflection under a uniform load, panel as bonded layers (transformed section)
  const verts = P.filter((p) => p.axis !== 2);
  const shelfRes = [];
  const zFloor = Math.min(...parts.map((p) => p.min[2]));
  for (const s of P.filter((p) => p.axis === 2 && !/drawer|DB/i.test(`${p.code} ${p.name}`))) {
    if (Math.max(s.max[0] - s.min[0], s.max[1] - s.min[1]) < C.shelf.min_len) continue;
    if (Math.min(s.max[0] - s.min[0], s.max[1] - s.min[1]) < 100) continue;          // trims, caps and edging strips
    if (s.min[2] - zFloor < 60) continue;                 // base on feet / floor: carried all over
    // one entry per layer level (a core cut in two pieces is still one layer)
    const L = [...new Map(s.layers.map((l) => [`${l.min[2]}|${l.max[2]}`, l])).values()];
    const Es = L.map((l) => C.E[kindOf(l.mat)] ?? 4000), ts = L.map((l) => l.max[2] - l.min[2]), zs = L.map((l) => (l.min[2] + l.max[2]) / 2);
    const zc = Es.reduce((a, E, i) => a + E * ts[i] * zs[i], 0) / Es.reduce((a, E, i) => a + E * ts[i], 0);
    const EIu = Es.reduce((a, E, i) => a + E * (ts[i] ** 3 / 12 + ts[i] * (zs[i] - zc) ** 2), 0);   // per mm of width
    const q = C.shelf.q_kN_m2 * 1e-3;
    // A support carries the shelf from below: a vertical panel reaching below the shelf top (a panel standing ON the shelf
    // is a load). Point supports across the span: panels normal to the span. Edge supports: a panel or a wall rail (code BR,
    // under the shelf or over it with the shelf screwed up into it) along a long edge. Both directions are tried; the
    // stiffest way wins.
    let best = null;
    for (const ax of [0, 1]) {
      const cr = 1 - ax, len = s.max[ax] - s.min[ax], b = s.max[cr] - s.min[cr];
      const sup = verts.filter((v) => v.axis === ax && v.max[2] >= s.min[2] - 1 && v.min[2] < s.max[2] - 1
        && Math.min(v.max[cr], s.max[cr]) - Math.max(v.min[cr], s.min[cr]) > 0.5 * b
        && v.max[ax] > s.min[ax] - 50 && v.min[ax] < s.max[ax] + 50).map((v) => [v.min[ax], v.max[ax]]).sort((x, y) => x[0] - y[0]);
      const along = (o) => Math.min(o.max[ax], s.max[ax]) - Math.max(o.min[ax], s.min[ax]) > 0.8 * len;
      const edges = new Set();
      // frame members (softwood, steel, any part) right under the shelf: across the span = point support, along an edge = edge support
      for (const p of parts) {
        if (s.layers.includes(p) || p.max[2] > s.min[2] + 1 || s.min[2] - p.max[2] > 15) continue;   // up to 15 mm packers / bond line
        const ov = [0, 1].map((i) => Math.min(p.max[i], s.max[i]) - Math.max(p.min[i], s.min[i]));
        if (ov[0] <= 0 || ov[1] <= 0) continue;
        if (ov[cr] > 0.5 * b) sup.push([p.min[ax], p.max[ax]]);
        else if (ov[ax] > 0.8 * len) { if (p.min[cr] - s.min[cr] < 60) edges.add("lo"); if (s.max[cr] - p.max[cr] < 60) edges.add("hi"); }
      }
      sup.sort((x, y) => x[0] - y[0]);
      // side panels along a long edge count only when structural (not a back or a lining)
      for (const v of verts) if (v.axis === cr && !/^(BK|LF|LN)$/.test(v.code) && v.max[cr] - v.min[cr] >= 30
        && v.max[2] >= s.min[2] - 1 && v.min[2] < s.max[2] - 1 && along(v)) {
        if (Math.abs(v.max[cr] - s.min[cr]) < 2 || (v.min[cr] <= s.min[cr] + 1 && v.max[cr] >= s.min[cr])) edges.add("lo");
        if (Math.abs(v.min[cr] - s.max[cr]) < 2 || (v.min[cr] <= s.max[cr] && v.max[cr] >= s.max[cr] - 1)) edges.add("hi");
      }
      for (const p of parts) if (p.code === "BR" && (Math.abs(p.max[2] - s.min[2]) < 2 || Math.abs(p.min[2] - s.max[2]) < 2) && along(p))
        edges.add(Math.abs(p.max[cr] - s.max[cr]) < Math.abs(p.min[cr] - s.min[cr]) ? "hi" : "lo");
      const ways = [];
      if (sup.length >= 2) { let span = 0; for (let i = 1; i < sup.length; i++) span = Math.max(span, sup[i][0] - sup[i - 1][1]);
        ways.push({ span, d: (5 * q * span ** 4) / (384 * EIu), how: "between supports" }); }
      if (len < b) edges.clear();                       // edge support only along a long edge
      if (edges.size === 2) ways.push({ span: b, d: (5 * q * b ** 4) / (384 * EIu), how: "on both long edges" });
      else if (edges.size === 1) ways.push({ span: b, d: (q * b ** 4) / (8 * EIu), how: "cantilever off one edge / wall rail" });
      for (const w of ways) if (!best || w.d < best.d) best = w;
    }
    if (!best) { shelfRes.push({ name: `${s.code} ${s.name}`, span: 0, t: r(s.max[2] - s.min[2]), d: Infinity, ratio: 0, how: "NO SUPPORT found under it" }); continue; }
    shelfRes.push({ name: `${s.code} ${s.name}`, span: r(best.span), t: r(ts.reduce((a, x) => a + x, 0)), d: r(best.d, 2), ratio: best.d > 0 ? r(best.span / best.d) : Infinity, how: best.how });
  }
  if (shelfRes.length) {
    const worst = shelfRes.reduce((a, x) => (x.ratio < a.ratio ? x : a));
    add("J03", `Shelf deflection under ${C.shelf.q_kN_m2} kN/m2 (span/${C.shelf.limit})`, worst.ratio < C.shelf.limit ? "FAIL" : worst.ratio < C.shelf.warn ? "WARN" : "PASS",
      `${shelfRes.length} spans; worst ${worst.name} (${worst.how}): span ${worst.span}, ${worst.t} thick, sag ${worst.d} mm = span/${worst.ratio}`);
  } else add("J03", "Shelf deflection", "INFO", "no shelf spans between two supports found");

  // J04 / J05 doors: hinge type for the door thickness, hinges per door by height and weight
  const doors = P.filter((p) => p.axis !== 2 && /^DR$|door/i.test(`${p.code}`) || (p.axis !== 2 && /door/i.test(p.name) && !/drawer/i.test(p.name)));
  const hinges = hw.filter((h) => /hinge/i.test(h.item) && !/plate|dowel/i.test(h.item)).reduce((a, h) => a + h.qty, 0);
  if (doors.length) {
    const t = r(Math.max(...doors.map((d) => d.max[d.axis] - d.min[d.axis])), 1);
    const cls = t < 10 ? "too thin for a cup hinge" : t <= 15 ? "thin-door hinge (10-19, e.g. Hettich Sensys 8646i)" : t <= 26 ? "standard 35 mm cup hinge" : t <= 32 ? "thick-door hinge (up to 32)" : "no standard concealed hinge (pivot or piano hinge)";
    const said = hw.map((h) => h.item.match(/(\d+)\s*mm door/i)).filter(Boolean).map((m) => +m[1]);
    const clash = said.length && !said.includes(Math.round(t));
    add("J04", "Hinge type suits the door thickness", t < 10 || t > 32 || clash ? "FAIL" : t > 26 ? "WARN" : "PASS",
      `${doors.length} doors ${t} thick -> ${cls}` + (clash ? `; hardware says ${said.join("/")} mm door` : ""));
    const need = doors.reduce((a, d) => a + hingeCount(d.max[2] - d.min[2], d.layers.reduce((x, l) => x + kg(l), 0)), 0), per = r(hinges / doors.length, 1);
    const short = hinges < need ? doors : [];
    const heavy = doors.reduce((a, d) => { const m = d.layers.reduce((x, l) => x + kg(l), 0); return m > a.m ? { m, h: d.max[2] - d.min[2] } : a; }, { m: 0, h: 0 });
    add("J05", "Hinges per door by height and weight", short.length ? "FAIL" : "PASS",
      `${hinges} hinges for ${doors.length} doors (${per} each on average, ${need} needed); heaviest door ${r(heavy.m, 1)} kg, ${r(heavy.h)} high needs ${hingeCount(heavy.h, heavy.m)}` + (short.length ? `; ${need - hinges} hinges short` : ""));
  } else { add("J04", "Hinge type suits the door thickness", "INFO", "no hinged doors"); add("J05", "Hinges per door", "INFO", "no hinged doors"); }

  // J06 the item (or each module) goes through the site door and can be carried
  const mods = {}; for (const p of parts) (mods[p.module ?? "whole item"] ??= []).push(p);
  const modRes = Object.entries(mods).map(([m, ps]) => {
    const d = [0, 1, 2].map((i) => Math.max(...ps.map((p) => p.max[i])) - Math.min(...ps.map((p) => p.min[i]))).sort((a, b) => a - b);
    return { m, d: d.map((x) => r(x)), kg: r(ps.reduce((a, p) => a + kg(p), 0)), fits: d[0] <= C.access.door_w && d[1] <= C.access.door_h };
  });
  const noFit = modRes.filter((x) => !x.fits), heavyM = modRes.filter((x) => x.kg > C.access.max_kg_two_men);
  add("J06", `Each module through a ${C.access.door_w} x ${C.access.door_h} door, ${C.access.max_kg_two_men} kg max for two men`,
    noFit.length ? "FAIL" : heavyM.length ? "WARN" : "PASS",
    modRes.map((x) => `${x.m}: ${x.d.join(" x ")}, ${x.kg} kg${x.fits ? "" : " (does not pass)"}`).join("; "));

  // J07 tall units fixed to the wall, free-standing units stable
  const H = Math.max(...parts.map((p) => p.max[2])) - Math.min(...parts.map((p) => p.min[2]));
  const plan = [0, 1].map((i) => Math.max(...parts.map((p) => p.max[i])) - Math.min(...parts.map((p) => p.min[i])));
  const wallFix = hw.some((h) => /wall fix|anti-tip|tip/i.test(h.item)) || parts.some((p) => p.code === "BT");
  const ratio = H / Math.min(...plan);
  add("J07", "Tall units fixed to the wall (EN 16121); free units stable", H > C.tall_mm && !wallFix ? "FAIL" : ratio > 2 && !wallFix ? "WARN" : "PASS",
    `height ${r(H)}, plan ${plan.map((x) => r(x)).join(" x ")}, H/D ${r(ratio, 1)}, ${wallFix ? "wall fixed" : "free-standing"}`);

  // J08 inserts for screws into cement board / MDF
  const soft = parts.some((p) => ["viroc", "mdf"].includes(kindOf(p.mat))) && (hinges > 0 || hw.some((h) => /runner|handle|lock/i.test(h.item)));
  const ins = hw.some((h) => /insert/i.test(h.item));
  add("J08", "Threaded inserts for hardware in Viroc / MDF", soft && !ins ? "WARN" : "PASS", soft ? (ins ? "inserts listed" : "hardware screws into cement board or MDF: add threaded inserts") : "n/a");

  // J09 no two parts in the same space
  // Boxes meeting at a corner overlap by one board thickness each way: that is a joint zone (mitre or butt still to cut),
  // not a clash. A clash is an overlap thicker than the boards in two directions.
  const clashes = [], joints = [];
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const a = parts[i], b = parts[j], o = [0, 1, 2].map((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]));
    if (a.profile || b.profile || !o.every((x) => x > 0.5)) continue;   // shaped parts: bounding boxes overlap by nature
    const ta = Math.min(...sz(a)), tb = Math.min(...sz(b)), os = [...o].sort((x, y) => x - y);
    const txt = `${a.name} / ${b.name} (${o.map((x) => r(x)).join("x")})`;
    if (os[0] <= Math.min(ta, tb) + 0.5 && os[1] <= Math.max(ta, tb) + 0.5) joints.push(txt); else clashes.push(txt);
  }
  add("J09", "No parts overlap (joint zones listed apart)", clashes.length ? "FAIL" : joints.length ? "WARN" : "PASS",
    clashes.length ? `${clashes.length} clashes: ${clashes.slice(0, 3).join("; ")}`
      : joints.length ? `${joints.length} corner joint zones modelled as overlaps: set mitre or butt (and shorten the butted part) before the CNC cut list` : `${parts.length} parts, none overlap`);

  // J10 Viroc parts with a joint in a visible face
  const vj = big.filter((x) => /viroc/.test(x));
  add("J10", "No joints in visible Viroc faces", vj.length ? "FAIL" : larger.some((x) => /viroc|Viroc/.test(x)) ? "WARN" : "PASS",
    vj.length ? `${vj.length} Viroc parts longer than any sheet` : larger.length ? "joint-free only with the larger Viroc sheet" : "no joints needed");
  return out;
}

if (process.argv[1]?.endsWith("joinery_check.mjs") && process.argv.length > 2) {
  const { readFileSync, writeFileSync } = await import("node:fs");
  const a = process.argv.slice(2); let cfg = {}, json = null;
  for (let i = 0; i < a.length; i++) { if (a[i] === "--config") cfg = JSON.parse(readFileSync(a[++i], "utf8")); else if (a[i] === "--json") json = a[++i]; }
  const files = a.filter((x, i) => !["--config", "--json"].includes(x) && !["--config", "--json"].includes(a[i - 1]));
  const all = {};
  for (const f of files) {
    const D = JSON.parse(readFileSync(f, "utf8")), res = checkJoinery(D, cfg); all[D.item] = res;
    console.log(`\n${D.item} ${D.title ?? ""}  (${res.filter((x) => x.result === "FAIL").length} FAIL, ${res.filter((x) => x.result === "WARN").length} WARN)`);
    for (const x of res) console.log(`  ${x.id} ${x.result.padEnd(4)} ${x.rule} - ${x.detail}`);
  }
  if (json) writeFileSync(json, JSON.stringify(all, null, 1));
}

