# Robot Structural Analysis driver (RobotOM COM): builds a 3D frame from a model JSON, runs it, saves the .rtd and writes results JSON.
# Usage: powershell -File robot_build.ps1 -Model model.json -Rtd out.rtd -Results results.json
# Model JSON (SI): nodes [{id,x,y,z}], bars [{id,n1,n2,sec,grp}], supports [node ids], loads {KEY: [[bar, px, py, pz] N/m]},
# cases [{no,key,name,nature: perm|wind}], combos [{no,name,type: ULS|SLS,f: [[case, factor]]}]. grp "* brace" = pinned at the start, "* X-brace" = pinned both ends,
# "* post" = posts (turned 90 deg if wind bends them about the weak axis). Sections: database names (IPE ...) or "SHS BxBxt".
param([Parameter(Mandatory)][string]$Model, [Parameter(Mandatory)][string]$Rtd, [Parameter(Mandatory)][string]$Results)
$ErrorActionPreference = "Stop"
Add-Type -Path "C:\Program Files\Autodesk\Robot Structural Analysis Professional 2026\Exe\Interop.RobotOM.dll"
$OUT = $Rtd
$M = Get-Content $Model -Raw -Encoding UTF8 | ConvertFrom-Json
$LT = [RobotOM.IRobotLabelType]
$app = New-Object -ComObject Robot.Application
for ($w = 0; $w -lt 60; $w++) { try { $null = $app.Project; break } catch { Start-Sleep -Seconds 2 } }
$app.Visible = 1
$app.Project.New([RobotOM.IRobotProjectType]::I_PT_FRAME_3D)
$app.Interactive = 0
$S = $app.Project.Structure
$log = @()
try { $app.Project.Preferences.SetActiveCode([RobotOM.IRobotCodeType]::I_CT_STEEL_STRUCTURES, "ANSI/AISC 360-10") | Out-Null; $log += "steel code set" } catch { $log += "steel code: " + $_.Exception.Message }

# European section database on (IPE)
$sa = $app.Project.Preferences.SectionsActive
$have = @(); for ($q = 1; $q -le $sa.Count; $q++) { $have += $sa.Get($q) }
$log += "section databases: " + ($have -join ", ")
foreach ($db in @("EURO", "UKST", "RCAT")) { if ($have -notcontains $db) { try { $r0 = $sa.Add($db); $log += "add $db -> $r0" } catch { $log += "add $db failed" } } }
# material S275
$ml = $S.Labels.Create($LT::I_LT_MATERIAL, "S275")
$md = $ml.Data
$okm = $false; try { $okm = $md.LoadFromDBase("S275") } catch {}
if (-not $okm) { $md.Type = [RobotOM.IRobotMaterialType]::I_MT_STEEL; $md.E = 2.1e11; $md.NU = 0.3; $md.RO = 77008.5; $md.LX = 1.2e-5; $md.Kirchoff = 8.1e10; $md.RE = 2.75e8; $md.RT = 4.3e8 }
$S.Labels.Store($ml); $log += "S275 from database: $okm"
$md2 = $S.Labels.Get($LT::I_LT_MATERIAL, "S275").Data; $log += "S275 check E=" + $md2.E + " RO=" + $md2.RO + " RE=" + $md2.RE + " type=" + $md2.Type

function Sec-DB($name) { $l = $S.Labels.Create($LT::I_LT_BAR_SECTION, $name); $d = $l.Data; $ok = $d.LoadFromDBase($name); $d.MaterialName = "S275"; $S.Labels.Store($l); return $ok }
function Sec-Box($name, $b, $t, $h = $null) { if ($null -eq $h) { $h = $b }
  $l = $S.Labels.Create($LT::I_LT_BAR_SECTION, $name); $d = $l.Data
  $d.Type = [RobotOM.IRobotBarSectionType]::I_BST_NS_BOX; $d.ShapeType = [RobotOM.IRobotBarSectionShapeType]::I_BSST_BOX
  $n = $d.CreateNonstd(0)
  $n.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_BOX_B, $b); $n.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_BOX_H, $h)
  $n.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_BOX_TW, $t); $n.SetValue([RobotOM.IRobotBarSectionNonstdDataValue]::I_BSNDV_BOX_TF, $t)
  $d.CalcNonstdGeometry(); $d.MaterialName = "S275"; $S.Labels.Store($l)
  return [math]::Round($d.GetValue([RobotOM.IRobotBarSectionDataValue]::I_BSDV_AX) * 1e6, 1)
}
foreach ($sn in ($M.bars.sec | Sort-Object -Unique)) { if ($sn -like "IPE *") { $log += "$sn db: " + (Sec-DB $sn) } }
foreach ($sn in ($M.bars.sec | Sort-Object -Unique)) { if ($sn -match "^SHS (\d+)x\d+x([\d.]+)$") { $log += "$sn area mm2: " + (Sec-Box $sn ([double]$Matches[1] / 1000) ([double]$Matches[2] / 1000)) } elseif ($sn -match "^RHS (\d+)x(\d+)x([\d.]+)$") { $log += "$sn area mm2: " + (Sec-Box $sn ([double]$Matches[1] / 1000) ([double]$Matches[3] / 1000) ([double]$Matches[2] / 1000)) } elseif ($sn -notlike "IPE *") { $log += "$sn db: " + (Sec-DB $sn) } }

# releases: brace pinned at the post end (the foot is a pinned support); X-brace pinned both ends
# Robot: I_BERV_NONE = no release (rigid), I_BERV_FIXED = released
$F = [RobotOM.IRobotBarEndReleaseValue]::I_BERV_NONE; $R = [RobotOM.IRobotBarEndReleaseValue]::I_BERV_FIXED
foreach ($pair in @(@("PIN-START", $true, $false), @("PIN-BOTH", $true, $true))) {
  $l = $S.Labels.Create($LT::I_LT_BAR_RELEASE, $pair[0]); $d = $l.Data
  foreach ($e in @(@($d.StartNode, $pair[1]), @($d.EndNode, $pair[2]))) { $n = $e[0]; $n.UX = $F; $n.UY = $F; $n.UZ = $F; $n.RX = $F; $n.RY = $(if ($e[1]) { $R } else { $F }); $n.RZ = $(if ($e[1]) { $R } else { $F }) }
  $S.Labels.Store($l)
}
$l = $S.Labels.Create($LT::I_LT_SUPPORT, "PINNED"); $d = $l.Data; $d.UX = 1; $d.UY = 1; $d.UZ = 1; $d.RX = 0; $d.RY = 0; $d.RZ = 0; $S.Labels.Store($l)

foreach ($n in $M.nodes) { $S.Nodes.Create([int]$n.id, [double]$n.x, [double]$n.y, [double]$n.z) }
$log += "nodes made: " + $S.Nodes.GetAll().Count
foreach ($b in $M.bars) {
  $S.Bars.Create([int]$b.id, [int]$b.n1, [int]$b.n2); $bar = $S.Bars.Get([int]$b.id)
  $bar.SetLabel($LT::I_LT_BAR_SECTION, $b.sec)
  if ($b.grp -like "* brace") { $bar.SetLabel($LT::I_LT_BAR_RELEASE, "PIN-START") }
  if ($b.grp -like "* X-brace") { $bar.SetLabel($LT::I_LT_BAR_RELEASE, "PIN-BOTH") }
}
Write-Host ($log -join "`n")
$sel = $S.Selections.Create([RobotOM.IRobotObjectType]::I_OT_NODE); $sel.FromText((@($M.supports) -join " ")); Write-Host ("support nodes selected: " + $sel.Count)
$S.Nodes.SetLabel($sel, $LT::I_LT_SUPPORT, "PINNED")
$all = $S.Nodes.GetAll(); $supSet = @{}; foreach ($sp in $M.supports) { $supSet[[int]$sp] = 1 }; $nsup = 0; $nhas = 0
for ($q = 1; $q -le $all.Count; $q++) { $nd = $all.Get($q); if ($supSet.ContainsKey([int]$nd.Number)) { if (-not $nd.HasLabel($LT::I_LT_SUPPORT)) { $nd.SetLabel($LT::I_LT_SUPPORT, "PINNED") }; $nsup++; if ($nd.HasLabel($LT::I_LT_SUPPORT)) { $nhas++ } } }
$log += "support nodes $nsup, with support label $nhas"

# load cases
$nat = @{ perm = [RobotOM.IRobotCaseNature]::I_CN_PERMANENT; wind = [RobotOM.IRobotCaseNature]::I_CN_WIND }
foreach ($c in $M.cases) {
  $S.Cases.CreateSimple([int]$c.no, [string]$c.name, $nat[$c.nature], [RobotOM.IRobotCaseAnalizeType]::I_CAT_STATIC_LINEAR) | Out-Null
  $case = $S.Cases.Get([int]$c.no)
  if ($c.key -eq "D1") { $i = $case.Records.New([RobotOM.IRobotLoadRecordType]::I_LRT_DEAD); $r = $case.Records.Get($i); $r.SetValue([RobotOM.IRobotDeadRecordValues]::I_DRV_Z, -1); $r.SetValue([RobotOM.IRobotDeadRecordValues]::I_DRV_ENTIRE_STRUCTURE, 1) }
  foreach ($ld in $M.loads.($c.key)) {
    $i = $case.Records.New([RobotOM.IRobotLoadRecordType]::I_LRT_BAR_UNIFORM); $r = $case.Records.Get($i)
    $r.SetValue([RobotOM.IRobotBarUniformRecordValues]::I_BURV_PX, [double]$ld[1]); $r.SetValue([RobotOM.IRobotBarUniformRecordValues]::I_BURV_PY, [double]$ld[2]); $r.SetValue([RobotOM.IRobotBarUniformRecordValues]::I_BURV_PZ, [double]$ld[3])
    $r.Objects.FromText([string]$ld[0])
  }
}
foreach ($cb in $M.combos) {
  $t = $(if ($cb.type -eq "ULS") { [RobotOM.IRobotCombinationType]::I_CBT_ULS } else { [RobotOM.IRobotCombinationType]::I_CBT_SLS })
  $S.Cases.CreateCombination([int]$cb.no, [string]$cb.name, $t, [RobotOM.IRobotCaseNature]::I_CN_PERMANENT, [RobotOM.IRobotCaseAnalizeType]::I_CAT_COMB) | Out-Null
  $comb = $S.Cases.Get([int]$cb.no); foreach ($f in $cb.f) { $comb.CaseFactors.New([int]$f[0], [double]$f[1]) | Out-Null }
}
foreach ($nm in ($M.bars.sec | Sort-Object -Unique)) { $sd = $S.Labels.Get($LT::I_LT_BAR_SECTION, $nm).Data; $log += "$nm AX=" + $sd.GetValue([RobotOM.IRobotBarSectionDataValue]::I_BSDV_AX) + " IY=" + $sd.GetValue([RobotOM.IRobotBarSectionDataValue]::I_BSDV_IY) + " IZ=" + $sd.GetValue([RobotOM.IRobotBarSectionDataValue]::I_BSDV_IZ) + " IX=" + $sd.GetValue([RobotOM.IRobotBarSectionDataValue]::I_BSDV_IX) + " mat=" + $sd.MaterialName }
foreach ($id in @(1, 9, 10, 55)) { $bb = $S.Bars.Get($id); $sn = "-"; $rn = "-"; try { $sn = $bb.GetLabelName($LT::I_LT_BAR_SECTION) } catch {}; try { $rn = $bb.GetLabelName($LT::I_LT_BAR_RELEASE) } catch {}; $log += "bar $id sec=$sn rel=$rn len=" + $bb.Length }
$log += "length unit: " + $app.Project.Preferences.Units.Get([RobotOM.IRobotUnitType]::I_UT_LENGTH).Name
$log += "model: " + $S.Nodes.GetAll().Count + " nodes, " + $S.Bars.GetAll().Count + " bars, " + $S.Cases.GetAll().Count + " cases"

# run; make sure the posts bend about their strong axis under wind (|My| > |Mz| at the post base)
$post = ($M.bars | Where-Object { $_.grp -like "* post" } | Sort-Object { -[math]::Abs($M.nodes[$_.n2 - 1].z - $M.nodes[$_.n1 - 1].z) } | Select-Object -First 1).id; $log += "check bar $post (post below the brace joint)"
$postIds = ($M.bars | Where-Object { $_.grp -like "* post" }).id -join " "
$calc = $app.Project.CalcEngine
try { $calc.AnalysisParams.IgnoreWarnings = $true; $log += "ignore warnings on" } catch { $log += "IgnoreWarnings n/a" }
try { $calc.AnalysisParams.AutoVerification = [RobotOM.IRobotStructureAutoVerificationType]::I_SAVT_NONE; $log += "auto verification off" } catch { $log += "AutoVerification n/a: " + $_.Exception.Message }
$rc = $calc.Calculate(); $log += "calculate: $rc"
try { $log += "results available: " + $S.Results.Available } catch { $log += "Results.Available n/a" }
$topNode = ($M.nodes | Where-Object { $_.x -eq 0 -and [math]::Abs($_.y - 0.168) -lt 0.001 } | Sort-Object z | Select-Object -Last 1).id
$dd = $S.Results.Nodes.Displacements.Value([int]$topNode, 2); $log += ("top of first B post under W1: UY {0:N2} mm, UX {1:N2} mm" -f ($dd.UY * 1000), ($dd.UX * 1000))
$f = $S.Results.Bars.Forces.Value([int]$post, 2, [double]1)
$log += ("post base under W1: My {0:N0} Nm, Mz {1:N0} Nm" -f $f.MY, $f.MZ)
if ([math]::Abs($f.MZ) -gt [math]::Abs($f.MY)) {
  $sel = $S.Selections.Create([RobotOM.IRobotObjectType]::I_OT_BAR); $sel.FromText($postIds)
  foreach ($g in @(90, ([math]::PI / 2))) {
    foreach ($id in ($postIds -split " ")) { $S.Bars.Get([int]$id).Gamma = $g }
    $rc = $calc.Calculate(); $f = $S.Results.Bars.Forces.Value([int]$post, 2, [double]1)
    $log += ("gamma {2}: My {0:N0} Nm, Mz {1:N0} Nm" -f $f.MY, $f.MZ, $g)
    if ([math]::Abs($f.MY) -gt [math]::Abs($f.MZ)) { break }
  }
}
$app.Interactive = 1
$app.Project.SaveAs($OUT); $log += "saved: $OUT"

# results
$res = @{ bars = @(); nodes = @(); log = $log }
$cases = @($M.cases.no) + @($M.combos.no)
foreach ($b in $M.bars) {
  foreach ($cn in $cases) { foreach ($x in @(0, 0.5, 1)) {
    $v = $S.Results.Bars.Forces.Value([int]$b.id, [int]$cn, [double]$x)
    $res.bars += , @($b.id, $cn, $x, [math]::Round($v.FX), [math]::Round($v.FY), [math]::Round($v.FZ), [math]::Round($v.MX), [math]::Round($v.MY), [math]::Round($v.MZ))
  } }
}
foreach ($n in $M.nodes) { foreach ($cn in $cases) {
  $d = $S.Results.Nodes.Displacements.Value([int]$n.id, [int]$cn)
  $row = @($n.id, $cn, [math]::Round($d.UX * 1000, 2), [math]::Round($d.UY * 1000, 2), [math]::Round($d.UZ * 1000, 2))
  if ($M.supports -contains $n.id) { $rr = $S.Results.Nodes.Reactions.Value([int]$n.id, [int]$cn); $row += @([math]::Round($rr.FX), [math]::Round($rr.FY), [math]::Round($rr.FZ)) }
  $res.nodes += , $row
} }
$res | ConvertTo-Json -Depth 5 -Compress | Set-Content $Results -Encoding UTF8
$log
