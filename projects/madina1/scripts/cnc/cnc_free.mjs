// Madina 1 free-standing units: island display D-02 (rounded parts, CNC) and reception counter D-01 (3 mm black pegboard, laser).
// Sizes from the model families (Madina Island Display D-02, Madina Reception Counter D-01) and the A-2401 / A-2402 keynotes.
import { mkdirSync, writeFileSync } from "node:fs";
import { Dxf, roundRect, rectPath } from "../../../../tools/cnc_dxf.mjs";
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const rows = [];
function part(file, name, mat, thk, qty, path, extra = () => {}, note = "") {
  const d = new Dxf(); d.layer("CUT", 1); d.layer("HOLES", 3); d.layer("TEXT", 8);
  d.poly(path, "CUT"); extra(d);
  const w = Math.max(...path.map((p) => p.x)), h = Math.max(...path.map((p) => p.y));
  d.text(0, -40, 20, `${name} | ${mat} ${thk} mm | QTY ${qty} | ${Math.round(w)} x ${Math.round(h)}`, "TEXT"); if (note) d.text(0, -70, 14, note, "TEXT");
  d.save(`${OUT}/${file}.dxf`); rows.push([`${file}.dxf`, name, mat, thk, qty, Math.round(w), Math.round(h), `"${note}"`].join(","));
}
const OAK = "EGGER H1113 Brown Kansas Oak";
// Island D-02, 1800 x 1000 x 955. Each 44 mm slab = 18 + 8 (set in 20, recess) + 18; 2 mm ABS on the 18 mm edges.
part("D02-TOP-18", "Island top, outer layers", OAK, 18, 2, roundRect(0, 0, 1800, 1000, 200), () => {}, "Top 44: two 18 mm layers R200 with an 8 mm layer set in 20. ABS 2 on the edges: check bending on R200.");
part("D02-TOP-8-RECESS", "Island top, recessed middle layer", OAK, 8, 1, roundRect(0, 0, 1760, 960, 180), () => {}, "Centred, 20 mm in from the 18 mm layers.");
part("D02-TOP-SUPPORT", "Island top support", OAK, 18, 1, roundRect(0, 0, 1740, 940, 180), () => {}, "Under the top, 30 in from its edge.");
part("D02-SHELF-18", "Island middle shelf, outer layers", OAK, 18, 2, roundRect(0, 0, 1600, 800, 160));
part("D02-SHELF-8-RECESS", "Island middle shelf, recessed layer", OAK, 8, 1, roundRect(0, 0, 1560, 760, 140));
part("D02-BASE-18", "Island base, outer layers", OAK, 18, 2, roundRect(0, 0, 1800, 1000, 200));
part("D02-BASE-8-RECESS", "Island base, recessed layer", OAK, 8, 1, roundRect(0, 0, 1760, 960, 180));
part("D02-PLINTH-OUTLINE", "Island plinth (set-out, softwood ring)", "Softwood, painted black", 50, 1, roundRect(0, 0, 1700, 900, 150), () => {}, "Plinth line 50 in from the base. Build as a ring of softwood, 50 high.");
part("D02-COLUMN-PLAN", "Island column, plan section", OAK, 336, 2, roundRect(0, 0, 1150, 150, 40), () => {}, "Plan shape of each column (lower and upper), 336 / 364 high. Build from 18 mm boards on a frame; R40 ends.");
part("D02-GOLD-RAIL-CENTRELINE", "Gold rail, tube centreline", "Gold tube 20 mm, galvanised", 20, 1, roundRect(0, 0, 1660, 860, 130), () => {}, "Bend the 20 mm tube to this centreline (R130 at the corners), 4 posts 10x10 at the corners.");
// Counter D-01: black metal pegboard, 3 mm flat steel, Ø5 holes at 25 pitch, 50 mm solid border.
const peg = (w, h) => (d) => { for (let x = 50 + 12.5; x <= w - 50 - 12.5 + 0.01; x += 25) for (let y = 50 + 12.5; y <= h - 50 - 12.5 + 0.01; y += 25) d.circle(x, y, 2.5, "HOLES"); };
part("D01-PEGBOARD-FRONT", "Counter pegboard, front", "Steel 3 mm, painted black", 3, 1, rectPath(0, 0, 1720, 750), peg(1720, 750), "Holes Ø5 at 25, 50 mm solid border. Fixed in the softwood frame.");
part("D01-PEGBOARD-SIDE", "Counter pegboard, side", "Steel 3 mm, painted black", 3, 2, rectPath(0, 0, 440, 750), peg(440, 750), "Left and right, same plate.");
writeFileSync(`${OUT}/_CUT-LIST.csv`, "file,part,material,thickness_mm,qty,width_mm,height_mm,note\n" + rows.join("\n") + "\n");
console.log(rows.length, "parts");
