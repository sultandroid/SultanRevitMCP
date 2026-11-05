param([string[]]$Files, [switch]$SaveDwg)
# Opens each DXF/DWG in AutoCAD core console, reports polylines (closed), circles, lines, texts and extents; optionally saves a DWG next to it.
$acc = "C:\Program Files\Autodesk\AutoCAD 2026\accoreconsole.exe"
$scr = Join-Path $env:TEMP "fabchk.scr"
foreach ($f in $Files) {
  $full = (Resolve-Path $f).Path
  $dwg = [IO.Path]::ChangeExtension($full, ".dwg") -replace '\\', '/'
  $lisp = '(progn (setq np 0 nc 0 ncir 0 nl 0 nt 0 e (entnext)) (while e (setq d (entget e) ty (cdr (assoc 0 d))) (cond ((member ty (list "POLYLINE" "LWPOLYLINE")) (setq np (1+ np)) (if (= 1 (logand 1 (cdr (assoc 70 d)))) (setq nc (1+ nc)))) ((= ty "CIRCLE") (setq ncir (1+ ncir))) ((= ty "LINE") (setq nl (1+ nl))) ((member ty (list "TEXT" "MTEXT")) (setq nt (1+ nt)))) (setq e (entnext e))) (princ (strcat "\nCHECK pl=" (itoa np) " closed=" (itoa nc) " circles=" (itoa ncir) " lines=" (itoa nl) " text=" (itoa nt) " ext=" (rtos (car (getvar "EXTMIN")) 2 0) "," (rtos (cadr (getvar "EXTMIN")) 2 0) " to " (rtos (car (getvar "EXTMAX")) 2 0) "," (rtos (cadr (getvar "EXTMAX")) 2 0))) (princ))'
  $lines = @($lisp, "_.ZOOM _E")
  if ($SaveDwg) { $lines += "_.SAVEAS 2018 `"$dwg`"" }
  $lines += "_.QUIT _Y", ""
  Set-Content -Path $scr -Value ($lines -join "`r`n") -Encoding ASCII
  $p = Start-Process -FilePath $acc -ArgumentList "/i `"$full`" /s `"$scr`" /l en-US" -NoNewWindow -PassThru -RedirectStandardOutput "$scr.out" -Wait:$false
  if (-not $p.WaitForExit(90000)) { $p.Kill(); Write-Output "$([IO.Path]::GetFileName($full)): TIMEOUT"; continue }
  $out = (Get-Content "$scr.out" -Raw) -replace "`0", ""
  $m = [regex]::Match($out, "CHECK pl=\d[^\r\n]*")
  Write-Output "$([IO.Path]::GetFileName($full)): $($m.Value)"
}

