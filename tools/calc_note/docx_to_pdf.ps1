# Open a docx in Word, update the table of contents, and export a print-quality PDF (pictures not downsampled).
# Works on a local temp copy (Word is unreliable on synced drives such as Google Drive). Keep it minimal:
# Save and ComputeStatistics can hang Word on large documents, and Word may drop the COM link on Close/Quit
# after the export (RPC_E_DISCONNECTED) - both are avoided or ignored. The docx is left as built (TOC is refreshed in the PDF).
# Usage: powershell -File docx_to_pdf.ps1 -Docx note.docx -Pdf note.pdf
param([Parameter(Mandatory)][string]$Docx, [Parameter(Mandatory)][string]$Pdf)
$ErrorActionPreference = "Stop"
$tmp = Join-Path $env:TEMP ("calcnote_" + [guid]::NewGuid().ToString("N").Substring(0, 8)); New-Item -ItemType Directory $tmp | Out-Null
# unique file name: after a killed Word, a fixed name ("note.docx") triggers a hidden "it caused a serious error, open it?" prompt and Open hangs
$stem = "note_" + [guid]::NewGuid().ToString("N").Substring(0, 8)
$td = Join-Path $tmp "$stem.docx"; $tp = Join-Path $tmp "$stem.pdf"; Copy-Item $Docx $td
$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0
try {
  $d = $w.Documents.Open($td, $false, $false, $false)          # not read-only: a read-only open can hang Word
  foreach ($t in $d.TablesOfContents) { $t.Update() }
  # 17 = PDF, OpenAfterExport false, OptimizeFor 0 = print
  $d.ExportAsFixedFormat($tp, 17, $false, 0)
  try { $d.Close($false) } catch {}
} finally { try { $w.Quit() } catch {}; try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($w) } catch {} }
if (-not (Test-Path $tp)) { throw "PDF was not written" }
Copy-Item $tp $Pdf -Force; Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
"saved: $Pdf  (" + [math]::Round((Get-Item $Pdf).Length / 1MB, 1) + " MB)"
