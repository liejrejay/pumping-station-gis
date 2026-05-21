@echo off
echo 雙北大漢溪抽水站管理系統
echo ==============================
echo.
echo 正在檢查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未安裝 Node.js，請先安裝 Node.js
    echo 下載連結: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js 已安裝
echo.
echo 正在檢查相依套件...
if not exist node_modules (
    echo 📦 正在安裝相依套件...
    npm install
)

echo.
echo 🚀 啟動伺服器...
echo 網址: http://localhost:3000
echo 按 Ctrl+C 可停止伺服器
echo ==============================
echo.

node server.js

pause