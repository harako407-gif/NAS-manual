@echo off
cd /d "%~dp0"
if not exist "release\index.html" goto missing
start "" "release\index.html"
exit /b 0

:missing
echo release\index.html was not found.
pause
exit /b 1
