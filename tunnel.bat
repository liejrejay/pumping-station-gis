@echo off
chcp 65001 >nul
echo 🌐 臨時網址產生器 (內網穿透)
echo ================================
echo 這個工具可以讓您快速產生一個臨時的公開網址
echo 讓別人可以透過網際網路訪問您的網站
echo.

REM 檢查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 請先安裝 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo 📋 選擇穿透服務：
echo [1] ngrok (需註冊，較穩定)
echo [2] localtunnel (免註冊，可能不穩)
echo [3] cloudflared (Cloudflare，較安全)
echo.
set /p choice="請選擇 (1-3): "

if "%choice%"=="1" goto ngrok
if "%choice%"=="2" goto localtunnel  
if "%choice%"=="3" goto cloudflared
goto invalid

:ngrok
echo.
echo 🚀 使用 ngrok...
echo 1. 請先到 https://ngrok.com 註冊帳號
echo 2. 下載並安裝 ngrok
echo 3. 設定 authtoken: ngrok authtoken YOUR_TOKEN
echo 4. 執行以下指令：
echo    ngrok http 3000
echo.
pause
exit /b 0

:localtunnel
echo.
echo 🚀 安裝 localtunnel...
call npm install -g localtunnel
echo.
echo 🌐 啟動本地伺服器和穿透...
echo 請保持這個視窗開啟
echo.
start "Local Server" cmd /c "node server.js"
timeout /t 3 /nobreak >nul
echo 正在建立穿透連線...
call npx localtunnel --port 3000 --subdomain gis-pumping-station
pause
exit /b 0

:cloudflared
echo.
echo 🚀 使用 Cloudflare Tunnel...
echo 1. 請到 https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/ 
echo 2. 下載 cloudflared
echo 3. 執行：cloudflared tunnel --url localhost:3000
echo.
pause
exit /b 0

:invalid
echo ❌ 無效選擇
pause