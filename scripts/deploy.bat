@echo off
setlocal
set "ROOT=%~dp0.."

echo [1/3] Building Docker image...
docker build -t baby-statistic "%ROOT%"
if %errorlevel% neq 0 (
  echo ERROR: Docker build failed.
  exit /b %errorlevel%
)

echo [2/3] Removing existing container (if any)...
docker rm -f baby-statistic >nul 2>&1

echo [3/3] Starting container...
docker run -d ^
  --name baby-statistic ^
  -p 80:80 ^
  -p 3001:3001 ^
  -v baby-statistic-data:/app/data ^
  --restart=on-failure ^
  baby-statistic
if %errorlevel% neq 0 (
  echo ERROR: Failed to start container.
  exit /b %errorlevel%
)

echo.
echo  Container is running at http://localhost
echo.

