@echo off
echo ========================================================
echo 🤖 INICIANDO AMAZON SCRAPER - TAREA DIARIA
echo ========================================================
cd /d "%~dp0"

:: Ejecutar el script orquestador
node scripts/automation/run-daily-cycle.js

echo.
echo ✅ Tarea finalizada. Revisa los logs en logs/automation/
pause
