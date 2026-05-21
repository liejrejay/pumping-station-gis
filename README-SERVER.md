# 雙北大漢溪抽水站管理系統 - 自動同步版

## 🚀 快速啟動

### 方法 1: 使用批次檔 (推薦)
1. 雙擊 `start-server.bat`
2. 系統會自動安裝相依套件並啟動伺服器
3. 在瀏覽器開啟 `http://localhost:3000`

### 方法 2: 手動啟動
```bash
# 1. 安裝 Node.js 相依套件
npm install

# 2. 啟動伺服器
npm start
```

## 🎯 自動同步功能

### ✅ **現在可以自動更新！**
- 用戶註冊 → 自動寫入 `data/users.json`
- 不需要手動匯出和複製貼上
- 即時同步到檔案系統

### 🔄 **雙模式運作**
1. **伺服器模式**: 啟動 Node.js 後端，自動同步
2. **離線模式**: 沒有後端時，使用 localStorage 備援

## 📁 檔案結構

```
GIS/
├── server.js              ← Node.js 後端伺服器
├── start-server.bat       ← 一鍵啟動批次檔
├── package.json           ← Node.js 專案設定
├── js/
│   ├── apiClient.js       ← API 客戶端 (自動偵測模式)
│   └── userManager.js     ← 舊版用戶管理器 (備援)
├── data/
│   └── users.json         ← 用戶資料檔 (自動更新)
└── 其他檔案...
```

## 🛠️ 系統需求

- **Node.js** (v14 或更新版本)
- **現代瀏覽器** (Chrome, Edge, Firefox)

## 📋 API 端點

| 端點 | 方法 | 功能 |
|------|------|------|
| `/api/users` | GET | 獲取所有用戶 |
| `/api/users/register` | POST | 註冊新用戶 |
| `/api/users/login` | POST | 用戶登入驗證 |
| `/api/users/stats` | GET | 獲取用戶統計 |
| `/api/users/export` | GET | 匯出註冊用戶 |
| `/api/health` | GET | 健康檢查 |

## 🔧 使用方式

### 1. 啟動系統
```bash
# 雙擊 start-server.bat 或執行：
npm start
```

### 2. 訪問網站
- 主系統: `http://localhost:3000`
- 登入頁面: `http://localhost:3000/login.html`
- 註冊頁面: `http://localhost:3000/register.html`
- 管理面板: `http://localhost:3000/admin-panel.html`

### 3. 自動同步
- 用戶註冊後，資料自動寫入 `data/users.json`
- 管理員可以即時查看最新的用戶資料
- 不需要手動匯出或複製貼上

## 🔐 管理員功能

登入 `admin` / `admin123` 後可以：
- 📊 查看用戶統計
- 💾 匯出抽水站資料
- 👥 匯出用戶資料
- 🔧 開啟管理面板

## 🔄 備援機制

如果伺服器未啟動：
- 系統自動切換到 localStorage 模式
- 所有功能正常運作
- 顯示 "🟡 使用本地儲存" 狀態

如果伺服器已啟動：
- 顯示 "🟢 已連接後端伺服器" 狀態
- 自動同步到檔案系統
- 支援跨設備資料共享

## ⚠️ 注意事項

1. **首次使用**請確保已安裝 Node.js
2. **防火牆**可能會詢問是否允許 Node.js 網路訪問，請選擇允許
3. **埠號 3000**需要空閒，如被占用會顯示錯誤
4. **資料備份**建議定期備份 `data/users.json`

## 🐛 疑難排解

### Q: 啟動失敗？
A: 確認已安裝 Node.js，執行 `node --version` 檢查

### Q: 埠號被占用？
A: 修改 `server.js` 中的 `PORT = 3000` 為其他數字

### Q: 資料不同步？
A: 檢查瀏覽器控制台，確認顯示 "🟢 已連接後端伺服器"

## 📞 技術支援

如有問題，請檢查：
1. Node.js 是否正確安裝
2. 防火牆設定
3. 瀏覽器控制台錯誤訊息