// Arabic in Revit text notes. Revit shapes Arabic letters but lays every line out left to right: each Arabic run reads
// correctly, but runs mixed with numbers or Latin words come out in the wrong order ("MDF 18", "30 x 50" jump around).
// arLine() puts the runs of one line in visual order (right to left), so the left-to-right layout prints it correctly.
// Use one line per call; wrap first. Found on the Endura side table sheets (12 Nov 2026): the direction marks
// U+202B, U+200F and U+2067 are ignored by Revit.
const LETTER = /[ء-يٱ-ۓ]/;

/** One Arabic line, ready for a Revit text note. */
export function arLine(s) {
  // Rule (user, 12 Nov 2026): the Arabic line translates the words only; sizes and numbers stay in the English line.
  if (/[0-9\u0660-\u0669]/.test(s)) throw new Error("Arabic line has a number (sizes stay in the English line): " + s);
  const toks = [];
  for (const w of s.trim().split(/\s+/)) {
    if (LETTER.test(w)) { toks.push(["ar", w]); continue; }
    // A number or Latin word: punctuation after it (، . : ؛) is its own run, drawn to its left.
    const m = /^(.*?)([،.:؛]+)$/.exec(w);
    if (m && m[1]) { toks.push(["lt", m[1]]); toks.push(["p", m[2]]); } else toks.push(["lt", w]);
  }
  const runs = [];
  for (const [k, w] of toks) { const r = runs[runs.length - 1]; if (r && r.k === k && k !== "p") r.w.push(w); else runs.push({ k, w: [w] }); }
  // Revit runs the Unicode bidi algorithm with a left-to-right base: numbers next to Arabic join the Arabic run. An invisible
  // left-to-right mark (U+200E) between the runs keeps each run on its own, so the runs print in the order given here.
  const LRM = "‎";
  // A punctuation run sits tight against the word it follows (on that word's left), with a space on its other side.
  const vis = runs.reverse();
  return vis.map((r, i) => r.w.join(" ") + (i < vis.length - 1 ? (r.k === "p" ? LRM : LRM + " " + LRM) : "")).join("");
}

/** Several lines (array or "\n" text): each one through arLine. */
export const arText = (t) => (Array.isArray(t) ? t : t.split("\n")).map(arLine).join("\n");
