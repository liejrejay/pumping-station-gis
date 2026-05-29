const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cors = require('cors');

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
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// 中介軟體
app.use(cors());
app.use(express.json());

// API 路由須在 static 之前，避免被靜態檔覆蓋
app.get('/api/config', (req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY || '';
    res.setHeader('Cache-Control', 'no-store');
    res.json({ googleMapsApiKey: key });
});

app.get('/api/config.js', (req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY || '';
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(`window.GOOGLE_MAPS_API_KEY = ${JSON.stringify(key)};\n`);
});

app.use(express.static('.')); // 提供靜態檔案服務

// 預設系統用戶
const SYSTEM_USERS = {
    "admin": {
        "password": "admin123",
        "role": "administrator",
        "name": "系統管理員",
        "permissions": ["view", "edit", "manage", "export"],
        "createdDate": "2026-01-01T00:00:00.000Z",
        "type": "system"
    },
    "operator": {
        "password": "op123",
        "role": "operator", 
        "name": "系統操作員",
        "permissions": ["view", "edit"],
        "createdDate": "2026-01-01T00:00:00.000Z",
        "type": "system"
    },
    "viewer": {
        "password": "view123",
        "role": "viewer",
        "name": "資料查看員", 
        "permissions": ["view"],
        "createdDate": "2026-01-01T00:00:00.000Z",
        "type": "system"
    }
};

// 讀取用戶資料
async function readUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // 如果檔案不存在，創建預設資料
        const defaultData = {
            systemUsers: SYSTEM_USERS,
            registeredUsers: {},
            metadata: {
                totalUsers: 3,
                totalRegistered: 0,
                lastUpdated: new Date().toISOString(),
                version: "1.0"
            }
        };
        await writeUsers(defaultData);
        return defaultData;
    }
}

// 寫入用戶資料
async function writeUsers(data) {
    try {
        // 確保目錄存在
        await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
        await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
        console.log('✅ 用戶資料已更新:', new Date().toLocaleString());
        return true;
    } catch (error) {
        console.error('❌ 寫入用戶資料失敗:', error);
        throw error;
    }
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
        const stats = {
            totalSystemUsers: Object.keys(usersData.systemUsers).length,
            totalRegisteredUsers: Object.keys(usersData.registeredUsers).length,
            activeUsers: Object.values(usersData.registeredUsers).filter(u => u.status === 'active').length,
            lastUpdated: usersData.metadata.lastUpdated
        };
        stats.totalUsers = stats.totalSystemUsers + stats.totalRegisteredUsers;
        
        res.json(stats);
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
        service: '雙北大漢溪抽水站用戶管理系統'
    });
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`
🚀 伺服器已啟動！
🌐 網址: http://localhost:${PORT}
📁 用戶資料檔案: ${USERS_FILE}
⏰ 啟動時間: ${new Date().toLocaleString()}

📋 API 端點:
- GET  /api/users        - 獲取所有用戶
- POST /api/users/register - 註冊新用戶  
- POST /api/users/login  - 用戶登入驗證
- GET  /api/users/stats  - 獲取用戶統計
- GET  /api/users/export - 匯出註冊用戶
- GET  /api/config       - Google Maps API key（JSON，來自 .env）
- GET  /api/config.js    - 同上（JavaScript）
- GET  /api/health       - 健康檢查
    `);
});

// 優雅關閉
process.on('SIGINT', () => {
    console.log('\n👋 伺服器正在關閉...');
    process.exit(0);
});