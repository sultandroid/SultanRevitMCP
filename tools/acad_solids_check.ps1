param([string]$File)
# Counts entity types in model space and inside every block definition: 3DSOLID (true solids) vs POLYFACE/MESH (mesh).
$acc = "C:\Program Files\Autodesk\AutoCAD 2026\accoreconsole.exe"
$scr = Join-Path $env:TEMP "fabsolids.scr"
$lisp = '(progn (setq tab nil) (defun bump (k) (if (assoc k tab) (setq tab (subst (cons k (1+ (cdr (assoc k tab)))) (assoc k tab) tab)) (setq tab (cons (cons k 1) tab)))) (defun walk (e) (while e (setq d (entget e) ty (cdr (assoc 0 d))) (if (= ty "POLYLINE") (if (= 64 (logand 64 (cdr (assoc 70 d)))) (bump "POLYFACE") (bump "POLYLINE")) (if (not (member ty (list "VERTEX" "SEQEND" "ATTRIB"))) (bump ty))) (setq e (entnext e)))) (walk (entnext)) (setq b (tblnext "BLOCK" T)) (while b (if (not (wcmatch (cdr (assoc 2 b)) "`**")) (walk (cdr (assoc -2 b)))) (setq b (tblnext "BLOCK"))) (princ "\nSOLIDCOUNT") (foreach p tab (princ (strcat " " (car p) "=" (itoa (cdr p))))) (princ))'
Set-Content -Path $scr -Value (@($lisp, "_.QUIT _Y", "") -join "`r`n") -Encoding ASCII
$p = Start-Process -FilePath $acc -ArgumentList "/i `"$File`" /s `"$scr`" /l en-US /readonly" -NoNewWindow -PassThru -RedirectStandardOutput "$scr.out"
if (-not $p.WaitForExit(600000)) { $p.Kill(); "TIMEOUT"; exit }
$out = (Get-Content "$scr.out" -Raw) -replace "`0", ""
[regex]::Match($out, "SOLIDCOUNT [^\r\n]*").Value
