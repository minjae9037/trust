@echo off
chcp 65001 > nul
title Trust Document Automation - PowerShell Server
cd /d "%~dp0"
echo.
echo ====================================================
echo  Windows PowerShell - Local HTTP Server
echo ====================================================
echo.
echo URL: http://localhost:8765/
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
