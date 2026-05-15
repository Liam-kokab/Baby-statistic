@echo off
setlocal
set "ROOT=%~dp0.."
set "ZIP=%ROOT%\dist.zip"

if not exist "%ZIP%" (
  echo ERROR: dist.zip not found. Did you extract baby-statistic-update.zip?
  exit /b 1
)

echo [1/3] Copying zip to container...
docker cp "%ZIP%" baby-statistic:/tmp/dist.zip
if %errorlevel% neq 0 (
  echo ERROR: docker cp failed. Is the container running?
  exit /b %errorlevel%
)

echo [2/3] Unzipping inside container...
docker exec baby-statistic sh -c "unzip -o /tmp/dist.zip -d /app; E=$?; rm -f /tmp/dist.zip; [ $E -le 1 ]"
if %errorlevel% neq 0 (
  echo ERROR: Unzip inside container failed.
  exit /b %errorlevel%
)

echo [3/3] Cleaning up local zip...
del "%ZIP%"

echo.
echo  Dist files updated successfully in the container.
echo.

