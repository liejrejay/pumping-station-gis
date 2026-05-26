// 設定範本：請複製此檔為 config.local.js（不會被 commit），並填入你的 Google Maps API key
//
// 1) cp js/config.local.example.js js/config.local.js
// 2) 編輯 js/config.local.js，把下面字串換成你的 key
// 3) 重新整理 http://localhost:3000
//
// 申請 key：https://console.cloud.google.com/apis/credentials
//   需要啟用 Maps JavaScript API、綁定 billing
//   建議在 Application restrictions 設 HTTP referrers 為你的網域
window.GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";
