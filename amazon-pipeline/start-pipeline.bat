@echo off
echo ========================================
echo Amazon Pipeline Orchestrator
echo ========================================
echo.
cd /d "%~dp0"
node pipeline-orchestrator.js start
pause
