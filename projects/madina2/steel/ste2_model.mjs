// Madina 2 ST-E2 analytical wireframe (centrelines, mm, world), read from the family parts 11 Nov 2026.
// Front line x 5750, back line x 6338; ends y 776 / 4985; back joint posts y 2138 / 3454.
const XF = 5750, XB = 6338, Y0 = 776, Y1 = 4985, YJ = [2138, 3454];
const m = [];
const add = (id, a, b, sec = "SHS", note = "") => m.push({ id, a, b, sec, note });
// front posts and back posts (floor to top)
add("FP1", [XF, Y0, 0], [XF, Y0, 2900]); add("FP2", [XF, Y1, 0], [XF, Y1, 2900]);
for (const [i, y] of [Y0, ...YJ, Y1].entries()) add("BP" + (i + 1), [XB, y, 0], [XB, y, 2900]);
// front truss: top chord +2.900, bottom chord +2.800, 10 Warren diagonals, first one rising from the bottom chord
const nY = [793, 1193, 1590, 1987, 2384, 2780, 3177, 3574, 3971, 4368, 4768];
add("TC", [XF, Y0, 2900], [XF, Y1, 2900]); add("BC", [XF, Y0, 2800], [XF, Y1, 2800]);
for (let i = 0; i < 10; i++) { const up = i % 2 === 0; add("TD" + (i + 1), [XF, nY[i], up ? 2800 : 2900], [XF, nY[i + 1], up ? 2900 : 2800]); }
// end frames: top rail and diagonal (front bottom to back top)
add("ER1", [XF, Y0, 2900], [XB, Y0, 2900]); add("ER2", [XF, Y1, 2900], [XB, Y1, 2900]);
add("ED1", [XF, Y0, 70], [XB, Y0, 2870]); add("ED2", [XF, Y1, 70], [XB, Y1, 2870]);
// back frame rails +0.028 / +1.500 / +2.900 and the two back diagonals
for (const z of [28, 1500, 2900]) add("BR" + z, [XB, Y0, z], [XB, Y1, z]);
add("BD1", [XB, Y0, 60], [XB, YJ[0], 2870]); add("BD2", [XB, Y1, 60], [XB, YJ[1], 2870]);
// top plan braces
add("PB1", [XF, Y0, 2900], [XB, YJ[0], 2900]); add("PB2", [XF, Y1, 2900], [XB, YJ[1], 2900]);
// HG-E cross members at the arch joints, front top chord to back top rail (+2.900)
for (const [i, y] of YJ.entries()) add("HG" + (i + 1), [XF, y, 2900], [XB, y, 2900]);
// hung shelf plates (user, 12 Nov 2026): 2 hangers per joint from the HG-E cross member (+2.900) down the arch seam to the plate (+1.902)
if (!process.env.NOHANG) for (const [i, y] of YJ.entries()) for (const x of [5810, 6040]) add("HV" + (i + 1) + (x === 5810 ? "a" : "b"), [x, y, 2900], [x, y, 1902], "SHS", "hanger: SHS 40 above the arch top, flat 40x6 in the seam");
// shelf plates 116 x 10, cantilever from the back joint posts at +1.902 to x 5730
for (const [i, y] of YJ.entries()) add("SP" + (i + 1), [XB, y, 1902], [5730, y, 1902], "PL116x10", "flat, 10 thick, carries shelf ES-1");
// wider base (user, 11 Nov 2026: no anchors): floor outriggers forward from each back post line to x = WIDE, resting on the floor
const WIDE = Number(process.env.WIDE || 0);
if (WIDE) for (const [i, y] of [Y0, ...YJ, Y1].entries()) add("OR" + (i + 1), [XB, y, 0], [WIDE, y, 0], "RHS", "RHS 60x40x2.5 laid flat on the floor, not fixed");
export const members = m;
export const supports = [[XF, Y0], [XF, Y1], ...[Y0, ...YJ, Y1].map((y) => [XB, y]), ...(WIDE ? [Y0, ...YJ, Y1].map((y) => [WIDE, y]) : [])].map(([x, y]) => [x, y, 0]);
