# 🗺️ Google Maps API Key 設定指南

## 🔑 如何設定 API Key

### 方法一：本地開發 (推薦)

1. **複製配置範本**：
   ```bash
   cp js/config.local.example.js js/config.local.js
   ```

2. **編輯 `js/config.local.js`**：
   ```javascript
   window.GOOGLE_MAPS_API_KEY = "您的_API_金鑰";
   ```

3. **重新整理網頁**

### 方法二：URL 參數 (臨時使用)

在網址後面加上您的 API Key：
```
https://liejrejay.github.io/pumping-station-gis/?api_key=您的_API_金鑰
```

### 方法三：瀏覽器提示輸入

1. 開啟網站
2. 系統會提示輸入 API Key
3. 輸入後會自動儲存到瀏覽器

### 方法四：手動設定 localStorage

在瀏覽器 F12 控制台執行：
```javascript
localStorage.setItem("GOOGLE_MAPS_API_KEY", "您的_API_金鑰");
location.reload();
```

## 🚀 如何取得 Google Maps API Key

### 1. 前往 Google Cloud Console
https://console.cloud.google.com/

### 2. 建立專案
- 點擊右上角的專案下拉選單
- 點擊「新增專案」
- 輸入專案名稱（例如：抽水站地圖）

### 3. 啟用 Maps JavaScript API
- 在左側選單找到「API 和服務」→「程式庫」
- 搜尋「Maps JavaScript API」
- 點擊並啟用

### 4. 建立 API Key
- 前往「API 和服務」→「憑證」
- 點擊「建立憑證」→「API 金鑰」
- 複製產生的金鑰

### 5. 設定安全限制 (重要)
- 點擊剛建立的 API Key 進行編輯
- 在「應用程式限制」選擇「HTTP 參照網址」
- 新增允許的網址：
  ```
  https://liejrejay.github.io/*
  localhost:*
  127.0.0.1:*
  ```

### 6. 啟用計費 (必要)
- Google Maps API 需要綁定計費帳戶
- 前往「計費」頁面設定信用卡
- 每月有 $200 美元的免費額度

## 🔒 安全注意事項

### ✅ 應該做的：
- 使用 `.gitignore` 排除 `js/config.local.js`
- 設定 HTTP 參照網址限制
- 定期檢查 API 使用量

### ❌ 不應該做的：
- 直接把 API Key 寫在程式碼中提交
- 不設定任何使用限制
- 把 Key 分享給他人

## 🆓 替代方案：OpenStreetMap

如果您不想使用 Google Maps，系統會自動切換到免費的 OpenStreetMap：
- 無需 API Key
- 完全免費
- 功能類似但樣式不同

## 🛠️ 故障排除

### 地圖無法載入
1. 檢查瀏覽器 F12 控制台是否有錯誤
2. 確認 API Key 是否正確
3. 檢查網域限制設定
4. 確認計費帳戶已啟用

### API 配額超限
- 查看 Google Cloud Console 的使用量儀表板
- 考慮升級計費方案或優化使用

### 403 Forbidden 錯誤
- 檢查 HTTP 參照網址限制
- 確認目前網域在允許清單中

---

📞 **需要協助？** 請檢查瀏覽器控制台的詳細錯誤訊息。