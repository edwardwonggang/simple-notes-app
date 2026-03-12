@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "POWERSHELL_SCRIPT=%SCRIPT_DIR%windows-start.ps1"

if not exist "%POWERSHELL_SCRIPT%" (
  echo [ERROR] Missing script: %POWERSHELL_SCRIPT%
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%POWERSHELL_SCRIPT%"
set "ERR=%ERRORLEVEL%"

if not "%ERR%"=="0" (
  echo.
  echo [ERROR] Startup failed. Please check the message above.
  pause
)

exit /b %ERR%
