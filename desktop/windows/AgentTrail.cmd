@echo off
cd /d "%~dp0\..\.."
if "%PORT%"=="" set PORT=4173
node server.js
pause
