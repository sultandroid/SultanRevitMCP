# Tile page PNGs into contact sheets for a quick visual check.
# Usage: powershell -File contact_sheet.ps1 -Dir folder -Cols 4 -Rows 2 -Tile 400
param([Parameter(Mandatory)][string]$Dir, [int]$Cols = 4, [int]$Rows = 2, [int]$Tile = 400)
Add-Type -AssemblyName System.Drawing
$files = Get-ChildItem $Dir -Filter "p*.png" | Sort-Object Name; $per = $Cols * $Rows; $k = 0
for ($s = 0; $s -lt $files.Count; $s += $per) {
  $first = [Drawing.Image]::FromFile($files[$s].FullName); $th = [int]($Tile * $first.Height / $first.Width); $first.Dispose()
  $bmp = New-Object Drawing.Bitmap ($Cols * ($Tile + 10)), ($Rows * ($th + 30)); $g = [Drawing.Graphics]::FromImage($bmp); $g.Clear([Drawing.Color]::DimGray)
  $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  for ($i = 0; $i -lt $per -and ($s + $i) -lt $files.Count; $i++) {
    $im = [Drawing.Image]::FromFile($files[$s + $i].FullName); $x = ($i % $Cols) * ($Tile + 10) + 5; $y = [Math]::Floor($i / $Cols) * ($th + 30) + 25
    $g.DrawImage($im, $x, $y, $Tile, $th); $im.Dispose()
    $g.DrawString($files[$s + $i].BaseName, (New-Object Drawing.Font("Arial", 11, [Drawing.FontStyle]::Bold)), [Drawing.Brushes]::White, $x, $y - 20) }
  $k++; $bmp.Save((Join-Path $Dir ("sheet{0:D2}.jpg" -f $k)), [Drawing.Imaging.ImageFormat]::Jpeg); $g.Dispose(); $bmp.Dispose() }
"contact sheets: $k"
