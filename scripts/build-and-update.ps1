npm run build:local
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

powershell -ExecutionPolicy Bypass -File scripts\create-update-zip.ps1

