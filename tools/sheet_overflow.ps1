# Flags text (or anything) that runs over the title-block border on a rendered sheet PNG (user, 12 Nov 2026: "there is text
# exceeding the sheet borders"). Finds the title block's left border (the longest dark vertical line in the right 30% of the
# sheet) and looks for dark pixels crossing it: in a band just left of it AND just right of it on the same rows.
# Usage: powershell -File sheet_overflow.ps1 <sheet.png> ...   Prints "OK <file>" or "OVERFLOW <file> rows y0-y1 ..." (exit 1).
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Files)
Add-Type -AssemblyName System.Drawing
$bad = 0
foreach ($f in $Files) {
  $im = [System.Drawing.Bitmap]::FromFile((Resolve-Path $f))
  $W = $im.Width; $H = $im.Height
  $dark = { param($x, $y) $c = $im.GetPixel($x, $y); ($c.R + $c.G + $c.B) -lt 450 }
  # title-block border: column in the right 30% with the most dark pixels
  $best = 0; $bx = 0
  for ($x = [int]($W * 0.7); $x -lt $W - 40; $x++) {
    $n = 0; for ($y = 0; $y -lt $H; $y += 4) { if (& $dark $x $y) { $n++ } }
    if ($n -gt $best) { $best = $n; $bx = $x }
  }
  $y0 = [int]($H * 0.03); $y1 = [int]($H * 0.97); $rows = @()
  for ($y = $y0; $y -lt $y1; $y++) {
    $l = $false; $r = $false
    for ($x = $bx - 14; $x -lt $bx - 3; $x++) { if (& $dark $x $y) { $l = $true; break } }
    if ($l) { for ($x = $bx + 3; $x -lt $bx + 14; $x++) { if (& $dark $x $y) { $r = $true; break } } }
    if ($l -and $r) { $rows += $y }
  }
  $im.Dispose()
  if ($rows.Count -lt 3) { "OK $f (border x $bx)" } else { $bad++; "OVERFLOW $f border x $bx rows $($rows[0])-$($rows[-1]) ($($rows.Count) rows)" }
}
if ($bad) { exit 1 }
