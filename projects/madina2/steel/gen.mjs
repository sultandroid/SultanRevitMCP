const { members, supports } = await import(process.env.MODEL ?? "./ste2_model.mjs");
const key = (p) => p.map((v) => Math.round(v)).join(","), nodes = new Map();
const n = (p) => { const k = key(p); if (!nodes.has(k)) nodes.set(k, { id: nodes.size + 1, p }); return nodes.get(k).id; };
const pts = [...new Map(members.flatMap((m) => [m.a, m.b]).map((p) => [key(p), p])).values()]; const bars = [];
for (const m of members) { const a = m.a, b = m.b, d = [0, 1, 2].map((i) => b[i] - a[i]), L2 = d.reduce((s, v) => s + v * v, 0);
  const on = pts.map((p) => { const t = [0, 1, 2].reduce((s, i) => s + (p[i] - a[i]) * d[i], 0) / L2; const e = Math.hypot(...[0, 1, 2].map((i) => a[i] + t * d[i] - p[i])); return { p, t, e }; }).filter((o) => o.e < 25 && o.t > 0.001 && o.t < 0.999).sort((x, y) => x.t - y.t);
  let prev = a; for (const o of [...on, { p: b }]) { bars.push({ id: m.id, sec: m.sec, n1: n(prev), n2: n(o.p) }); prev = o.p; } }
(await import("node:fs")).writeFileSync("ste2_robot.json", JSON.stringify({ nodes: [...nodes.values()].map((o) => ({ id: o.id, x: o.p[0] / 1000, y: o.p[1] / 1000, z: o.p[2] / 1000 })), bars, sup: supports.map(n) }));
console.log(nodes.size, bars.length, supports.length);
