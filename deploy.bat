@echo off
set PATH=C:\Program Files\nodejs;C:\Users\juanj\AppData\Roaming\npm;%PATH%
cd /d "%~dp0"

echo.
echo ==========================================
echo   JJ Multi-LLM Research -- Deploy
echo ==========================================
echo.

echo [1/3] Haciendo login en Railway...
railway login

echo.
echo [2/3] Desplegando en Railway...
railway up --detach

echo.
echo [3/3] Abriendo dashboard de Railway...
railway open

echo.
echo Listo! Cuando quieras ver la URL del deploy ejecuta:
echo   railway status
echo.
pause
