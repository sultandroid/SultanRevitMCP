// Closed CNC paths (true arcs, for tools/cnc_dxf.mjs) for the arch parts we make on every shopfit job:
//  - pointedRing: a two-centred pointed arch band (or rib) with straight legs down to the capital;
//  - roundRing: a semicircular ring (no legs);
//  - spandrelPanel: the flat panel above an arch, cut to a pointed or round curve, from the springing to a top line.
// Coordinates: u across (0 = arch axis), z up (project heights, mm). Outer boundary counter-clockwise.
// Two-centred rule (Makkah A-2101): each half is one arc whose centre sits e past the axis on the springing line, so the arc is
// tangent to its vertical leg. Inset k shrinks the band on every face that gets a bending-ply wrap (outer, inner, legs).
import { pt, arcV } from "./cnc_dxf.mjs";

const snap = (path) => path.map((v) => ({ ...v, x: Math.abs(v.x) < 1e-6 ? 0 : v.x }));

/** Pointed band: outer radius Ro, inner Ri, centres at +-e, springing zc, leg bottom zs (capital); inset k on curved and leg faces. */
export function pointedRing({ Ro, Ri, e, zc, zs, k = 0 }) {
  const ro = Ro - k, ri = Ri + k, uo = ro - e, ui = ri - e;            // leg faces: outer at +-uo, inner at +-ui
  const aO = Math.acos(e / ro), aI = Math.acos(e / ri);                // angle of the apex seen from the right-half centre (-e)
  return snap([
    pt(-uo, zs), pt(-ui, zs), pt(-ui, zc),
    arcV(e, zc, ri, Math.PI, Math.PI - aI),                            // inner left arc, springing -> apex (clockwise)
    arcV(-e, zc, ri, aI, 0),                                           // inner right arc, apex -> springing
    pt(ui, zc), pt(ui, zs), pt(uo, zs), pt(uo, zc),
    arcV(-e, zc, ro, 0, aO),                                           // outer right arc, springing -> apex (counter-clockwise)
    arcV(e, zc, ro, Math.PI - aO, Math.PI),                            // outer left arc, apex -> springing
    pt(-uo, zc),
  ]);
}

/** Semicircular ring: radii Ro / Ri about (0, zc), no legs; inset k on both curved faces. */
export function roundRing({ Ro, Ri, zc, k = 0 }) {
  const ro = Ro - k, ri = Ri + k;
  return [pt(-ro, zc), arcV(0, zc, ri, Math.PI, 0), pt(ri, zc), arcV(0, zc, ro, 0, Math.PI)].map((v, i) => (i === 1 ? { ...v, x: -ri, y: zc } : i === 3 ? { ...v, x: ro, y: zc } : v));
}

/** Spandrel panel from the springing zc to zTop, half width hw, cut to radius R. Pointed: centres at +-e. Round: e = 0. */
export function spandrelPanel({ hw, zc, zTop, R, e = 0 }) {
  const a = Math.acos(e / R), u = R - e, out = [];
  if (hw - u > 0.01) out.push(pt(-hw, zc));
  if (e === 0) out.push({ ...arcV(0, zc, R, Math.PI, 0), x: -R, y: zc });
  else out.push(arcV(e, zc, R, Math.PI, Math.PI - a), arcV(-e, zc, R, a, 0));
  if (hw - u > 0.01) out.push(pt(u, zc));
  out.push(pt(hw, hw - u > 0.01 ? zc : zc), pt(hw, zTop), pt(-hw, zTop));
  return snap(out.filter((v, i, s) => i === 0 || Math.hypot(v.x - s[i - 1].x, v.y - s[i - 1].y) > 0.01));
}
