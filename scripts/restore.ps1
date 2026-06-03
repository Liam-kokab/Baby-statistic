<#
Restores a backup JSON into the running server by POSTing to the restore endpoint.

Usage:
  .\restore.ps1 [backupFilePath] [serverUrl]

Arguments:
  backupFilePath  Path to the JSON file to restore. Defaults to ./backup.json
  serverUrl       Full URL of the restore endpoint. Defaults to http://localhost:3000/api/backup/restore

Example:
  .\restore.ps1 .\data\backup-2026-05-31.json http://localhost:3000/api/backup/restore
#>

param(
    [string]$BackupFile = "$(Join-Path -Path (Split-Path -Parent $MyInvocation.MyCommand.Path) -ChildPath 'backup.json')",
    [string]$Url = 'http://localhost:3000/api/backup/restore'
)

# If a dated backup exists in the same folder as this script, prefer it.
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$datedCandidate = Join-Path -Path $scriptDir -ChildPath 'backup-2026-05-31.json'
if (Test-Path -Path $datedCandidate -PathType Leaf) {
    # Only override if the caller didn't pass an explicit other file
    try {
        # If the user passed the literal default (backup.json path), treat that as no-op and prefer the dated file
        $defaultPath = (Join-Path -Path $scriptDir -ChildPath 'backup.json')
        if ($BackupFile -eq $defaultPath) {
            $BackupFile = $datedCandidate
        }
    } catch {
        # ignore and continue with provided $BackupFile
    }
}

function Write-ErrorAndExit([string]$msg, [int]$code = 1) {
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit $code
}

if (-not (Test-Path -Path $BackupFile -PathType Leaf)) {
    Write-ErrorAndExit "Backup file not found: $BackupFile"
}

try {
    $json = Get-Content -Path $BackupFile -Raw -ErrorAction Stop
} catch {
    Write-ErrorAndExit ("Failed to read file: " + $_.Exception.Message)
}

# Validate JSON
try {
    $null = $json | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-ErrorAndExit ("Invalid JSON in " + $BackupFile + ": " + $_.Exception.Message)
}

Write-Host "Posting backup file '$BackupFile' to $Url..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $Url -Method Post -Body $json -ContentType 'application/json' -ErrorAction Stop
    Write-Host "Restore response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host "Restore completed successfully." -ForegroundColor Green
    exit 0
} catch {
    # Try to surface response content if available
    $err = $_
    Write-Host "Restore failed:" -ForegroundColor Red
    if ($err.Exception -and $err.Exception.Response) {
        try {
            $stream = $err.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            Write-Host $body
        } catch {
            Write-Host $err.Exception.Message
        }
    } else {
        Write-Host $err.Exception.Message
    }
    exit 2
}


