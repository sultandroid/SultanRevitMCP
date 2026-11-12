// Madina 2: artificial plants on the walls, as the design (Rev-02 renders 1-3), shown as OUTLINE ONLY on the wall section
// sheets (user 12 Nov 2026: "as the design there is artificial plants on the elevation also we have to indicate it as outlines
// on the sheets also"). Not modelled, same as the ceiling flowers on A-2702.
//  - West + East walls: white-flower jasmine vines along the top of the arch cladding, pouring down at the arch joints.
//  - Rear wall: dried palm / pampas bunches over the arch joints and ends.
// Dashed line style "Outline Only - By Others" + one note per sheet; a revision cloud for the new revision on each sheet.
// Re-run after tools/wall_section_sheet.mjs rebuilds a wall sheet.
import { call as raw } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" }, call = (n, a = {}) => raw(n, { ...D, ...a });
const LS = "Outline Only - By Others", TT = 374611, TOP = 2980;
const REV = Number(process.argv[2]);   // revision id for the clouds (made by the caller)
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// u = position along the wall, P(u, z) = model point on the view plane
const walls = [
  { sheet: "West Wall Section", view: "S1201-Wall Section", P: (u, z) => ({ x: 900, y: u, z }), ends: [909, 4760], joints: [2123, 3546], kind: "vine", noteY: 250 },
  { sheet: "East Wall Section", view: "S1203-Wall Section", P: (u, z) => ({ x: 5700, y: u, z }), ends: [821, 4770], joints: [2138, 3453], kind: "vine", noteY: 235 },
  { sheet: "Rear Wall Section", view: "S1202-Wall Section", P: (u, z) => ({ x: u, y: 4900, z }), ends: [1061, 5581], joints: [2540, 4100], kind: "palm", noteY: 195 },
];
const views = (await call("list_views")).views, sheets = (await call("query_elements", { category: "OST_Sheets", limit: 500 })).elements;
for (const w of walls) {
  const v = views.find((x) => x.name === w.view)?.id, sh = sheets.find((s) => s.name === w.sheet)?.id;
  if (!v) { console.log("no view", w.view); continue; }
  const lines = [], seg = (pts) => pts.slice(0, -1).forEach((p, i) => lines.push({ start: p, end: pts[i + 1] }));
  if (w.kind === "vine") {
    // band from the cladding top down: +2.25 at the joints and ends, +2.60..2.75 over the crowns, ragged edge
    const [u0, u1] = w.ends, pts = [w.P(u0 - 60, TOP)];
    for (let u = u0 - 60; u <= u1 + 60; u += 70) {
      const dj = Math.min(...[...w.joints, u0, u1].map((j) => Math.abs(u - j)));
      const base = dj < 220 ? 2250 + dj * 0.9 : 2600;
      pts.push(w.P(u, Math.min(TOP - 60, base + rnd() * 140)));
    }
    pts.push(w.P(u1 + 60, TOP)); pts.push(w.P(u0 - 60, TOP));
    seg(pts);
  } else {
    // a fan-shaped bunch (ellipse 700 x 520) over each joint and end, top cut at the ceiling line
    for (const c of [w.ends[0], ...w.joints, w.ends[1]]) {
      const pts = [];
      for (let i = 0; i <= 24; i++) { const t = (2 * Math.PI * i) / 24, r = 1 + (rnd() - 0.5) * 0.25; pts.push(w.P(c + 350 * r * Math.cos(t), Math.min(TOP, 2740 + 260 * r * Math.sin(t)))); }
      pts[24] = pts[0]; seg(pts);
    }
  }
  if (!process.argv.includes("--notes-only")) await call("create_detail_lines", { view_id: v, line_style: LS, lines });
  const text = w.kind === "vine"
    ? "ARTIFICIAL JASMINE VINES (WHITE FLOWERS) BY THE FLORIST\nOUTLINE ONLY, NOT MODELLED - as design renders\nFR certified, hooked to the top of the arch cladding"
    : "DRIED PALM / PAMPAS BUNCHES BY THE FLORIST\nOUTLINE ONLY, NOT MODELLED - as design renders\nFR certified, fixed over the arch joints";
  // the note goes in the sheet notes column (x 815), in the free space under the finish swatches: inside the view it ran over
  // the item labels (12 Nov 2026)
  if (sh) await call("create_text_note", { view_id: sh, location: { x: 815, y: w.noteY, z: 0 }, text_type_id: TT, text: "PLANTS (dashed outline in the section):\n" + text });
  if (REV && sh && !process.argv.includes("--notes-only")) await call("create_revision_cloud", { view_id: sh, revision_id: REV, comments: "Artificial plants outline", points: [{ x: 1020, y: 190 }, { x: 1182, y: 190 }, { x: 1182, y: 240 }, { x: 1020, y: 240 }] }).catch((e) => console.log("cloud", e.message.slice(0, 80)));
  console.log(w.sheet, lines.length, "lines");
}
