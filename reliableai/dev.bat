@echo off
set PATH=C:\Program Files\nodejs;C:\Users\juanj\AppData\Roaming\npm;%PATH%
cd /d "%~dp0"

echo.
echo ==========================================
echo   JJ Multi-LLM Research -- Modo Local
echo ==========================================
echo.
echo  Servidor: http://localhost:3000
echo  Reinicio automatico al guardar (--watch)
echo  Ctrl+C para parar
echo.

node --watch server.js
