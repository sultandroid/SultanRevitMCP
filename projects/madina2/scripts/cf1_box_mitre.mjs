// Madina 2 CF-1 ceiling wood frame (572716): each 100x100 member as a box of 18 FR MDF with oak veneer matching EGGER H1145,
// every board mitred 45 degrees at the four corners (user 11 Nov 2026: "miter connection and use MDF FR with veneer to match
// the egger and use 18 mm like box"). Outline 2380 x 1730, z +3.100..+3.200 as before. The family is reloaded under its own
// name (make_unit_family, like tools/mitre_painted.mjs) and the instance is checked with rays and moved back by any drift.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import { AX, fitToSolids, setDoc } from "file:///C:/Users/user/samaya-revit-standards/tools/fitlib.mjs";
const D = { document: "Madina2_ARCH_01" }; setDoc(D.document);
const ID = 572716, FAM = "Madina2 Ceiling Wood Frame CF-1", W = 2380, H = 1730, B = 100, T = 18;
const DIR = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Revit Files/Rfa";
const RFT = String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Generic Model.rft`;
const MAT = "FR MDF 18 Oak Veneer (match EGGER H1145 ST10)";
const mat = (await call("ensure_material", { ...D, name: MAT, color: { r: 196, g: 160, b: 112 } })).id;
const g = await call("get_element", { ...D, element_id: ID }), o = g.location.point; // family origin = outer corner, rotation 0
// U section open at the top (user: "the box to be open from up and all edges 45 degree"): soffit + outer and inner side,
// 18 thick, long edges mitred 45 (soffit/side) and all boards mitred 45 at the four plan corners. Each board is its
// cross-section placed in the corner mitre plane, extruded along the member to just past mid-length from both ends
// (the two halves overlap 4 mm at mid-length): exact 45 faces with extrusions only.
const SEC = [
  [[0, 0], [B, 0], [B - T, T], [T, T]],            // soffit, both long edges bevelled
  [[0, 0], [T, T], [T, B], [0, B]],                // outer side
  [[B, 0], [B, B], [B - T, B], [B - T, T]],        // inner side
];
const SIDES = [ // start corner, member axis u, inward offset axis o, length
  { s: [0, 0], u: [1, 0], o: [0, 1], L: W }, { s: [W, 0], u: [0, 1], o: [-1, 0], L: H },
  { s: [W, H], u: [-1, 0], o: [0, -1], L: W }, { s: [0, H], u: [0, -1], o: [1, 0], L: H },
];
const solids = [], boards = [];
for (const S of SIDES) for (const sec of SEC) { const pair = []; for (const end of [0, 1]) {
  const dir = end ? -1 : 1, half = S.L / 2 + 2;
  const pt = ([oo, z]) => { const uu = end ? S.L - oo : oo; return { x: o.x + S.s[0] + uu * S.u[0] + oo * S.o[0], y: o.y + S.s[1] + uu * S.u[1] + oo * S.o[1], z: o.z + z }; };
  const s1 = { profile: sec.map(pt), direction: { x: dir * S.u[0], y: dir * S.u[1], z: 0 }, length_mm: half, material_id: mat };
  solids.push(s1); pair.push(s1);
} boards.push(pair); }
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
// one direct shape per board, its two halves fused (union) so no seam shows at mid-length
const dss = []; for (const pair of boards) dss.push((await call("create_direct_shape", { ...D, category: "OST_GenericModel", name: FAM, solids: pair, union: true })).id);
const r = await call("make_unit_family", { ...D, template_path: RFT, family_name: FAM, save_dir: DIR, level_id: lv, mark: "TEMP-CF1", element_ids: dss });
if (r.id !== ID) await call("delete_elements", { ...D, element_ids: [r.id] });
const f1 = await fitToSolids(ID, solids);
if (f1 && AX.some((a) => Math.abs(f1.drift[a]) > 0.05)) await call("move_elements", { ...D, element_ids: [ID], dx_mm: -f1.drift.x, dy_mm: -f1.drift.y, dz_mm: -f1.drift.z });
const f2 = await fitToSolids(ID, solids);
await call("set_parameter", { ...D, element_id: ID, parameter_name: "Comments", value: "Wood frame round the flower grid inside the C02 rattan tray, 100 x 100 (user), outline 2380 x 1730, underside +3.10, top on the rattan +3.20 | Each member a box of 18 FR MDF with oak veneer matching EGGER H1145 ST10: U section open at the top: soffit and two sides, all edges mitred 45 (long edges and the four corners), glue blocks inside @ 600 (user 11 Nov 2026) | Downlights GL-1 to GL-8 in the soffit, 50 in from the edge | Hangers to confirm" });
console.log("CF-1 rebuilt", solids.length, "boards; drift before", JSON.stringify(f1?.drift), "after", JSON.stringify(f2?.drift));
