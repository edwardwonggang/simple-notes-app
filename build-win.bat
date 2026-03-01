@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo [1/3] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Please install Node.js 18+ first.
  pause
  exit /b 1
)

echo [2/3] Installing dependencies...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo [3/3] Building Windows installer (.exe)...
call npm run dist:win
if errorlevel 1 (
  echo [ERROR] Build failed.
  pause
  exit /b 1
)

echo.
echo Build completed.
echo Output folder: %cd%\dist
if exist "%cd%\dist" start "" "%cd%\dist"

echo.
pause
exit /b 0
