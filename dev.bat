@echo off
title Keno Vault — Local Dev Server
cd /d "%~dp0"
echo.
echo   ⬡  Keno Vault — Local Dev Server
echo   ═══════════════════════════════════
echo.
echo   Opening http://localhost:3000
echo   Press Ctrl+C to stop
echo.
start "" http://localhost:3000
python -m http.server 3000
pause
