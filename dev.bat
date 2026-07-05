@echo off
title Keno Vault — Local Dev Server
cd /d "%~dp0"
echo Starting Keno Vault dev server...
start "" http://localhost:3000
node server.js
pause
