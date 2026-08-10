@echo off
title Rani Mahal Print Bridge
cls
echo Starting Rani Mahal Thermal Print Bridge...
cd /d %~dp0
node print-bridge.js
pause
