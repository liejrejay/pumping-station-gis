@echo off
chcp 65001 >nul
echo 🚀 抽水站管理系統 - 部署準備工具
echo ================================
echo.

REM 檢查是否有 git
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 請先安裝 Git: https://git-scm.com/
    pause
    exit /b 1
)

REM 檢查是否有 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 請先安裝 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ 環境檢查通過
echo.

REM 安裝依賴
echo 📦 安裝依賴套件...
call npm install
if errorlevel 1 (
    echo ❌ 依賴安裝失敗
    pause
    exit /b 1
)

echo ✅ 依賴安裝完成
echo.

REM 建置專案
echo 🔨 建置專案...
call npm run build
if errorlevel 1 (
    echo ❌ 建置失敗
    pause
    exit /b 1
)

echo ✅ 建置完成
echo.

REM Git 初始化和推送
echo 📤 準備 Git 儲存庫...

REM 檢查是否已經是 git 儲存庫
if not exist ".git" (
    echo 🔧 初始化 Git 儲存庫...
    git init
    echo.
)

REM 添加所有檔案
echo 📝 添加檔案到 Git...
git add .

REM 創建提交
echo 💾 創建提交...
git commit -m "準備部署 - %date% %time%"

echo.
echo 🎉 部署準備完成！
echo.
echo 📋 接下來的步驟：
echo.
echo 1. 創建 GitHub 儲存庫：
echo    - 前往 https://github.com/new
echo    - 儲存庫名稱：GIS-Pumping-Stations
echo    - 設為 Public
echo.
echo 2. 推送程式碼：
echo    git remote add origin https://github.com/你的用戶名/GIS-Pumping-Stations.git
echo    git branch -M main
echo    git push -u origin main
echo.
echo 3. 部署到 Netlify：
echo    - 前往 https://netlify.com
echo    - 登入並連結 GitHub
echo    - 選擇你的儲存庫
echo    - 建置指令：npm run build
echo    - 發布資料夾：dist
echo.
echo 4. 取得網址：
echo    - 部署完成後會獲得 .netlify.app 網址
echo    - 可在 Site settings 中自訂域名
echo.
echo 📖 詳細說明請參考 DEPLOYMENT.md
echo.
pause