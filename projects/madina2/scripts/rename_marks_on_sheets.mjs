// Madina 2 (user, 12 Nov 2026: "mark names should refer to the item name", "rename all"): every text note in every view
// gets the old unit codes replaced by the new item names from marks_map.json, whole codes only (not inside longer codes or words).
// node rename_marks_on_sheets.mjs [--apply]
import { call } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs";
import fs from "node:fs";
const D = { document: "Madina2_ARCH_01" }, APPLY = process.argv.includes("--apply");
const raw = JSON.parse(fs.readFileSync("C:/Users/user/samaya-revit-standards/projects/madina2/marks_map.json", "utf8"));
const map = Object.entries(raw.map ?? raw).sort((a, b) => b[0].length - a[0].length);
const esc = (s) => [...s].map((c) => (".-".includes(c) ? String.fromCharCode(92) + c : c)).join("");
const re = new RegExp(`(?<![A-Za-z0-9-])(${map.map(([k]) => esc(k)).join("|")})(?![A-Za-z0-9-]|-[A-Z])`, "g");
const M = Object.fromEntries(map);
const views = (await call("list_views", D)).views;
let n = 0; const hits = {};
for (const v of views) {
  let a; try { a = await call("list_view_annotations", { ...D, view_id: v.id }); } catch { continue; }
  const pairs = [];
  for (const it of a.items.filter((i) => i.kind === "text" && i.text)) {
    const nt = it.text.replace(re, (m) => { hits[m] = (hits[m] ?? 0) + 1; return M[m]; });
    if (nt !== it.text) pairs.push({ find: it.text, replace: nt });
  }
  if (!pairs.length) continue;
  n += pairs.length;
  console.log(`${v.name}: ${pairs.length}`);
  if (APPLY) await call("replace_text", { ...D, view_id: v.id, pairs });
}
console.log("notes", n, "codes", JSON.stringify(hits));
