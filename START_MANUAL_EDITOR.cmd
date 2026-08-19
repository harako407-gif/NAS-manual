@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -Command "try { $null=Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto already_running

set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "CODEX_PNPM=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
set "CODEX_LOCAL_NO_WORKER=1"
set "WRANGLER_LOG_PATH=.wrangler\wrangler.log"

if exist "%CODEX_PNPM%" goto codex_runtime
where npm >nul 2>nul
if not errorlevel 1 goto system_node
goto missing_runtime

:codex_runtime
set "PATH=%CODEX_NODE%;%PATH%"
if exist "node_modules\.bin\vinext.CMD" goto start_codex
call "%CODEX_PNPM%" install --lockfile=false --ignore-scripts
if errorlevel 1 goto failed

:start_codex
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\wait-and-open.ps1"
echo.
echo Starting the Synology manual editor at http://localhost:3000/
echo Keep this window open. Press Ctrl+C to stop the server.
echo.
call "%CODEX_PNPM%" run dev
exit /b %ERRORLEVEL%

:system_node
if exist "node_modules\.bin\vinext.CMD" goto start_npm
call npm install
if errorlevel 1 goto failed

:start_npm
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\wait-and-open.ps1"
echo.
echo Starting the Synology manual editor at http://localhost:3000/
echo Keep this window open. Press Ctrl+C to stop the server.
echo.
call npm run dev
exit /b %ERRORLEVEL%

:already_running
start "" "http://localhost:3000/"
exit /b 0

:missing_runtime
echo.
echo Node.js or the Codex runtime was not found.
echo Send a screenshot of this window to Codex.
pause
exit /b 1

:failed
echo.
echo Setup failed. Send a screenshot of this window to Codex.
pause
exit /b 1
