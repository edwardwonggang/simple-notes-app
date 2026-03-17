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

echo [2/3] Checking dependencies...
if not exist node_modules (
  if exist package-lock.json (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
) else (
  echo node_modules already exists, skip installation.
)

echo [3/3] Launching AI Markdown Client...
call npm start
if errorlevel 1 (
  echo [ERROR] Application failed to start.
  pause
  exit /b 1
)

exit /b 0
