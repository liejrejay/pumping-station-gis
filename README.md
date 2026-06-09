# 🗺️ 雙北大漢溪抽水站管理系統

[![Deploy to GitHub Pages](https://github.com/liejrejay/GIS/actions/workflows/deploy.yml/badge.svg)](https://github.com/liejrejay/GIS/actions/workflows/deploy.yml)

大漢溪流域 Web GIS 儀表板，整合抽水站、水位站、河道與親水廊道圖層，並串接中央氣象署（CWA）與水利署（WRA）即時資料。

## 🌐 線上訪問

**正式網站：** https://liejrejay.github.io/pumping-station-gis/

## 👥 組員快速登入

| 角色 | 帳號 | 密碼 |
|------|------|------|
| 管理員 | `admin` | `admin123` |


詳細操作說明見 [組員使用指南](TEAM-GUIDE.md)。

## 🚀 本機快速開始

```bash
cp .env.example .env
# 編輯 .env，填入 Google Maps API Key（組長私下提供，勿上傳 git）

npm install   # 首次
npm start
```

瀏覽器開啟：**http://localhost:3000**（請勿用 `file://` 直接開 HTML）。

開發模式（檔案變更自動重啟）：

```bash
npm run dev
```

## ✨ 系統功能

### 地圖與圖層

- 互動式地圖（Google Maps / OpenStreetMap 底圖切換）
- 業務圖層：抽水站、水位站（現存／已廢）、大漢溪河道、親水廊道
- 點選設施顯示詳細資訊視窗
- 頂部搜尋列：搜尋抽水站、水位站、親水廊道並定位
- 左下角座標讀取（滑鼠移動即時顯示經緯度）
- 右下角圖例

### 即時監測

- **即時水位**：大漢溪 8 站（水利署 WRA），顯示於左側欄系統概覽
- **即時氣象**：雨量、溫度、濕度、風速（中央氣象署 CWA）
- **氣象警示面板**：整合雨量、水位與鄉鎮預報的綜合風險評估
- 點選地圖站點可切換鄰近觀測站天氣資訊

### 地圖工具

| 工具 | 說明 |
|------|------|
| 📍 我的位置 | 顯示目前 GPS 位置與精度範圍 |
| 📏 量測 | 多點距離量測，結果顯示於側邊欄 |
| ⛶ 全螢幕 | 地圖全螢幕顯示 |
| 🖨️ 列印 | 列印或匯出 PDF |

#### 距離量測操作

1. 按左側欄「📏 量測」開始
2. 在地圖上點選多個位置
3. **再按一次「📏 量測」結束**
4. 側邊欄顯示累計距離（自動切換公尺／公里）及各段距離
5. 若要重新量測，量測完成後再按「📏 量測」即可清除並開始新的量測

### 用戶與管理

- 多角色權限（管理員／操作員／查看員／民眾）
- 管理員可匯出資料、查看用戶統計、開啟管理面板
- 支援訪客模式與帳號登入

## 🔑 API Key 設定

本專案**不把 key 寫進程式碼或 git**。全組共用同一把 Google Maps API key，由負責人私下發給組員。

### 本機開發（`.env`）

```env
GOOGLE_MAPS_API_KEY=（組長私下提供）
CWA_API_KEY=（中央氣象署授權碼，選用，即時氣象用）
PUBLIC_API_BASE_URL=（共用後端網址，選用，全組註冊用）
```

詳見 [API 設定指南](API-SETUP-GUIDE.md)、[API Key 設定](API-KEY-SETUP.md)。

### 正式網站（GitHub Pages）

有 repo 管理權限的組員到：

**GitHub → Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|--------|
| `GOOGLE_MAPS_API_KEY` | 與本機 `.env` 相同的那把 key |
| `CWA_API_KEY` | 中央氣象署授權碼（選用） |
| `PUBLIC_API_BASE_URL` | Render 後端網址（選用） |

push 到 `main` 後，Actions 會建置並推送到 **`gh-pages`** 分支。

**GitHub → Settings → Pages**（僅需設定一次）：

| 項目 | 設定 |
|------|------|
| Source | Deploy from a branch |
| Branch | **`gh-pages`** / **`/ (root)`** |

### Google Cloud Console（負責人設定一次）

同一把 key 的 **Application restrictions → HTTP referrers** 請同時包含：

- `http://localhost:3000/*`
- `http://127.0.0.1:3000/*`
- `https://liejrejay.github.io/*`（或實際 Pages 網域）

並確認已啟用 **Maps JavaScript API** 與 **Billing**。

## 📁 專案結構

```
pumping-station-gis/
├── index.html              # 主地圖頁面
├── login.html / register.html / admin-panel.html
├── server.js               # 本機開發伺服器與 API 代理
├── data/                   # GeoJSON 圖層與快照資料
│   ├── pumping-stations.geojson
│   ├── taoyuan-dahan-facilities.geojson
│   ├── dahan-waterfront-paths.geojson
│   ├── cwa-weather-latest.json
│   └── wra-water-latest.json
├── js/                     # 前端模組
│   ├── realtimeRainfall.js / realtimeTemperature.js
│   ├── realtimeWaterLevel.js / weatherAlert.js
│   ├── localWeatherDisplay.js / townshipForecast.js
│   └── apiClient.js / userManager.js
├── lib/                    # 後端共用邏輯
├── css/                    # 樣式
├── scripts/                # 資料建置與快照腳本
│   ├── build_geojson.py
│   ├── fetch_cwa_snapshot.js
│   ├── fetch_wra_water_snapshot.js
│   └── audit_reference_table.py
└── .github/workflows/      # CI/CD 部署
```

## 🔧 技術架構

| 項目 | 技術 |
|------|------|
| 前端 | HTML5、CSS3、JavaScript（ES6+） |
| 地圖 | Google Maps JavaScript API、OpenStreetMap |
| 圖層格式 | GeoJSON（WGS84） |
| 即時資料 | 中央氣象署 CWA、水利署 WRA |
| 本機伺服器 | Node.js + Express |
| 部署 | GitHub Pages + Actions |
| 共用後端 | Render（選用，見 [BACKEND-DEPLOY.md](BACKEND-DEPLOY.md)） |
| 響應式 | Mobile-First RWD |

## 📊 資料來源

- 雙北大漢溪流域抽水站（桃園、新北等）
- 水利署 IoT 平台即時水位
- 中央氣象署開放資料（雨量、氣象、鄉鎮預報）
- 政府資料開放平台

## 📚 相關文件

| 文件 | 說明 |
|------|------|
| [TEAM-GUIDE.md](TEAM-GUIDE.md) | 組員使用指南 |
| [系統需求與開發環境.md](系統需求與開發環境.md) | 需求定義與開發環境 |
| [API-SETUP-GUIDE.md](API-SETUP-GUIDE.md) | API 整合設定 |
| [API-KEY-SETUP.md](API-KEY-SETUP.md) | API Key 詳細步驟 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | 網站部署方案 |
| [BACKEND-DEPLOY.md](BACKEND-DEPLOY.md) | 全組共用後端 API 部署 |
| [SYSTEM-TEST.md](SYSTEM-TEST.md) | 系統測試清單 |

## 📱 支援設備

- 💻 桌面電腦（Chrome、Edge、Safari、Firefox）
- 📱 手機（iOS / Android）
- 🖥️ 平板電腦

---

*雙北大漢溪流域抽水站 Web GIS · 政府開放資料整合*
