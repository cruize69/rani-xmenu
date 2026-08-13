@echo off
title Rani Mahal Print Bridge
cls

REM ============================================================
REM  IMPORTANT: Set your real MANAGER_SECRET below before running
REM  It must match the MANAGER_SECRET env var set on Vercel
REM ============================================================
set MANAGER_SECRET=PASTE_YOUR_MANAGER_SECRET_HERE

echo Starting Rani Mahal Thermal Print Bridge...
echo Printer: 192.168.2.221:9100 (Star TSP143 LAN)
cd /d %~dp0
node print-bridge.js
pause
