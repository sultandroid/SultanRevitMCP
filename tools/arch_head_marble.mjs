// Marble (stone) cladding pasted on an arch-head lunette panel (user, 11 Nov 2026: "all fascia LF-C-F and its like to be
// pasted on it marble as per the design"; Madina 2 design MR 01 = 12 mm Tuscany travertine). For each face panel
// (-F) the arch opening is traced with rays at the stone's own plane, from the soffit underside up to the apex, and a
// stone piece of that outline and --thick mm is set on the shop side of the panel. One family per piece
// ("<family base> <mark>-M Marble"), placed by ray fit (the Casework template lands 44.7 mm off).
//
// usage: node tools/arch_head_marble.mjs --doc <title> --ids <F instance id>[,<id>...] --save-dir <folder>
//        [--thick 12] [--material "Marble Tuscany Travertine 12 Approved"] [--arch "Arch Unit"] [--dry]
import { call } from "./rvt.mjs";
import { setDoc, AX, xform, fitToSolids, fitInstance } from "./fitlib.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const DOC = arg("doc"), IDS = (arg("ids") || "").split(",").filter(Boolean).map(Number), DIR = arg("save-dir");
const TH = Number(arg("thick", 12)), MAT = arg("material", "Marble Tuscany Travertine 12 Approved"), ARCH = new RegExp(arg("arch", "Arch Unit")), DRY = process.argv.includes("--dry");
setDoc(DOC);
const D = { document: DOC };
const RFT = String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Casework.rft`;
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const ray = async (o, d) => (await call("probe_ray", { ...D, origin: o, direction: d, max_distance_mm: 6000, limit: 300 })).hits;
let matId = (await call("query_elements", { ...D, category: "Materials", parameter_name: "Name", parameter_value: MAT, limit: 10 })).elements.find((e) => e.name === MAT)?.id;
if (!matId && !DRY) matId = (await call("ensure_material", { ...D, name: MAT, color: { r: 222, g: 211, b: 190 } })).id;   // new material only

for (const id of IDS) {
  const e = await call("get_element", { ...D, element_id: id });
  const mark = e.parameters.find((p) => p.name === "Mark")?.value ?? String(id);
  const items = (await call("inspect_family", { ...D, element_id: id })).items.filter((i) => i.material && /Extrusion|FreeForm/.test(i.class));
  // where the panel really is: rays near its straight bottom band (the lunette is curved, so its box cannot be fitted)
  const blo = Object.fromEntries(AX.map((a) => [a, Math.min(...items.map((i) => i.min[a]))])), bhi = Object.fromEntries(AX.map((a) => [a, Math.max(...items.map((i) => i.max[a]))]));
  const n = bhi.x - blo.x < bhi.y - blo.y ? "x" : "y", w = n === "x" ? "y" : "x";            // the panel is thin in n
  const L = e.location.point, c = { x: L.x + (blo.x + bhi.x) / 2, y: L.y + (blo.y + bhi.y) / 2, z: L.z + blo.z + 30 };
  const span = async (o, a) => { const h = (await ray({ ...o, [a]: o[a] - 3000 }, { x: 0, y: 0, z: 0, [a]: 1 })).filter((x) => x.element_id === id).map((x) => x.point[a]); return h.length ? [Math.min(...h), Math.max(...h)] : null; };
  const sn = await span(c, n); if (!sn) { console.log(`SKIP ${mark}: rays cannot see it`); continue; }
  const cn = { ...c, [n]: (sn[0] + sn[1]) / 2 }, sw = await span(cn, w);
  const sz = await span({ ...cn, [w]: (sw[0] + sw[1]) / 2, z: c.z }, "z");
  const lo = { [n]: sn[0], [w]: sw[0], z: sz[0] }, hi = { [n]: sn[1], [w]: sw[1], z: sz[1] };
  // which side is the shop: the side a ray from the panel reaches without hitting the wall within 300 mm
  const mid = { [n]: (lo[n] + hi[n]) / 2, [w]: (lo[w] + hi[w]) / 2, z: lo.z + 60 };
  const away = async (s) => { const h = (await ray({ ...mid, [n]: s > 0 ? hi[n] + 1 : lo[n] - 1 }, { x: 0, y: 0, z: 0, [n]: s })).filter((x) => x.element_id !== id); return h.length ? h[0].distance_mm : 9999; };
  const sgn = (await away(1)) > (await away(-1)) ? 1 : -1, nOut = sgn > 0 ? hi[n] : lo[n];
  const nMid = nOut + sgn * TH / 2, P = (nv, wv, zv) => ({ [n]: nv, [w]: wv, z: zv });
  const wc = (lo[w] + hi[w]) / 2;
  const edge = async (z) => {
    const side = async (s) => (await ray(P(nMid, wc, z), { [n]: 0, [w]: s, z: 0 })).find((x) => ARCH.test(x.name));
    const Lh = await side(-1), Rh = await side(1);
    return Lh && Rh && Lh.distance_mm > 0.5 && Rh.distance_mm > 0.5 ? [Lh.point[w], Rh.point[w]] : null;
  };
  // the stone starts at the panel's OUTER bottom edge (flush with the soffit underside), not at mid thickness, where
  // the 45 degree mitre to the soffit lifts the panel's bottom by half its thickness
  const zOut = await span({ [n]: nOut - sgn * 0.3, [w]: wc, z: lo.z }, "z");
  const z0 = zOut ? zOut[0] : lo.z, rows = [];
  // never above the panel it is bonded to
  for (let z = z0 + 0.5; z < hi.z - 0.5; z += 4) { const ed = await edge(z); if (!ed || ed[1] - ed[0] < 2) break; rows.push([z, ...ed]); }
  if (rows.length < 10) { console.log(`SKIP ${mark}: arch opening not traced at the stone's plane`); continue; }
  rows[0][0] = z0;
  const last = rows[rows.length - 1], closed = last[2] - last[1] < 30;
  // closed arch: one apex point just above the last row; else a flat top at the panel's top edge
  const top = closed ? [[(last[1] + last[2]) / 2, Math.min(last[0] + 4, hi.z)]] : [[last[1], hi.z], [last[2], hi.z]];
  const outline = [...rows.map(([z, l]) => [l, z]), ...top, ...rows.slice().reverse().map(([z, , r]) => [r, z])];
  const apex = [0, Math.max(...top.map((p) => p[1]))];
  const sol = [{ profile: outline.map(([wv, zv]) => P(sgn > 0 ? nOut : nOut - TH, wv, zv)), direction: P(1, 0, 0), length_mm: TH, material_id: matId }];
  console.log(`${mark}: ${TH} mm stone on the ${n}${sgn > 0 ? "+" : "-"} face at ${n} ${nOut.toFixed(1)}, ${Math.round(rows[0][2] - rows[0][1])} wide at the bottom, ${Math.round(apex[1] - z0)} tall (z ${Math.round(z0)}..${Math.round(apex[1])})`);
  if (DRY) continue;
  const fam = `${e.family.split(" LF-")[0]} ${mark.replace(/-F$/, "")}-M Marble`;
  const ds = (await call("create_direct_shape", { ...D, category: "OST_Casework", name: fam, solids: sol })).id;
  const r = await call("make_unit_family", { ...D, template_path: RFT, family_name: fam, save_dir: DIR, level_id: lv, mark: mark.replace(/-F$/, "-M"), element_ids: [ds] });
  const f1 = await fitToSolids(r.id, sol);
  if (f1 && AX.some((a) => Math.abs(f1.drift[a]) > 0.05)) await call("move_elements", { ...D, element_ids: [r.id], dx_mm: -f1.drift.x, dy_mm: -f1.drift.y, dz_mm: -f1.drift.z });
  const f2 = await fitToSolids(r.id, sol), ok = f2 && AX.every((a) => Math.abs(f2.drift[a]) < 0.2);
  await call("set_parameter", { ...D, element_id: r.id, parameter_name: "Comments", value: `${TH} mm Tuscany travertine (design MR 01) bonded to ${mark}, cut to the arch line, soffit to apex; sign letters fixed on it as per design (user, 11 Nov 2026)` });
  for (const p of ["SF_Maturity", "SF_PhaseStatus"]) { const v = e.parameters.find((x) => x.name === p)?.value; if (v) await call("set_parameter", { ...D, element_id: r.id, parameter_name: p, value: v }).catch(() => {}); }
  console.log(`  ${fam}: ${r.id} ${ok ? "in place" : "VERIFY placement"}`);
}
