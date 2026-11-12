// Madina 2 East Steel Frame (ST-E2) + East Arch Hangers as built in Revit on 12 Nov 2026 (no changes): lean frame, sketch ties,
// flat hung shelf plates, L40 hanger angles, M10 adjustable rods, 40x6 flat bars. Centrelines, mm, world.
const XF = 5750, XB = 6338, Y0 = 776, Y1 = 4985, YJ = [2138, 3454];
const m = [], add = (id, a, b, sec = "SHS", note = "") => m.push({ id, a, b, sec, note });
add("FP1", [XF, Y0, 0], [XF, Y0, 2900]); add("FP2", [XF, Y1, 0], [XF, Y1, 2900]);
for (const [i, y] of [Y0, ...YJ, Y1].entries()) add("BP" + (i + 1), [XB, y, 0], [XB, y, 2900]);
const nY = [793, 1193, 1590, 1987, 2384, 2780, 3177, 3574, 3971, 4368, 4768];
add("TC", [XF, Y0, 2900], [XF, Y1, 2900]); add("BC", [XF, Y0, 2800], [XF, Y1, 2800]);
for (let i = 0; i < 10; i += 2) add("TD" + (i + 1), [XF, nY[i], 2800], [XF, nY[i + 1], 2900]);      // TD1, 3, 5, 7, 9 kept
add("ER1", [XF, Y0, 2900], [XB, Y0, 2900]); add("ER2", [XF, Y1, 2900], [XB, Y1, 2900]);
add("ED1", [XF, Y0, 70], [XB, Y0, 2870]); add("ED2", [XF, Y1, 70], [XB, Y1, 2870]);
add("EM1", [XF, Y0, 1500], [XB, Y0, 1500]); add("EM2", [XF, Y1, 1500], [XB, Y1, 1500]);             // sketch: end rails +1.500
add("EF1", [XF, Y0, 28], [XB, Y0, 28]); add("EF2", [XF, Y1, 28], [XB, Y1, 28]);                     // sketch: end floor rails
for (const z of [28, 1500, 2900]) add("BR" + z, [XB, Y0, z], [XB, Y1, z]);                           // back rails (floor rail re-added)
add("BD1", [XB, Y0, 60], [XB, YJ[0], 2870]);
for (const [i, y] of YJ.entries()) {
  add("HA" + (i + 1), [XF, y, 2900], [XB, y, 2900], "L40", "angle 40x40x4 hanger cross member");
  for (const x of [5810, 6040]) { const t = x === 5810 ? "a" : "b";
    add("HR" + (i + 1) + t, [x, y, 2900], [x, y, 2830], "ROD", "M10 adjustable rod");
    add("HF" + (i + 1) + t, [x, y, 2830], [x, y, 1902], "FB", "flat bar 40x6 in the arch seam"); }
  add("SP" + (i + 1), [XB, y, 1902], [5730, y, 1902], "PL116x10", "flat shelf plate");
}
export const members = m;
export const supports = [[XF, Y0], [XF, Y1], ...[Y0, ...YJ, Y1].map((y) => [XB, y])].map(([x, y]) => [x, y, 0]);
