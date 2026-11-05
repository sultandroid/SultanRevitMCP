# High-resolution result pictures from the model open in Robot (or -Rtd), for calculation notes.
# Each view: PNG file (window enlarged, copied to the clipboard) + optional Robot screen capture (4096 px) for Robot's own report.
# Usage: powershell -STA -File robot_views.ps1 -Views views.json -Out folder [-Rtd model.rtd] [-Capture]
# views.json: [{ "name": "01_model", "title": "...", "proj": "3D|XZ|YZ|XY", "cases": "6", "show": ["SECTIONS_SHAPE","STRUCTURE_SUPPORT_SYMBOLS"],
#               "diagram": "NTM_MY|DEFORMATION_DEFORMATION|REACTION_FY|NTM_FX", "dscale": 0, "barmap": "STRESS_S_MAX|NTM_MY|DESIGN_RATIO",
#               "values": "GLOBAL_EXTREMES", "w": 3600, "h": 1800 }]
param([Parameter(Mandatory)][string]$Views, [Parameter(Mandatory)][string]$Out, [string]$Rtd, [switch]$Capture)
$ErrorActionPreference = "Stop"
Add-Type -Path "C:\Program Files\Autodesk\Robot Structural Analysis Professional 2026\Exe\Interop.RobotOM.dll"
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$V = Get-Content $Views -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Force $Out | Out-Null
$app = New-Object -ComObject Robot.Application
$app.Visible = 1
if ($Rtd -and ($app.Project.FileName -ne $Rtd -or -not $app.Project.IsActive)) { $app.Project.Open($Rtd) }
if (-not $app.Project.Structure.Results.Available) { [void]$app.Project.CalcEngine.Calculate() }
$P = @{ "3D" = [RobotOM.IRobotViewProjection]::I_VP_3DXYZ; XZ = [RobotOM.IRobotViewProjection]::I_VP_XZ; YZ = [RobotOM.IRobotViewProjection]::I_VP_YZ; XY = [RobotOM.IRobotViewProjection]::I_VP_XY }
$log = @(); $caps = @()
foreach ($s in $V) {
  try {
    $v = $app.Project.ViewMngr.CreateView([RobotOM.IRobotViewType]::I_VT_STANDARD)
    $v.Projection = $P[[string]($(if ($s.proj) { $s.proj } else { "3D" }))]
    $v.Visible = 1
    try { $v.StructAxisVisible = $false; $v.GridVisible = $false; $v.RulerVisible = $false } catch {}
    foreach ($a in @($s.show)) { if ($a) { try { $v.ParamsDisplay.Set([RobotOM.IRobotViewDisplayAttributes]::("I_VDA_" + $a), $true) } catch { $log += "$($s.name): show $a failed" } } }
    if ($s.cases) { $v.Selection.Get([RobotOM.IRobotObjectType]::I_OT_CASE).FromText([string]$s.cases) }
    if ($s.diagram) {
      $dt = [RobotOM.IRobotViewDiagramResultType]::("I_VDRT_" + $s.diagram)
      $v.ParamsDiagram.Set($dt, $true)
      if ($s.dscale) { $v.ParamsDiagram.SetScale($dt, [double]$s.dscale) }
      $v.ParamsDiagram.Descriptions = [RobotOM.IRobotViewDiagramDescriptionType]::I_VDDT_LABELS
      $v.ParamsDiagram.Values = [RobotOM.IRobotViewDiagramValueType]::("I_VDVT_" + $(if ($s.values) { $s.values } else { "GLOBAL_EXTREMES" }))
      try { $v.ParamsDiagram.Filling = [RobotOM.IRobotViewDiagramFillingType]::I_VDFT_FILLED } catch {}
    }
    if ($s.barmap) { $v.ParamsBarMap.CurrentResult = [RobotOM.IRobotViewBarMapResultType]::("I_VBMRT_" + $s.barmap); try { $v.ParamsBarMap.MapThicknessCoeff = 4 } catch {} }
    if ($s.title) { $v.Title = [string]$s.title }
    $v.Redraw(1)
    # Robot screen capture at 4096 px (the clipboard copy only gives the on-screen size)
    $cp = $app.CmpntFactory.Create([RobotOM.IRobotComponentType]::I_CT_VIEW_SCREEN_CAPTURE_PARAMS)
    $cp.Name = [string]$s.name; $cp.UpdateType = [RobotOM.IRobotViewScreenCaptureUpdateType]::I_SCUT_CURRENT_VIEW
    $cp.Resolution = [RobotOM.IRobotViewScreenCaptureResolution]::I_VSCR_4096; $cp.Orientation = [RobotOM.IRobotPageSetupOrientation]::I_PSO_LANDSCAPE
    $v.MakeScreenCapture($cp); $caps += [string]$s.name; $log += "$($s.name): captured"
    try { $v.Visible = 0 } catch {}
  } catch { $log += "$($s.name): " + $_.Exception.Message.Split("`n")[0] }
}

# Export the captures through a Robot report (RTF) and save each picture as PNG, in order.
$pe = $app.Project.PrintEngine; $ps = $pe.PageSetup
$act = @{}; foreach ($e in 'Header','Footer','TitlePage') { $act[$e] = $ps.$e.Active; $ps.$e.Active = $false }
$pe.ResetReport(); foreach ($c in $caps) { [void]$pe.AddScToReport($c) }
$rtf = Join-Path ([IO.Path]::GetTempPath()) ('robot_caps_' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.rtf')
[void]$pe.SaveReportToFile($rtf, [RobotOM.IRobotOutputFileFormat]::I_OFF_RTF)
foreach ($e in 'Header','Footer','TitlePage') { $ps.$e.Active = $act[$e] }
$txt = [IO.File]::ReadAllText($rtf)
$ms = [regex]::Matches($txt, '\{\\pict[^{}]*?\\(pngblip|jpegblip)[^{}]*?\s([0-9a-fA-F\s]+)\}')
$log += "pictures in report: $($ms.Count) for $($caps.Count) captures"
# the report also holds small pictures (legends, logos): keep only the full captures (width >= 2000 px), in order
$big = @()
foreach ($m in $ms) {
  $hex = ($m.Groups[2].Value -replace '\s', ''); $bytes = New-Object byte[] ($hex.Length / 2)
  for ($j = 0; $j -lt $bytes.Length; $j++) { $bytes[$j] = [Convert]::ToByte($hex.Substring(2 * $j, 2), 16) }
  $im = [Drawing.Image]::FromStream((New-Object IO.MemoryStream(, $bytes)))
  if ($im.Width -ge 2000) { $big += , @($bytes, $(if ($m.Groups[1].Value -eq 'pngblip') { 'png' } else { 'jpg' }), $im.Width, $im.Height) }
  $im.Dispose() }
$log += "full captures found: $($big.Count)"
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class Trim { // crop the white margin round a capture, keep a pad
  public static Bitmap Run(Bitmap src, int pad) {
    var b = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb); using (var g = Graphics.FromImage(b)) g.DrawImage(src, 0, 0, src.Width, src.Height);
    var d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    var px = new int[b.Width * b.Height]; Marshal.Copy(d.Scan0, px, 0, px.Length); b.UnlockBits(d);
    int x0 = b.Width, y0 = b.Height, x1 = -1, y1 = -1;
    for (int y = 0; y < b.Height; y++) for (int x = 0; x < b.Width; x++) { int c = px[y * b.Width + x]; int r = (c >> 16) & 255, gg = (c >> 8) & 255, bb = c & 255;
      if (r < 235 || gg < 235 || bb < 235) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0) return b;
    x0 = Math.Max(0, x0 - pad); y0 = Math.Max(0, y0 - pad); x1 = Math.Min(b.Width - 1, x1 + pad); y1 = Math.Min(b.Height - 1, y1 + pad);
    var r2 = b.Clone(new Rectangle(x0, y0, x1 - x0 + 1, y1 - y0 + 1), PixelFormat.Format24bppRgb); b.Dispose(); return r2; } }
"@
for ($i = 0; $i -lt [Math]::Min($big.Count, $caps.Count); $i++) {
  $src = [Drawing.Bitmap]::FromStream((New-Object IO.MemoryStream(, $big[$i][0]))); $t = [Trim]::Run($src, 40); $src.Dispose()
  $f = Join-Path $Out ($caps[$i] + '.png'); $t.Save($f, [Drawing.Imaging.ImageFormat]::Png); $log += "$($caps[$i]): $($big[$i][2])x$($big[$i][3]) -> trimmed $($t.Width)x$($t.Height)"; $t.Dispose() }
Remove-Item $rtf -Force
$log
