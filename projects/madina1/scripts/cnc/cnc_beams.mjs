// Madina 1 oak ceiling beams C03 (tray grid, 50 wide x 100 deep, underside +3.17, hung from the tray soffit +3.27) and the 50 mm
// top fillers TF-*: CNC elevations of each beam with its half-lap notches, and cut lists. Beam positions from the model.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { Dxf, pt } from "../../../../tools/cnc_dxf.mjs";
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const V = [["CL-V1", 2100], ["CL-V2", 2250], ["CL-V3", 4480], ["CL-V4", 4630]], VY = [1890, 4090];   // x of each V beam (50 wide), runs in y
const H = [["CL-H1", 2190], ["CL-H2", 2340], ["CL-H3", 3590], ["CL-H4", 3740]], HX = [1800, 4980];   // y of each H beam, runs in x
const D = 100, Wd = 50, half = D / 2;
const rows = ["file,beam,qty,length_mm,section_mm,material,notches"];
// Elevation of one beam: length L along u, depth 0..100 (0 = underside). Notches 50 wide, 50 deep: from the top on V beams (they sit
// over the H beams' lower halves), from the bottom on H beams.
function beam(name, L, cuts, fromTop) {
  const p = [pt(0, 0)];
  const bottom = fromTop ? [] : cuts, top = fromTop ? cuts : [];
  for (const c of bottom) p.push(pt(c, 0), pt(c, half), pt(c + Wd, half), pt(c + Wd, 0));
  p.push(pt(L, 0), pt(L, D));
  for (const c of [...top].reverse()) p.push(pt(c + Wd, D), pt(c + Wd, D - half), pt(c, D - half), pt(c, D));
  p.push(pt(0, D));
  const d = new Dxf(); d.layer("CUT", 1); d.layer("TEXT", 8); d.poly(p, "CUT");
  d.text(0, -30, 16, `${name} | oak C03, 50 x 100 | L ${L} | half-laps 50x50 from the ${fromTop ? "top" : "bottom"} at ${cuts.map((c) => c).join(", ")} | elevation, underside at the bottom`, "TEXT");
  d.save(`${OUT}/BEAM-${name}.dxf`);
  rows.push([`BEAM-${name}.dxf`, name, 1, L, "50 x 100", "Oak C03 (confirm solid or veneered box)", `"${cuts.join(" / ")} from the ${fromTop ? "top" : "bottom"}"`].join(","));
}
for (const [n] of V) beam(n, VY[1] - VY[0], H.map(([, y]) => y - VY[0]), true);
for (const [n] of H) beam(n, HX[1] - HX[0], V.map(([, x]) => x - HX[0]), false);
writeFileSync(`${OUT}/_BEAMS-CUT-LIST.csv`, rows.join("\n") + "\nnote,,,,,,\"Beam slots 100 wide between the pairs carry the downlights DL1-4 and the emergency lights E1/E2 (90 x 300). Fix to the tray framing; tray soffit +3.27, beam underside +3.17.\"\n");
// Top fillers (from the model log): 50 mm high over each full-height panel, +3.000 to +3.050, 20 mm shadow gap to the ceiling.
const tf = JSON.parse(readFileSync(process.argv[3], "utf8"));
const sizes = JSON.parse(readFileSync(process.argv[4], "utf8"));
writeFileSync(`${OUT}/_TOP-FILLERS-CUT-LIST.csv`, "mark,over,height_mm,plan_size_mm,material,note\n" + tf.map(([id, mk, h]) => [mk, mk.replace(/^TF-/, ""), mk === "TF-PC-037" ? 55 : 50, sizes[id] ?? "", "Same finish as the panel below", "\"top +3.050, 20 mm shadow gap under the +3.070 ceiling; scribe on site\""].join(",")).join("\n") + "\n");
console.log("beams", V.length + H.length, "fillers", tf.length);
