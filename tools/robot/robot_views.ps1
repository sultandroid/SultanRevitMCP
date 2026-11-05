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
for ($i = 0; $i -lt [Math]::Min($ms.Count, $caps.Count); $i++) {
  $hex = ($ms[$i].Groups[2].Value -replace '\s', ''); $bytes = New-Object byte[] ($hex.Length / 2)
  for ($j = 0; $j -lt $bytes.Length; $j++) { $bytes[$j] = [Convert]::ToByte($hex.Substring(2 * $j, 2), 16) }
  $tmp = Join-Path $Out ($caps[$i] + '.' + $(if ($ms[$i].Groups[1].Value -eq 'pngblip') { 'png' } else { 'jpg' })); [IO.File]::WriteAllBytes($tmp, $bytes)
  $im = [Drawing.Image]::FromFile($tmp); $log += "$($caps[$i]): $($im.Width)x$($im.Height)"; $im.Dispose() }
Remove-Item $rtf -Force
$log
