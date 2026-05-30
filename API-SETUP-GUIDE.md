# 🌦️ 氣象 API 設定指南

## 📋 必要 API 清單

### 🥇 優先級 1：中央氣象署開放資料平臺 (必須)

**用途**：台灣官方氣象資料
**費用**：免費
**申請網址**：https://opendata.cwa.gov.tw/

#### 申請步驟：
1. 前往 [中央氣象署開放資料平臺](https://opendata.cwa.gov.tw/)
2. 點擊右上角「會員專區」→「加入會員」
3. 填寫基本資料完成註冊
4. 登入後到「會員專區」→「我的資料」
5. 點擊「取得授權碼」
6. 複製授權碼

#### 設定方式：
```javascript
// 在 js/weatherApiConfig.js 中
WeatherAPIConfig.CWA.apiKey = '你的授權碼';
```

#### 可用資料：
- ✅ 即時雨量資料 (每10分鐘更新)
- ✅ 自動氣象站資料 (溫度、濕度、風速)
- ✅ 36小時天氣預報
- ✅ 颱風路徑和強度
- ✅ 氣象特報 (豪雨、強風等)

---

### 🥈 優先級 2：水利署開放資料 (推薦)

**用途**：水位監測資料
**費用**：完全免費，無需申請
**網址**：https://data.gov.tw/

#### 可用資料：
- ✅ 即時水位資料
- ✅ 河川警戒水位
- ✅ 水文觀測資料
- ✅ 抽水站操作資料

---

### 🥉 優先級 3：國際氣象 API (備用)

#### OpenWeatherMap
**網址**：https://openweathermap.org/api
**免費額度**：每月 1,000,000 次調用
**優點**：全球覆蓋、資料豐富

#### WeatherAPI
**網址**：https://www.weatherapi.com/
**免費額度**：每月 1,000,000 次調用
**優點**：資料準確、回應快速

---

## 🔧 設定教學

### 步驟 1：取得 API Key

根據上面的申請步驟取得各平台的 API Key。

### 步驟 2：設定 API Key

編輯 `js/weatherApiConfig.js` 檔案：

```javascript
const WeatherAPIConfig = {
    CWA: {
        apiKey: 'CWA-你的授權碼',  // ← 在這裡填入
        // ... 其他設定
    },
    
    OpenWeather: {
        apiKey: 'your-openweather-key',  // ← 選擇性填入
        // ... 其他設定
    }
};
```

### 步驟 3：測試 API 連接

打開瀏覽器的開發者工具 (F12)，在 Console 中執行：

```javascript
// 顯示申請指南
showAPIGuide();

// 測試 API 連接
testAPIConnection().then(results => console.log(results));
```

### 步驟 4：啟用真實資料

設定完成後，氣象警示系統會自動：
- ✅ 使用真實氣象資料
- ✅ 顯示資料來源
- ✅ 提供更準確的預警

---

## 📊 資料使用量估算

### 中央氣象署 (CWA)
- **每次更新**：約 5 個 API 調用
- **更新頻率**：每 5 分鐘
- **每日用量**：約 1,440 次調用
- **限制**：每日 10,000 次 (足夠使用)

### 預估月用量
- **正常使用**：約 43,200 次/月
- **安全範圍**：遠低於限制

---

## ⚠️ 注意事項

### API Key 安全
- ✅ API Key 設定在客戶端是正常的 (氣象資料通常不機敏)
- ✅ 中央氣象署允許客戶端使用
- ⚠️ 建議設定來源網域限制 (如果平台支援)

### 錯誤處理
- 系統會自動降級到模擬資料
- 不會因為 API 問題而停止運作
- 錯誤訊息會顯示在瀏覽器 Console

### 效能優化
- 自動快取資料 5 分鐘
- 避免頻繁 API 調用
- 失敗時使用指數退避

---

## 🚀 進階設定

### 自訂警示閾值
在 `js/weatherAlert.js` 中調整：

```javascript
rainfall: {
    light: { threshold: 10, color: '#ffc107', level: 'warning' },
    moderate: { threshold: 25, color: '#fd7e14', level: 'warning' },
    heavy: { threshold: 50, color: '#dc3545', level: 'danger' },
    extreme: { threshold: 100, color: '#721c24', level: 'critical' }
}
```

### 新增氣象站
在設定檔中新增區域特定的氣象站資料。

### 整合其他資料源
可以擴展系統整合雷達回波、衛星雲圖等。

---

## 📞 技術支援

遇到問題時請檢查：
1. API Key 是否正確設定
2. 瀏覽器 Console 的錯誤訊息
3. API 服務是否正常運作
4. 網路連線是否穩定

**設定完成後，你的氣象警示系統就能使用真實的台灣氣象資料了！** 🎉