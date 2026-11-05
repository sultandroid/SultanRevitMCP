# Render PDF pages to PNG with the Windows PDF engine (no extra software). Windows PowerShell 5.
# Usage: powershell -File pdf_pages.ps1 -Pdf file.pdf -Out folder [-Pages 1,2,5] [-Width 1100]
param([Parameter(Mandatory)][string]$Pdf, [Parameter(Mandatory)][string]$Out, [int[]]$Pages, [int]$Width = 1100)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation``1" } | Select-Object -First 1
$asAction = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq "IAsyncAction" } | Select-Object -First 1
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }
function AwaitAction($op) { $asAction.Invoke($null, @($op)).Wait() }
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $Pdf).Path)) ([Windows.Storage.StorageFile])
$doc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
New-Item -ItemType Directory -Force $Out | Out-Null
if (-not $Pages) { $Pages = 1..$doc.PageCount }
"pages in file: " + $doc.PageCount
foreach ($n in $Pages) {
  if ($n -lt 1 -or $n -gt $doc.PageCount) { continue }
  $pg = $doc.GetPage($n - 1)
  $opt = New-Object Windows.Data.Pdf.PdfPageRenderOptions; $opt.DestinationWidth = $Width
  $ms = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  AwaitAction ($pg.RenderToStreamAsync($ms, $opt))
  $st = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($ms.GetInputStreamAt(0))
  $fs = [IO.File]::Create((Join-Path $Out ("p{0:D3}.png" -f $n))); $st.CopyTo($fs); $fs.Close(); $st.Close(); $pg.Dispose()
}
"rendered: " + ($Pages -join ",")
