@echo off
setlocal
cd /d "%~dp0\..\.."
if "%PORT%"=="" set PORT=4173
set AGENTTRAIL_DESKTOP=1
set AGENTTRAIL_APP_MODE=tray
set AGENTTRAIL_DESKTOP_NOTIFICATIONS=on
set AGENTTRAIL_UPDATE_CHANNEL=stable
where powershell.exe >nul 2>nul
if %errorlevel%==0 (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0AgentTrail-Tray.ps1"
) else (
  node server.js
  pause
)
