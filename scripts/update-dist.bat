@echo off
setlocal
set "ROOT=%~dp0.."
set "ZIP=%ROOT%\dist.zip"
set "INDEX_JS=%ROOT%\index.js"

if not exist "%ZIP%" (
  echo ERROR: dist.zip not found. Did you extract baby-statistic-update.zip?
  exit /b 1
)

echo [1/4] Copying dist zip to container...
docker cp "%ZIP%" baby-statistic:/tmp/dist.zip
if %errorlevel% neq 0 (
  echo ERROR: docker cp failed. Is the container running?
  exit /b %errorlevel%
)

echo [2/4] Unzipping dist inside container...
docker exec baby-statistic sh -c "unzip -o /tmp/dist.zip -d /app; E=$?; rm -f /tmp/dist.zip; [ $E -le 1 ]"
if %errorlevel% neq 0 (
  echo ERROR: Unzip inside container failed.
  exit /b %errorlevel%
)

echo [3/4] Copying index.js to container...
if exist "%INDEX_JS%" (
  docker cp "%INDEX_JS%" baby-statistic:/app/index.js
)

echo [4/4] Cleaning up local zip...
del "%ZIP%"

echo.
echo  Files updated successfully in the container.
echo  Restart the container to apply: docker restart baby-statistic
echo.
