# Robot calculation note for DAS_STR_01_Robot.rtd: standard tables saved to RTF (with pictures).
param([Parameter(Mandatory)][string]$Rtd, [Parameter(Mandatory)][string]$Rtf)
$ErrorActionPreference = "Stop"
Add-Type -Path "C:\Program Files\Autodesk\Robot Structural Analysis Professional 2026\Exe\Interop.RobotOM.dll"
$app = New-Object -ComObject Robot.Application
for ($w = 0; $w -lt 60; $w++) { try { $null = $app.Project; break } catch { Start-Sleep -Seconds 2 } }
$app.Visible = 1
$app.Project.Open($Rtd)
$app.Interactive = 0
$log = @("opened: " + $app.Project.FileName)
try { $app.Project.CalcEngine.AnalysisParams.IgnoreWarnings = $true } catch {}
$rc = $app.Project.CalcEngine.Calculate(); $log += "calculate: $rc"
# metric display units for the report
$U = $app.Project.Preferences.Units; $UT = [RobotOM.IRobotUnitType]
try { $log += "units members: " + (($U | Get-Member -MemberType Method | ForEach-Object Name) -join ",") } catch {}
foreach ($p in @(@($UT::I_UT_STRUCTURE_DIMENSION, @("m")), @($UT::I_UT_SECTION_DIMENSION, @("mm")), @($UT::I_UT_SECTION_PROPERTIES, @("cm")), @($UT::I_UT_FORCE, @("kN")), @($UT::I_UT_MOMENT, @("kN")), @($UT::I_UT_STRESS, @("MN")), @($UT::I_UT_DISPLACEMENT, @("mm")), @($UT::I_UT_WEIGHT, @("kG", "kg")))) {
  foreach ($nm in $p[1]) { try { $d = $U.Get($p[0]); $d.Name = $nm; try { $U.Set($p[0], $d) } catch {}; $chk = $U.Get($p[0]).Name; $log += "unit " + $p[0] + " -> " + $chk; if ($chk -eq $nm) { break } } catch { $log += "unit " + $p[0] + " " + $nm + ": " + $_.Exception.Message.Split("`n")[0] } }
}
try { $U.UseMetricAsDefault = $true; $log += "metric default on" } catch { $log += "UseMetricAsDefault n/a" }
foreach ($cx in @(@($UT::I_UT_MOMENT, "kN", "m"), @($UT::I_UT_STRESS, "MN", "m"))) { try { $d = $U.Get($cx[0]); $d.Name = $cx[1]; $d.Name2 = $cx[2]; $U.Set($cx[0], $d) } catch { $log += "complex unit " + $cx[0] + ": " + $_.Exception.Message.Split("`n")[0] } }
try { $U.Refresh() } catch {}
foreach ($ty in @($UT::I_UT_MOMENT, $UT::I_UT_STRESS)) { try { $d = $U.Get($ty); $log += "unit $ty name=" + $d.Name + " / " + $d.Name2 + " GetName=" + $U.GetName($ty) } catch {} }
$pe = $app.Project.PrintEngine
$pe.ResetReport()
$addM = [RobotOM.IRobotPrintEngine].GetMethod("AddToReport"); $log += "RobotPrintable: " + [RobotOM.RobotPrintable].IsInterface + " / " + [RobotOM.RobotPrintable].FullName
$tm = $pe.ReportTemplates; $names = @(); for ($i = 1; $i -le $tm.Count; $i++) { try { $names += $tm.Get($i).Name } catch { try { $names += [string]$tm.Get($i) } catch {} } }
$log += "templates: " + ($names -join " | ")
$TT = [RobotOM.IRobotTableType]; $TD = [RobotOM.IRobotTableDataType]
$want = @(
  @($TT::I_TT_PROPERTIES, $TD::I_TDT_DEFAULT, "sections"), @($TT::I_TT_NODES, $TD::I_TDT_DEFAULT, "nodes"), @($TT::I_TT_BARS, $TD::I_TDT_DEFAULT, "bars"),
  @($TT::I_TT_SUPPORTS, $TD::I_TDT_DEFAULT, "supports"), @($TT::I_TT_LOADS, $TD::I_TDT_DEFAULT, "loads"), @($TT::I_TT_COMBINATIONS, $TD::I_TDT_DEFAULT, "combinations"),
  @($TT::I_TT_REACTIONS, $TD::I_TDT_ENVELOPE, "reactions envelope"), @($TT::I_TT_REACTIONS, $TD::I_TDT_TOTAL, "reaction totals"),
  @($TT::I_TT_NODE_DISPLACEMENTS, $TD::I_TDT_ENVELOPE, "displacements envelope"), @($TT::I_TT_FORCES, $TD::I_TDT_ENVELOPE, "forces envelope"),
  @($TT::I_TT_FORCES, $TD::I_TDT_EXTREMES, "forces extremes"), @($TT::I_TT_STRESSES, $TD::I_TDT_EXTREMES, "stresses extremes"))
# pictures: 3D structure, then the My diagram for the ULS envelope
foreach ($pic in @("structure", "My")) {
  try {
    $v = $app.Project.ViewMngr.CreateView([RobotOM.IRobotViewType]::I_VT_STANDARD)
    $v.Projection = [RobotOM.IRobotViewProjection]::I_VP_3DXYZ
    if ($pic -eq "My") {
      $dt = [Enum]::GetNames([RobotOM.IRobotViewDiagramResultType]) | Where-Object { $_ -match "^I_VDRT_NTM_MY$|_MY$" } | Select-Object -First 1
      $v.ParamsDiagram.Set([RobotOM.IRobotViewDiagramResultType]::$dt, 1)
      $v.Selection.Get([RobotOM.IRobotObjectType]::I_OT_CASE).FromText("5to14")
      $log += "diagram type $dt"
    }
    $v.Redraw(1); $pe.AddToReport($v.Printable); $log += "picture ${pic}: added"
  } catch { $log += "picture ${pic}: " + $_.Exception.Message.Split("`n")[0] }
}
foreach ($t in $want) {
  try { $tab = $app.Project.ViewMngr.CreateTable($t[0], $t[1]); $pe.AddToReport($tab.Printable); $log += "table " + $t[2] + ": added" } catch { $log += "table " + $t[2] + ": " + $_.Exception.Message.Split("`n")[0] }
}
$pe.SaveReportToFile($Rtf, [RobotOM.IRobotOutputFileFormat]::I_OFF_RTF_JPEG)
$log += "saved: " + (Test-Path $Rtf) + " " + $(if (Test-Path $Rtf) { (Get-Item $Rtf).Length } else { 0 })
$app.Interactive = 1
$app.Project.Close()
$log
