/**
 * 共用後端 API 根網址（可 commit，Render 網址非機密）
 * 若 Actions Secret 有注入 runtime-config.js，以 Secret 為準；否則用此預設。
 */
(function () {
  const DEFAULT_PUBLIC_API_BASE_URL =
    "https://pumping-station-gis.onrender.com";
  if (
    !window.PUBLIC_API_BASE_URL ||
    !String(window.PUBLIC_API_BASE_URL).trim()
  ) {
    window.PUBLIC_API_BASE_URL = DEFAULT_PUBLIC_API_BASE_URL;
  }
})();
