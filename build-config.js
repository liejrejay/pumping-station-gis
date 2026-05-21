const fs = require('fs');
const path = require('path');

console.log('🔧 配置生產環境...');

// 修改 apiClient.js 為生產環境
const apiClientPath = path.join(__dirname, 'dist', 'js', 'apiClient.js');

if (fs.existsSync(apiClientPath)) {
    let content = fs.readFileSync(apiClientPath, 'utf8');
    
    // 替換 API 基礎 URL
    content = content.replace(
        /baseURL\s*=\s*['"`][^'"`]*['"`]/g,
        "baseURL = '/.netlify/functions'"
    );
    
    // 替換 localhost 檢查
    content = content.replace(
        /localhost/g,
        'production'
    );
    
    fs.writeFileSync(apiClientPath, content);
    console.log('✅ API 配置已更新為生產環境');
}

// 創建 _redirects 檔案給 Netlify
const redirectsContent = `
# API 重定向
/api/*  /.netlify/functions/:splat  200

# SPA 重定向
/*      /index.html                200
`;

fs.writeFileSync(path.join(__dirname, 'dist', '_redirects'), redirectsContent);
console.log('✅ Netlify 重定向規則已創建');

// 創建 .nojekyll 給 GitHub Pages
fs.writeFileSync(path.join(__dirname, 'dist', '.nojekyll'), '');
console.log('✅ GitHub Pages 配置已創建');

console.log('🚀 建置完成！');