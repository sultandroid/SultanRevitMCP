// Madina 2 centre ceiling: ONE steel frame carries everything (user 12 Nov 2026: "why we didnt make complete steel frame
// shs 40X2 mm and hang all the box frame and the middle wooden ceiling with rattan and the steel mesh that will hold the
// artificial plants"). Replaces the 10 separate M8 rod hangers + 4 braces (cf1_hangers.mjs, family deleted here).
//  - SHS 40x40x2 grid lying on the rattan board (+3.2125..+3.2525): ring on the CF-1 member centre lines (x 2180 / 4460,
//    y 2040 / 3670), 2 cross members x 2940 / 3700, 1 middle member y 2855 -> board supported at <= 815.
//  - Hangers: 10 M10 threaded rods only (user 12 Nov 2026), drop-in anchors in the slab soffit +3.70, down to angle cleats
//    welded to the inner face of the SHS ring, nut + washer each side (the site levels the grid on these nuts);
//    no diagonal bracing (user).
//  - CF-1 box frame: 10 flat bars 40x6 welded to the SHS, through slots in the rattan board, screwed inside the open-top
//    boxes to the inner side board through a 6 ply packer (user 12 Nov 2026: "the connection ... flat bar").
//  - Middle rattan ceiling board: screwed up into the SHS grid (self-drilling screws @ 300).
//  - Flower mesh: its 2 bars hang on 4 M8 bolts to the cross members (cf1_mesh.mjs).
// History: first built with SHS posts + M8 bolts into ply blocks, changed the same day.
// Family "Madina2 Ceiling Steel Frame CF-1", Generic Models, mark "Ceiling Steel Frame".
// ALL STEEL PAINTED BLACK (user 12 Nov 2026: "no steel galvanize or powder coated all painted steel black"): rods, nuts, cleats,
// flat bars, SHS, mesh and angles, one material "Steel Painted Black".
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" };
const FAM = "Madina2 Ceiling Steel Frame CF-1", MARK = "Ceiling Steel Frame";
const DIR = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Revit Files/Rfa";
const RFT = String.raw`C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Metric Generic Model.rft`;
const blk = (await call("ensure_material", { ...D, name: "Steel Painted Black", color: { r: 35, g: 35, b: 35 } })).id;
const galv = (await call("ensure_material", { ...D, name: "Steel Painted Black", color: { r: 35, g: 35, b: 35 } })).id;
const ply = (await call("ensure_material", { ...D, name: "Plywood 18", color: { r: 214, g: 184, b: 140 } })).id;
const up = { x: 0, y: 0, z: 1 };
const box = (x0, y0, z0, x1, y1, z1, m) => ({ profile: [{ x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x0, y: y1, z: z0 }], direction: up, length_mm: z1 - z0, material_id: m });
const poly = (cx, cy, z, r, n) => Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((2 * Math.PI * i) / n), y: cy + r * Math.sin((2 * Math.PI * i) / n), z }));
const cyl = (cx, cy, z0, r, h, m, n = 8) => ({ profile: poly(cx, cy, z0, r, n), direction: up, length_mm: h, material_id: m });
const Z0 = 3212.5, Z1 = Z0 + 40, SLAB = 3700, h = 20;
const S = [];
// ring + cross + middle members (solid 40x40 in the model, SHS 40x40x2 in the note)
S.push(box(2160, 2020, Z0, 4480, 2060, Z1, blk), box(2160, 3650, Z0, 4480, 3690, Z1, blk));          // south / north, full length
S.push(box(2160, 2060, Z0, 2200, 3650, Z1, blk), box(4440, 2060, Z0, 4480, 3650, Z1, blk));          // west / east between
for (const x of [2940, 3700]) S.push(box(x - h, 2060, Z0, x + h, 3650, Z1, blk));                     // cross members
for (const [a, b] of [[2200, 2920], [2960, 3680], [3720, 4440]]) S.push(box(a, 2835, Z0, b, 2875, Z1, blk));   // middle member
// hangers = M10 threaded rods only (user 12 Nov 2026: "the hangger should be thired rods only"): drop-in anchor in the slab,
// rod down to an angle cleat 40x40x4 x 50 welded to the inner side of the SHS ring, nut + washer above and below the cleat.
// [x, y, inward unit vector] on the ring centre lines
const RODS = [[2560, 2040, 0, 1], [3320, 2040, 0, 1], [4080, 2040, 0, 1], [2560, 3670, 0, -1], [3320, 3670, 0, -1], [4080, 3670, 0, -1],
  [2180, 2450, 1, 0], [2180, 3260, 1, 0], [4460, 2450, -1, 0], [4460, 3260, -1, 0]];
const rodAt = [];
for (const [x, y, ix, iy] of RODS) {
  const rx = x + ix * 40, ry = y + iy * 40;                                   // rod 20 clear of the SHS face
  const a = { x: x + ix * 20, y: y + iy * 20 }, b = { x: x + ix * 60, y: y + iy * 60 };
  const [cx0, cx1] = ix ? [Math.min(a.x, b.x), Math.max(a.x, b.x)] : [x - 25, x + 25];
  const [cy0, cy1] = iy ? [Math.min(a.y, b.y), Math.max(a.y, b.y)] : [y - 25, y + 25];
  S.push(box(cx0, cy0, Z1 - 4, cx1, cy1, Z1, blk));                                                   // cleat horizontal leg at the SHS top
  S.push(box(ix ? Math.min(a.x, a.x + ix * 4) : cx0, iy ? Math.min(a.y, a.y + iy * 4) : cy0, Z0, ix ? Math.max(a.x, a.x + ix * 4) : cx1, iy ? Math.max(a.y, a.y + iy * 4) : cy1, Z1, blk));   // vertical leg welded to the SHS
  S.push(cyl(rx, ry, Z1 - 4 - 10.5, 5, SLAB - (Z1 - 14.5), galv));                                     // M10 rod to the slab
  S.push(cyl(rx, ry, Z1 - 4 - 10.5, 9.5, 8, galv, 6), cyl(rx, ry, Z1 - 4 - 2.5, 10, 2.5, galv));      // nut + washer under the cleat
  S.push(cyl(rx, ry, Z1, 10, 2.5, galv), cyl(rx, ry, Z1 + 2.5, 9.5, 8, galv, 6));                      // washer + nut on top
  rodAt.push({ x: rx, y: ry, ix, iy });
}
// No sway bracing (user 12 Nov 2026: "there is diagonal hanger no need"): rods ~440 short, the grid is boxed in by the C02 tray.
// CF-1 bolts: ply block in the box, M8 through the board and the SHS
const XS = [2180, 2940, 3700, 4460], pts = [...[2040, 3670].flatMap((y) => XS.map((x) => ({ x, y, ax: "x" }))), ...[2180, 4460].map((x) => ({ x, y: 2855, ax: "y" }))];
// CF-1 connection = FLAT BAR (user 12 Nov 2026: "the connection between the frame and the box frame flat bar"):
// flat bar 40x6 welded to the inner face of the SHS, down through a 45x10 slot in the rattan board into the open-top box,
// screwed with 2 no. 4.8x30 pan screws through a 6 ply packer (100 x 75, glued) into the box's inner side board. Hidden.
const BOT = 3125;                                       // 7 above the soffit board (3118)
for (const p of pts) {
  const inward = p.ax === "x" ? (p.y < 2855 ? 1 : -1) : (p.x < 3320 ? 1 : -1);   // toward the inner side board (opening)
  const off = (a, b) => [Math.min(a, b), Math.max(a, b)];
  const [b0, b1] = off(20 * inward, 26 * inward), [k0, k1] = off(26 * inward, 32 * inward);
  // FIXING ONLY (user 12 Nov 2026: "if you make balancing system for the frame no need for the box just flatbar to fix
  // only"): the grid is levelled on the M10 rod nuts, so the box needs no adjustment of its own. (A slotted M6 version was
  // built and dropped the same day.) Plain flat bar 40x6, 2 no. 4.8x30 pan screws through the 6 ply packer into the board.
  const along = (u0, u1, w0, w1, z0, z1, m) => p.ax === "x" ? box(p.x + u0, p.y + w0, z0, p.x + u1, p.y + w1, z1, m) : box(p.x + w0, p.y + u0, z0, p.x + w1, p.y + u1, z1, m);
  S.push(along(-20, 20, b0, b1, BOT, Z1, blk));                                       // flat bar 40x6
  S.push(along(-50, 50, k0, k1, BOT, 3200, ply));                                     // 6 ply packer on the inner side board
}
const lv = (await call("list_levels", D)).levels.reduce((a, l) => (Math.abs(l.elevation_mm) < Math.abs(a.elevation_mm) ? l : a)).id;
// remove the separate rod hangers
const old = []; for (const mk of ["Ceiling Frame Hangers", "Ceiling Steel Frame"]) old.push(...(await call("query_elements", { ...D, parameter_name: "Mark", parameter_value: mk })).elements.filter((e) => /Hangers|Steel Frame/.test(e.name)).map((e) => e.id));
if (old.length) await call("delete_elements", { ...D, element_ids: old });
const ds = (await call("create_direct_shape", { ...D, category: "OST_GenericModel", name: FAM, solids: S })).id;
const r = await call("make_unit_family", { ...D, template_path: RFT, family_name: FAM, save_dir: DIR, level_id: lv, mark: MARK, element_ids: [ds] });
await call("set_parameter", { ...D, element_id: r.id, parameter_name: "Comments", value:
  "One steel frame carries the centre ceiling (user 12 Nov 2026): SHS 40x40x2 grid, painted black, lying on the rattan board +3.2125..+3.2525: ring on the Ceiling Wood Frame centre lines 2320 x 1670, 2 cross members x 2940 / 3700, middle member y 2855, all welded. HANGERS: threaded rods only: 10 M10 rods from drop-in anchors in the slab soffit +3.70 to angle cleats 40x40x4 x 50 welded to the inner face of the ring, nut + washer above and below (level the grid on the nuts); no diagonal bracing. BOX FRAME: 10 flat bars 40x6 welded to the SHS, through 45x10 slots in the rattan board, fixed with 2 no. 4.8x30 pan screws through a 6 ply packer into the box inner side board, hidden inside the open-top box (levelling is on the M10 rod nuts only). Middle rattan board screwed up into the grid @ 300. Flower mesh bars on 4 M8 rods to the cross members. ~115 kg on 10 rods. Shift flat bars <=100 to clear downlights GL-1..8." });
console.log("steel frame", r.id, S.length, "solids; removed hangers", old);
