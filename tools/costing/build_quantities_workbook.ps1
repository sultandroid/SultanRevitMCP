# Samaya Factory quantities (take-off) workbook from a JSON take-off.
# Usage: powershell -File build_quantities_workbook.ps1 -Takeoff takeoff.json -Out "<PRJ>_Hoarding_Quantities_Rev01.xlsx" -Title "..."
# takeoff.json: { steel:[{component,section,count,length_m,kg_m,weight_kg}], plates:[{component,count,kg_each,weight_kg}],
#                 anchors:{k:n}, summary:[[item,qty,unit,note]], doors:[{mark,desc,n}] }
param([Parameter(Mandatory)][string]$Takeoff, [Parameter(Mandatory)][string]$Out, [string]$Title = "SITE HOARDING - TAKE-OFF FROM THE MODEL")
$ErrorActionPreference = "Stop"
$T = Get-Content $Takeoff -Raw -Encoding UTF8 | ConvertFrom-Json
$xl = New-Object -ComObject Excel.Application; $xl.Visible = $false; $xl.DisplayAlerts = $false
function Put($ws, $rows, $hdrRow) { $rr = 1; foreach ($row in $rows) { $col = 1; foreach ($v in $row) { if ($v -is [double] -or $v -is [int] -or $v -is [long] -or $v -is [decimal]) { $ws.Cells.Item($rr, $col).Value2 = [double]$v } else { $ws.Cells.Item($rr, $col).Value2 = [string]$v }; $col++ }; $rr++ }
  $ws.Columns.AutoFit() | Out-Null; $ws.Rows.Item(1).Font.Bold = $true; $ws.Rows.Item(1).Font.Size = 12; if ($hdrRow) { $ws.Rows.Item($hdrRow).Font.Bold = $true; $ws.Rows.Item($hdrRow).Interior.Color = 0xEEE6DD } ; $ws.Cells.Font.Name = "Arial" }
try {
  $wb = $xl.Workbooks.Add(); while ($wb.Worksheets.Count -lt 3) { $wb.Worksheets.Add([Type]::Missing, $wb.Worksheets.Item($wb.Worksheets.Count)) | Out-Null }
  $ws = $wb.Worksheets.Item(1); $ws.Name = "Steel"
  $rows = @(,@($Title)); $rows += ,@("Net quantities from the model geometry, no waste allowance. Lengths are member centrelines. Plates and anchors ASSUMED - structural check needed."); $rows += ,@("")
  $rows += ,@("Component", "Section", "Count", "Total length (m)", "kg/m", "Weight (kg)")
  foreach ($s in $T.steel) { $rows += ,@($s.component, $s.section, $s.count, $s.length_m, $s.kg_m, $s.weight_kg) }
  foreach ($p in $T.plates) { $rows += ,@($p.component, "Plate", $p.count, "", ("{0} kg each" -f $p.kg_each), $p.weight_kg) }
  $tot = ($T.steel | Measure-Object weight_kg -Sum).Sum + ($T.plates | Measure-Object weight_kg -Sum).Sum
  $rows += ,@(""); $rows += ,@("TOTAL STEEL", "", "", "", "", $tot); $rows += ,@(""); $rows += ,@("Weight by section")
  foreach ($g in ($T.steel | Group-Object section)) { $rows += ,@($g.Name, "", "", (($g.Group | Measure-Object length_m -Sum).Sum), "", (($g.Group | Measure-Object weight_kg -Sum).Sum)) }
  $rows += ,@("Plates", "", "", "", "", (($T.plates | Measure-Object weight_kg -Sum).Sum))
  Put $ws $rows 4
  $ws = $wb.Worksheets.Item(2); $ws.Name = "Face, base, doors"
  $rows = @(,@("Item", "Quantity", "Unit", "Note")); foreach ($s in $T.summary) { $rows += ,@($s[0], $s[1], $s[2], $s[3]) }
  foreach ($d in $T.doors) { $rows += ,@("Door " + $d.mark + ": " + $d.desc, $d.n, "no.", "drawing A-1103") }
  Put $ws $rows 1
  $ws = $wb.Worksheets.Item(3); $ws.Name = "Anchors"
  $rows = @(,@("Anchors", "Count")); foreach ($pr in $T.anchors.PSObject.Properties) { $rows += ,@($pr.Name, $pr.Value) }; $rows += ,@("TOTAL", (($T.anchors.PSObject.Properties | Measure-Object Value -Sum).Sum))
  Put $ws $rows 1
  $wb.Worksheets.Item(1).Activate(); $wb.SaveAs($Out, 51); $wb.Close($true); "saved $Out  steel $tot kg"
} finally { $xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl) }
