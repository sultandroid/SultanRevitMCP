// The Samaya Factory title block layout (ISO 5457 frame, A1 layout scaled to each ISO 216 size) as a function,
// so the same standard can carry another factory's brand (logo, owner name, footer line).
// Used by tools/samaya_template.mjs (Samaya Factory) and tools/brand_title_blocks.mjs (client factories).
import { S } from "./standards.mjs";

export const SIZES = [["A0", 1189, 841, 160], ["A1", 841, 594, 140], ["A2", 594, 420, 120], ["A3", 420, 297, 100]];
const BLACK = { r: 0, g: 0, b: 0 }, NL = String.fromCharCode(10);
const P = (x, y) => ({ x, y, z: 0 });

// NOTES panel, on every sheet: the factory's short fabrication notes and the standards applied, from sultan-standards.json.
function notesPanel(X, top, bottom) {
  const N = S.sheet_notes, lines = [[N.fabrication_heading, true], ...N.fabrication.map((t) => [t, false]), ["", false], [N.standards_heading, true], ...N.standards.map((t) => [t, false])];
  const step = Math.min(N.size_mm * 1.6, (top - bottom - 4) / (lines.length + 0.5)), size = Math.max(1.8, Math.min(N.size_mm, step / 1.45));
  return lines.map(([text, bold], i) => text && { text, at: P(X, top - 5 - i * step), size_mm: Math.round(size * 10) / 10, color: BLACK, bold }).filter(Boolean);
}

// brand: { owner: "Samaya Factory", footer: "samaya-factory.com", logo: <png path>, logo_width_mm: 130 (on A0) }
export function spec({ name, SW, SH, SWID, source_rfa, save_path, brand }) {
  const R = SW - 10, L = R - SWID, X = L + 5 * (SWID / 160), M = (L + R) / 2, W = 20, T = SH - 10, B = 10;
  const ky = (T - B) / 821, kx = SWID / 160, y = (v) => B + (v - 10) * ky, x = (v) => L + (v - 1022) * kx;
  const f = Math.min(1, Math.max(0.55, ky * 1.3)), size = (s) => Math.round(Math.max(2.6, s * f) * 10) / 10;
  const zone = SH >= 841 ? 100 : 50, COLS = Math.max(2, Math.round((R - W) / zone)), ROWS_Z = Math.max(2, Math.round((T - B) / zone));
  const zw = (R - W) / COLS, zh = (T - B) / ROWS_Z;
  const line = (x1, y1, x2, y2) => ({ start: P(x1, y1), end: P(x2, y2) });
  const head = (text, xx, yy) => ({ text, at: P(xx, yy), size_mm: 2.5, color: BLACK, bold: true });
  const ROWS = [741, 691, 641, 591, 471, 371, 281, 241, 186, 146, 116, 86, 56, 24].map(y);
  const used = new Set(["2.5b", "2n", "3b"]);
  const lab = (match, xx, yy, s, bold = false) => { let z = size(s); while (used.has(z + (bold ? "b" : "n"))) z = Math.round((z + 0.1) * 10) / 10; used.add(z + (bold ? "b" : "n")); return { match, at: P(xx, yy), size_mm: z, color: BLACK, bold }; };
  const owner = brand.owner;
  return {
    source_rfa, save_path, sheet_size_mm: { w: SW, h: SH },
    lines: [
      line(W, B, R, B), line(R, B, R, T), line(R, T, W, T), line(W, T, W, B), line(L, B, L, T),
      ...ROWS.map((yy) => line(L, yy, R, yy)), line(M, y(56), M, y(146)),
      line(SW / 2, T, SW / 2, SH), line(SW / 2, 0, SW / 2, B), line(0, SH / 2, W, SH / 2), line(R, SH / 2, SW, SH / 2),
      ...Array.from({ length: COLS + 1 }, (_, k) => line(W + k * zw, T, W + k * zw, T + 5)), ...Array.from({ length: COLS + 1 }, (_, k) => line(W + k * zw, B, W + k * zw, B - 5)),
      ...Array.from({ length: ROWS_Z + 1 }, (_, k) => line(W, B + k * zh, W - 5, B + k * zh)), ...Array.from({ length: ROWS_Z + 1 }, (_, k) => line(R, B + k * zh, R + 5, B + k * zh)),
    ],
    images: [{ path: brand.logo, center: P(M, y(786)), width_mm: Math.round((brand.logo_width_mm ?? 130) * kx) }],
    texts: [
      head("CLIENT", X, y(737)), head("CONSULTANT", X, y(687)), head("DESIGNER", X, y(637)), head("NOTES", X, y(587)), head("KEY PLAN", X, y(467)), head("REVISIONS", X, y(367)),
      ...Array.from({ length: COLS }, (_, k) => ({ text: String(k + 1), at: P(W + k * zw + zw / 2 - 2, T + 7), size_mm: 2.5, color: BLACK })),
      ...Array.from({ length: COLS }, (_, k) => ({ text: String(k + 1), at: P(W + k * zw + zw / 2 - 2, 7), size_mm: 2.5, color: BLACK })),
      ...Array.from({ length: ROWS_Z }, (_, k) => ({ text: String.fromCharCode(65 + ROWS_Z - 1 - k), at: P(W - 8, B + k * zh + zh / 2 + 2), size_mm: 2.5, color: BLACK })),
      ...Array.from({ length: ROWS_Z }, (_, k) => ({ text: String.fromCharCode(65 + ROWS_Z - 1 - k), at: P(R + 3, B + k * zh + zh / 2 + 2), size_mm: 2.5, color: BLACK })),
      ...notesPanel(X, y(587), y(475)),
      head("PROJECT", X, y(277)), head("DRAWING TITLE", X, y(237)), head("DRAWING NO.", X, y(182)), head("REV", x(1154), y(182)),
      head("SCALE", X, y(142)), head("DATE", M + 5 * kx, y(142)), head("DRAWN BY", X, y(112)), head("CHECKED BY", M + 5 * kx, y(112)), head("APPROVED BY", X, y(82)), head("PROJECT NO.", M + 5 * kx, y(82)),
      { text: SWID >= 160 ? `This drawing is the property of ${owner}. Do not scale. Check all dimensions on site before fabrication.` : `Property of ${owner}. Do not scale.` + NL + "Check all dimensions on site.", at: P(X, y(51)), size_mm: 2, color: BLACK },
      // Footer: sized and centred in its own row (a text box is about 1.4 x its size; at = top of the box), so it never touches the border on A3 (cell is under 5 mm there).
      (() => { const cell = y(24) - B, fs = Math.round(Math.min(3, cell * 0.42) * 10) / 10; return { text: brand.footer, at: P(X, B + cell / 2 + fs * 0.7), size_mm: fs, color: BLACK, bold: true }; })(),
    ],
    labels: [
      lab("Client Name", X, y(722), 3.5), lab("Project Name", X, y(265), 3.5, true), lab("Sheet Name", X, y(225), 4, true), lab("A101", X, y(172), 7, true),
      lab("Current Revision", x(1154), y(172), 5, true), lab('1/8" = 1\'-0"', X, y(132), 3), lab("Project Issue Date", M + 5 * kx, y(132), 3.1),
      lab("DSG", X, y(102), 3.2), lab("CHK", M + 5 * kx, y(102), 3.3), lab("APR", X, y(72), 3.4), lab("Project Number", M + 5 * kx, y(72), 3.6),
    ],
    // Revision schedule starts 4 mm under the REVISIONS heading (on A3 the scaled offset alone put it on the heading).
    revSchedule: (() => { const rev = Math.max(12, Math.round(16 * kx)), date = Math.max(24, Math.round(38 * kx)); return { location: P(L + 1, Math.min(y(362), y(367) - 4)), fields: [{ name: "Revision Number", heading: "REV", width_mm: rev }, { name: "Revision Description", heading: "DESCRIPTION", width_mm: SWID - 2 - rev - date }, { name: "Revision Date", heading: "DATE", width_mm: date }] }; })(),
  };
}
