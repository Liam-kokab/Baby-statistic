# Creates a zip containing a pre-zipped dist/ and the update script.
# Output: baby-statistic-update.zip in the project root.
# Run `npm run build:local` first to generate dist/.

$root      = Split-Path $PSScriptRoot -Parent
$dist      = Join-Path $root 'dist'
$zipPath   = Join-Path $root 'baby-statistic-update.zip'
$staging   = Join-Path $env:TEMP 'baby-statistic-update'
$distZip   = Join-Path $staging 'dist.zip'

if (-not (Test-Path $dist)) {
  Write-Host ""
  Write-Host "  ERROR: dist/ folder not found. Run 'npm run build:local' first." -ForegroundColor Red
  Write-Host ""
  exit 1
}

# ── Stage files ───────────────────────────────────────────────────────────────
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item $staging -ItemType Directory | Out-Null
New-Item (Join-Path $staging 'scripts') -ItemType Directory | Out-Null

# Zip dist/ into staging/dist.zip
Compress-Archive -Path $dist -DestinationPath $distZip -CompressionLevel Optimal


# Copy update script and index.js
Copy-Item (Join-Path $PSScriptRoot 'update-dist.bat') (Join-Path $staging 'scripts\update-dist.bat')
Copy-Item (Join-Path $root 'index.js') (Join-Path $staging 'index.js')

# ── Zip and clean up ──────────────────────────────────────────────────────────
if (Test-Path $zipPath) { Remove-Item $zipPath }
Compress-Archive -Path "$staging\*" -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item $staging -Recurse -Force

Write-Host ""
Write-Host "  Update zip created:" -ForegroundColor Green
Write-Host "  $zipPath" -ForegroundColor Cyan
Write-Host ""

