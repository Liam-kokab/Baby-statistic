# Fetches a backup from the API and registers a daily scheduled task.
# Run as Administrator for the scheduled task to be created.

$root      = Split-Path $PSScriptRoot -Parent
$backupDir = Join-Path $root 'backups'
$date      = Get-Date -Format 'yyyy-MM-dd'
$outFile   = Join-Path $backupDir "backup-$date.json"

# Ensure backups folder exists
if (-not (Test-Path $backupDir)) { New-Item $backupDir -ItemType Directory | Out-Null }

# Fetch backup
Write-Host "Fetching backup from http://localhost/api/backup ..."
try {
  Invoke-WebRequest -Uri 'http://localhost/api/backup' -OutFile $outFile -UseBasicParsing
} catch {
  Write-Host "ERROR: Failed to fetch backup. $_" -ForegroundColor Red
  exit 1
}

Write-Host "Backup saved to $outFile" -ForegroundColor Green

# Register daily scheduled task (requires Administrator)
$taskName = 'BabyStatisticBackup'
$scriptPath = Join-Path $PSScriptRoot 'backup.ps1'
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At '00:05'

try {
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -RunLevel Highest -Force -ErrorAction Stop | Out-Null
  Write-Host "Scheduled task `"$taskName`" registered (daily at 00:05)." -ForegroundColor Green
} catch {
  Write-Host "WARNING: Could not create scheduled task. Run as Administrator." -ForegroundColor Yellow
  Write-Host "Done."
  exit 0
}

Write-Host "Done."

