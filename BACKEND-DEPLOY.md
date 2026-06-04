# 全組共用後端 API 部署說明

GitHub Pages **只能放靜態網頁**，無法讓 A、B 兩位組員的註冊資料存在同一個地方。  
要「上架到網路且全組共用」，需要再部署一支 **Node API**（本專案已內建 `server.js`）。

## 架構

| 元件 | 網址範例 | 用途 |
|------|----------|------|
| 前端 | `https://liejrejay.github.io/pumping-station-gis/` | 地圖、圖層 |
| **共用 API** | `https://xxx.onrender.com` | 註冊、登入、用戶統計 |

前端透過 `js/runtime-config.js` 內的 `PUBLIC_API_BASE_URL` 連到 API。

---

## 步驟一：部署到 Render（建議，免費方案可測試）

1. 將專案 push 到 GitHub（已有即可）。
2. 登入 [Render](https://render.com/) → **New → Blueprint** 或 **Web Service**。
3. 連線此 repo，Render 會讀取根目錄的 `render.yaml`。
4. 在 Render 後台設定環境變數：
   - `CORS_ORIGIN` = `https://liejrejay.github.io`（或你們實際 Pages 網域）
   - `CWA_API_KEY` = 中央氣象署授權碼（選用，本機/API 氣象代理用）
   - `GOOGLE_MAPS_API_KEY` = 選用
5. 部署完成後複製服務網址，例如：  
   `https://pumping-station-api.onrender.com`
6. 用瀏覽器開啟測試：  
   `https://pumping-station-api.onrender.com/api/health`  
   應回傳 `{"status":"OK",...}`

> **注意**：Render 免費方案若久未連線會休眠，首次開啟可能需等約 30 秒。用戶資料存在伺服器檔案 `data/users.json`，重新部署可能清空，正式展示前請備份。

---

## 步驟二：GitHub Secret（讓 Pages 前端連到 API）

**GitHub → Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|--------|
| `PUBLIC_API_BASE_URL` | `https://pumping-station-api.onrender.com`（**不要**加 `/api` 結尾） |

與既有的 `GOOGLE_MAPS_API_KEY`、`CWA_API_KEY` 一併設定。

push 到 `main` 後，Actions 會把此網址寫入 `dist/js/runtime-config.js` 並部署到 Pages。

---

## 步驟三：驗證全組共用

1. 組員 A 在公開站 **註冊** 新帳號。
2. 組員 B 用管理員登入 → **用戶統計** 應看到註冊數增加。
3. 登入頁主控台應顯示：`🟢 已連接共用後端（全組同步）`。

若顯示 `🔴 未設定共用後端`，代表 Secret 未設或尚未重新部署 Pages。

---

## 本機開發

`.env` 加入（見 `.env.example`）：

```env
PUBLIC_API_BASE_URL=http://localhost:3000
```

執行：

```bash
npm start
```

本機前端 `http://localhost:3000` 與 API 同源，註冊／統計會寫入 `data/users.json`。

---

## API 端點摘要

- `GET /api/health` — 健康檢查
- `POST /api/users/register` — 註冊
- `POST /api/users/login` — 登入
- `GET /api/users/stats` — 用戶統計（管理員面板每 30 秒 fetch）
