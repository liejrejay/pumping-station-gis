const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cors = require('cors');
const { buildDahanWeatherSummary } = require('./lib/cwaWeather');
const { buildDahanWaterLevelSummary } = require('./lib/wraWaterLevel');
const userStore = require('./lib/userStore');
const { SYSTEM_USERS, normalizeUsersData } = require('./lib/userRoles');

// 讀取 .env（不入 git）
try {
    const envPath = path.join(__dirname, '.env');
    const text = fsSync.readFileSync(envPath, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (m && process.env[m[1]] === undefined) {
            process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
        }
    }
} catch (_) { /* 無 .env 時略過 */ }

const app = express();
const PORT = process.env.PORT || 3000;

// 中介軟體（允許 GitHub Pages 前端跨域呼叫 API）
const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
app.use(
    cors({
        origin(origin, callback) {
            if (!origin) return callback(null, true);
            if (corsOrigins.length === 0 || corsOrigins.includes(origin)) {
                return callback(null, true);
            }
            if (/\.github\.io$/i.test(origin)) return callback(null, true);
            return callback(null, true);
        },
    })
);
app.use(express.json());

// API 路由須在 static 之前，避免被靜態檔覆蓋
app.get('/api/config', (req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY || '';
    const cwaKey = process.env.CWA_API_KEY || '';
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        googleMapsApiKey: key,
        cwaApiConfigured: Boolean(cwaKey),
        publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL || null,
    });
});

/** 即時氣象（中央氣象署，key 在 .env，不入前端） */
app.get('/api/weather/current', async (req, res) => {
    const apiKey = process.env.CWA_API_KEY || '';
    res.setHeader('Cache-Control', 'no-store');
    if (!apiKey) {
        return res.status(503).json({
            error: 'CWA_API_KEY 未設定',
            hint: '請在 .env 加入 CWA_API_KEY=您的授權碼（https://opendata.cwa.gov.tw/）',
        });
    }
    try {
        const data = await buildDahanWeatherSummary(apiKey);
        res.json(data);
    } catch (err) {
        console.error('[weather]', err.message);
        res.status(502).json({ error: err.message });
    }
});

/** 即時水位（水利署 WRA OpenData，大漢溪 8 站） */
app.get('/api/water-level/current', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const data = await buildDahanWaterLevelSummary();
        res.json(data);
    } catch (err) {
        console.error('[water-level]', err.message);
        res.status(502).json({ error: err.message });
    }
});

app.get('/api/config.js', (req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY || '';
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(`window.GOOGLE_MAPS_API_KEY = ${JSON.stringify(key)};\n`);
});

app.use(express.static('.')); // 提供靜態檔案服務

async function readUsers() {
    const data = normalizeUsersData(await userStore.readUsers(SYSTEM_USERS));
    return data;
}

async function writeUsers(data) {
    return userStore.writeUsers(normalizeUsersData(data), SYSTEM_USERS);
}

function buildUserStats(usersData) {
    const registered = usersData.registeredUsers || {};
    const regDates = Object.values(registered)
        .map((u) => u.registrationDate)
        .filter(Boolean);
    const dataLastModified = [usersData.metadata?.lastUpdated, ...regDates]
        .filter(Boolean)
        .sort()
        .reverse()[0] || new Date().toISOString();

    const stats = {
        totalSystemUsers: Object.keys(usersData.systemUsers || {}).length,
        totalRegisteredUsers: Object.keys(registered).length,
        activeUsers: Object.values(registered).filter((u) => u.status === 'active').length,
        dataLastModified,
        lastUpdated: new Date().toISOString(),
    };
    stats.totalUsers = stats.totalSystemUsers + stats.totalRegisteredUsers;
    return stats;
}

// API 路由

// 獲取所有用戶
app.get('/api/users', async (req, res) => {
    try {
        const users = await readUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: '讀取用戶資料失敗' });
    }
});

// 註冊新用戶
app.post('/api/users/register', async (req, res) => {
    try {
        const { username, nickname, email, phone, password } = req.body;
        
        // 驗證必填欄位
        if (!username || !nickname || !email || !password) {
            return res.status(400).json({ error: '缺少必填欄位' });
        }

        const usersData = await readUsers();
        
        // 檢查帳號是否已存在
        if (usersData.systemUsers[username] || usersData.registeredUsers[username]) {
            return res.status(409).json({ error: '帳號已存在' });
        }

        // 檢查信箱是否已存在
        for (let user of Object.values(usersData.registeredUsers)) {
            if (user.email === email) {
                return res.status(409).json({ error: '信箱已存在' });
            }
        }

        // 新增用戶
        usersData.registeredUsers[username] = {
            password: password,
            role: 'citizen',
            name: nickname,
            email: email,
            phone: phone,
            permissions: ['view'],
            registrationDate: new Date().toISOString(),
            status: 'active',
            type: 'registered'
        };

        // 更新統計資料
        usersData.metadata.totalUsers = Object.keys(usersData.systemUsers).length + Object.keys(usersData.registeredUsers).length;
        usersData.metadata.totalRegistered = Object.keys(usersData.registeredUsers).length;
        usersData.metadata.lastUpdated = new Date().toISOString();

        await writeUsers(usersData);
        
        console.log(`👤 新用戶註冊: ${username} (${nickname})`);
        res.json({ success: true, message: '註冊成功' });

    } catch (error) {
        console.error('註冊用戶失敗:', error);
        res.status(500).json({ error: '註冊失敗' });
    }
});

// 用戶登入驗證
app.post('/api/users/login', async (req, res) => {
    try {
        const { loginInput, password } = req.body;
        const usersData = await readUsers();
        const allUsers = { ...usersData.systemUsers, ...usersData.registeredUsers };
        
        let foundUser = null;
        let username = null;

        // 先嘗試用帳號查找
        if (allUsers[loginInput]) {
            foundUser = allUsers[loginInput];
            username = loginInput;
        } else {
            // 再嘗試用信箱查找
            for (let [user, userData] of Object.entries(usersData.registeredUsers)) {
                if (userData.email === loginInput) {
                    foundUser = userData;
                    username = user;
                    break;
                }
            }
        }

        if (foundUser && foundUser.password === password) {
            res.json({
                success: true,
                user: {
                    username: username,
                    name: foundUser.name,
                    role: foundUser.role,
                    permissions: foundUser.permissions,
                    email: foundUser.email || ''
                }
            });
        } else {
            res.status(401).json({ error: '帳號或密碼錯誤' });
        }

    } catch (error) {
        console.error('登入驗證失敗:', error);
        res.status(500).json({ error: '登入驗證失敗' });
    }
});

// 獲取用戶統計
app.get('/api/users/stats', async (req, res) => {
    try {
        const usersData = await readUsers();
        res.json(buildUserStats(usersData));
    } catch (error) {
        res.status(500).json({ error: '獲取統計資料失敗' });
    }
});

// 匯出註冊用戶 (管理員功能)
app.get('/api/users/export', async (req, res) => {
    try {
        const usersData = await readUsers();
        const exportData = {
            exportTime: new Date().toISOString(),
            totalUsers: usersData.metadata.totalRegistered,
            users: usersData.registeredUsers
        };
        
        res.setHeader('Content-Disposition', 'attachment; filename="registered_users.json"');
        res.setHeader('Content-Type', 'application/json');
        res.json(exportData);
    } catch (error) {
        res.status(500).json({ error: '匯出失敗' });
    }
});

// 健康檢查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: '雙北大漢溪抽水站用戶管理系統',
        storage: userStore.getStorageMode(),
        persistent: userStore.isPersistentStorage(),
    });
});

async function startServer() {
    await userStore.initUserStore(SYSTEM_USERS);
    try {
        await writeUsers(await readUsers());
    } catch (e) {
        console.warn('[userRoles] 啟動時同步身分設定略過:', e.message);
    }

    app.listen(PORT, () => {
        const mode = userStore.getStorageMode();
        const persistHint =
            mode === 'mongo'
                ? 'MongoDB（部署後保留）'
                : '本機檔案（Render 重新部署會還原 repo，請設定 MONGODB_URI）';
        console.log(`
🚀 伺服器已啟動！
🌐 網址: http://localhost:${PORT}
📁 用戶儲存: ${persistHint}
⏰ 啟動時間: ${new Date().toLocaleString()}

📋 API 端點:
- GET  /api/users        - 獲取所有用戶
- POST /api/users/register - 註冊新用戶  
- POST /api/users/login  - 用戶登入驗證
- GET  /api/users/stats  - 獲取用戶統計
- GET  /api/users/export - 匯出註冊用戶
- GET  /api/config       - Google Maps / 氣象 API 設定狀態（.env）
- GET  /api/config.js    - Google Maps key（JavaScript）
- GET  /api/weather/current - 大漢溪流域即時氣象（CWA，需 CWA_API_KEY）
- GET  /api/water-level/current - 大漢溪 8 站即時水位（WRA OpenData）
- GET  /api/health       - 健康檢查
    `);
    });
}

startServer().catch((err) => {
    console.error('伺服器啟動失敗:', err);
    process.exit(1);
});

// 優雅關閉
process.on('SIGINT', () => {
    console.log('\n👋 伺服器正在關閉...');
    process.exit(0);
});