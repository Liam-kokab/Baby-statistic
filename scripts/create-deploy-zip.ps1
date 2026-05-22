# Creates a self-contained deployment zip of the baby-statistic project.
# Output: baby-statistic-deploy.zip in the project root.

$root    = Split-Path $PSScriptRoot -Parent
$zipPath = Join-Path $root 'baby-statistic-deploy.zip'
$staging = Join-Path $env:TEMP 'baby-statistic-deploy'

# ── Clean staging area ────────────────────────────────────────────────────────
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item $staging -ItemType Directory | Out-Null

# ── What to include ───────────────────────────────────────────────────────────
$includes = @(
    'Dockerfile',
    'package.json',
    'tsconfig.base.json',
    'index.js',
    'common',
    'client',
    'server',
    'mcp-server',
    'scripts',
    'doc'
)

# ── What to skip (directory names and file extensions) ───────────────────────
$excludedDirs = @('node_modules', 'dist', '.git', 'data', 'server\public')
$excludedExts = @('.db', '.db-shm', '.db-wal')

foreach ($name in $includes) {
    $src = Join-Path $root $name

    if (Test-Path $src -PathType Leaf) {
        # Plain file — copy directly
        Copy-Item $src (Join-Path $staging $name)

    } elseif (Test-Path $src -PathType Container) {
        # Directory — walk recursively, honouring exclusion rules
        Get-ChildItem $src -Recurse -File | Where-Object {
            $rel  = $_.FullName.Substring($root.Length + 1)  # path relative to project root
            $skip = $false

            foreach ($ex in $excludedDirs) {
                if ($rel -like "*\$ex\*" -or $rel -like "$ex\*") { $skip = $true; break }
            }
            if ($excludedExts -contains $_.Extension) { $skip = $true }

            -not $skip
        } | ForEach-Object {
            $rel     = $_.FullName.Substring($root.Length + 1)
            $dstFile = Join-Path $staging $rel
            New-Item (Split-Path $dstFile) -ItemType Directory -Force | Out-Null
            Copy-Item $_.FullName $dstFile
        }
    }
}

# ── Zip and clean up ──────────────────────────────────────────────────────────
if (Test-Path $zipPath) { Remove-Item $zipPath }
Compress-Archive -Path "$staging\*" -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item $staging -Recurse -Force

Write-Host ""
Write-Host "  Deployment zip created:" -ForegroundColor Green
Write-Host "  $zipPath" -ForegroundColor Cyan
Write-Host ""

