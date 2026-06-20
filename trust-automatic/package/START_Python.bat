@echo off
chcp 65001 > nul
title Trust Document Automation - Python Server
cd /d "%~dp0"
echo.
echo ====================================================
echo  Bundled Python - Local HTTP Server
echo ====================================================
echo.
echo URL: http://localhost:8765/
echo.
start "" http://localhost:8765/
"%~dp0python-portable\python.exe" -m http.server 8765 --bind 127.0.0.1
pause
