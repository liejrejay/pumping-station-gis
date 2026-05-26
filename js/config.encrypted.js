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
    if (apiKey) {
        window.GOOGLE_MAPS_API_KEY = apiKey;
        console.log("[Config] ✅ API Key 已自動載入");
    } else {
        console.warn("[Config] ❌ API Key 解密失敗");
    }
})();