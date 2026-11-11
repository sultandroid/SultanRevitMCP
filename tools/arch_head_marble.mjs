// Marble L on an arch head (user, 11 Nov 2026): "all fascia LF-C-F and its like to be pasted on it marble as per the
// design" + "yes 45 mitre but marble 20 mm not 12 mm". Design MR 01 is Tuscany travertine; the factory uses 20 mm.
// For each lunette face panel (-F):
//   FACE    stone bonded on the shop side of the panel, cut to the arch line (traced with rays at the stone's own
//           plane every 4 mm), from the corner up to the apex, never above the panel;
//   SOFFIT  (--soffit, the L) stone under the soffit board, from the corner back to the first thing in its way
//           (pegboard top, hanger, drop board...), its ends cut to the arch line over its thickness;
//   the two meet on a 45 degree mitre at the outer bottom corner (the diagonal from the outer to the inner corner).
// One family per arch head ("<base> <mark>-M Marble", mark <mark>-M), face and soffit as two pieces in it; placed by
// ray fit (the Casework template lands 44.7 mm off). Replaces an older piece of the same mark (--replace).
//
// usage: node tools/arch_head_marble.mjs --doc <title> --ids <F id>,... --save-dir <folder> [--thick 20] [--soffit]
//        [--replace] [--round <bird's-nose radius>] [--ignore <regex of items fixed under the soffit>] [--material "Marble Tuscany Travertine 20 Approved"] [--arch "Arch Unit"] [--dry]
import { call } from "./rvt.mjs";
import { setDoc, AX, fitToSolids } from "./fitlib.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const DOC = arg("doc"), IDS = (arg("ids") || "").split(",").filter(Boolean).map(Number), DIR = arg("save-dir");
const T = Number(arg("thick", 20)), SOFFIT = process.argv.includes("--soffit"), REPLACE = process.argv.includes("--replace");
const RND = Number(arg("round", 0));   // bird's-nose: round the outer corner of the L with this radius (mm)
const IGN = arg("ignore") ? new RegExp(arg("ignore")) : null;   // items fixed UNDER the soffit, to be re-fixed to the stone (reported)
const MAT = arg("material", `Marble Tuscany Travertine ${T} Approved`), ARCH = new RegExp(arg("arch", "Arch Unit")), DRY = process.argv.includes("--dry");
setDoc(DOC);
const D = { document: DOC };
const RFT = String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Casework.rft`;
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const ray = async (o, d) => (await call("probe_ray", { ...D, origin: o, direction: d, max_distance_mm: 6000, limit: 300 })).hits;
let matId = (await call("query_elements", { ...D, category: "Materials", parameter_name: "Name", parameter_value: MAT, limit: 10 })).elements.find((e) => e.name === MAT)?.id;
if (!matId && !DRY) matId = (await call("ensure_material", { ...D, name: MAT, color: { r: 222, g: 211, b: 190 } })).id;   // new material only
const span = async (id, o, a) => { const h = (await ray({ ...o, [a]: o[a] - 3000 }, { x: 0, y: 0, z: 0, [a]: 1 })).filter((x) => x.element_id === id).map((x) => x.point[a]); return h.length ? [Math.min(...h), Math.max(...h)] : null; };

for (const id of IDS) {
  const e = await call("get_element", { ...D, element_id: id });
  const mark = (e.parameters.find((p) => p.name === "Mark")?.value ?? String(id)).replace(/-F$/, "");
  const items = (await call("inspect_family", { ...D, element_id: id })).items.filter((i) => i.material && /Extrusion|FreeForm/.test(i.class));
  // the panel, found with rays near its straight bottom band (the lunette is curved, its box cannot be fitted)
  const blo = Object.fromEntries(AX.map((a) => [a, Math.min(...items.map((i) => i.min[a]))])), bhi = Object.fromEntries(AX.map((a) => [a, Math.max(...items.map((i) => i.max[a]))]));
  const n = bhi.x - blo.x < bhi.y - blo.y ? "x" : "y", w = n === "x" ? "y" : "x";
  const L = e.location.point, c = { x: L.x + (blo.x + bhi.x) / 2, y: L.y + (blo.y + bhi.y) / 2, z: L.z + blo.z + 30 };
  const sn = await span(id, c, n); if (!sn) { console.log(`SKIP ${mark}: rays cannot see the panel`); continue; }
  const cn = { ...c, [n]: (sn[0] + sn[1]) / 2 }, sw = await span(id, cn, w), sz = await span(id, { ...cn, [w]: (sw[0] + sw[1]) / 2 }, "z");
  const lo = { [n]: sn[0], [w]: sw[0], z: sz[0] }, hi = { [n]: sn[1], [w]: sw[1], z: sz[1] }, wc = (lo[w] + hi[w]) / 2;
  // which side is the shop: the side where a ray from the panel runs further before hitting anything
  const mid = { [n]: (lo[n] + hi[n]) / 2, [w]: wc, z: lo.z + 60 };
  const away = async (s) => { const h = (await ray({ ...mid, [n]: s > 0 ? hi[n] + 1 : lo[n] - 1 }, { x: 0, y: 0, z: 0, [n]: s })).filter((x) => x.element_id !== id && !/-M Marble/.test(x.name)); return h.length ? h[0].distance_mm : 9999; };   // ignore stone already there
  const s = (await away(1)) > (await away(-1)) ? 1 : -1, nOut = s > 0 ? hi[n] : lo[n];
  const P = (nv, wv, zv) => ({ [n]: nv, [w]: wv, z: zv });
  // the corner: the panel's outer bottom edge = the soffit underside
  const zo = await span(id, { [n]: nOut - s * 0.3, [w]: wc, z: lo.z }, "z"), zb = zo ? zo[0] : lo.z;
  const edge = async (nPlane, z) => {
    const side = async (d) => (await ray(P(nPlane, wc, z), { [n]: 0, [w]: d, z: 0 })).find((x) => ARCH.test(x.name));
    const Lh = await side(-1), Rh = await side(1);
    return Lh && Rh && Lh.distance_mm > 0.5 && Rh.distance_mm > 0.5 ? [Lh.point[w], Rh.point[w]] : null;
  };
  // FACE: trace at the stone's plane from the corner up to the apex (never above the panel)
  const nF = nOut + (s * T) / 2, rows = [];
  for (let z = zb + 0.5; z < hi.z - 0.5; z += 4) { const ed = await edge(nF, z); if (!ed || ed[1] - ed[0] < 2) break; rows.push([z, ...ed]); }
  if (rows.length < 10) { console.log(`SKIP ${mark}: arch opening not traced at the stone's plane`); continue; }
  rows[0][0] = zb;
  const last = rows[rows.length - 1], closed = last[2] - last[1] < 30;
  const top = closed ? [[(last[1] + last[2]) / 2, Math.min(last[0] + 4, hi.z)]] : [[last[1], hi.z], [last[2], hi.z]];
  const face = [...rows.map(([z, l]) => [l, z]), ...top, ...rows.slice().reverse().map(([z, , r]) => [r, z])];
  const prN = (wz, n0, n1) => ({ profile: wz.map(([wv, zv]) => P(Math.min(n0, n1), wv, zv)), direction: P(1, 0, 0), length_mm: Math.abs(n1 - n0), material_id: matId });
  const prW = (nz, w0, w1) => ({ profile: nz.map(([nv, zv]) => P(nv, w0, zv)), direction: P(0, 1, 0), length_mm: w1 - w0, material_id: matId });
  const sol = [prN(face, nOut, nOut + s * T)];
  let soffitTxt = "";
  if (SOFFIT) {
    // the mitre band (z zb-T .. zb): opening at its middle, at the stone plane
    const em = await edge(nF, zb - T / 2), eB = await edge(nOut - s * 20, zb - T + 0.5), eT = await edge(nOut - s * 20, zb - 0.5);
    if (!em || !eB || !eT) { console.log(`SKIP ${mark}: opening under the soffit not traced`); continue; }
    // how far back the soffit stone can run: the first thing in its way, over its width and thickness
    let nStop = null; const clash = new Set();
    for (const z of [zb - 2, zb - T / 2, zb - T + 2]) for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const wv = eB[0] + f * (eB[1] - eB[0]);
      const h = (await ray(P(nOut - s * 1, wv, z), { [n]: -s, [w]: 0, z: 0 })).find((x) => !/-M Marble/.test(x.name) && !(IGN && IGN.test(x.name)));
      const g = IGN ? (await ray(P(nOut - s * 1, wv, z), { [n]: -s, [w]: 0, z: 0 })).find((x) => IGN.test(x.name) && (!h || x.distance_mm < h.distance_mm)) : null;
      if (g) clash.add(g.name.replace(/^Madina2? /, ""));
      if (h && (nStop === null || Math.abs(h.point[n] - nOut) < Math.abs(nStop - nOut))) nStop = h.point[n];
    }
    if (nStop === null) { console.log(`SKIP ${mark}: nothing found behind the soffit`); continue; }
    // the corner, in (u = out from the panel face, v = up from the soffit underside): outer O=(T,-T), inner I=(0,0).
    // Mitre on the diagonal I-O. Bird's nose (--round R): the outer corner is a quarter round R centred on the
    // diagonal at (T-R, -T+R); the joint runs from I to the middle of that round, so each piece keeps half of it.
    const UV = ([u, v]) => [nOut + s * u, zb + v];
    let faceW, soffW;
    if (RND > 0) {
      const R = Math.min(RND, T), cu = T - R, cv = -T + R, arc = (a0, a1, k = 6) => Array.from({ length: k + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / k; return [cu + R * Math.cos(a), cv + R * Math.sin(a)]; });
      faceW = [[T, 0], ...arc(0, -Math.PI / 4), [0, 0]];                 // (T,0) down the face, round to the middle, back to I
      soffW = [[0, 0], ...arc(-Math.PI / 4, -Math.PI / 2), [0, -T]];      // I, middle of the round, round to the underside, (0,-T)
    } else { faceW = [[T, -T], [T, 0], [0, 0]]; soffW = [[0, 0], [0, -T], [T, -T]]; }
    sol.push(prW(faceW.map(UV), em[0], em[1]));
    sol.push(prW(soffW.map(UV), em[0], em[1]));
    // soffit body from the panel face back to nStop, (w,z) ends cut to the arch line over the thickness
    sol.push(prN([[eB[0], zb - T], [eB[1], zb - T], [eT[1], zb], [eT[0], zb]], nOut, nStop));
    soffitTxt = `; soffit ${Math.round(Math.abs(nStop - nOut) + T)} deep x ${Math.round(eB[1] - eB[0])} wide, mitred 45 to the face${RND > 0 ? `, bird's-nose R${Math.min(RND, T)} on the outer corner` : ""}${clash.size ? `; CLASH: ${[...clash].join(", ")} is fixed under the soffit, must drop ${T} mm` : ""}`;
  }
  console.log(`${mark}: ${T} mm ${SOFFIT ? "L" : "face"} on the ${n}${s > 0 ? "+" : "-"} side at ${n} ${nOut.toFixed(1)}; face ${Math.round(rows[0][2] - rows[0][1])} wide x ${Math.round(Math.max(...top.map((p) => p[1])) - zb + (SOFFIT ? T : 0))} tall${soffitTxt}`);
  if (DRY) continue;
  const fam = `${e.family.split(" LF-")[0]} ${mark}-M Marble`;
  if (REPLACE) {
    const old = (await call("query_elements", { ...D, parameter_name: "Family", parameter_value: fam, limit: 20 })).elements.filter((x) => x.family === fam).map((x) => x.id);
    if (old.length) { await call("delete_elements", { ...D, element_ids: old }); console.log(`  replaced ${old.length} old piece(s)`); }
  }
  const ds = (await call("create_direct_shape", { ...D, category: "OST_Casework", name: fam, solids: sol })).id;
  const r = await call("make_unit_family", { ...D, template_path: RFT, family_name: fam, save_dir: DIR, level_id: lv, mark: `${mark}-M`, element_ids: [ds] });
  const f1 = await fitToSolids(r.id, sol);
  if (f1 && AX.some((a) => Math.abs(f1.drift[a]) > 0.05)) await call("move_elements", { ...D, element_ids: [r.id], dx_mm: -f1.drift.x, dy_mm: -f1.drift.y, dz_mm: -f1.drift.z });
  const f2 = await fitToSolids(r.id, sol), ok = f2 && AX.every((a) => Math.abs(f2.drift[a]) < 0.2);
  await call("set_parameter", { ...D, element_id: r.id, parameter_name: "Comments", value: `${T} mm Tuscany travertine (design MR 01) ${SOFFIT ? "L: face on " + mark + "-F and soffit under " + mark + "-S, 45 degree mitre at the outer bottom corner" + (RND > 0 ? ", bird's-nose R" + Math.min(RND, T) + " on the outer corner" : "") : "face on " + mark + "-F"}, cut to the arch line; sign letters fixed on it as per design (user, 11 Nov 2026)` });
  for (const p of ["SF_Maturity", "SF_PhaseStatus"]) { const v = e.parameters.find((x) => x.name === p)?.value; if (v) await call("set_parameter", { ...D, element_id: r.id, parameter_name: p, value: v }).catch(() => {}); }
  console.log(`  ${fam}: ${r.id} ${ok ? "in place" : "VERIFY placement"}`);
}
