@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
set "CREATED_CONFIG="

pushd "%PROJECT_DIR%"

if not exist node_modules (
  echo [1/3] Installing dependencies...
  call npm install
  if errorlevel 1 goto :fail
)

if not exist config.local.json (
  set "CREATED_CONFIG=1"
)

echo [2/3] Registering addon in WPS...
call node scripts\\windows-register.mjs
if errorlevel 1 goto :fail

if defined CREATED_CONFIG (
  echo.
  echo config.local.json was created. Fill in your API settings and run this script again.
  start "" notepad "%PROJECT_DIR%\\config.local.json"
  popd
  exit /b 0
)

echo [3/3] Starting local addon server on http://127.0.0.1:3889/
echo Keep this window open while using the plugin in WPS.
call npm run dev -- --host 127.0.0.1 --port 3889
set "ERR=%ERRORLEVEL%"
popd
exit /b %ERR%

:fail
set "ERR=%ERRORLEVEL%"
popd
exit /b %ERR%
