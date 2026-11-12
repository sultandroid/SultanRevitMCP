// Madina 2 CF-1 ceiling wood frame hangers (user 12 Nov 2026: "how we will hang this in the ceiling?" -> "Yes, model them").
// CF-1 (572716) is ~35-40 kg and only touches the 12.5 rattan tray board (C02, +3.20), which cannot carry it. 10 M8 rod
// hangers drop from the structure above the existing ceiling (+3.70) through 12 holes in the rattan board into the open-top
// U boxes: an 18 ply hanger block glued + screwed between the box sides, nut + washer under it, lock nut + washer on top,
// all hidden inside the box (soffit closed below). 4 M8 sway braces at 45 along the member axis, alternating directions.
// One family "Madina2 Ceiling Frame Hangers CF-1", Generic Models, mark "Ceiling Frame Hangers". CF-1 is not touched.
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import { AX, fitToSolids, setDoc } from "file:///C:/Users/user/samaya-revit-standards/tools/fitlib.mjs";
const D = { document: "Madina2_ARCH_01" }; setDoc(D.document);
const FAM = "Madina2 Ceiling Frame Hangers CF-1", MARK = "Ceiling Frame Hangers";
const DIR = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Revit Files/Rfa";
const RFT = String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Generic Model.rft`;
const steel = (await call("ensure_material", { ...D, name: "Steel Galvanised", color: { r: 170, g: 175, b: 180 } })).id;
const ply = (await call("ensure_material", { ...D, name: "Plywood 18", color: { r: 214, g: 184, b: 140 } })).id;
const TOP = 3700;                       // existing ceiling level: the rods carry on to the structure, cut to length on site
const SOFF = 3118;                      // top of the CF-1 soffit board (3100 + 18)
const BLK = [3145, 3163];               // hanger block z (27 clear above the soffit for nut + washer)
const poly = (cx, cy, z, r, n, rot = 0) => Array.from({ length: n }, (_, i) => { const a = rot + (2 * Math.PI * i) / n; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), z }; });
const up = { x: 0, y: 0, z: 1 };
// member centre lines: frame 2130..4510 x 1990..3720, members 100 wide
const XS = [2180, 2940, 3700, 4460], YL = [2040, 3670], YM = 2855, XE = [2180, 4460];
const pts = [...YL.flatMap((y) => XS.map((x) => ({ x, y, ax: "x" }))), ...XE.map((x) => ({ x, y: YM, ax: "y" }))];
const solids = [];
for (const p of pts) {
  // ply block: 100 along the member, 64 across (clear between the 18 sides)
  const [hu, hv] = p.ax === "x" ? [50, 32] : [32, 50];
  solids.push({ profile: [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]].map(([a, b]) => ({ x: p.x + a, y: p.y + b, z: BLK[0] })), direction: up, length_mm: BLK[1] - BLK[0], material_id: ply });
  solids.push({ profile: poly(p.x, p.y, BLK[0] - 12, 4, 8), direction: up, length_mm: TOP - (BLK[0] - 12), material_id: steel });   // M8 rod
  solids.push({ profile: poly(p.x, p.y, BLK[0] - 2, 12, 12), direction: up, length_mm: 2, material_id: steel });                    // washer under
  solids.push({ profile: poly(p.x, p.y, BLK[0] - 8.5, 7.5, 6), direction: up, length_mm: 6.5, material_id: steel });                // nut under
  solids.push({ profile: poly(p.x, p.y, BLK[1], 12, 12), direction: up, length_mm: 2, material_id: steel });                        // washer on top
  solids.push({ profile: poly(p.x, p.y, BLK[1] + 2, 7.5, 6), direction: up, length_mm: 6.5, material_id: steel });                  // lock nut
}
// sway braces: M8 rod at 45 from the block top along the member axis up to the structure line, alternating directions
const BR = [{ x: 2940, y: 2040, d: { x: -1, y: 0 } }, { x: 3700, y: 3670, d: { x: 1, y: 0 } }, { x: 2180, y: YM, d: { x: 0, y: -1 } }, { x: 4460, y: YM, d: { x: 0, y: 1 } }];
const z0 = BLK[1] + 9, L = (TOP - z0) * Math.SQRT2;
for (const b of BR) {
  // profile normal to the 45 rod: a square 8 x 8 in the plane spanned by the across axis and (-d, 1)/sqrt2
  const ac = b.d.x ? { x: 0, y: 1 } : { x: 1, y: 0 }, n = { x: -b.d.x / Math.SQRT2, y: -b.d.y / Math.SQRT2, z: 1 / Math.SQRT2 };
  const c = { x: b.x + b.d.x * 12, y: b.y + b.d.y * 12, z: z0 };
  const prof = [[-4, -4], [4, -4], [4, 4], [-4, 4]].map(([u, v]) => ({ x: c.x + u * ac.x + v * n.x, y: c.y + u * ac.y + v * n.y, z: c.z + v * n.z }));
  solids.push({ profile: prof, direction: { x: b.d.x / Math.SQRT2, y: b.d.y / Math.SQRT2, z: 1 / Math.SQRT2 }, length_mm: L, material_id: steel });
}
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
const ds = (await call("create_direct_shape", { ...D, category: "OST_GenericModel", name: FAM, solids })).id;
const r = await call("make_unit_family", { ...D, template_path: RFT, family_name: FAM, save_dir: DIR, level_id: lv, mark: MARK, element_ids: [ds] });
const ID = r.id;
const fitS = solids.filter((s) => s.material_id === ply);   // the blocks are the boxy parts the ray fit can read
const f1 = await fitToSolids(ID, fitS);
if (f1 && AX.some((a) => Math.abs(f1.drift[a]) > 0.05)) await call("move_elements", { ...D, element_ids: [ID], dx_mm: -f1.drift.x, dy_mm: -f1.drift.y, dz_mm: -f1.drift.z });
const f2 = await fitToSolids(ID, fitS);
await call("set_parameter", { ...D, element_id: ID, parameter_name: "Comments", value:
  "Hangers for the Ceiling Wood Frame CF-1 (user 12 Nov 2026): 10 no. M8 galvanised threaded rods from the structure above the existing ceiling +3.70 (drop-in anchor M8 in concrete or beam clamp on steel, length cut on site; never hang from the existing ceiling), through 12 holes in the rattan tray board hidden by the frame, onto an 18 ply hanger block 100 x 64 glued + screwed between the box sides at +3.145; nut + 24 washer under, lock nut + washer on top, all hidden inside the open-top box. 4 no. M8 sway braces at 45 along the members, alternating directions. Positions on the member centre lines: long sides x 2180/2940/3700/4460 at y 2040 and 3670, short sides y 2855. Shift up to 100 along the member to clear downlights GL-1..8. ~4 kg per hanger." });
console.log("CF-1 hangers", ID, solids.length, "solids; drift before", JSON.stringify(f1?.drift), "after", JSON.stringify(f2?.drift));
