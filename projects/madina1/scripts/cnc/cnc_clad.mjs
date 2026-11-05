// Madina 1 strip cladding SC-A (side walls, 2 arches) and SC-B (rear, 1 arch): CNC DXFs and cut list, from the same geometry as the
// model (m1/sc3.mjs: 20 mm strips at ~40 pitch, 15 thick, 5 mm backing, 6 mm closure round the keel ring, top +3.050).
// Strips over an arch are cut to the curve: each gets its own closed outline, numbered, laid side by side in one DXF per run.
// Backing pieces (5 mm) as cut: rectangles between arches and one keel-cut piece per arch.
import { mkdirSync, writeFileSync } from "node:fs";
import { Dxf, pt } from "../../../../tools/cnc_dxf.mjs";
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const W = 20, PITCH = 40, TOP = 3050, B = 6, Z0 = 1984, APEX = 2960, RISE = 560, R = 400, zB = Z0 + B;
const RUNS = [
  { id: "SC-A", qty: 2, u0: 780, u1: 4730, arches: [[1342, 2262], [3249.7, 4169.7]], note: "SC-A1 west; SC-A2 east is the same run turned 180" },
  { id: "SC-B", qty: 2, u0: 1011, u1: 2335, arches: [[1212.9, 2132.9]], note: "SC-B1 rear left; SC-B2 rear right the same" },
];
const layout = (a, b) => { const n = Math.max(2, Math.round((b - a + W) / PITCH)), step = (b - a - W) / (n - 1), o = []; for (let i = 0; i < n; i++) o.push([a + i * step, a + i * step + W]); return o; };
function side(a, b, e, sg) {
  const Wd = b - a, zs = APEX - RISE, t = Math.atan2(RISE, Wd / 2 - R) + Math.acos(R / Math.hypot(Wd / 2 - R, RISE)), r = R + e, n = 96, L = [];
  for (let i = 0; i <= n; i++) { const g = Math.PI - (i * (Math.PI - t)) / n; L.push([a + R + r * Math.cos(g), zs + r * Math.sin(g)]); }
  const [pu, pz] = L[L.length - 1], end = [(a + b) / 2, pz + (((a + b) / 2 - pu) / Math.sin(t)) * -Math.cos(t)]; if (Math.hypot(end[0] - pu, end[1] - pz) > 0.5) L.push(end);
  return sg < 0 ? L : L.map(([u, z]) => [a + b - u, z]);
}
const line = (a, b, e) => [...side(a, b, e, -1), ...side(a, b, e, 1).slice(0, -1).reverse()];
const zAt = (L, u) => { for (let i = 1; i < L.length; i++) { const [u0, z0] = L[i - 1], [u1, z1] = L[i]; if ((u - u0) * (u - u1) <= 0 && u1 !== u0) return z0 + ((u - u0) / (u1 - u0)) * (z1 - z0); } return -Infinity; };
const csv = ["run,piece,qty_per_run,runs,total,width_mm,length_or_height_mm,material,thickness_mm,file,note"];
const r1 = (v) => Math.round(v * 10) / 10;

for (const run of RUNS) {
  const strips = [], backs = []; let cur = run.u0, curB = run.u0, nLow = 0;
  for (const [a, b] of run.arches) {
    const left = a - B, right = b + B, outer = line(a, b, B);
    nLow += layout(cur, left).length;
    for (const [u, v] of layout(left, right)) {
      const zu = Math.max(zAt(outer, Math.max(u, left)), zB), zv = Math.max(zAt(outer, Math.min(v, right)), zB);
      const inner = outer.filter((p) => p[0] > u && p[0] < v).map((p) => [p[0], Math.max(p[1], zB)]);
      strips.push({ u, pts: [[u, zu], ...inner, [v, zv], [v, TOP], [u, TOP]] });
    }
    if (a > curB) backs.push({ name: "flat", pts: [[curB, Z0], [a, Z0], [a, TOP], [curB, TOP]] });
    backs.push({ name: "arch", pts: [...line(a, b, 0), [b, TOP], [a, TOP]] });
    cur = right; curB = b;
  }
  nLow += layout(cur, run.u1).length;
  if (curB < run.u1) backs.push({ name: "flat", pts: [[curB, Z0], [run.u1, Z0], [run.u1, TOP], [curB, TOP]] });

  // Shaped strips: one DXF, each strip at its own x with 15 mm between, bottom at 0; numbered from the run start.
  const d = new Dxf(); d.layer("CUT", 1); d.layer("TEXT", 8); let x = 0;
  strips.forEach((s, i) => {
    const zmin = Math.min(...s.pts.map((p) => p[1]));
    d.poly(s.pts.map(([u, z]) => pt(x + (u - s.u), z - zmin)), "CUT");
    d.text(x + 2, -25, 8, String(i + 1), "TEXT");
    const len = TOP - zmin;
    csv.push([run.id, `shaped strip ${i + 1} (u ${r1(s.u)})`, 1, run.qty, run.qty, W, r1(len), "Strip Cladding MDF HPL Light Grey", 15, `${run.id}-SHAPED-STRIPS.dxf`, "bottom cut to the arch curve"].join(","));
    x += W + 15;
  });
  d.text(0, -60, 20, `${run.id} shaped strips 1-${strips.length} | MDF HPL light grey 15 mm | 20 wide | QTY each ${run.qty} (one per run) | ${run.note}`, "TEXT");
  d.save(`${OUT}/${run.id}-SHAPED-STRIPS.dxf`);
  csv.push([run.id, "straight strip", nLow, run.qty, nLow * run.qty, W, TOP - zB, "Strip Cladding MDF HPL Light Grey", 15, "", "between and beside the arches"].join(","));

  // Backing pieces.
  const db = new Dxf(); db.layer("CUT", 1); db.layer("TEXT", 8); let bx = 0;
  backs.forEach((p, i) => {
    const u0 = Math.min(...p.pts.map((q) => q[0])), u1 = Math.max(...p.pts.map((q) => q[0]));
    db.poly(p.pts.map(([u, z]) => pt(bx + u - u0, z - Z0)), "CUT"); db.text(bx + 10, -30, 16, `B${i + 1} ${Math.round(u1 - u0)} x ${TOP - Z0}`, "TEXT");
    csv.push([run.id, `backing B${i + 1} (${p.name})`, 1, run.qty, run.qty, r1(u1 - u0), TOP - Z0, "Backing board, painted to match", 5, `${run.id}-BACKING.dxf`, p.name === "arch" ? "keel cut-out = outer face of the arch" : ""].join(","));
    bx += u1 - u0 + 60;
  });
  db.text(0, -70, 20, `${run.id} backing 5 mm | QTY each ${run.qty} | ${run.note}`, "TEXT");
  db.save(`${OUT}/${run.id}-BACKING.dxf`);
  csv.push([run.id, "support board", 1, run.qty, run.qty, 100, r1(run.u1 - run.u0), "Softwood 18 (FR MDF 18 allowed)", 18, "", "+3.032 to +3.050, fixed to the wall"].join(","));
  console.log(run.id, "shaped strips", strips.length, "straight", nLow, "backing pieces", backs.length);
}
writeFileSync(`${OUT}/_CLADDING-CUT-LIST.csv`, csv.join("\n") + "\n");
