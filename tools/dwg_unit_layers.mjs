// Put every unit of a Revit 3D DWG export on its own AutoCAD layer, named after the unit Mark (user 14 Nov 2026,
// Madina 2 manufacturing export: "we need unit layer autocad, please use clean lines, make the file lighter").
// Revit exports each family instance as a block INSERT named "<Family> - <Type>-<typeId>-<view name>". This script:
//  - matches each INSERT to the nearest instance of that type (units json: [{id, t: typeId, p: {x,y,z}, mk}]);
//    mirrored / rotated copies come out as a block with another id: those fall back to the nearest unit of any type
//  - puts the INSERT on a layer = the Mark (own colour), and every entity inside every block on layer 0, colour ByLayer,
//    so the whole unit follows its layer (no explode: blocks stay light and each unit stays one object to pick)
//  - deletes loose non-solid entities in model space, purges everything (incl. regapps), audits, saves
// LESSON (Madina 2, 14 Nov 2026): Revit exports instances CUT by voids (and some arch units) as LOOSE 3DSOLIDs on the
// category layer, not as blocks (4 units, 46 solids there). Find them (loose 3DSOLIDs left in model space), export each such
// instance alone from Revit (duplicate the 3D view, isolate_in_view, export_view_dwg solids:"acis": same origin), delete the
// loose solids and -INSERT each file at 0,0,0 as a block named after the unit, put it on its layer, contents on layer 0.
// Usage: node tools/dwg_unit_layers.mjs <dwg> <units.json>   (AutoCAD 2026 accoreconsole; back up the DWG first)
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { spawnSync } from "node:child_process";
// --by-type (default, user 14 Nov 2026: "items same family same size should be in the same layer, the unit with its
// including"): one layer per Revit type, named from the block name (prefix like "Madina2 " dropped with --prefix);
// --by-mark: one layer per instance Mark (needs units.json).
const args = process.argv.slice(2), flag = (f) => args.includes(f), val = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
// --groups <json>: {prefix, groups: [[wcmatch pattern, layer name], ...]} puts a unit and its parts (arch + back panel,
// fascia marble + soffit, ...) on one layer; first match wins.
const G = val("--groups") ? JSON.parse(fs.readFileSync(val("--groups"), "utf8")) : {};
const byType = !flag("--by-mark"), prefix = val("--prefix") ?? G.prefix ?? "", groups = G.groups ?? [];
const [dwg, unitsFile] = args.filter((a, i) => !a.startsWith("--") && !["--prefix", "--groups"].includes(args[i - 1]));
const U = unitsFile ? JSON.parse(fs.readFileSync(unitsFile, "utf8")).filter((u) => u.p) : [];
const san = (s) => s.replace(/[<>\/\\":;?*|=,`]/g, "-").trim();
const lst = U.map((u) => `(${u.t} ${u.p.x.toFixed(1)} ${u.p.y.toFixed(1)} ${u.p.z.toFixed(1)} "${san(u.mk)}")`).join(" ");
const lisp = String.raw`(setvar "CMDECHO" 0)
(setq MAP '(${lst}))
(defun tid (nm / i j) (setq i (vl-string-search "-FAB-3D" nm)) (if (null i) (setq i (strlen nm)))
  (setq j i) (while (and (> j 0) (wcmatch (substr nm j 1) "#")) (setq j (1- j))) (atoi (substr nm (1+ j) (- i j))))
(defun near (ty pt / b bd d) (setq b nil bd 1e99)
  (foreach m MAP (if (or (null ty) (= (car m) ty)) (progn (setq d (distance (list (nth 1 m) (nth 2 m) (nth 3 m)) pt)) (if (< d bd) (setq bd d b m)))))
  (if b (list (nth 4 b) bd)))
(setq cols '(1 2 3 4 5 6 30 40 140 150 160 200 210 220 11 21 31 41 51 61 71 81 91 101 111 121 131 141 151 161 171 181 191 201 211 221 231 241 8 9) ci 0 made nil)
(setq BYTYPE ${byType ? "T" : "nil"})
; type name from the block name "<Family> - <Type>-<id>-<view>": the part after the last " - ", without the id and the prefix
(defun tname (nm / i j p) (setq i (vl-string-search "-FAB-3D" nm)) (if (null i) (setq i (strlen nm)))
  (setq j i) (while (and (> j 0) (wcmatch (substr nm j 1) "#")) (setq j (1- j))) (setq nm (substr nm 1 (1- j)))
  (while (setq p (vl-string-search " - " nm)) (setq nm (substr nm (+ p 4))))
  (if (wcmatch nm "${prefix}*") (setq nm (substr nm ${prefix.length + 1})))
  (setq g (vl-some '(lambda (x) (if (wcmatch nm (car x)) (cdr x))) GROUPS)) (if g g nm))
(setq GROUPS '(${groups.map(([p, n]) => `("${p}" . "${san(n)}")`).join(" ")}))
(defun lay (n) (if (not (tblsearch "LAYER" n)) (progn (entmake (list '(0 . "LAYER") '(100 . "AcDbSymbolTableRecord") '(100 . "AcDbLayerTableRecord") (cons 2 n) '(70 . 0) (cons 62 (nth (rem ci (length cols)) cols)) '(6 . "Continuous"))) (setq ci (1+ ci)))) (if (and (member n made) (not BYTYPE)) (princ (strcat "\nDUPLICATE " n))) (if (not (member n made)) (setq made (cons n made))) n)
(setq s (ssget "_X" '((0 . "INSERT") (410 . "Model"))) k 0 nf 0)
(if s (progn (setq i 0) (repeat (sslength s) (setq e (ssname s i) d (entget e) pt (cdr (assoc 10 d)) r (near (tid (cdr (assoc 2 d))) pt))
  (if BYTYPE (setq r (list (tname (cdr (assoc 2 d)))))
    (if (null r) (progn (setq r (near nil pt) nf (1+ nf)) (princ (strcat "\nFALLBACK " (cdr (assoc 2 d)) " -> " (car r) " d=" (rtos (cadr r) 2 0))))))
  (entmod (subst (cons 8 (lay (car r))) (assoc 8 d) d)) (setq k (1+ k) i (1+ i)))))
(setq types nil nb 0 b nil)
(while (setq b (tblnext "BLOCK" (null b)))
  (if (/= (substr (cdr (assoc 2 b)) 1 1) "*") (progn (setq nb (1+ nb) e (cdr (assoc -2 b)))
    (while e (setq d (entget e) ty (cdr (assoc 0 d)) c (assoc ty types))
      (setq types (if c (subst (cons ty (1+ (cdr c))) c types) (cons (cons ty 1) types)))
      (setq d (subst (cons 8 "0") (assoc 8 d) d)) (setq d (if (assoc 62 d) (subst (cons 62 256) (assoc 62 d) d) (append d '((62 . 256))))) (entmod d)
      (setq e (entnext e))))))
(setq s (ssget "_X" '((410 . "Model"))) del 0)
(if s (progn (setq i 0) (repeat (sslength s) (setq e (ssname s i)) (if (not (member (cdr (assoc 0 (entget e))) '("INSERT" "3DSOLID" "BODY" "SURFACE" "REGION"))) (progn (entdel e) (setq del (1+ del)))) (setq i (1+ i)))))
(setvar "CLAYER" "0")
(repeat 3 (command "_.-PURGE" "_A" "*" "_N"))
(command "_.-PURGE" "_R" "*" "_N")
(command "_.AUDIT" "_Y")
(command "_.ZOOM" "_E")
(princ (strcat "\nRESULT inserts=" (itoa k) " fallback=" (itoa nf) " unitlayers=" (itoa (length made)) " blocks=" (itoa nb) " deleted=" (itoa del)))
(foreach x made (princ (strcat "\nLAYER " x)))
(foreach x types (princ (strcat "\nTYPE " (car x) " " (itoa (cdr x)))))
(princ)
`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "unitlay-")).replace(/\\/g, "/");
fs.writeFileSync(tmp + "/u.lsp", lisp);
fs.writeFileSync(tmp + "/u.scr", `(load "${tmp}/u.lsp")\r\n_.QSAVE\r\n_.QUIT _Y\r\n`);
const r = spawnSync("C:/Program Files/Autodesk/AutoCAD 2026/accoreconsole.exe", ["/i", dwg, "/s", tmp + "/u.scr", "/l", "en-US"], { encoding: "utf16le", timeout: 900000 });
const out = (r.stdout || "").replace(/\0/g, "");
console.log(out.split(/\r?\n/).filter((l) => /RESULT|TYPE|LAYER |FALLBACK|DUPLICATE|error|Invalid/.test(l)).join("\n"));
console.log("size", (fs.statSync(dwg).size / 1e6).toFixed(1), "MB");
