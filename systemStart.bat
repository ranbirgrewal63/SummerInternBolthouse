
@echo off
title Bolthouse Detection System
cd /d "%~dp0"
 
echo Starting backend...
start "Bolthouse Backend" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 5050"
 
timeout /t 8 >nul
 
echo Starting frontend...
start "Bolthouse Frontend" cmd /k "cd bolthouse-dashboard && npm run dev -- --host"
 
timeout /t 5 >nul
start http://localhost:3000
 
echo System started!
echo.
echo To view on your phone/tablet, use your laptop's network IP instead of localhost.
echo Run "ipconfig" in a terminal to find it, then go to http://[your-ip]:3000
echo.
pause