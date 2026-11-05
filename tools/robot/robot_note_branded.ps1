# Robot calculation note with Samaya Factory branding, exported from Robot itself.
# Sets Robot's page setup (A4, margins, header with logo, footer with page no., title page with both logos and a
# document table), adds a lean set of views and tables, saves the RTF and converts it to PDF with Word (no restyling).
# Usage: powershell -File robot_note_branded.ps1 -Config note.json
# note.json: { rtd, out_rtf, out_pdf, logo, client_logo, title, subtitle, project_en, project_ar, project_no,
#   client_en, client_ar, doc_no, rev, status, date, prepared, checked, approved, codes, cases_diagram, case_defl,
#   tables: ["sections","supports","loads","combinations","reactions_env","reaction_totals","displ_extremes",
#            "forces_extremes","stresses_extremes", (optional) "nodes","bars","forces_env","displ_env"] }
param([Parameter(Mandatory)][string]$Config, [switch]$PolishOnly)   # -PolishOnly: skip Robot, re-format the saved RTF only
$ErrorActionPreference = "Stop"
$K = Get-Content $Config -Raw -Encoding UTF8 | ConvertFrom-Json
Add-Type -Path "C:\Program Files\Autodesk\Robot Structural Analysis Professional 2026\Exe\Interop.RobotOM.dll"
Add-Type -AssemblyName System.Drawing
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("robot_note_" + [guid]::NewGuid().ToString("N").Substring(0, 8)); New-Item -ItemType Directory $tmp | Out-Null

# ---------- RTF helpers ----------
function RtfText([string]$s) {   # escape, non-ASCII as \uN?
  $sb = New-Object Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) { $c = [int]$ch
    if ($ch -eq '\' -or $ch -eq '{' -or $ch -eq '}') { [void]$sb.Append('\' + $ch) }
    elseif ($c -gt 127) { $v = if ($c -gt 32767) { $c - 65536 } else { $c }; [void]$sb.Append("\u$v?") }
    else { [void]$sb.Append($ch) } }
  $sb.ToString() }
function RtfPng([string]$path, [double]$widthMm) {
  $img = [Drawing.Image]::FromFile($path); $pw = $img.Width; $ph = $img.Height; $img.Dispose()
  $gw = [int]($widthMm * 56.693); $gh = [int]($gw * $ph / $pw)
  $hex = [BitConverter]::ToString([IO.File]::ReadAllBytes($path)).Replace("-", "").ToLower()
  $lines = for ($i = 0; $i -lt $hex.Length; $i += 128) { $hex.Substring($i, [Math]::Min(128, $hex.Length - $i)) }
  "{\pict\pngblip\picw$pw\pich$ph\picwgoal$gw\pichgoal$gh`r`n" + ($lines -join "`r`n") + "}" }
$HEAD = '{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0\fswiss\fcharset0 Arial;}{\f1\fswiss\fcharset178 Arial;}}{\colortbl;\red31\green42\blue63;\red102\green102\blue102;\red238\green238\blue238;}'
$TW = 9638   # text width in twips (A4 210 - 20 - 20 mm)

# Header: logo left, title and document number right, rule under
$hdr = $HEAD + '\pard\tqr\tx' + $TW + '\sb0\sa60\brdrb\brdrs\brdrw10\brsp40\f0\fs16\cf2 ' + (RtfPng $K.logo 26) + '\tab ' +
  '\b\cf1 ' + (RtfText $K.title) + '\b0\cf2  | ' + (RtfText $K.doc_no) + ' Rev ' + (RtfText $K.rev) + '\par}'
# Footer
$ftr = $HEAD + '\pard\tqc\tx' + [int]($TW / 2) + '\tqr\tx' + $TW + '\brdrt\brdrs\brdrw10\brsp40\f0\fs16\cf2 Samaya Factory | samaya-factory.com\tab ' +
  (RtfText $K.project_no) + ' - Robot file @PROJECT_FILE@\tab Date @DATE@   Page \b @PAGE_NUMBER@\b0\par}'
# Title page
function Row([string]$a, [string]$b) {
  '\trowd\trgaph100\trleft0\clbrdrt\brdrs\brdrw10\clbrdrl\brdrs\brdrw10\clbrdrb\brdrs\brdrw10\clbrdrr\brdrs\brdrw10\clcbpat3\cellx2700' +
  '\clbrdrt\brdrs\brdrw10\clbrdrl\brdrs\brdrw10\clbrdrb\brdrs\brdrw10\clbrdrr\brdrs\brdrw10\cellx' + $TW +
  '\pard\intbl\sb40\sa40\f0\fs18\b ' + (RtfText $a) + '\b0\cell\pard\intbl\sb40\sa40\f0\fs18 ' + (RtfText $b) + '\cell\row' + "`r`n" }
# Arabic as a picture: Robot's RTF reader drops the numbers from \uN escapes, which breaks the file for Word.
$script:arN = 0
function ArPng([string]$s, [double]$pt) {
  $scale = 6; $f = New-Object Drawing.Font("Arial", [single]($pt * $scale), [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Point)
  $fmt = New-Object Drawing.StringFormat([Drawing.StringFormatFlags]::DirectionRightToLeft)
  $g0 = [Drawing.Graphics]::FromImage((New-Object Drawing.Bitmap 1, 1)); $sz = $g0.MeasureString($s, $f, 100000, $fmt); $g0.Dispose()
  $bmp = New-Object Drawing.Bitmap([int]$sz.Width + 8), ([int]$sz.Height + 4)   # no SetResolution before drawing: it rescales Point fonts
  $g = [Drawing.Graphics]::FromImage($bmp); $g.Clear([Drawing.Color]::White); $g.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.DrawString($s, $f, (New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(31, 42, 63))), (New-Object Drawing.RectangleF(0, 2, ($sz.Width + 8), $sz.Height)), $fmt); $g.Dispose()
  $script:arN++; $p = Join-Path $tmp "ar$($script:arN).png"; $bmp.Save($p, [Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  $wmm = ($sz.Width + 8) / ($scale * 96) * 25.4; RtfPng $p $wmm }
$ar = { param($s, $fs) '\pard\qc\sa60 ' + (ArPng $s ($fs / 2)) + '\par' + "`r`n" }
$tp = $HEAD + "`r`n" + '\pard\qc\sb200\sa200 ' + (RtfPng $K.logo 62) + '\par' + "`r`n" +
  '\pard\qc\sb600\sa80\f0\fs44\b\cf1 ' + (RtfText "STRUCTURAL CALCULATION NOTE") + '\par' +
  '\pard\qc\sa60\fs26\b0\cf0 ' + (RtfText $K.subtitle) + '\par' +
  '\pard\qc\sa360\fs20\cf2 Analysis and results exported from Autodesk Robot Structural Analysis Professional 2026\par' + "`r`n" +
  (& $ar $K.project_ar 28) +
  '\pard\qc\sa40\f0\fs24\b\cf0 ' + (RtfText $K.project_en) + '\b0\par' +
  '\pard\qc\sa300\fs20 Project No. ' + (RtfText $K.project_no) + '\par' + "`r`n" +
  '\pard\qc\sa60\fs16\b\cf2 CLIENT\b0\cf0\par\pard\qc\sa60 ' + (RtfPng $K.client_logo 46) + '\par' + "`r`n" +
  (& $ar $K.client_ar 22) +
  '\pard\qc\sa360\f0\fs20 ' + (RtfText $K.client_en) + '\par' + "`r`n"
foreach ($r in @(@("Document No.", $K.doc_no), @("Revision", "$($K.rev) - $($K.status)"), @("Date", $K.date), @("Design codes", $K.codes),
  @("Robot model", "@PROJECT_FILE@"), @("Prepared by", $K.prepared), @("Checked by", $K.checked), @("Approved by", $K.approved))) { $tp += Row $r[0] $r[1] }
$tp += '\pard\qc\sb300\f0\fs14\cf2 ' + (RtfText "This document is the property of Samaya Factory. Preliminary issue for review; not for construction until approved.") + '\par}'
foreach ($p in @(@("hdr.rtf", $hdr), @("ftr.rtf", $ftr), @("tp.rtf", $tp))) { [IO.File]::WriteAllText((Join-Path $tmp $p[0]), $p[1], [Text.Encoding]::ASCII) }

# ---------- Robot ----------
$log = @()
if (-not $PolishOnly) {
$app = New-Object -ComObject Robot.Application
for ($w = 0; $w -lt 60; $w++) { try { $null = $app.Project; break } catch { Start-Sleep -Seconds 2 } }
$app.Visible = 1
if ($app.Project.FileName -ne $K.rtd -or -not $app.Project.IsActive) { $app.Project.Open($K.rtd) }
$app.Interactive = 0
$log += "opened: " + $app.Project.FileName
try {
  if (-not $app.Project.Structure.Results.Available) { $log += "calculate: " + $app.Project.CalcEngine.Calculate() }
  # metric units
  $U = $app.Project.Preferences.Units; $UT = [RobotOM.IRobotUnitType]
  foreach ($p in @(@($UT::I_UT_STRUCTURE_DIMENSION, "m"), @($UT::I_UT_SECTION_DIMENSION, "mm"), @($UT::I_UT_SECTION_PROPERTIES, "cm"), @($UT::I_UT_FORCE, "kN"), @($UT::I_UT_DISPLACEMENT, "mm"))) { try { $d = $U.Get($p[0]); $d.Name = $p[1]; $U.Set($p[0], $d) } catch {} }
  foreach ($cx in @(@($UT::I_UT_MOMENT, "kN", "m"), @($UT::I_UT_STRESS, "MN", "m"))) { try { $d = $U.Get($cx[0]); $d.Name = $cx[1]; $d.Name2 = $cx[2]; $U.Set($cx[0], $d) } catch {} }
  try { $U.Refresh() } catch {}
  # project variables
  $V = $app.Project.PrintEngine.PageSetup.Variables; $VI = [RobotOM.IRobotVariablePredefinedId]
  foreach ($pv in @(@($VI::I_VPI_USER_NAME, $K.prepared), @($VI::I_VPI_COMPANY_NAME, "Samaya Factory"), @($VI::I_VPI_INVESTOR_NAME, $K.client_en), @($VI::I_VPI_PROJECT_REFERENCE, $K.project_no), @($VI::I_VPI_PROJECT_COMMENT, $K.project_en))) { try { [void]$V.SetPredefinedValue($pv[0], [string]$pv[1]) } catch {} }
  # page setup
  $ps = $app.Project.PrintEngine.PageSetup
  $ps.PaperSize = 9; $ps.PageOrientation = [RobotOM.IRobotPageSetupOrientation]::I_PSO_PORTRAIT
  $ps.MarginTop = 22; $ps.MarginBottom = 18; $ps.MarginLeft = 20; $ps.MarginRight = 20; $ps.FromEdgeHeader = 8; $ps.FromEdgeFooter = 8
  $ps.TextFrame = [RobotOM.IRobotPageSetupFrameType]::I_PSFT_NONE
  foreach ($e in @(@("Header", "hdr.rtf"), @("Footer", "ftr.rtf"), @("TitlePage", "tp.rtf"))) { $el = $ps.($e[0]); $el.Active = $true; $el.Frame = [RobotOM.IRobotPageSetupFrameType]::I_PSFT_NONE; $log += "$($e[0]) loaded: " + $el.LoadFromFile((Join-Path $tmp $e[1])) }
  try { $ps.Toc.Active = $true; $ps.Toc.IncludeTitle = $true } catch {}
  [void]$ps.Save()
  # report content
  $pe = $app.Project.PrintEngine; $pe.ResetReport()
  $VT = [RobotOM.IRobotViewType]; $VP = [RobotOM.IRobotViewProjection]; $OT = [RobotOM.IRobotObjectType]
  $views = if ($K.images) { @() } else { @(@("structure", ""), @("defl", [string]$K.case_defl), @("My", [string]$K.cases_diagram)) }   # with images (high-res pictures), Robot screen views are left out
  foreach ($vw in $views) {
    try { $v = $app.Project.ViewMngr.CreateView($VT::I_VT_STANDARD); $v.Projection = $VP::I_VP_3DXYZ
      if ($vw[0] -eq "My") { $dt = [Enum]::GetNames([RobotOM.IRobotViewDiagramResultType]) | Where-Object { $_ -match "_MY$" } | Select-Object -First 1; $v.ParamsDiagram.Set([RobotOM.IRobotViewDiagramResultType]::$dt, 1); $v.Selection.Get($OT::I_OT_CASE).FromText($vw[1]) }
      if ($vw[0] -eq "defl") { try { $v.ParamsDeformation.Active = $true } catch { try { $v.ParamsDeformation.Set(1) } catch {} }; $v.Selection.Get($OT::I_OT_CASE).FromText($vw[1]) }
      $v.Redraw(1); $pe.AddToReport($v.Printable); $log += "view $($vw[0]): added" } catch { $log += "view $($vw[0]): " + $_.Exception.Message.Split("`n")[0] } }
  $TT = [RobotOM.IRobotTableType]; $TD = [RobotOM.IRobotTableDataType]
  $map = @{ sections = @($TT::I_TT_PROPERTIES, $TD::I_TDT_DEFAULT); nodes = @($TT::I_TT_NODES, $TD::I_TDT_DEFAULT); bars = @($TT::I_TT_BARS, $TD::I_TDT_DEFAULT)
    supports = @($TT::I_TT_SUPPORTS, $TD::I_TDT_DEFAULT); loads = @($TT::I_TT_LOADS, $TD::I_TDT_DEFAULT); combinations = @($TT::I_TT_COMBINATIONS, $TD::I_TDT_DEFAULT)
    reactions_env = @($TT::I_TT_REACTIONS, $TD::I_TDT_ENVELOPE); reaction_totals = @($TT::I_TT_REACTIONS, $TD::I_TDT_TOTAL)
    displ_env = @($TT::I_TT_NODE_DISPLACEMENTS, $TD::I_TDT_ENVELOPE); displ_extremes = @($TT::I_TT_NODE_DISPLACEMENTS, $TD::I_TDT_EXTREMES)
    forces_env = @($TT::I_TT_FORCES, $TD::I_TDT_ENVELOPE); forces_extremes = @($TT::I_TT_FORCES, $TD::I_TDT_EXTREMES); stresses_extremes = @($TT::I_TT_STRESSES, $TD::I_TDT_EXTREMES) }
  foreach ($t in $K.tables) { try { $tab = $app.Project.ViewMngr.CreateTable($map[$t][0], $map[$t][1]); $pe.AddToReport($tab.Printable); $log += "table ${t}: added" } catch { $log += "table ${t}: " + $_.Exception.Message.Split("`n")[0] } }
  $ok = $pe.SaveReportToFile($K.out_rtf, [RobotOM.IRobotOutputFileFormat]::I_OFF_RTF_JPEG); $log += "rtf saved: $ok " + (Get-Item $K.out_rtf).Length
} finally { $app.Interactive = 1 }
}

# ---------- RTF -> DOCX + PDF (Word tidy-up) ----------
if ($K.out_pdf) {
  $wd = New-Object -ComObject Word.Application; $wd.Visible = $false; $wd.DisplayAlerts = 0
  $wd.ScreenUpdating = $false
  try { $doc = $wd.Documents.Open($K.out_rtf, $false, $false)
    $wd.Options.Pagination = $false
    # 1 drop Robot's empty first page (everything before the first page break, when it holds no text)
    $txt = $doc.Content.Text; $pb = $txt.IndexOf([char]12)
    if ($pb -ge 0 -and $txt.Substring(0, $pb).Trim().Length -eq 0) { $doc.Range(0, $pb + 1).Delete() | Out-Null; $log += "blank first page removed" }
    # 2 one font for the Robot body (title page and header are Arial already)
    $doc.Content.Font.Name = "Arial"
    # 3 view captions as headings
    foreach ($p in $doc.Paragraphs) { $t = $p.Range.Text; if ($t -match "^(View:|Cases:|\s*-\s*Cases:)") { $p.Range.Font.Size = [single]10; $p.Range.Font.Bold = 1; $p.Range.Font.Color = 0x3F2A1F; $p.KeepWithNext = -1; $p.SpaceBefore = [single]8 } }
    # 4 pictures after the title page to the full text width
    $tw = [single]($doc.PageSetup.PageWidth - $doc.PageSetup.LeftMargin - $doc.PageSetup.RightMargin)
    if (-not $K.images) { $i = 0; foreach ($s in $doc.InlineShapes) { $i++; if ($i -le 4) { continue }; $s.LockAspectRatio = -1; if ($s.Width -lt $tw) { $s.Width = $tw } } }
    # 4b high-res result pictures (config images: [{path, caption}]) at the start of the body, one or two per page
    if ($K.images) {
      $t0 = $doc.Content.Text; $pb2 = $t0.IndexOf([char]12)
      $at = $doc.Range($pb2 + 1, $pb2 + 1)
      $at.InsertParagraphBefore(); $at = $doc.Range($pb2 + 1, $pb2 + 1)
      $at.Text = "Analysis results - pictures"; $at.Font.Size = [single]13; $at.Font.Bold = 1; $at.Font.Color = 0x3F2A1F; $at.ParagraphFormat.SpaceAfter = [single]6
      $cur = $at.End
      $k2 = 0
      foreach ($im in $K.images) { $k2++
        $r = $doc.Range($cur, $cur); $r.InsertParagraphAfter(); $r = $doc.Range($cur + 1, $cur + 1)
        $sh = $doc.InlineShapes.AddPicture([string]$im.path, $false, $true, $r); $sh.LockAspectRatio = -1; $sh.Width = $tw
        $sh.Range.ParagraphFormat.Alignment = 1; $sh.Range.ParagraphFormat.KeepWithNext = -1; $sh.Range.ParagraphFormat.SpaceBefore = [single]6
        $e = $sh.Range.End; $c = $doc.Range($e, $e); $c.InsertParagraphAfter(); $c = $doc.Range($e + 1, $e + 1)
        $c.Text = "Figure " + $k2 + "  " + [string]$im.caption; $c.Font.Size = [single]8.5; $c.Font.Italic = 1; $c.Font.Bold = 0; $c.ParagraphFormat.Alignment = 1; $c.ParagraphFormat.SpaceAfter = [single]10
        $cur = $c.End
        if ($k2 % 2 -eq 0 -or $k2 -eq $K.images.Count) { $pbr = $doc.Range($cur, $cur); $pbr.InsertBreak(7); $cur = $cur + 1 } }
      $log += "pictures inserted: $k2" }
    # 5 tables (skip the title-page table): Arial 7, shaded repeating header, rows kept whole, fitted to the page width
    # Robot writes each table on a wide grid of mostly empty cells, so Word cannot fit it. Rebuild every table:
    # read the values row by row, drop columns that are empty in every row, and convert clean tab text back to a table.
    $EOC = [string][char]13 + [char]7
    $tabs = @(); foreach ($t in $doc.Tables) { $tabs += $t }
    $nOk = 0
    for ($ti = $tabs.Count - 1; $ti -ge 1; $ti--) { $t = $tabs[$ti]
      $rows = New-Object System.Collections.ArrayList
      try { foreach ($row in $t.Rows) { $parts = $row.Range.Text -split [regex]::Escape($EOC); $cells = @($parts[0..($parts.Count - 2)] | ForEach-Object { ($_ -replace "[\r\n\v\t\a]+", " ").Trim() }); [void]$rows.Add($cells) } }
      catch { $rows.Clear(); $cur = -1; $line = $null
        foreach ($c in $t.Range.Cells) { if ($c.RowIndex -ne $cur) { if ($line) { [void]$rows.Add(@($line)) }; $line = New-Object System.Collections.ArrayList; $cur = $c.RowIndex }
          [void]$line.Add(($c.Range.Text -replace "[\r\n\v\t\a]+", " ").Trim()) }
        if ($line) { [void]$rows.Add(@($line)) } }
      $rows = @($rows | Where-Object { ($_ -join "").Trim().Length -gt 0 })
      if ($rows.Count -eq 0) { continue }
      $nc = ($rows | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
      $keep = @(0..($nc - 1) | Where-Object { $ci = $_; @($rows | Where-Object { $ci -lt $_.Count -and $_[$ci] -ne "" }).Count -gt 0 })
      # columns with the same value in every data row carry no information: list them once under the table
      $const = @()
      if ($rows.Count -ge 4 -and $keep.Count -gt 8) {
        $keep = @($keep | Where-Object { $ci = $_; $vals = @($rows[1..($rows.Count - 1)] | ForEach-Object { if ($ci -lt $_.Count) { $_[$ci] } else { "" } } | Sort-Object -Unique)
          if ($vals.Count -le 1 -and $ci -gt 0) { $hd = if ($ci -lt $rows[0].Count) { $rows[0][$ci] } else { "" }; $v = "$($vals[0])"; if ($v) { $script:const += $(if ($hd) { "$hd = $v" } else { $v }) }; $false } else { $true } }) }
      $text = ($rows | ForEach-Object { $r = $_; ($keep | ForEach-Object { if ($_ -lt $r.Count) { $r[$_] } else { "" } }) -join "`t" }) -join "`r"
      $start = $t.Range.Start; $t.Delete()
      $rng = $doc.Range($start, $start); $rng.InsertBefore($text + "`r"); $rng = $doc.Range($start, $start + $text.Length)
      $nt = $rng.ConvertToTable(1, $rows.Count, $keep.Count)
      $nt.Range.Font.Name = "Arial"; $nt.Range.ParagraphFormat.SpaceBefore = 0; $nt.Range.ParagraphFormat.SpaceAfter = 0; $nt.Range.ParagraphFormat.Alignment = 0
      $nt.Borders.Enable = 1; $nt.Borders.InsideColor = 0xBBBBBB; $nt.Borders.OutsideColor = 0x888888
      $nt.TopPadding = 1; $nt.BottomPadding = 1; $nt.LeftPadding = 3; $nt.RightPadding = 3
      $nt.Rows.Item(1).HeadingFormat = -1; $nt.Rows.Item(1).Range.Font.Bold = 1; $nt.Rows.Item(1).Shading.BackgroundPatternColor = 0xEEEEEE
      $nt.Rows.AllowBreakAcrossPages = 0
      # columns sized to content so names stay on one line; smaller font if the table is wider than the page
      $fit = $false
      foreach ($fs in @(7.5, 7, 6.5, 6)) { $nt.Range.Font.Size = [single]$fs; $nt.AutoFitBehavior(1)
        $w = 0.0; foreach ($col in $nt.Columns) { $w += $col.Width }; if ($w -le $tw) { $fit = $true; break } }
      if (-not $fit) { $nt.AutoFitBehavior(2) }
      $nt.Rows.Alignment = 1; $nOk++
      if ($const.Count) { $after = $nt.Range; $after.Collapse(0); $after.InsertAfter("Same in every row: " + ($const -join ";  ") + "`r"); $after.Font.Size = [single]7; $after.Font.Italic = 1; $after.Font.Bold = 0 } }
    $log += "tables rebuilt: $nOk"
    $wd.Options.Pagination = $true; $doc.Repaginate()
    if ($K.out_docx) { $doc.SaveAs2($K.out_docx, 16) }
    $doc.ExportAsFixedFormat($K.out_pdf, 17); $log += "pdf pages: " + $doc.ComputeStatistics(2); $doc.Close($false) }
  finally { $wd.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wd) }
  $log += "pdf saved: " + (Get-Item $K.out_pdf).Length }
Remove-Item $tmp -Recurse -Force
$log
