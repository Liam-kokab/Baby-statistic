@echo off
REM Wrapper for calling the PowerShell restore script from cmd / double-click
REM Usage: restore.bat [backupFilePath] [serverUrl]

SET SCRIPT_DIR=%~dp0
SET PS1=%SCRIPT_DIR%restore.ps1

REM Forward all args to PowerShell script
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*

