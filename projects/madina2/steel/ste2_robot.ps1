# Madina 2 ST-E2 in Robot (COM): frame 3D from ste2_robot.json, SHS 40x40x2 + PL 116x10, pinned feet, loads, ULS/SLS, results to JSON.
param([string]$Dir = $PSScriptRoot, [string]$Drop = "", [string]$Tag = "v2", [switch]$NoTie, [switch]$FixedBase, [switch]$FlatPlate, [switch]$NoPull, [switch]$Report)
$ErrorActionPreference = "Stop"
Add-Type -Path "C:\Program Files\Autodesk\Robot Structural Analysis Professional 2026\Exe\Interop.RobotOM.dll"
$m = Get-Content "$Dir\ste2_robot.json" -Raw | ConvertFrom-Json
$app = New-Object -ComObject Robot.Application
$app.Visible = 1; $app.Interactive = 0   # no Robot message boxes while the script runs (user, 12 Nov 2026: many warning dialogs)
$app.Project.New([RobotOM.IRobotProjectType]::I_PT_FRAME_3D)
$str = $app.Project.Structure
foreach ($n in $m.nodes) { $str.Nodes.Create($n.id, $n.x, $n.y, $n.z) }
$i = 0; foreach ($b in $m.bars) { $i++; $str.Bars.Create($i, $b.n1, $b.n2) }
$lab = $str.Labels
# sections
$log = @()
$shs = $lab.Create([RobotOM.IRobotLabelType]::I_LT_BAR_SECTION, "SHS 40x40x2")
$d = $shs.Data; $ok = $false
foreach ($nm in @("SHS 40x40x2", "SHS 40x40x2.0", "RHSC 40x40x2", "CFRHS 40x40x2", "TRON 40x40x2", "TCAR 40x2")) { if ($d.LoadFromDBase($nm) -eq 1) { $ok = $true; $log += "SHS from db: $nm"; break } }
if (-not $ok) {
  $d.Type = [RobotOM.IRobotBarSectionType]::I_BST_NS_BOX; $d.ShapeType = [RobotOM.IRobotBarSectionShapeType]::I_BSST_USER_BOX
  $ns = $d.CreateNonstd(0)
  $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_BOX_B, 0.04); $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_BOX_H, 0.04)
  $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_BOX_TW, 0.002); $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_BOX_TF, 0.002)
  $d.CalcNonstdGeometry(); $log += "SHS user box 40x40x2"
}
$lab.Store($shs)
$pl = $lab.Create([RobotOM.IRobotLabelType]::I_LT_BAR_SECTION, "PL 116x10")
# stiffened shelf bracket (11 Nov 2026): PL 116x10 with a 80x8 fin welded under it = T 116 x 70
if ($FlatPlate) { $d = $pl.Data; $d.Type = [RobotOM.IRobotBarSectionType]::I_BST_NS_RECT; $d.ShapeType = [RobotOM.IRobotBarSectionShapeType]::I_BSST_USER_RECT
  $ns = $d.CreateNonstd(0); $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_RECT_B, 0.116); $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_RECT_H, 0.010)
  $d.CalcNonstdGeometry(); $lab.Store($pl) } else {
$d = $pl.Data; $d.Type = [RobotOM.IRobotBarSectionType]::I_BST_NS_T; $d.ShapeType = [RobotOM.IRobotBarSectionShapeType]::I_BSST_USER_T_SHAPE
$ns = $d.CreateNonstd(0)
$ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_T_B, 0.116); $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_T_H, 0.090)
$ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_T_TF, 0.010); $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_T_TW, 0.008)
$d.CalcNonstdGeometry(); $lab.Store($pl) }
$rhs = $lab.Create([RobotOM.IRobotLabelType]::I_LT_BAR_SECTION, "RHS 60x40x2.5")
$d = $rhs.Data; $d.Type = [RobotOM.IRobotBarSectionType]::I_BST_NS_BOX; $d.ShapeType = [RobotOM.IRobotBarSectionShapeType]::I_BSST_USER_BOX
$ns = $d.CreateNonstd(0)
$ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_BOX_B, 0.06); $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_BOX_H, 0.04)
$ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_BOX_TW, 0.0025); $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_BOX_TF, 0.0025)
$d.CalcNonstdGeometry(); $lab.Store($rhs)
# as-built hanger sections (12 Nov 2026)
$L = $lab.Create([RobotOM.IRobotLabelType]::I_LT_BAR_SECTION, "L 40x40x4"); $d = $L.Data; $okL = $false
foreach ($nm in @("L 40x40x4", "CAE 40x4", "L 40x4", "LE 40x4")) { if ($d.LoadFromDBase($nm) -eq 1) { $okL = $true; $log += "angle from db: $nm"; break } }
if (-not $okL) { # equal angle L 40x40x4 by its properties (EN 10056): A 308 mm2, I 44.8 cm4 (4.48e-8 m4), It 1.7 cm4... (1.7e-9), e 11.2 mm
  $d.Type = [RobotOM.IRobotBarSectionType]::I_BST_SPECIAL
  foreach ($kv in @(@('I_BSDV_AX',3.08e-4),@('I_BSDV_AY',1.6e-4),@('I_BSDV_AZ',1.6e-4),@('I_BSDV_IX',1.7e-9),@('I_BSDV_IY',4.48e-8),@('I_BSDV_IZ',4.48e-8),@('I_BSDV_VY',0.0288),@('I_BSDV_VPY',0.0112),@('I_BSDV_VZ',0.0288),@('I_BSDV_VPZ',0.0112),@('I_BSDV_BF',0.04),@('I_BSDV_D',0.04)))
  { $d.SetValue([RobotOM.IRobotBarSectionDataValue]::($kv[0]), $kv[1]) }
  $log += 'angle by properties L 40x40x4' }
$lab.Store($L)
$R = $lab.Create([RobotOM.IRobotLabelType]::I_LT_BAR_SECTION, "M10 rod"); $d = $R.Data; $d.Type = [RobotOM.IRobotBarSectionType]::I_BST_NS_TUBE; $d.ShapeType = [RobotOM.IRobotBarSectionShapeType]::I_BSST_USER_CIRC_FILLED
$ns = $d.CreateNonstd(0); $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_TUBE_D, 0.0086); $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_TUBE_T, 0.0043); $d.CalcNonstdGeometry(); $lab.Store($R)
$F = $lab.Create([RobotOM.IRobotLabelType]::I_LT_BAR_SECTION, "FB 40x6"); $d = $F.Data; $d.Type = [RobotOM.IRobotBarSectionType]::I_BST_NS_RECT; $d.ShapeType = [RobotOM.IRobotBarSectionShapeType]::I_BSST_USER_RECT
$ns = $d.CreateNonstd(0); $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_RECT_B, 0.04); $ns.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_RECT_H, 0.006); $d.CalcNonstdGeometry(); $lab.Store($F)
foreach ($q in @(@("SHS",$shs),@("L",$L),@("ROD",$R),@("FB",$F))) { $dd=$q[1].Data; $log += $q[0] + " AX=" + $dd.GetValue([RobotOM.IRobotBarSectionDataValue]::I_BSDV_AX) + " IY=" + $dd.GetValue([RobotOM.IRobotBarSectionDataValue]::I_BSDV_IY) + " IZ=" + $dd.GetValue([RobotOM.IRobotBarSectionDataValue]::I_BSDV_IZ) }
$secName = @{ L40 = "L 40x40x4"; ROD = "M10 rod"; FB = "FB 40x6" }
$shsBars = @(); $plBars = @(); $rhsBars = @(); $i = 0
foreach ($b in $m.bars) { $i++; if ($secName.ContainsKey($b.sec)) { $sel1 = $str.Selections.Get([RobotOM.IRobotObjectType]::I_OT_BAR); $sel1.FromText("$i"); $str.Bars.SetLabel($sel1, [RobotOM.IRobotLabelType]::I_LT_BAR_SECTION, $secName[$b.sec]) } elseif ($b.sec -eq "SHS") { $shsBars += $i } elseif ($b.sec -eq "RHS") { $rhsBars += $i } else { $plBars += $i } }
$sel = $str.Selections.Get([RobotOM.IRobotObjectType]::I_OT_BAR)
$sel.FromText(($shsBars -join " ")); $str.Bars.SetLabel($sel, [RobotOM.IRobotLabelType]::I_LT_BAR_SECTION, "SHS 40x40x2")
if ($rhsBars.Count) { $sel.FromText(($rhsBars -join " ")); $str.Bars.SetLabel($sel, [RobotOM.IRobotLabelType]::I_LT_BAR_SECTION, "RHS 60x40x2.5") }
$sel.FromText(($plBars -join " ")); $str.Bars.SetLabel($sel, [RobotOM.IRobotLabelType]::I_LT_BAR_SECTION, "PL 116x10")
# supports: pinned
$sup = $lab.Create([RobotOM.IRobotLabelType]::I_LT_SUPPORT, "Pinned")
$sd = $sup.Data; $sd.UX = 1; $sd.UY = 1; $sd.UZ = 1; $r0 = [int][bool]$FixedBase; $sd.RX = $r0; $sd.RY = $r0; $sd.RZ = $r0; $lab.Store($sup)
$ns2 = $str.Selections.Get([RobotOM.IRobotObjectType]::I_OT_NODE); $ns2.FromText(($m.sup -join " "))
$str.Nodes.SetLabel($ns2, [RobotOM.IRobotLabelType]::I_LT_SUPPORT, "Pinned")
if ($Drop) { $k = 0; $del = @(); foreach ($b in $m.bars) { $k++; if ($b.id -match $Drop) { $del += $k } }; $dsel = $str.Selections.Get([RobotOM.IRobotObjectType]::I_OT_BAR); $dsel.FromText(($del -join " ")); $str.Bars.DeleteMany($dsel) }
# wall ties: top of each back post fixed to the existing east wall (UX only)
$tie = $lab.Create([RobotOM.IRobotLabelType]::I_LT_SUPPORT, "WallTie"); $td = $tie.Data; $td.UX = 1; $td.UY = 0; $td.UZ = 0; $td.RX = 0; $td.RY = 0; $td.RZ = 0; $lab.Store($tie)
$tops = @(); foreach ($n in $m.nodes) { if ([math]::Abs($n.x - 6.338) -lt 0.001 -and ([math]::Abs($n.z - 2.9) -lt 0.001 -or [math]::Abs($n.z - 1.902) -lt 0.001)) { $tops += $n.id } }
if ($NoTie) { $tops = @() }
$ns3 = $str.Selections.Get([RobotOM.IRobotObjectType]::I_OT_NODE); $ns3.FromText(($tops -join " ")); $str.Nodes.SetLabel($ns3, [RobotOM.IRobotLabelType]::I_LT_SUPPORT, "WallTie")
# bars by member id
function BarsOf($rx) { $r = @(); $k = 0; foreach ($b in $m.bars) { $k++; if ($b.id -match $rx) { $r += $k } }; return ($r -join " ") }
function Udl($case, $bars, $comp, $val) {
  $ix = $case.Records.New([RobotOM.IRobotLoadRecordType]::I_LRT_BAR_UNIFORM); $rec = $case.Records.Get($ix)
  $rec.SetValue($comp, $val); $rec.Objects.FromText($bars)
}
$PZ = [RobotOM.IRobotBarUniformRecordValues]::I_BURV_PZ; $PX = [RobotOM.IRobotBarUniformRecordValues]::I_BURV_PX
# 1 DL: self weight; back cladding BK-E + pegboards 0.40 kN/m on the +1.500 back rail; shelf ES-1 0.25 kN/m on each shelf plate
$c1 = $str.Cases.CreateSimple(1, "DL", [RobotOM.IRobotCaseNature]::I_CN_PERMANENT, [RobotOM.IRobotCaseAnalizeType]::I_CAT_STATIC_LINEAR)
$ix = $c1.Records.New([RobotOM.IRobotLoadRecordType]::I_LRT_DEAD); $r = $c1.Records.Get($ix)
$r.SetValue([RobotOM.IRobotDeadRecordValues]::I_DRV_Z, -1); $r.Objects.FromText((BarsOf "^(?!HA)")) # self-weight on every bar except the angles (a special section reads a wrong unit weight); angle weight added below
Udl $c1 (BarsOf "^BR1500$") $PZ -400
Udl $c1 (BarsOf "^SP") $PZ -250
if ((BarsOf "^HA")) { Udl $c1 (BarsOf "^HA") $PZ -24 }   # L 40x40x4 = 2.42 kg/m
# 2 LL: shelf goods 1.5 kN/m2 x 0.593 deep x 1.316 tributary per plate over 0.608 m = 1.93 kN/m; pegboard goods 0.5 kN/m2 x 1.4 = 0.70 kN/m
$c2 = $str.Cases.CreateSimple(2, "LL", [RobotOM.IRobotCaseNature]::I_CN_EXPLOATATION, [RobotOM.IRobotCaseAnalizeType]::I_CAT_STATIC_LINEAR)
Udl $c2 (BarsOf "^SP") $PZ -1930
Udl $c2 (BarsOf "^BR1500$") $PZ -700
# 3 H: horizontal push/pull on the pegboard wall 0.30 kN/m (x) on the +1.500 back rail and 0.5 kN/m on the front top chord
$c3 = $str.Cases.CreateSimple(3, "H", [RobotOM.IRobotCaseNature]::I_CN_EXPLOATATION, [RobotOM.IRobotCaseAnalizeType]::I_CAT_STATIC_LINEAR)
if (-not $NoPull) { Udl $c3 (BarsOf "^BR1500$") $PX -300 }
# top chord pull removed (not an SBC 301 load)
# minimal variant: no front chord, so the arch-top restraint (0.5 kN/m x 2.1 m tributary) goes to the HG-E front ends as point loads
if ($false) { $ix = $c3.Records.New([RobotOM.IRobotLoadRecordType]::I_LRT_NODE_FORCE); $rec = $c3.Records.Get($ix)
  $rec.SetValue([RobotOM.IRobotNodeForceRecordValues]::I_NFRV_FX, -1050)
  $hn = @(); foreach ($n in $m.nodes) { if ([math]::Abs($n.x - 5.75) -lt 0.001 -and [math]::Abs($n.z - 2.9) -lt 0.001 -and ([math]::Abs($n.y - 2.138) -lt 0.001 -or [math]::Abs($n.y - 3.454) -lt 0.001)) { $hn += $n.id } }
  $rec.Objects.FromText(($hn -join " ")) }
# SBC 306 C2.2b notional load: 0.002 x factored gravity (~13 kN) = 26 N, forward at the +2.900 back rail
Udl $c3 (BarsOf "^BR2900$") $PX -7
# combinations
# SBC 301 (2.3.2) LRFD: 10 = 1.4D, 12 = 1.2D + 1.6L (L includes the horizontal shopfit load H)
$u = $str.Cases.CreateCombination(10, "SBC 1.2D+1.6L", [RobotOM.IRobotCombinationType]::I_CBT_ULS, [RobotOM.IRobotCaseNature]::I_CN_PERMANENT, [RobotOM.IRobotCaseAnalizeType]::I_CAT_COMB)
$u.CaseFactors.New(1, 1.2); $u.CaseFactors.New(2, 1.6); $u.CaseFactors.New(3, 1.6)
$u2 = $str.Cases.CreateCombination(12, "SBC 1.4D", [RobotOM.IRobotCombinationType]::I_CBT_ULS, [RobotOM.IRobotCaseNature]::I_CN_PERMANENT, [RobotOM.IRobotCaseAnalizeType]::I_CAT_COMB)
$u2.CaseFactors.New(1, 1.4)
$s = $str.Cases.CreateCombination(11, "SBC SLS D+L", [RobotOM.IRobotCombinationType]::I_CBT_SLS, [RobotOM.IRobotCaseNature]::I_CN_PERMANENT, [RobotOM.IRobotCaseAnalizeType]::I_CAT_COMB)
$s.CaseFactors.New(1, 1.0); $s.CaseFactors.New(2, 1.0); $s.CaseFactors.New(3, 1.0)
$u3 = $str.Cases.CreateCombination(13, "SBC 0.9D+1.6L (uplift)", [RobotOM.IRobotCombinationType]::I_CBT_ULS, [RobotOM.IRobotCaseNature]::I_CN_PERMANENT, [RobotOM.IRobotCaseAnalizeType]::I_CAT_COMB)
$u3.CaseFactors.New(1, 0.9); $u3.CaseFactors.New(3, 1.6)
$app.Project.CalcEngine.Calculate() | Out-Null
$res = $str.Results
$bars = @(); $k = 0
foreach ($b in $m.bars) { $k++; if ($Drop -and $b.id -match $Drop) { continue }
  $mx = @{ N = 0; My = 0; Mz = 0; Fy = 0; Fz = 0 }
  foreach ($p in 0, 0.25, 0.5, 0.75, 1) { $f = $res.Bars.Forces.Value($k, 10, $p)
    if ([math]::Abs($f.FX) -gt [math]::Abs($mx.N)) { $mx.N = $f.FX }
    if ([math]::Abs($f.MY) -gt [math]::Abs($mx.My)) { $mx.My = $f.MY }
    if ([math]::Abs($f.MZ) -gt [math]::Abs($mx.Mz)) { $mx.Mz = $f.MZ }
    if ([math]::Abs($f.FY) -gt [math]::Abs($mx.Fy)) { $mx.Fy = $f.FY }
    if ([math]::Abs($f.FZ) -gt [math]::Abs($mx.Fz)) { $mx.Fz = $f.FZ } }
  $bars += [pscustomobject]@{ bar = $k; id = $b.id; sec = $b.sec; N = $mx.N; My = $mx.My; Mz = $mx.Mz; Vy = $mx.Fy; Vz = $mx.Fz } }
$nodes = @(); foreach ($n in $m.nodes) { $dd = $res.Nodes.Displacements.Value($n.id, 11)
  $nodes += [pscustomobject]@{ node = $n.id; x = $n.x; y = $n.y; z = $n.z; ux = $dd.UX; uy = $dd.UY; uz = $dd.UZ } }
$reac = @(); foreach ($n in $m.sup) { $rr = $res.Nodes.Reactions.Value($n, 10); $r13 = $res.Nodes.Reactions.Value($n, 13); $r1 = $res.Nodes.Reactions.Value($n, 1); $r2 = $res.Nodes.Reactions.Value($n, 2); $reac += [pscustomobject]@{ node = $n; FX = $rr.FX; FY = $rr.FY; FZ = $rr.FZ; FZup = $r13.FZ; FZ1 = $r1.FZ; FZ2 = $r2.FZ } }
$app.Project.SaveAs("$Dir\Madina2_ST-E2_$Tag.rtd")
$pe = $app.Project.PrintEngine; $tn = @(); $rt = $pe.ReportTemplates; for ($t = 1; $t -le $rt.Count; $t++) { $tn += $rt.Get($t) }
$log += "templates: " + ($tn -join " | ")
if ($Report) { $pe.ResetReport(); foreach ($t in @("Data", "Results")) { if ($tn -contains $t) { $pe.AddTemplateToReport($t); $log += "report template: $t" } }
  $pe.SaveReportToFile("$DirST-E2_Robot_Report_$Tag.rtf", [RobotOM.IRobotOutputFileFormat]::I_OFF_RTF_JPEG) }
[pscustomobject]@{ log = $log; bars = $bars; nodes = $nodes; reactions = $reac } | ConvertTo-Json -Depth 5 | Out-File "$Dir\ste2_results_$Tag.json" -Encoding utf8
"done: " + ($log -join "; ")

