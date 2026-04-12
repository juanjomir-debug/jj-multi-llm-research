@echo off
echo === ReliableAI Deploy ===
echo.

echo [1/2] Pushing to GitHub...
git push origin master
if %errorlevel% neq 0 (
    echo ERROR: git push failed
    pause
    exit /b 1
)

echo.
echo [2/2] Deploying to VPS...
ssh root@187.124.184.177 "cd /var/www/reliableai && git reset --hard origin/master && npm install --omit=dev && pm2 restart reliableai && pm2 status"
if %errorlevel% neq 0 (
    echo ERROR: SSH deploy failed
    pause
    exit /b 1
)

echo.
echo === Deploy complete! ===
echo https://reliableai.net
pause
