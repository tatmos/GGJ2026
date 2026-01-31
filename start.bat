@echo off
chcp 65001 >nul
echo サーバーを起動しています...
echo.
start "GGJ2026 Server" cmd /k "npm start"
echo 3秒後にブラウザを開きます...
timeout /t 3 /nobreak >nul
start http://localhost:3000
echo.
echo ブラウザで http://localhost:3000 が開きました。
echo サーバーを止める場合は「GGJ2026 Server」の窓で Ctrl+C を押してください。
pause
