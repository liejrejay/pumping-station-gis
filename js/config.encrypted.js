// 加密的 Google Maps API Key
// 使用簡單的 Base64 + XOR 加密，組員可直接使用

(function() {
    // 加密的 API Key (您的金鑰已加密)
    const encryptedKey = "BgApU2NLdxA/NF17eg8lfiBUeW0APgQUBmUDQiIufnZBBkEWcBVZ";
    
    // 解密函數 (簡單的 XOR + Base64)
    function decryptApiKey(encrypted) {
        try {
            // Base64 解碼
            const decoded = atob(encrypted);
            
            // 簡單 XOR 解密 (密鑰: "GIS2026")
            const key = "GIS2026";
            let result = "";
            
            for (let i = 0; i < decoded.length; i++) {
                const char = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
                result += String.fromCharCode(char);
            }
            
            return result;
        } catch (e) {
            console.error("API Key 解密失敗:", e);
            return null;
        }
    }
    
    // 自動設定解密後的 API Key
    const apiKey = decryptApiKey(encryptedKey);
    if (apiKey && apiKey.length > 10) {
        window.GOOGLE_MAPS_API_KEY = apiKey;
        console.log("[Config] ✅ API Key 已自動載入:", apiKey.substring(0, 20) + "...");
    } else {
        console.error("[Config] ❌ API Key 解密失敗，使用備用方案");
        // 備用：直接使用您的 API Key（暫時移除網域限制用於測試）
        window.GOOGLE_MAPS_API_KEY = "AIzaSyAWvgoKH9b7sfI_6yMG4U1teg-Dq4wQ9Fk";
        console.log("[Config] ✅ 使用備用 API Key");
        console.warn("[Config] ⚠️  如果仍無法載入，請到 Google Cloud Console 檢查：");
        console.warn("[Config] 1. Maps JavaScript API 是否已啟用");
        console.warn("[Config] 2. 計費帳戶是否已設定");
        console.warn("[Config] 3. HTTP referrers 是否包含 *.github.io/*");
    }
})();