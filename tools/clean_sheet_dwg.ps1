param([string[]]$Files)
# Clean Revit sheet DWGs for the workshop: audit, purge, remove duplicate/overlapping lines (OVERKILL), join touching lines and
# arcs into polylines (PEDIT Join, 0.5 mm fuzz) in model and paper space, zoom extents, save in place (AutoCAD 2018 format).
# Reports entity counts before/after so a bad run shows.
$acc = "C:\Program Files\Autodesk\AutoCAD 2026\accoreconsole.exe"
$scr = Join-Path $env:TEMP "fabclean.scr"
$count = '(defun c:FABCOUNT (/ e d ty nl np na) (setq nl 0 np 0 na 0 e (entnext)) (while e (setq ty (cdr (assoc 0 (entget e)))) (cond ((= ty "LINE") (setq nl (1+ nl))) ((member ty (list "LWPOLYLINE" "POLYLINE")) (setq np (1+ np))) ((= ty "ARC") (setq na (1+ na)))) (setq e (entnext e))) (princ (strcat "\nFABCOUNT lines=" (itoa nl) " arcs=" (itoa na) " polylines=" (itoa np))) (princ))'
$lines = @(
  $count,
  "FABCOUNT",
  "(setvar `"PEDITACCEPT`" 1)",
  "_.AUDIT _Y",
  "_.-PURGE _A * _N",
  "_.-PURGE _R * _N",
  "_.TILEMODE 1",
  "_-OVERKILL _ALL",
  "",
  "",
  "_.PEDIT _M _ALL",
  "",
  "_J 0.5",
  "",
  "_.TILEMODE 0",
  "_.PSPACE",
  "_-OVERKILL _ALL",
  "",
  "",
  "_.PEDIT _M _ALL",
  "",
  "_J 0.5",
  "",
  "_.ZOOM _E",
  "FABCOUNT",
  "_.QSAVE",
  "_.QUIT _Y",
  ""
)
Set-Content -Path $scr -Value ($lines -join "`r`n") -Encoding ASCII
foreach ($f in $Files) {
  $full = (Resolve-Path $f).Path
  $p = Start-Process -FilePath $acc -ArgumentList "/i `"$full`" /s `"$scr`" /l en-US" -NoNewWindow -PassThru -RedirectStandardOutput "$scr.out"
  if (-not $p.WaitForExit(240000)) { $p.Kill(); Write-Output "$([IO.Path]::GetFileName($full)): TIMEOUT"; continue }
  $out = (Get-Content "$scr.out" -Raw) -replace "`0", ""
  $m = [regex]::Matches($out, "FABCOUNT lines=\d[^\r\n]*") | ForEach-Object { $_.Value -replace 'FABCOUNT ', '' }
  Write-Output "$([IO.Path]::GetFileName($full)): before [$($m[0])] after [$($m[-1])]"
}
