# SultanRevitMCP install.
#   Day to day (Revit open):   .\install-sultan.ps1
#     Builds the commands (handlers), copies them to a new version folder and asks the running bridge to load them
#     (reload_handlers). Revit stays open; no "Always Load" prompt, because Revit never sees the handlers DLL.
#   Once, or when the loader itself changes (Revit closed):   .\install-sultan.ps1 -Loader
#     Installs the small loader add-in, retires the old RevitMcp.addin (kept as .bak), and installs the server's npm packages.
param(
    [switch]$Loader,
    [string]$RevitVersion = "2026",
    [string]$RevitDir = "C:\Program Files\Autodesk\Revit $RevitVersion",
    [string]$Dotnet = "$env:LOCALAPPDATA\RevitMcp\dotnet-sdk\dotnet.exe",
    [int]$Port = 48884
)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$addins = Join-Path $env:APPDATA "Autodesk\Revit\Addins\$RevitVersion"
$builds = Join-Path $env:LOCALAPPDATA "SultanRevitMCP\handlers"

function Send-Bridge([string]$command) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect("127.0.0.1", $Port)
        $stream = $client.GetStream()
        $bytes = [System.Text.Encoding]::UTF8.GetBytes((@{ command = $command; params = @{} } | ConvertTo-Json -Compress) + "`n")
        $stream.Write($bytes, 0, $bytes.Length)
        $reader = New-Object System.IO.StreamReader($stream)
        return $reader.ReadToEnd()
    } finally { $client.Close() }
}

# Handlers: a new version folder per build; old folders stay for rollback (delete the newest to go back, then reload).
$version = Get-Date -Format "yyyyMMdd-HHmmss"
$out = Join-Path $builds $version
& $Dotnet build (Join-Path $root "handlers\SultanRevitMCP.Handlers.csproj") -c Release "-p:RevitDir=$RevitDir" "-p:OutDir=$out\"
if ($LASTEXITCODE -ne 0) { throw "Handlers build failed." }
Write-Host "Handlers $version built to $out"

if ($Loader) {
    if (Get-Process Revit -ErrorAction SilentlyContinue) { throw "Close Revit before installing the loader (it locks the loader DLL)." }
    $target = Join-Path $addins "SultanRevitMCP"
    & $Dotnet build (Join-Path $root "loader\SultanRevitMCP.Loader.csproj") -c Release "-p:RevitDir=$RevitDir" "-p:OutDir=$target\"
    if ($LASTEXITCODE -ne 0) { throw "Loader build failed." }
    Copy-Item (Join-Path $root "loader\SultanRevitMCP.addin") $addins -Force
    $old = Join-Path $addins "RevitMcp.addin"
    if (Test-Path $old) { Move-Item $old "$old.bak" -Force; Write-Host "Old RevitMcp.addin retired to RevitMcp.addin.bak" }
    $sign = Join-Path $root "sign-loader.ps1"
    Write-Host "Loader installed to $target. If you have run sign-loader.ps1 -Setup once, run sign-loader.ps1 now to sign it."
    Push-Location (Join-Path $root "server")
    try { npm install --omit=dev; if ($LASTEXITCODE -ne 0) { throw "npm install failed." } } finally { Pop-Location }
    return
}

if (Get-Process Revit -ErrorAction SilentlyContinue) {
    try { Write-Host ("reload_handlers: " + (Send-Bridge "reload_handlers")) }
    catch { Write-Host "Revit is running but the bridge did not answer; the new handlers load on the next command or start." }
} else {
    Write-Host "Revit is closed; the new handlers load when it starts."
}
