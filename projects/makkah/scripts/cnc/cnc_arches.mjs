// Makkah store (KEC): CNC DXFs for the curved wood parts, one part per file, 1:1 mm, lower-left at 0,0, closed polylines with true
// arcs (factory CNC standard, joinery-practice.md "CNC files"). Geometry = the scripts that built the families (A-2101 set-out):
//   AR   side arches (6): two-centred, centres 60 past the axis, Ri 500 / Ro 620, springing +2.200, capital +2.050, band 101 deep.
//   AR-R rear arches (2): Ri 570 / Ro 690, springing +2.185, capital +2.035, band 105 deep.
//   AR-B1 gate ring (1): semicircle R 680 / 800 about +2.040, 80 deep.
//   SC-A / SC-B / SC-C spandrel panels: FR MDF 18, cut 20 inside the band (R 600 / 670 / 780), springing to +2.980 (20 shadow gap).
// Bands are built as FR MDF 18 ribs (front and back flush with the band faces, plus a middle rib where the band is deeper than 80),
// inset 5 on the curved and leg faces for a 5 mm bending-ply wrap, filled and painted (as the Madina 1 arch ribs).
// Usage: node projects/makkah/scripts/cnc/cnc_arches.mjs <out folder>
import { mkdirSync, writeFileSync } from "node:fs";
import { Dxf, area, reverse } from "../../../../tools/cnc_dxf.mjs";
import { pointedRing, roundRing, spandrelPanel } from "../../../../tools/cnc_arch_paths.mjs";
const OUT = process.argv[2]; if (!OUT) throw new Error("usage: cnc_arches.mjs <out folder>"); mkdirSync(OUT, { recursive: true });
// One folder per item, each with its own cut list (package standard, joinery-practice.md "Fabrication package folder").
const PLY = 5, ZTOP = 2980, ITEMS = { arch: "01 Arch Units (A-2102 to A-2104)", sc: "02 Spandrel Cladding (A-2107 to A-2109)" }, rows = { arch: [], sc: [] };

function savePart(item, name, mat, thk, qty, outline, note) {
  const dir = `${OUT}/${ITEMS[item]}`; mkdirSync(dir, { recursive: true });
  const d = new Dxf(), CUT = d.layer("CUT", 1); d.layer("HOLES", 3); d.layer("TEXT", 8);
  const x0 = Math.min(...outline.map((p) => p.x)), y0 = Math.min(...outline.map((p) => p.y));
  const ol = (area(outline) < 0 ? reverse(outline) : outline).map((p) => ({ ...p, x: p.x - x0, y: p.y - y0 }));
  d.poly(ol, CUT);
  // true size: sample every arc (a semicircle has all its vertices on the springing line)
  const sp = []; ol.forEach((a, i) => { const b = ol[(i + 1) % ol.length]; sp.push(a); if (!a.b) return;
    const th = 4 * Math.atan(a.b), ch = Math.hypot(b.x - a.x, b.y - a.y), r = ch / (2 * Math.sin(Math.abs(th) / 2)), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dd = r * Math.cos(Math.abs(th) / 2), nx = -(b.y - a.y) / ch, ny = (b.x - a.x) / ch, s = th > 0 ? 1 : -1, cx = mx + s * nx * dd, cy = my + s * ny * dd;
    const a0 = Math.atan2(a.y - cy, a.x - cx); for (let k = 1; k < 32; k++) { const g = a0 + (th * k) / 32; sp.push({ x: cx + r * Math.cos(g), y: cy + r * Math.sin(g) }); } });
  const w = Math.max(...sp.map((p) => p.x)) - Math.min(...sp.map((p) => p.x)), h = Math.max(...sp.map((p) => p.y)) - Math.min(...sp.map((p) => p.y));
  d.text(0, -40, 20, `${name} | ${mat} ${thk} mm | QTY ${qty} | ${Math.round(w)} x ${Math.round(h)}`, "TEXT");
  d.text(0, -70, 14, note, "TEXT");
  const file = `MAK-${name}.dxf`; d.save(`${dir}/${file}`);
  rows[item].push([file, name, mat, thk, qty, Math.round(w), Math.round(h), `"${note}"`].join(","));
  console.log(file, Math.round(w), "x", Math.round(h), "qty", qty);
}

// Arch band ribs
const AR = { Ro: 620, Ri: 500, e: 60, zc: 2200, zs: 2050 }, ARR = { Ro: 690, Ri: 570, e: 60, zc: 2185, zs: 2035 };
savePart("arch", "AR-BAND-RIB", "FR MDF", 18, 3 * 6, pointedRing({ ...AR, k: PLY }),
  "Band 120 x 101: 3 ribs per arch (front, middle, back), glue blocks between, 5 mm bending ply on the curves and legs, painted to U775 ST9 White Grey. Bottom edge = capital +2.050.");
savePart("arch", "AR-R-BAND-RIB", "FR MDF", 18, 3 * 2, pointedRing({ ...ARR, k: PLY }),
  "Band 120 x 105: 3 ribs per arch (front, middle, back), glue blocks between, 5 mm bending ply on the curves and legs, painted to U775 ST9 White Grey. Bottom edge = capital +2.035.");
savePart("arch", "AR-B1-RING-RIB", "FR MDF", 18, 2, roundRing({ Ro: 800, Ri: 680, zc: 2040, k: PLY }),
  "Gate ring 120 x 80: 2 ribs (front and back), glue blocks between, 5 mm bending ply on both curves, painted to U775 ST9 White Grey. Bottom edge = springing +2.040. Voussoir lines as A-2104.");
// Spandrel cladding panels
savePart("sc", "SC-A-PANEL", "FR MDF", 18, 6, spandrelPanel({ hw: 560, zc: 2200, zTop: ZTOP, R: 600, e: 60 }),
  "Behind the AR band, cut 20 inside the band (R 600, centres 60 past the axis). Bottom = springing +2.200, top +2.980. Painted to U775 ST9 White Grey.");
savePart("sc", "SC-B-PANEL", "FR MDF", 18, 2, spandrelPanel({ hw: 630, zc: 2185, zTop: ZTOP, R: 670, e: 60 }),
  "Behind the AR-R band, cut 20 inside the band (R 670, centres 60 past the axis). Bottom = springing +2.185, top +2.980. Painted to U775 ST9 White Grey.");
savePart("sc", "SC-C-PANEL", "FR MDF", 18, 1, spandrelPanel({ hw: 800, zc: 2040, zTop: ZTOP, R: 780 }),
  "Behind the gate ring, cut 20 inside the ring (R 780 about the springing +2.040), top +2.980. AR-B1 spandrel ornaments fix on it. Painted to U775 ST9 White Grey.");
for (const [k, r] of Object.entries(rows)) writeFileSync(`${OUT}/${ITEMS[k]}/_CUT-LIST.csv`, "file,part,material,thickness_mm,qty,width_mm,height_mm,note\n" + r.join("\n") + "\n");
