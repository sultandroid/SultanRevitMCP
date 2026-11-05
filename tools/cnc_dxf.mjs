// Minimal CNC-clean DXF (AutoCAD R12 / AC1009): closed POLYLINEs with true arcs as bulges, circles for holes, text on its own layer.
// Units mm (INSUNITS 4). One part per file, drawn at 1:1 with the part's lower-left at 0,0.
// Path: [{ x, y, b }] vertices, b = bulge of the segment from this vertex to the next (0 = straight; tan(sweep/4), + = counter-clockwise).
import { writeFileSync } from "node:fs";

const n = (v) => (Math.abs(v) < 1e-9 ? 0 : Math.round(v * 10000) / 10000);
export class Dxf {
  constructor() { this.e = []; this.layers = new Map([["0", 7]]); }
  layer(name, color) { if (!this.layers.has(name)) this.layers.set(name, color); return name; }
  poly(path, layer, closed = true) {
    this.e.push(`0\nPOLYLINE\n8\n${layer}\n66\n1\n10\n0\n20\n0\n30\n0\n70\n${closed ? 1 : 0}`);
    for (const p of path) this.e.push(`0\nVERTEX\n8\n${layer}\n10\n${n(p.x)}\n20\n${n(p.y)}\n30\n0${p.b ? `\n42\n${n(p.b)}` : ""}`);
    this.e.push(`0\nSEQEND\n8\n${layer}`);
  }
  circle(x, y, r, layer) { this.e.push(`0\nCIRCLE\n8\n${layer}\n10\n${n(x)}\n20\n${n(y)}\n30\n0\n40\n${n(r)}`); }
  line(x0, y0, x1, y1, layer) { this.e.push(`0\nLINE\n8\n${layer}\n10\n${n(x0)}\n20\n${n(y0)}\n30\n0\n11\n${n(x1)}\n21\n${n(y1)}\n31\n0`); }
  text(x, y, h, s, layer) { this.e.push(`0\nTEXT\n8\n${layer}\n10\n${n(x)}\n20\n${n(y)}\n30\n0\n40\n${h}\n1\n${String(s).replace(/[^\x20-\x7E]/g, "?")}`); }
  save(file) {
    const lt = [...this.layers].map(([l, c]) => `0\nLAYER\n2\n${l}\n70\n0\n62\n${c}\n6\nCONTINUOUS`).join("\n");
    const out = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n9\n$MEASUREMENT\n70\n1\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${this.layers.size}\n${lt}\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${this.e.join("\n")}\n0\nENDSEC\n0\nEOF\n`;
    writeFileSync(file, out.replace(/\n/g, "\r\n"));
  }
}

// Path helpers. Arc from angle a0 to a1 (radians) about (cx, cy), radius r: returns the start vertex with its bulge.
export const arcV = (cx, cy, r, a0, a1) => ({ x: cx + r * Math.cos(a0), y: cy + r * Math.sin(a0), b: Math.tan((a1 - a0) / 4) });
export const pt = (x, y) => ({ x, y, b: 0 });
export const rectPath = (x0, y0, x1, y1) => [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)];
// Rounded rectangle, corner radius r, counter-clockwise.
export function roundRect(x0, y0, x1, y1, r) {
  const q = Math.PI / 2;
  // Each arc vertex is followed by its end point, which starts the next straight edge.
  return [arcV(x1 - r, y0 + r, r, -q, 0), pt(x1, y0 + r), arcV(x1 - r, y1 - r, r, 0, q), pt(x1 - r, y1), arcV(x0 + r, y1 - r, r, q, 2 * q), pt(x0, y1 - r), arcV(x0 + r, y0 + r, r, 2 * q, 3 * q), pt(x0 + r, y0)];
}
// Bounding box of a path's vertices (arcs bulge out at most by their sagitta; fine for a sheet frame).
export const bbox = (path) => path.reduce((b, p) => [Math.min(b[0], p.x), Math.min(b[1], p.y), Math.max(b[2], p.x), Math.max(b[3], p.y)], [Infinity, Infinity, -Infinity, -Infinity]);
// Area by the shoelace on vertices (sign = direction); used to force outer CCW, holes CW.
export const area = (path) => path.reduce((s, p, i) => { const q = path[(i + 1) % path.length]; return s + p.x * q.y - q.x * p.y; }, 0) / 2;
export const reverse = (path) => { const r = []; for (let i = path.length - 1; i >= 0; i--) { const nxt = path[(i - 1 + path.length) % path.length]; r.push({ x: path[i].x, y: path[i].y, b: -(nxt.b || 0) }); } return r; };
