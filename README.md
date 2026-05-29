# 🗺️ 雙北大漢溪抽水站管理系統

[![Deploy to GitHub Pages](https://github.com/liejrejay/GIS/actions/workflows/deploy.yml/badge.svg)](https://github.com/liejrejay/GIS/actions/workflows/deploy.yml)

## 🌐 線上訪問
**網站網址：** https://liejrejay.github.io/pumping-station-gis/

## 👥 組員快速登入
- **管理員**: `admin` / `admin123`
- **操作員**: `operator` / `op123`  
- **查看員**: `viewer` / `view123`
- **示範用戶**: `demo_user` / `demo123`

詳細說明請參考 [組員使用指南](TEAM-GUIDE.md)

## 🔑 Google Maps API Key（全組共用一把）

本專案**不把 key 寫進程式碼或 git**。全組共用**同一把** Google Maps API key，由負責人私下發給組員（Line、面對面等），**請勿 commit 到 GitHub**。

### 本機開發（每位組員）

```bash
cp .env.example .env
# 編輯 .env，填入組長提供的同一把 key：
# GOOGLE_MAPS_API_KEY=（組長私下提供，勿上傳）

npm install   # 首次
node server.js
```

瀏覽器開：**http://localhost:3000**（不要用 `file://` 直接開 HTML）。

### 正式網站（GitHub Pages，僅需設定一次）

有 repo **管理權限** 的組員到：

**GitHub → Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|--------|
| `GOOGLE_MAPS_API_KEY` | 與本機 `.env` **相同的那把** key |

push 到 `main` 後，Actions 會建置並推送到 **`gh-pages` 分支**。

**GitHub → Settings → Pages**（僅需設定一次）：

| 項目 | 設定 |
|------|------|
| Source | Deploy from a branch |
| Branch | **`gh-pages`** / **`/ (root)`** |

公開網址的地圖會用 Secret 注入的 key（不入 git）。

### Google Cloud Console（負責人設定一次）

同一把 key 的 **Application restrictions → HTTP referrers** 請同時包含：

- `http://localhost:3000/*`
- `http://127.0.0.1:3000/*`
- `https://liejrejay.github.io/*`（或你們實際的 Pages 網域）

並確認已啟用 **Maps JavaScript API** 與 **Billing**。

## ✨ 系統功能
- 🗺️ 互動式抽水站地圖
- 📊 即時政府 API 資料整合
- 👥 多角色用戶系統 (管理員/操作員/查看員/民眾)
- 📱 完整響應式設計 (RWD)
- 🔐 安全登入驗證
- 📈 用戶統計管理

## 🏢 支援單位
- 雙北大漢溪流域抽水站
- 水利署 IoT 平台
- 政府資料開放平台

## 📱 支援設備
- 💻 桌面電腦
- 📱 手機 (iOS/Android)
- 🖥️ 平板電腦

## 🔧 技術架構
- **前端**: HTML5, CSS3, JavaScript
- **地圖**: Google Maps JavaScript API + OpenStreetMap 底圖
- **API Key**: 本機 `.env`、上線 GitHub Actions Secret（不入 git）
- **API**: 政府開放資料
- **部署**: GitHub Pages + Actions
- **響應式**: Mobile-First RWD

---
*自動部署於 ${new Date().toLocaleString('zh-TW')} (台北時間)*