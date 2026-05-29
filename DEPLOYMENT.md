# 🌐 網站部署指南

將您的抽水站管理系統部署到網際網路，讓任何人都可以透過網址訪問。

## 🚀 推薦部署方案

### 方案一：Netlify (最簡單) ⭐

**優點：**
- 📦 一鍵部署
- 🔄 自動更新
- 🛡️ 內建 HTTPS
- 💰 免費額度充足
- 🔧 支援 Functions (後端功能)

**步驟：**

1. **上傳到 GitHub**
   ```bash
   git add .
   git commit -m "準備部署"
   git push origin main
   ```

2. **連結 Netlify**
   - 前往 [netlify.com](https://netlify.com)
   - 註冊並連結 GitHub
   - 選擇您的 GIS 專案
   - 設定建置指令：`npm run build`
   - 發布資料夾：`dist`

3. **取得網址**
   - 部署完成後會獲得類似：
   - `https://amazing-name-123456.netlify.app`
   - 可自訂子域名：`https://your-name.netlify.app`

### 方案二：Vercel (次推薦)

**優點：**
- ⚡ 超快速部署
- 🌍 全球 CDN
- 🔧 支援 API Routes
- 📊 效能分析

**步驟：**
1. 前往 [vercel.com](https://vercel.com)
2. 導入 GitHub 專案
3. 自動部署完成

### 方案三：GitHub Pages (純前端)

**優點：**
- 🆓 完全免費
- 🔗 與 GitHub 整合
- 📝 簡單設定

**限制：**
- 僅支援靜態網站
- 無法使用後端功能 (Node.js)

**步驟：**
1. **Settings → Secrets → Actions** 新增 `GOOGLE_MAPS_API_KEY`（與本機 `.env` 同一把 key）
2. push 到 `main`，等待 **Deploy to GitHub Pages** workflow 成功
3. **Settings → Pages**：Source 選 **Deploy from a branch** → 分支 **`gh-pages`** → **`/ (root)`**
4. 公開網址：`https://liejrejay.github.io/pumping-station-gis/`

Workflow 見 `.github/workflows/deploy.yml`（建置 `dist/` 並部署到 `gh-pages`，含 `js/runtime-config.js`）。

## 🔧 部署前準備

### 1. 建置專案
```bash
npm run build
```

### 2. 測試建置結果
```bash
# 進入 dist 資料夾測試
cd dist
python -m http.server 8000
# 或
npx serve .
```

### 3. 檢查檔案結構
```
dist/
├── index.html          # 主頁面
├── login.html          # 登入頁面  
├── register.html       # 註冊頁面
├── admin-panel.html    # 管理面板
├── mobile-test.html    # 手機測試
├── css/               # 樣式檔案
├── js/                # JavaScript
├── data/              # 資料檔案
├── _redirects         # Netlify 重定向
└── .nojekyll         # GitHub Pages 配置
```

## 🌐 自訂域名 (選用)

### 免費子域名選項：
- **Netlify**: `your-name.netlify.app`
- **Vercel**: `your-name.vercel.app`  
- **GitHub**: `username.github.io/repo-name`

### 購買自訂域名：
1. **域名註冊商**：
   - [Namecheap](https://namecheap.com) - 國際知名
   - [Gandi](https://gandi.net) - 歐洲知名
   - [網路中文](https://www.net-chinese.com.tw) - 台灣本土

2. **設定 DNS**：
   ```
   類型: CNAME
   名稱: www (或 @)
   值: your-app.netlify.app
   ```

## 📊 生產環境功能

### 已包含功能：
- ✅ 響應式設計 (RWD)
- ✅ HTTPS 安全連線
- ✅ 用戶登入系統
- ✅ 地圖互動功能
- ✅ 政府 API 整合
- ✅ 手機版優化

### 後端 API 支援：
- `/api/users` - 用戶管理
- `/api/users/login` - 登入驗證
- `/api/users/register` - 用戶註冊
- `/api/users/stats` - 統計資料
- `/api/health` - 健康檢查

## 🔒 安全性設定

### 環境變數 (Netlify)：
```
NODE_ENV=production
API_KEY=your-government-api-key
```

### 安全標頭：
- ✅ HTTPS 強制重定向
- ✅ XSS 防護
- ✅ 內容類型檢查
- ✅ 參照來源政策

## 🚨 常見問題

### Q: 為什麼 API 無法使用？
A: 生產環境使用 Netlify Functions，不需要 Node.js 伺服器。

### Q: 如何更新網站？
A: 推送程式碼到 GitHub，會自動重新部署。

### Q: 手機版無法正常顯示？
A: 檢查是否已包含 `responsive.css` 和 viewport meta tag。

### Q: 地圖無法載入？
A: 確認政府 API 在生產環境中可正常訪問。

## 📞 技術支援

如需協助，請檢查：
1. 瀏覽器開發者工具 (F12)
2. Netlify 部署日誌
3. 網站效能報告

---

🎉 **部署完成後，您的網站將可透過網址全球訪問！**

範例網址：
- https://pumping-stations-gis.netlify.app
- https://your-domain.com