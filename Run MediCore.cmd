@echo off
setlocal
cd /d "%~dp0"
title MediCore Launcher

set "VALIDATE_ONLY=0"
set "OPEN_BROWSER=1"
set "OPEN_FILES=1"
set "APP_PORT=3000"
set "START_PATH=/switch-user"

set "HTTP_PROXY="
set "HTTPS_PROXY="
set "ALL_PROXY="
set "http_proxy="
set "https_proxy="
set "all_proxy="
set "GIT_HTTP_PROXY="
set "GIT_HTTPS_PROXY="
set "npm_config_proxy="
set "npm_config_https_proxy="

if /I "%~1"=="--validate" (
  set "VALIDATE_ONLY=1"
  set "OPEN_BROWSER=0"
  set "OPEN_FILES=0"
)

echo.
echo ==========================================
echo           MediCore Launcher
echo ==========================================
echo.
echo Cleared local proxy variables for this run.
echo.

if not exist ".env.local" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env.local" >nul
    echo Created .env.local from .env.example.
  )

  echo MediCore needs a configured .env.local file before it can run.
  echo.
  echo Fill in these 3 values inside .env.local:
  echo 1. NEXT_PUBLIC_SUPABASE_URL
  echo 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
  echo 3. SUPABASE_SERVICE_ROLE_KEY
  echo.

  if "%OPEN_FILES%"=="1" (
    start "" notepad.exe ".env.local"
    if exist "README.md" start "" notepad.exe "README.md"
    if exist "DEPLOYMENT-BEGINNER.md" start "" notepad.exe "DEPLOYMENT-BEGINNER.md"
  )

  if "%VALIDATE_ONLY%"=="1" exit /b 1
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing packages for the first run...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Package installation failed.
    if "%VALIDATE_ONLY%"=="1" exit /b 1
    pause
    exit /b 1
  )
)

if "%VALIDATE_ONLY%"=="1" (
  echo MediCore launcher validation passed.
  exit /b 0
)

echo Starting MediCore on http://localhost:%APP_PORT%
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%APP_PORT% .*LISTENING"') do (
  echo Found an older process already using port %APP_PORT%. Closing it now...
  taskkill /PID %%P /F >nul 2>&1
)
echo Keep this window open while the app is running.
echo.

echo Building MediCore for launch...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo MediCore could not be built.
  pause
  exit /b 1
)
echo.

if "%OPEN_BROWSER%"=="1" (
  start "" powershell -WindowStyle Hidden -NoProfile -Command "$port=%APP_PORT%; $path='%START_PATH%'; for ($i=0; $i -lt 60; $i++) { if (Test-NetConnection -ComputerName 'localhost' -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet) { Start-Process ('http://localhost:' + $port + $path); exit 0 }; Start-Sleep -Seconds 1 }"
)

call npm.cmd run start -- --hostname 127.0.0.1 --port %APP_PORT%

echo.
echo The MediCore server exited.
echo If the browser says connection refused, reopen this file and keep this window visible.

echo.
echo MediCore has stopped.
pause
