# Builds the add-in, installs it for the current user, and installs the MCP server's dependencies.
# Close Revit first: it locks the add-in DLL while running.
param(
    [string]$RevitVersion = "2026",
    [string]$RevitDir = "C:\Program Files\Autodesk\Revit $RevitVersion",
    [string]$Dotnet = "dotnet"
)
$ErrorActionPreference = "Stop"

if (Get-Process Revit -ErrorAction SilentlyContinue) { throw "Close Revit before installing." }

$root = $PSScriptRoot
$addins = Join-Path $env:APPDATA "Autodesk\Revit\Addins\$RevitVersion"
$target = Join-Path $addins "RevitMcp"

& $Dotnet build (Join-Path $root "addin\RevitMcp.csproj") -c Release "-p:RevitDir=$RevitDir"
if ($LASTEXITCODE -ne 0) { throw "Add-in build failed." }

New-Item -ItemType Directory -Force $target | Out-Null
Copy-Item (Join-Path $root "addin\bin\Release\RevitMcp.dll") $target -Force
Copy-Item (Join-Path $root "addin\bin\Release\RevitMcp.deps.json") $target -Force
Copy-Item (Join-Path $root "addin\RevitMcp.addin") $addins -Force

Push-Location (Join-Path $root "server")
try {
    npm install --omit=dev
    if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
} finally {
    Pop-Location
}

Write-Host "Installed to $target"
Write-Host "On the next Revit start, choose 'Always Load' when asked about the unsigned add-in."
