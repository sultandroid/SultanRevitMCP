# Samaya Factory cost & pricing workbook (Arabic, live formulas) from a JSON spec.
# Usage: powershell -File build_cost_workbook.ps1 -Spec cost_spec.json -Out "COST-XXX Rev01 (مصدر الحساب).xlsx"
# Spec: { title, code, date, status, policy:{overhead,transport,margin,vat},
#         inputs:[{key,name,unit,price,source}],
#         items:[{code,desc,unit,qty,qty_note,components:[{name,input,per_unit}]}],
#         sensitivity:[{label,input,values:[..]}], inquiries:[{topic,issue,assumption,owner,impact}] }
# Sheets: المدخلات (prices + source; edit here) | تحليل البنود (cost of one unit of each item, by component) |
#         البنود (quantities x unit rates, overhead, transport, margin, VAT) | ملخص التكلفة (when inputs carry a type:
#         direct cost by type - materials, labour, subcontract - then overhead, transport, margin, VAT) | الحساسية | الاستفسارات
# Optional input.type (e.g. "مواد", "عمالة", "مقاولو باطن") groups the direct cost in ملخص التكلفة.
param([Parameter(Mandatory)][string]$Spec, [Parameter(Mandatory)][string]$Out)
$ErrorActionPreference = "Stop"
trap { Write-Host ("FAILED: " + $_.Exception.Message + " | " + $_.InvocationInfo.ScriptLineNumber + ": " + $_.InvocationInfo.Line.Trim()); break }
$S = Get-Content $Spec -Raw -Encoding UTF8 | ConvertFrom-Json
$xl = New-Object -ComObject Excel.Application; $xl.Visible = $false; $xl.DisplayAlerts = $false
function Hdr($ws, $row, $cols) { $r = $ws.Range($ws.Cells.Item($row, 1), $ws.Cells.Item($row, $cols)); $r.Font.Bold = $true; $r.Interior.Color = 0xEEE6DD; $r.Borders.LineStyle = 1 }
function Title($ws, $t, $sub) { $ws.Cells.Item(1, 1).Value2 = $t; $ws.Cells.Item(1, 1).Font.Size = 14; $ws.Cells.Item(1, 1).Font.Bold = $true; $ws.Cells.Item(2, 1).Value2 = $sub; $ws.Cells.Item(2, 1).Font.Italic = $true; $ws.DisplayRightToLeft = $true }
try {
  $wb = $xl.Workbooks.Add(); while ($wb.Worksheets.Count -lt 5) { $wb.Worksheets.Add([Type]::Missing, $wb.Worksheets.Item($wb.Worksheets.Count)) | Out-Null }
  $wIn = $wb.Worksheets.Item(1); $wIn.Name = "المدخلات"
  $wAn = $wb.Worksheets.Item(2); $wAn.Name = "تحليل البنود"
  $wIt = $wb.Worksheets.Item(3); $wIt.Name = "البنود"
  $wSe = $wb.Worksheets.Item(4); $wSe.Name = "الحساسية"
  $wQ  = $wb.Worksheets.Item(5); $wQ.Name = "الاستفسارات"
  # ---- inputs + policy
  Title $wIn "المدخلات وأساس كل سعر - $($S.title)" "كل سعر موسوم بسنده - ما بلا سند = assumed ويحتاج عرض مورد. عدّل الأسعار هنا فقط."
  $r = 4; foreach ($h in @("البند", "الوحدة", "السعر (ر.س)", "السند")) { $wIn.Cells.Item($r, 1 + [array]::IndexOf(@("البند", "الوحدة", "السعر (ر.س)", "السند"), $h)).Value2 = $h }; Hdr $wIn 4 4
  $ref = @{}; $typeOf = @{}; $types = @(); foreach ($i in $S.inputs) { if ($i.type -and ($types -notcontains [string]$i.type)) { $types += [string]$i.type } }; if ($types.Count) { $wIn.Cells.Item(4, 5).Value2 = "النوع"; Hdr $wIn 4 5; $wIn.Columns.Item(5).ColumnWidth = 14 }; $r = 5
  foreach ($i in $S.inputs) { $wIn.Cells.Item($r, 1).Value2 = $i.name; $wIn.Cells.Item($r, 2).Value2 = $i.unit; $wIn.Cells.Item($r, 3).Value2 = [double]$i.price; $wIn.Cells.Item($r, 4).Value2 = $i.source; if ($i.type) { $wIn.Cells.Item($r, 5).Value2 = [string]$i.type }; $typeOf[$i.key] = [string]$i.type
    if ($i.source -match "assumed") { $wIn.Cells.Item($r, 4).Font.Color = 0x0000C0 }
    $ref[$i.key] = "'المدخلات'!`$C`$$r"; $r++ }
  $r++; $wIn.Cells.Item($r, 1).Value2 = "سياسة التسعير"; $wIn.Cells.Item($r, 1).Font.Bold = $true; $r++
  foreach ($p in @(@("overhead", "أوفر هيد"), @("transport", "نقل"), @("margin", "هامش الربح"), @("vat", "ضريبة القيمة المضافة"))) {
    $wIn.Cells.Item($r, 1).Value2 = $p[1]; $wIn.Cells.Item($r, 3).Value2 = [double]$S.policy.($p[0]); $wIn.Cells.Item($r, 3).NumberFormat = "0%"; $ref[$p[0]] = "'المدخلات'!`$C`$$r"; $r++ }
  $wIn.Cells.Item($r, 1).Value2 = "معامل البيع (قبل الضريبة)"; $wIn.Cells.Item($r, 3).Formula = "=(1+$($ref.overhead)+$($ref.transport))*(1+$($ref.margin))"; $wIn.Cells.Item($r, 3).NumberFormat = "0.0000"; $ref.factor = "'المدخلات'!`$C`$$r"
  $wIn.Columns.Item(1).ColumnWidth = 48; $wIn.Columns.Item(2).ColumnWidth = 10; $wIn.Columns.Item(3).ColumnWidth = 13; $wIn.Columns.Item(4).ColumnWidth = 70
  # ---- analysis per item
  Title $wAn "تحليل البنود - تكلفة الوحدة الواحدة من كل بند" "مباشر ثم سعر بيع بعد الأوفر هيد والنقل والربح (قبل الضريبة)"
  $hd = @("بند", "المكوّن", "سعر المدخل", "الكمية لكل وحدة", "مباشر/وحدة", "بيع/وحدة", "نسبة", "النوع", "مباشر للبند كاملاً", "رمز البند")
  for ($c = 0; $c -lt $hd.Count; $c++) { $wAn.Cells.Item(4, $c + 1).Value2 = $hd[$c] }; Hdr $wAn 4 10
  $r = 5; $unitRef = @{}; $idx = 0
  foreach ($it in $S.items) { $qRow = 5 + $idx; $idx++
    $top = $r; $wAn.Cells.Item($r, 1).Value2 = $it.code; $wAn.Cells.Item($r, 2).Value2 = "الإجمالي - " + $it.unit; $wAn.Range("A${r}:G${r}").Font.Bold = $true; $r++
    $first = $r
    foreach ($cp in $it.components) { $wAn.Cells.Item($r, 2).Value2 = "   " + $cp.name; $wAn.Cells.Item($r, 3).Formula = "=" + $ref[$cp.input]; $wAn.Cells.Item($r, 4).Value2 = [double]$cp.per_unit
      $wAn.Cells.Item($r, 5).Formula = "=C$r*D$r"; $wAn.Cells.Item($r, 6).Formula = "=E$r*$($ref.factor)"; $wAn.Cells.Item($r, 7).Formula = "=IF(`$E`$$top=0,0,E$r/`$E`$$top)"
      $wAn.Cells.Item($r, 8).Value2 = [string]$typeOf[$cp.input]; $wAn.Cells.Item($r, 9).Formula = "=E$r*'البنود'!`$D`$$qRow"; $wAn.Cells.Item($r, 10).Value2 = [string]$it.code; $r++ }
    $last = $r - 1
    $wAn.Cells.Item($top, 5).Formula = "=SUM(E${first}:E${last})"; $wAn.Cells.Item($top, 6).Formula = "=SUM(F${first}:F${last})"; $wAn.Cells.Item($top, 7).Value2 = 1
    $unitRef[$it.code] = @("'تحليل البنود'!`$E`$$top", "'تحليل البنود'!`$F`$$top"); $r++ }
  $wAn.Range("C5:F$r").NumberFormat = "#,##0.00"; $wAn.Range("I5:I$r").NumberFormat = "#,##0.00"; $anLast = $r; $wAn.Range("G5:G$r").NumberFormat = "0.0%"; $wAn.Columns.Item(2).ColumnWidth = 52; foreach ($c in 3..7) { $wAn.Columns.Item($c).ColumnWidth = 15 }
  # ---- items summary
  Title $wIt "$($S.title) - البنود والتسعير" "$($S.code) | $($S.date) | $($S.status)"
  $hd = @("بند", "الوصف", "الوحدة", "الكمية", "سند الكمية", "مباشر/وحدة", "بيع/وحدة", "مباشر", "بيع قبل الضريبة", "ضريبة", "الإجمالي")
  for ($c = 0; $c -lt $hd.Count; $c++) { $wIt.Cells.Item(4, $c + 1).Value2 = $hd[$c] }; Hdr $wIt 4 11
  $r = 5
  foreach ($it in $S.items) { $wIt.Cells.Item($r, 1).Value2 = $it.code; $wIt.Cells.Item($r, 2).Value2 = $it.desc; $wIt.Cells.Item($r, 3).Value2 = $it.unit; $wIt.Cells.Item($r, 4).Value2 = [double]$it.qty; $wIt.Cells.Item($r, 5).Value2 = $it.qty_note
    $wIt.Cells.Item($r, 6).Formula = "=" + $unitRef[$it.code][0]; $wIt.Cells.Item($r, 7).Formula = "=" + $unitRef[$it.code][1]
    $wIt.Cells.Item($r, 8).Formula = "=D$r*F$r"; $wIt.Cells.Item($r, 9).Formula = "=D$r*G$r"; $wIt.Cells.Item($r, 10).Formula = "=I$r*$($ref.vat)"; $wIt.Cells.Item($r, 11).Formula = "=I$r+J$r"; $r++ }
  $last = $r - 1; $wIt.Cells.Item($r, 2).Value2 = "الإجمالي"; foreach ($c in 8..11) { $col = [char](64 + $c); $wIt.Cells.Item($r, $c).Formula = "=SUM(${col}5:${col}$last)" }; $wIt.Range("A${r}:K${r}").Font.Bold = $true; $wIt.Range("A4:K$r").Borders.LineStyle = 1
  $wIt.Range("D5:D$r").NumberFormat = "#,##0.0"; $wIt.Range("F5:K$r").NumberFormat = "#,##0.00"; $wIt.Columns.Item(2).ColumnWidth = 70; $wIt.Range("B5:B$r").WrapText = $true; $wIt.Columns.Item(5).ColumnWidth = 30; $wIt.Range("E5:E$r").WrapText = $true
  foreach ($c in @(1, 3, 4, 6, 7, 8, 9, 10, 11)) { $wIt.Columns.Item($c).ColumnWidth = 14 }; $totRow = $r
  # ---- cost summary by type (materials / labour / subcontract), overhead, transport, margin, VAT
  $sumTot = $null
  if ($types.Count) {
    $wSu = $wb.Worksheets.Add([Type]::Missing, $wIt); $wSu.Name = "ملخص التكلفة"
    Title $wSu "ملخص التكلفة - المواد والعمالة والأوفر هيد والربح" "التكلفة المباشرة مقسومة حسب النوع من تحليل البنود، ثم الأوفر هيد والنقل والربح والضريبة (النسب من المدخلات)"
    $AN = "'تحليل البنود'"; $hd = @("بند", "الوصف") + $types + @("المباشر", "أوفر هيد", "نقل", "التكلفة الكلية", "الربح", "بيع قبل الضريبة", "ضريبة", "الإجمالي")
    for ($c = 0; $c -lt $hd.Count; $c++) { $wSu.Cells.Item(4, $c + 1).Value2 = $hd[$c] }; Hdr $wSu 4 $hd.Count
    $nT = $types.Count; $cD = 3 + $nT
    function ColL([int]$n) { $s = ""; while ($n -gt 0) { $m = ($n - 1) % 26; $s = [string][char](65 + $m) + $s; $n = [int][Math]::Floor(($n - 1) / 26) }; return $s }
    $cA = ColL 3; $cB = ColL ($cD - 1); $cDir = ColL $cD; $cOh = ColL ($cD + 1); $cTr = ColL ($cD + 2); $cK = ColL ($cD + 3); $cMg = ColL ($cD + 4); $cSl = ColL ($cD + 5); $cVt = ColL ($cD + 6); $cEnd = ColL ($cD + 7)
    $r = 5
    foreach ($it in $S.items) {
      $wSu.Cells.Item($r, 1).Value2 = [string]$it.code; $wSu.Cells.Item($r, 2).Value2 = ([string]$it.desc).Split("(")[0].Split(":")[0].Trim()
      for ($k = 0; $k -lt $nT; $k++) { $wSu.Cells.Item($r, 3 + $k).Formula = "=SUMIFS($AN!`$I`$5:`$I`$$anLast,$AN!`$J`$5:`$J`$$anLast,`$A$r,$AN!`$H`$5:`$H`$$anLast,""$($types[$k])"")" }
      $wSu.Cells.Item($r, $cD).Formula = "=SUM($cA$($r):$cB$($r))"; $wSu.Cells.Item($r, $cD + 1).Formula = "=$cDir$r*$($ref.overhead)"; $wSu.Cells.Item($r, $cD + 2).Formula = "=$cDir$r*$($ref.transport)"
      $wSu.Cells.Item($r, $cD + 3).Formula = "=$cDir$r+$cOh$r+$cTr$r"; $wSu.Cells.Item($r, $cD + 4).Formula = "=$cK$r*$($ref.margin)"; $wSu.Cells.Item($r, $cD + 5).Formula = "=$cK$r+$cMg$r"
      $wSu.Cells.Item($r, $cD + 6).Formula = "=$cSl$r*$($ref.vat)"; $wSu.Cells.Item($r, $cD + 7).Formula = "=$cSl$r+$cVt$r"; $r++ }
    $sLast = $r - 1; $wSu.Cells.Item($r, 2).Value2 = "الإجمالي"
    for ($c = 3; $c -le $cD + 7; $c++) { $col = ColL $c; $wSu.Cells.Item($r, $c).Formula = "=SUM($($col)5:$col$sLast)" }
    $sTot = $r; $r++; $wSu.Cells.Item($r, 2).Value2 = "النسبة من المباشر"
    for ($c = 3; $c -le $cD; $c++) { $col = ColL $c; $wSu.Cells.Item($r, $c).Formula = "=IF(`$$cDir`$$sTot=0,0,$col$sTot/`$$cDir`$$sTot)" }; $wSu.Range("C$($r):$cDir$r").NumberFormat = "0.0%"
    $wSu.Range("A4:$cEnd$r").Borders.LineStyle = 1; $wSu.Range("A$($sTot):$cEnd$r").Font.Bold = $true; $wSu.Range("C5:$cEnd$sTot").NumberFormat = "#,##0"
    $wSu.Range("B5:B$sLast").WrapText = $true
    # vertical block: price structure
    $r += 3; $wSu.Cells.Item($r, 2).Value2 = "هيكل السعر"; $wSu.Cells.Item($r, 2).Font.Bold = $true; $wSu.Cells.Item($r, 2).Font.Size = 12; $r++; $blk = $r
    $rows = @(); for ($k = 0; $k -lt $nT; $k++) { $rows += ,@(("تكلفة " + $types[$k]), ("=" + (ColL (3 + $k)) + $sTot), "") }
    $rows += ,@("التكلفة المباشرة", "=$cDir$sTot", ""); $rows += ,@("أوفر هيد", "=$cOh$sTot", "=$($ref.overhead)"); $rows += ,@("نقل", "=$cTr$sTot", "=$($ref.transport)")
    $rows += ,@("التكلفة الكلية", "=$cK$sTot", ""); $rows += ,@("الربح", "=$cMg$sTot", "=$($ref.margin)"); $rows += ,@("سعر البيع قبل الضريبة", "=$cSl$sTot", "")
    $rows += ,@("ضريبة القيمة المضافة", "=$cVt$sTot", "=$($ref.vat)"); $rows += ,@("الإجمالي شامل الضريبة", "=$cEnd$sTot", "")
    foreach ($row in $rows) { $wSu.Cells.Item($r, 2).Value2 = $row[0]; $wSu.Cells.Item($r, 3).Formula = $row[1]; if ($row[2]) { $wSu.Cells.Item($r, 4).Formula = $row[2]; $wSu.Cells.Item($r, 4).NumberFormat = "0%" }
      if ($row[0] -match "^(التكلفة المباشرة|التكلفة الكلية|سعر البيع|الإجمالي)") { $wSu.Range("B$($r):D$r").Font.Bold = $true }; $r++ }
    $wSu.Range("B$($blk):D$($r - 1)").Borders.LineStyle = 1; $wSu.Range("C$($blk):C$($r - 1)").NumberFormat = "#,##0"
    $wSu.Columns.Item(1).ColumnWidth = 8; $wSu.Columns.Item(2).ColumnWidth = 48; for ($c = 3; $c -le $cD + 7; $c++) { $wSu.Columns.Item($c).ColumnWidth = 15 }
    $sumTot = @($wSu, $sTot, $cD) }
  # ---- sensitivity: what each input change does to the total (sale before VAT)
  Title $wSe "الحساسية - أثر تغيّر الأسعار المؤثرة على الإجمالي" "القيم محسوبة بنفس معادلات البنود (قبل الضريبة)"
  $hd = @("المدخل", "القيمة", "الإجمالي قبل الضريبة", "الفرق عن الأساس"); for ($c = 0; $c -lt 4; $c++) { $wSe.Cells.Item(4, $c + 1).Value2 = $hd[$c] }; Hdr $wSe 4 4
  $r = 5; foreach ($row in $S.sensitivity_rows) { $rr = [int]$r; $wSe.Cells.Item($rr, 1).Value2 = [string]$row.label; $wSe.Cells.Item($rr, 2).Value2 = [double]$row.value; $wSe.Cells.Item($rr, 3).Value2 = [double]$row.total; $wSe.Cells.Item($rr, 4).Value2 = [double]$row.diff; if ($row.base) { $wSe.Range("A${rr}:D${rr}").Font.Bold = $true }; $r = $rr + 1 }
  $wSe.Range("C5:D$r").NumberFormat = "#,##0"; $wSe.Columns.Item(1).ColumnWidth = 45; foreach ($c in 2..4) { $wSe.Columns.Item($c).ColumnWidth = 20 }
  # ---- inquiries
  Title $wQ "بنود تحتاج تأكيداً قبل التسعير النهائي" "كل افتراض مسعّر مذكور هنا"
  $hd = @("#", "الموضوع", "المشكلة", "الافتراض المسعّر", "جهة القرار", "الأثر"); for ($c = 0; $c -lt 6; $c++) { $wQ.Cells.Item(4, $c + 1).Value2 = $hd[$c] }; Hdr $wQ 4 6
  $r = 5; $n = 1; foreach ($q in $S.inquiries) { $vals = @($n, $q.topic, $q.issue, $q.assumption, $q.owner, $q.impact); for ($c = 0; $c -lt 6; $c++) { $wQ.Cells.Item($r, $c + 1).Value2 = [string]$vals[$c] }; $r++; $n++ }
  $wQ.Range("A4:F$r").WrapText = $true; $wQ.Columns.Item(1).ColumnWidth = 4; foreach ($c in 2..6) { $wQ.Columns.Item($c).ColumnWidth = 32 }
  $allWs = @($wIn, $wAn, $wIt, $wSe, $wQ); if ($sumTot) { $allWs += $sumTot[0] }; foreach ($ws in $allWs) { $ws.DisplayRightToLeft = $true; $ws.Cells.Font.Name = "Arial" }
  $wIt.Activate()
  $wb.SaveAs($Out, 51); $xl.Calculate()
  "items total sale before VAT: " + [Math]::Round([double]$wIt.Cells.Item($totRow, 9).Value2, 2) + " | VAT incl: " + [Math]::Round([double]$wIt.Cells.Item($totRow, 11).Value2, 2) + " | direct: " + [Math]::Round([double]$wIt.Cells.Item($totRow, 8).Value2, 2)
  if ($sumTot) { $line = "summary:"; for ($c = 3; $c -le $sumTot[2] + 7; $c++) { $line += " " + $sumTot[0].Cells.Item(4, $c).Value2 + "=" + [Math]::Round([double]$sumTot[0].Cells.Item($sumTot[1], $c).Value2, 0) }; $line }
  $wb.Close($true)
} finally { $xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl) }
