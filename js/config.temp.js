// 臨時測試用 API Key 配置（無網域限制）
// 這是為了快速診斷問題而建立的臨時檔案

console.log("[Temp Config] 載入臨時 API Key 配置...");

// 設定無網域限制的 API Key（你需要在 Google Cloud Console 創建一個新的或暫時移除限制）
window.GOOGLE_MAPS_API_KEY = "AIzaSyAWvgoKH9b7sfI_6yMG4U1teg-Dq4wQ9Fk";

// 測試函數
window.testGoogleMaps = function() {
    console.log("開始測試 Google Maps API...");
    console.log("API Key:", window.GOOGLE_MAPS_API_KEY?.substring(0, 20) + "...");
    console.log("當前網域:", window.location.hostname);
    console.log("完整 URL:", window.location.href);
    
    // 測試 API 是否可訪問
    const testScript = document.createElement('script');
    testScript.src = `https://maps.googleapis.com/maps/api/js?key=${window.GOOGLE_MAPS_API_KEY}&v=weekly`;
    testScript.onload = () => console.log("✅ Google Maps API 載入成功");
    testScript.onerror = () => console.error("❌ Google Maps API 載入失敗");
    document.head.appendChild(testScript);
};

console.log("[Temp Config] ✅ 臨時配置已載入，請在 Console 執行 testGoogleMaps() 進行測試");