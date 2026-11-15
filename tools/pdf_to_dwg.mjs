// Sheet PDF -> clean DWG at true paper size (mm): AutoCAD -PDFIMPORT (scale 25.4), every leftover LINE / ARC turned into a
// polyline (PEDIT), purge, save 2018. Text stays text. Result: lines=0 arcs=0 (rule: CAD export = polylines).
// Why (Madina 2, 15 Nov 2026): Revit's sheet DWG export came out EMPTY for the wall-section sheets A-1201..1204 (17 KB, ok=true),
// and clean_sheet_dwg.ps1 -Explode needs 10+ min per big sheet (25 timed out). The PDF route takes seconds per sheet.
// Dimensions arrive as polylines + text (not dimension objects); use the explode route when live dims are needed.
// Usage: node tools/pdf_to_dwg.mjs <out dir> <sheet.pdf> [...]   (writes <out dir>/<pdf name>.dwg, overwrites)
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { spawnSync } from "node:child_process";
const [outDir, ...pdfs] = process.argv.slice(2);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pdf2dwg-")).replace(/\\/g, "/");
const lsp = String.raw`(defun c:P2DCLEAN (/ s i e nl na np nt ty)
  (setq s (ssget "_X" '((0 . "ARC,LINE"))) i 0)
  (if s (repeat (sslength s) (if (entget (ssname s i)) (command "_.PEDIT" (ssname s i) "")) (setq i (1+ i))))
  (setq nl 0 na 0 np 0 nt 0 e (entnext))
  (while e (setq ty (cdr (assoc 0 (entget e)))) (cond ((= ty "LINE") (setq nl (1+ nl))) ((= ty "ARC") (setq na (1+ na))) ((wcmatch ty "*POLYLINE") (setq np (1+ np))) ((wcmatch ty "*TEXT") (setq nt (1+ nt)))) (setq e (entnext e)))
  (princ (strcat "\nP2DCOUNT lines=" (itoa nl) " arcs=" (itoa na) " polylines=" (itoa np) " text=" (itoa nt))) (princ))
`;
fs.writeFileSync(tmp + "/p2d.lsp", lsp);
for (const pdf of pdfs) {
  const name = path.basename(pdf, path.extname(pdf));
  fs.copyFileSync(pdf, tmp + "/in.pdf");                       // ASCII path for the console
  const scr = [`(setvar "CMDECHO" 0)(setvar "FILEDIA" 0)(setvar "INSUNITS" 4)(setvar "PEDITACCEPT" 1)(load "${tmp}/p2d.lsp")`,
    `_.-PDFIMPORT _F ${tmp}/in.pdf 1 0,0 25.4 0`, "P2DCLEAN", "_.-PURGE _A * _N", "_.-PURGE _R * _N", "_.ZOOM _E",
    `_.SAVEAS 2018 ${tmp}/out.dwg`, "_.QUIT _Y", ""].join("\r\n");
  fs.writeFileSync(tmp + "/p.scr", scr); fs.rmSync(tmp + "/out.dwg", { force: true });
  const r = spawnSync("C:/Program Files/Autodesk/AutoCAD 2026/accoreconsole.exe", ["/s", tmp + "/p.scr", "/l", "en-US"], { encoding: "utf16le", timeout: 900000 });
  const m = (r.stdout || "").replace(/\0/g, "").match(/^P2DCOUNT [^\r\n"]*/m);
  if (!fs.existsSync(tmp + "/out.dwg")) { console.log(name + ": FAILED"); continue; }
  fs.copyFileSync(tmp + "/out.dwg", path.join(outDir, name + ".dwg"));
  console.log(name + ": " + (m ? m[0].replace("P2DCOUNT ", "") : "?"));
}
