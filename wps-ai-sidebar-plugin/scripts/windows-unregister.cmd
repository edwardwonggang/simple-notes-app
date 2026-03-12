@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."

pushd "%PROJECT_DIR%"
call node scripts\\windows-unregister.mjs
set "ERR=%ERRORLEVEL%"
popd
exit /b %ERR%
