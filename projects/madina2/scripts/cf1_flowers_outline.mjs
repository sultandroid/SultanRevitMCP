// Madina 2 A-2702: the artificial bougainvillea is NOT modelled (user 12 Nov 2026: "dont model the artificial plant we can
// refer to it in the sheet only with outline annotation only"). Dashed outline (line style "Outline Only - By Others") under
// the flower mesh down to the lowest tip +2.40, in Section A / Section B / Location Section, plus one note. Re-run after
// fab_sheet.mjs CF-1 (it rebuilds the views).
import { call as raw } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
const D = { document: "Madina2_ARCH_01" }, call = (n, a = {}) => raw(n, { ...D, ...a });
const views = (await call("list_views")).views;
const V = (re) => views.find((v) => re.test(v.name))?.id;
const LS = "Outline Only - By Others", TT = 374611;   // Sheet Note 5
const TOP = 3132, LOW = 2400;
// scalloped bottom: heavier cascade near the frame (render), every 110 mm, never below +2.40
function outline(u0, u1, P) {
  const pts = [P(u0, TOP)]; let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let u = u0; u <= u1; u += 110) {
    const e = Math.min(u - u0, u1 - u) < 350;
    pts.push(P(Math.min(u, u1), Math.max(LOW, (e ? 2450 : 2650) + rnd() * (e ? 200 : 250))));
  }
  pts.push(P(u1, TOP));
  return pts.slice(0, -1).map((s, i) => ({ start: s, end: pts[i + 1] }));
}
const X = (u, z) => ({ x: u, y: 2855, z }), Y = (u, z) => ({ x: 3320, y: u, z });
const jobs = [[V(/^J2702-Section A$/), outline(2250, 4390, X), X(2300, 2300)], [V(/^J2702-Section B$/), outline(2110, 3600, Y), null],
  [V(/^J2702-Location Section$/), outline(2110, 3600, Y), null]];
for (const [v, lines, at] of jobs) {
  if (!v) continue;
  await call("extend_view_crop", { view_id: v, bottom_mm: 850 }).catch((e) => console.log("crop", e.message.slice(0, 80)));
  await call("create_detail_lines", { view_id: v, line_style: LS, lines });
  if (at) await call("create_text_note", { view_id: v, location: at, text_type_id: TT, text: "ARTIFICIAL BOUGAINVILLEA BY THE FLORIST\nOUTLINE ONLY, NOT MODELLED\nFR certified, cable-tied to the flower mesh\nlowest tip +2.400" });
}
console.log("outline drawn in", jobs.filter((j) => j[0]).length, "views");
