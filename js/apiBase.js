/**
 * 共用後端 API 網址（GitHub Pages 前端 + Render 等 Node API）
 */
(function () {
  function normalizeApiBase(url) {
    const b = String(url).trim().replace(/\/$/, "");
    return b.endsWith("/api") ? b : `${b}/api`;
  }

  /** 取得 /api 前綴；未設定且非本機則回傳 null */
  function getSharedApiBase() {
    if (
      typeof window.PUBLIC_API_BASE_URL === "string" &&
      window.PUBLIC_API_BASE_URL.trim()
    ) {
      return normalizeApiBase(window.PUBLIC_API_BASE_URL);
    }
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1") {
      return "http://localhost:3000/api";
    }
    return null;
  }

  function isStaticProductionSite() {
    return /\.github\.io$/i.test(location.hostname);
  }

  function requiresSharedBackend() {
    return isStaticProductionSite();
  }

  window.getSharedApiBase = getSharedApiBase;
  window.isStaticProductionSite = isStaticProductionSite;
  window.requiresSharedBackend = requiresSharedBackend;
})();
