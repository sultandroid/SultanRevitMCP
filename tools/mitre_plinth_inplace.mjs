// Plinths/skirtings as mitred rail frames, edited IN PLACE inside the family (factory rule: painted parts meet on
// 45 degree mitres, user 11 Nov 2026). For unit families that also hold shaped parts (doors, handles, profiles, nested
// hardware) and so cannot be rebuilt from boxes by mitre_painted.mjs. Only the skirting parts are deleted and replaced:
//   - one solid skirting block  -> four rails (front, back, two sides) of --rail thickness, block height;
//   - four boards already forming a frame (butt corners) -> the same frame with mitred corners.
// Each rail is a trapezoid in plan; the outside corners meet on the 45 degree diagonal. Uses edit_family_solids with
// "profile" (SultanRevitMCP, 11 Nov 2026). The family keeps its origin, so instances do not move. Check with
// tools/ray_snapshot.mjs before and after.
//
// usage: node tools/mitre_plinth_inplace.mjs --doc <title> --family <regex> --material <regex> [--rail 30] [--dry]
import { call } from "./rvt.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const DOC = arg("doc"), FAM = new RegExp(arg("family")), MAT = new RegExp(arg("material"), "i"), R = Number(arg("rail", 30)), DRY = process.argv.includes("--dry");
const D = { document: DOC }, T = 0.6, eq = (a, b) => Math.abs(a - b) < T;

const fams = new Map();
for (let off = 0; ; ) {
  const r = await call("query_elements", { ...D, parameter_name: "Family", parameter_value: " ", limit: 500, offset: off });
  for (const e of r.elements) if (e.family && FAM.test(e.family) && !fams.has(e.family)) fams.set(e.family, e);
  off += r.returned; if (off >= r.total || !r.returned) break;
}

const frame = (x0, y0, x1, y1) => [                       // four mitred rails, plan outlines
  [[x0, y0], [x1, y0], [x1 - R, y0 + R], [x0 + R, y0 + R]],   // y0 side
  [[x0, y1], [x0 + R, y1 - R], [x1 - R, y1 - R], [x1, y1]],   // y1 side
  [[x0, y0], [x0 + R, y0 + R], [x0 + R, y1 - R], [x0, y1]],   // x0 side
  [[x1, y0], [x1, y1], [x1 - R, y1 - R], [x1 - R, y0 + R]],   // x1 side
];

for (const [family, e] of fams) {
  const items = (await call("inspect_family", { ...D, element_id: e.id })).items;
  const sk = items.filter((i) => i.material && MAT.test(i.material) && i.max.z - i.min.z <= 150);
  if (!sk.length) { console.log(`${family}: no skirting parts`); continue; }
  const z0 = Math.min(...sk.map((i) => i.min.z)), z1 = Math.max(...sk.map((i) => i.max.z)), mat = sk[0].material;
  const x0 = Math.min(...sk.map((i) => i.min.x)), x1 = Math.max(...sk.map((i) => i.max.x));
  const y0 = Math.min(...sk.map((i) => i.min.y)), y1 = Math.max(...sk.map((i) => i.max.y));
  let kind = null;
  if (sk.length === 1 && x1 - x0 > 3 * R && y1 - y0 > 3 * R) kind = "solid block";
  else if (sk.length === 4 && sk.every((i) => (eq(i.max.x - i.min.x, R) && (eq(i.min.x, x0) || eq(i.max.x, x1))) || (eq(i.max.y - i.min.y, R) && (eq(i.min.y, y0) || eq(i.max.y, y1)))))
    kind = "4-board frame";
  if (!kind || sk.some((i) => !eq(i.min.z, z0) || !eq(i.max.z, z1))) { console.log(`SKIP ${family}: ${sk.length} skirting part(s), not one block or a ${R} mm 4-board frame; do by hand`); continue; }
  console.log(`${family}: ${kind} ${Math.round(x1 - x0)} x ${Math.round(y1 - y0)} x ${Math.round(z1 - z0)} -> 4 mitred ${R} mm rails (${mat})`);
  if (DRY) continue;
  const add = frame(x0, y0, x1, y1).map((p) => ({
    min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, material: mat,
    profile: p.map(([x, y]) => ({ x, y })),
  }));
  const r = await call("edit_family_solids", { ...D, element_id: e.id, delete_form_ids: sk.map((i) => i.id), add });
  console.log(`  replaced ${r.deleted} part(s) with ${r.added.length} rails`);
}
