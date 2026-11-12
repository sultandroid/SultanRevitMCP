// RULE (user, 12 Nov 2026): "different materials different colors - this is a rule in modelling". Every material in a model
// has its own shading colour; two materials never share one (or one so close the eye cannot tell them apart).
// The registry standards/material-colors.json keeps one colour per material name for every project, so a material keeps its
// colour from model to model. call("ensure_material") goes through distinctColor() (client/rvt.mjs); the add-in checks the
// colours already in the model as well (Handlers.cs EnsureMaterial).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "standards", "material-colors.json");
export const MIN_DIST = 24;
// Locked colours: a real EGGER board with its code (EGGER ... H/U/F/W1234) or a RAL code keeps the colour given: it is the
// approved colour. A material made "to match" a code, or painted to a code without RAL, is another material: it moves.
export const APPROVED = { test: (n) => !/\bmatch/i.test(n) && (/\bEGGER\b.*\b[HUFW]\d{3,4}\b/i.test(n) || /\bRAL ?\d{4}\b/i.test(n)) };

let reg = null;
function load() { if (!reg) { try { reg = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { reg = {}; } } return reg; }
function save() { try { fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(Object.entries(reg).sort()), null, 1) + "\n"); } catch { /* read-only checkout */ } }
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

/** A starting colour from the material name when the caller gives none. */
export function classColor(name) {
  const n = name.toLowerCase();
  if (/black/.test(n)) return [35, 35, 35];
  if (/stainless|steel|metal|alumin/.test(n)) return [160, 165, 170];
  if (/rattan/.test(n)) return [205, 175, 115];
  if (/oak|veneer|walnut|wood/.test(n)) return [190, 150, 100];
  if (/ply/.test(n)) return [214, 184, 140];
  if (/softwood|support|batten/.test(n)) return [222, 196, 150];
  if (/marble|travertine|stone|corian/.test(n)) return [225, 218, 200];
  if (/glass/.test(n)) return [180, 215, 225];
  if (/white/.test(n)) return [240, 240, 236];
  if (/grey|gray/.test(n)) return [180, 180, 178];
  if (/mdf/.test(n)) return [200, 175, 140];
  return [150, 150, 150];
}

// 26 directions (every -1/0/1 combination but 0,0,0), for the search below.
const DIRS = []; for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) { const l = Math.hypot(x, y, z); DIRS.push([x / l, y / l, z / l]); }
// lighter / darker first, then the directions nearest the grey axis: a material keeps its hue as far as possible
DIRS.sort((a, b) => Math.abs(b[0] + b[1] + b[2]) - Math.abs(a[0] + a[1] + a[2]));
/** The free colour nearest to c: rings of growing radius round c, every direction; a candidate pushed past 0..255 is
 *  dropped (clamping is what turned every clash white on 12 Nov 2026). null when nothing within 200 is free. */
export function nearestFree(c, ok) {
  if (ok(c)) return c;
  // every candidate within 160, cheapest first: cost = distance, x3 for a move off the grey axis (a hue / tint change)
  const cand = [];
  for (let r = 6; r <= 160; r += 3) for (const d of DIRS) {
    const q = d.map((v, i) => Math.round(c[i] + v * r));
    if (q.some((v) => v < 0 || v > 255)) continue;
    const off = 1 - Math.abs(d[0] + d[1] + d[2]) / Math.sqrt(3);
    cand.push([r * (1 + 2 * off), q]);
  }
  cand.sort((p, q) => p[0] - q[0]);
  for (const [, q] of cand) if (ok(q)) return q;
  return null;
}

/** Colour for material `name`: its registered colour, or `want` (or a class colour) moved until it clashes with no other
 *  registered material. `taken` adds colours known to be in use (e.g. read from the model). Registers the result. */
export function distinctColor(name, want, taken = []) {
  const R = load();
  if (APPROVED.test(name) && want) { R[name] = [want.r, want.g, want.b]; save(); return want; }
  const others = Object.entries(R).filter(([k]) => k !== name).map(([, v]) => v).concat(taken);
  const ok = (c) => others.every((o) => dist(o, c) >= MIN_DIST);
  if (R[name] && ok(R[name])) return { r: R[name][0], g: R[name][1], b: R[name][2] };
  const base = want ? [want.r, want.g, want.b] : classColor(name);
  const c = nearestFree(base, ok);
  if (!c) { console.log("materialColors: no free colour near", name, base.join(","), "- kept, check by hand"); return { r: base[0], g: base[1], b: base[2] }; }
  R[name] = c; save();
  return { r: c[0], g: c[1], b: c[2] };
}

/** Name pairs in the registry that break the rule (for a check run). */
export function clashes() {
  const e = Object.entries(load()), out = [];
  for (let i = 0; i < e.length; i++) for (let j = i + 1; j < e.length; j++) if (dist(e[i][1], e[j][1]) < MIN_DIST) out.push([e[i][0], e[j][0]]);
  return out;
}
