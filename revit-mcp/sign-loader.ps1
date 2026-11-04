# Signs the SultanRevitMCP loader so Revit stops asking "Always Load" for it.
# Run it yourself, in your own PowerShell; it changes which certificates this Windows user trusts.
#   Once:              .\sign-loader.ps1 -Setup     (creates a code-signing certificate and trusts it for this user only)
#   After each loader install:  .\sign-loader.ps1
# Day-to-day command changes (install-sultan.ps1 without -Loader) never need signing: Revit does not load the handlers DLL itself.
param(
    [switch]$Setup,
    [string]$RevitVersion = "2026",
    [string]$Subject = "CN=Samaya Factory SultanRevitMCP"
)
$ErrorActionPreference = "Stop"
$dll = Join-Path $env:APPDATA "Autodesk\Revit\Addins\$RevitVersion\SultanRevitMCP\SultanRevitMCP.Loader.dll"

if ($Setup) {
    $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject $Subject -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddYears(5)
    $cer = Join-Path $env:TEMP "SultanRevitMCP.cer"
    Export-Certificate -Cert $cert -FilePath $cer | Out-Null
    # Trusted for this Windows user only: as a root (so the signature verifies) and as a publisher (so Revit trusts the vendor).
    Import-Certificate -FilePath $cer -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
    Import-Certificate -FilePath $cer -CertStoreLocation Cert:\CurrentUser\TrustedPublisher | Out-Null
    Remove-Item $cer
    Write-Host "Certificate $($cert.Thumbprint) created and trusted for this user."
}

$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object Subject -eq $Subject | Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $cert) { throw "No '$Subject' certificate. Run .\sign-loader.ps1 -Setup first." }
if (-not (Test-Path $dll)) { throw "Loader not installed at $dll. Run .\install-sultan.ps1 -Loader with Revit closed first." }
$sig = Set-AuthenticodeSignature -FilePath $dll -Certificate $cert -HashAlgorithm SHA256
Write-Host "Signed $dll : $($sig.Status)"
Write-Host "On the next Revit start, Revit may ask once about the publisher 'Samaya Factory SultanRevitMCP': choose Always Load. It will not ask again for builds signed with this certificate."
