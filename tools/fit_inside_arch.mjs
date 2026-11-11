// Infill behind an arch fits INSIDE the arch opening only (user, 11 Nov 2026: "should be inside the arch only, why
// extended outside, think as a carpenter"). For an L fascia split into an outside face part (-F) and an inside soffit
// part (-S) (tools/mitre_painted.mjs --split), this rebuilds both per arch opening:
//   -F  lunette panel: the face board cut to the arch's inner line (traced with rays every 4 mm at the face plane),
//       from the soffit up to the apex; its bottom edge keeps the 45 degree mitre to the soffit.
//   -S  soffit (and drop boards) between the arch legs, ends scribed to the curve over the board thickness; the front
//       (and back, with a drop board) 45 degree mitres kept. Extra soffit pieces are clipped to the opening.
// Pieces outside the opening (behind the legs, piers and spandrel cladding) are dropped: hidden, clashing, unfittable.
// One new family per piece ("<family base> <mark>-F Lunette" / "-S Soffit"), placed by ray fit (the Casework
// template lands 44.7 mm off), old instances deleted. An L part over several arches gives one pair per arch (-1, -2...).
//
// usage: node tools/fit_inside_arch.mjs --doc <title> --pairs <F id>:<S id>[,<F id>:<S id>...] --save-dir <folder>
//        [--arch <regex for the arch element names, default "Arch Unit">] [--source-doc <title>] [--dry]
// --source-doc: read the old -F/-S parts from another open model (e.g. a backup) and build into --doc; the old parts are
// then not deleted. Used to rebuild a piece that a bad run lost (Madina 2 LF-D drop boards, 11 Nov 2026).
import { call } from "./rvt.mjs";
import { setDoc, AX, xform, fitToSolids, fitInstance } from "./fitlib.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const DOC = arg("doc"), SRC = arg("source-doc", arg("doc")), DIR = arg("save-dir"), DRY = process.argv.includes("--dry"), ARCH = new RegExp(arg("arch", "Arch Unit"));
const PAIRS = (arg("pairs") || "").split(",").filter(Boolean).map((p) => p.split(":").map(Number));
if (!DOC || !PAIRS.length || (!DIR && !DRY)) { console.error("usage: --doc --pairs F:S[,F:S] --save-dir <dir> [--dry]"); process.exit(1); }
setDoc(DOC);
const D = { document: DOC }, T = 0.6;
const RFT = { Casework: String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Casework.rft`, "Generic Models": String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Generic Model.rft` };
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const matIds = new Map();
const matId = async (n) => { if (!matIds.has(n)) matIds.set(n, (await call("query_elements", { ...D, category: "Materials", parameter_name: "Name", parameter_value: n, limit: 50 })).elements.find((e) => e.name === n).id); return matIds.get(n); };

// world boxes of an instance's boards, by ray fit of the instance (mirror-aware)
async function boards(id) {
  const DS = { document: SRC };
  const e = await call("get_element", { ...DS, element_id: id });
  const items = (await call("inspect_family", { ...DS, element_id: id })).items.filter((i) => i.material && /Extrusion|FreeForm/.test(i.class));
  const loc = items.map((i) => ({ profile: [[i.min.x, i.min.y], [i.max.x, i.min.y], [i.max.x, i.max.y], [i.min.x, i.max.y]].map(([x, y]) => ({ x, y, z: i.min.z })), direction: { x: 0, y: 0, z: 1 }, length_mm: i.max.z - i.min.z }));
  setDoc(SRC); const f = await fitInstance({ id, location: e.location }, loc); setDoc(DOC);
  if (!f || f.res > 20) throw new Error(`cannot fit instance ${id} with rays (res ${f?.res})`);
  const W = xform(loc, f.T);
  const B = W.map((s, k) => {
    const pts = [...s.profile, ...s.profile.map((p) => ({ ...p, z: p.z + s.length_mm }))];
    const lo = Object.fromEntries(AX.map((a) => [a, Math.min(...pts.map((p) => p[a]))])), hi = Object.fromEntries(AX.map((a) => [a, Math.max(...pts.map((p) => p[a]))]));
    const d = AX.map((a) => hi[a] - lo[a]);
    return { lo, hi, thin: AX[d.indexOf(Math.min(...d))], mat: items[k].material };
  });
  const par = (n) => e.parameters.find((p) => p.name === n)?.value ?? null;
  return { e, B, mark: par("Mark") ?? "", comments: par("Comments") ?? "", sf: ["SF_Maturity", "SF_PhaseStatus"].map((n) => [n, par(n)]).filter(([, v]) => v), cat: e.category };
}
const ray = async (o, d, lim = 300) => (await call("probe_ray", { ...D, origin: o, direction: d, max_distance_mm: 6000, limit: lim })).hits;

for (const [fid, sid] of PAIRS) {
  const F = await boards(fid), S = await boards(sid);
  const fb0 = F.B.reduce((a, b) => (vol(b) > vol(a) ? b : a));           // the largest face board sets the plane
  const faces = F.B.filter((b) => b.thin === fb0.thin && Math.abs(b.lo[fb0.thin] - fb0.lo[fb0.thin]) < T);
  const fb = { ...fb0, lo: { ...fb0.lo }, hi: { ...fb0.hi } };            // ...and all face boards in it the run (LF-A: 3)
  for (const a of ["x", "y", "z"]) { fb.lo[a] = Math.min(...faces.map((b) => b.lo[a])); fb.hi[a] = Math.max(...faces.map((b) => b.hi[a])); }
  const n = fb.thin, w = n === "x" ? "y" : "x";
  const soff = S.B.filter((b) => b.thin === "z").reduce((a, b) => (area(b) > area(a) ? b : a));
  const zb = soff.lo.z, zt = soff.hi.z;
  const wallLow = (soff.lo[n] + soff.hi[n]) / 2 < (fb.lo[n] + fb.hi[n]) / 2;   // the wall is on the low-n side
  const nOut = wallLow ? fb.hi[n] : fb.lo[n], nIn = wallLow ? fb.lo[n] : fb.hi[n], nMid = (nOut + nIn) / 2;
  const P = (nv, wv, zv) => ({ [n]: nv, [w]: wv, z: zv });
  // edges of the opening around wc at height z, in the face plane: nearest arch faces either side
  const edge = async (wc, z) => {
    const side = async (s) => { const h = (await ray(P(nMid, wc, z), { [n]: 0, [w]: s, z: 0 })).filter((x) => ARCH.test(x.name)); return h.length ? h[0] : null; };
    const L = await side(-1), R = await side(1);
    if (!L || !R || L.distance_mm < 0.5 || R.distance_mm < 0.5) return null;
    return [L.point[w], R.point[w]];
  };
  // openings: gaps between arch faces just above the soffit, within the face board, closed above by an arch
  const hs = (await ray(P(nMid, fb.lo[w] - 300, zt + 2), { [n]: 0, [w]: 1, z: 0 }, 60)).filter((x) => ARCH.test(x.name)).map((x) => x.point[w]).sort((a, b) => a - b);
  const ops = [];
  for (let i = 0; i + 1 < hs.length; i++) {
    const a = hs[i], b = hs[i + 1], c = (a + b) / 2;
    if (b - a < 300 || c < fb.lo[w] || c > fb.hi[w]) continue;
    const up = (await ray(P(nMid, c, zt + 2), { [n]: 0, [w]: 0, z: 1 })).find((x) => ARCH.test(x.name));
    if (up && up.point.z - zt < 1500) ops.push({ c, arch: up.name.replace(/^Madina2 |^Madina |^Makkah /, "") });
  }
  const base = F.mark.replace(/-F$/, "");
  console.log(`${base}: face ${n} ${nIn.toFixed(1)}..${nOut.toFixed(1)}, soffit z ${zb}..${zt}, ${ops.length} arch opening(s): ${ops.map((o) => o.arch + "@" + Math.round(o.c)).join(", ")}`);
  if (!ops.length) { console.log(`  SKIP ${base}: no arch opening found behind it`); continue; }
  const fTop = fb.hi.z;
  const famF = F.e.family, famS = S.e.family;
  const made = [];
  for (const [k, op] of ops.entries()) {
    const tag = ops.length > 1 ? `${base}-${k + 1}` : base;
    // trace the opening
    const pts = [];
    for (let z = zt + 0.5; z < fTop; z += 4) { const e = await edge(op.c, z); if (!e || e[1] - e[0] < 2) break; pts.push([z, e[0], e[1]]); }
    if (!pts.length) { console.log(`  SKIP ${tag}: opening not traced`); continue; }
    const eb = await edge(op.c, zb + 0.5), em = await edge(op.c, (zb + zt) / 2), et = [pts[0][1], pts[0][2]];
    const last = pts[pts.length - 1], closed = last[2] - last[1] < 30, apexZ = closed ? Math.min(last[0] + 4, fTop) : fTop;
    const outline = [...pts.map(([z, l]) => [l, z]), ...(closed ? [[(last[1] + last[2]) / 2, apexZ]] : [[last[1], fTop], [last[2], fTop]]), ...pts.slice().reverse().map(([z, , r]) => [r, z])];
    console.log(`  ${tag}: ${op.arch} opening ${Math.round(eb[1] - eb[0])} wide at the soffit, ${closed ? "apex" : "flat top"} at z ${apexZ.toFixed(0)} (${pts.length} trace points)`);
    if (DRY) continue;
    const mF = await matId(fb.mat), nA = Math.min(nIn, nOut), nB = Math.max(nIn, nOut);
    const prN = (wz, n0, n1, m) => ({ profile: wz.map(([wv, zv]) => P(n0, wv, zv)), direction: P(1, 0, 0), length_mm: n1 - n0, material_id: m });
    const prW = (nz, w0, w1, m) => ({ profile: nz.map(([nv, zv]) => P(nv, w0, zv)), direction: P(0, 1, 0), length_mm: w1 - w0, material_id: m });
    const solF = [prN(outline, nA, nB, mF), prW([[nOut, zb], [nOut, zt], [nIn, zt]], em[0], em[1], mF)];
    // inside part: every S board, clipped to the opening, mitre zones kept as wedges along w
    const solS = [];
    // a drop board hangs below the soffit (LF-D). Its top may already run up into the soffit band (mitred), so test its
    // bottom, not its top: the old test (top at or under the soffit) missed it and the board was lost (11 Nov 2026).
    const drop = S.B.find((b) => b.thin === n && b.lo.z < zb - T);
    for (const b of S.B) {
      const m = await matId(b.mat);
      if (b.thin === "z") {                                                  // soffit level board
        const touchesFace = Math.abs((wallLow ? b.hi[n] : b.lo[n]) - nOut) < T;
        const back = wallLow ? b.lo[n] : b.hi[n];
        const dropBack = drop && Math.abs((wallLow ? drop.lo[n] : drop.hi[n]) - back) < T;
        const dIn = dropBack ? (wallLow ? drop.hi[n] : drop.lo[n]) : null;
        let n0 = touchesFace ? nIn : (wallLow ? b.hi[n] : b.lo[n]), n1 = dropBack ? dIn : back;
        const wlo = Math.max(b.lo[w], eb[0]), whi = Math.min(b.hi[w], eb[1]);
        if (whi - wlo < 1) continue;
        const tz = [[Math.max(b.lo[w], eb[0]), zb], [Math.min(b.hi[w], eb[1]), zb], [Math.min(b.hi[w], et[1]), zt], [Math.max(b.lo[w], et[0]), zt]];
        solS.push(prN(tz, Math.min(n0, n1), Math.max(n0, n1), m));
        const ww = [Math.max(b.lo[w], em[0]), Math.min(b.hi[w], em[1])];
        if (touchesFace) solS.push(prW([[nOut, zb], [nIn, zb], [nIn, zt]], ww[0], ww[1], m));
        if (dropBack) solS.push(prW([[dIn, zb], [back, zt], [dIn, zt]], ww[0], ww[1], m));
      } else if (b !== drop) {
        console.log(`    WARNING ${tag}: board ${b.mat} ${AX.map((a) => Math.round(b.lo[a]) + ".." + Math.round(b.hi[a])).join(" ")} is neither a soffit board nor a drop board; NOT rebuilt, check by hand`);
      } else {                                              // drop board: body below, top mitre wedge
        const nb = wallLow ? b.lo[n] : b.hi[n], ni = wallLow ? b.hi[n] : b.lo[n];
        const e0 = await edge(op.c, b.lo.z + 0.5), e1 = await edge(op.c, zb - 0.5);
        const lo0 = Math.max(b.lo[w], e0[0]), hi0 = Math.min(b.hi[w], e0[1]), lo1 = Math.max(b.lo[w], e1[0]), hi1 = Math.min(b.hi[w], e1[1]);
        solS.push(prN([[lo0, b.lo.z], [hi0, b.lo.z], [hi1, zb], [lo1, zb]], Math.min(nb, ni), Math.max(nb, ni), m));
        solS.push(prW([[ni, zb], [nb, zb], [nb, zt]], Math.max(b.lo[w], em[0]), Math.min(b.hi[w], em[1]), m));
      }
    }
    for (const [part, label, sols, src] of [["F", "Lunette", solF, F], ["S", "Soffit", solS, S]]) {
      const fam = `${famF.split(" LF-")[0]} ${tag}-${part} ${label}`;
      const ds = (await call("create_direct_shape", { ...D, category: src.cat === "Casework" ? "OST_Casework" : "OST_GenericModel", name: fam, solids: sols })).id;
      const r = await call("make_unit_family", { ...D, template_path: RFT[src.cat] ?? RFT["Generic Models"], family_name: fam, save_dir: DIR, level_id: lv, mark: `${tag}-${part}`, element_ids: [ds] });
      const f1 = await fitToSolids(r.id, sols);
      if (f1 && AX.some((a) => Math.abs(f1.drift[a]) > 0.05)) await call("move_elements", { ...D, element_ids: [r.id], dx_mm: -f1.drift.x, dy_mm: -f1.drift.y, dz_mm: -f1.drift.z });
      const f2 = await fitToSolids(r.id, sols);
      const ok = f2 && AX.every((a) => Math.abs(f2.drift[a]) < 0.2) && f2.res < 0.5;
      await call("set_parameter", { ...D, element_id: r.id, parameter_name: "Comments", value: `${part === "F" ? "LUNETTE PANEL" : "SOFFIT"} inside ${op.arch} only, cut to the arch line, 45 degree mitre to ${tag}-${part === "F" ? "S" : "F"}; fitted after the arch (user, 11 Nov 2026) | ${src.comments}`.slice(0, 1000) });
      for (const [p, v] of src.sf) await call("set_parameter", { ...D, element_id: r.id, parameter_name: p, value: v }).catch(() => {});
      made.push(r.id);
      console.log(`    ${tag}-${part} ${fam}: ${r.id} ${ok ? "in place" : "VERIFY placement"} (moved ${f1 ? AX.map((a) => (-f1.drift[a]).toFixed(1)).join(",") : "?"})`);
    }
  }
  if (!DRY && made.length && SRC === DOC) { await call("delete_elements", { ...D, element_ids: [fid, sid] }); console.log(`  old ${fid}, ${sid} deleted`); }
}
function vol(b) { return AX.reduce((p, a) => p * (b.hi[a] - b.lo[a]), 1); }
function area(b) { return (b.hi.x - b.lo.x) * (b.hi.y - b.lo.y); }
