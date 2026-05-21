/**
 * API 客戶端 - 與後端伺服器通訊
 */

class ApiClient {
    constructor() {
        // 自動偵測運行環境
        this.baseUrl = this.getApiBaseUrl();
        this.isServerMode = false;
        this.checkServerAvailability();
    }

    // 獲取 API 基礎網址
    getApiBaseUrl() {
        const hostname = window.location.hostname;
        
        // 生產環境 (Netlify, Vercel 等)
        if (hostname.includes('netlify.app') || 
            hostname.includes('vercel.app') || 
            hostname.includes('github.io') ||
            hostname.includes('pages.dev')) {
            return '/.netlify/functions';
        }
        
        // 本地開發環境
        if (hostname === 'production' || hostname === '127.0.0.1') {
            return 'http://production:3000/api';
        }
        
        // file:// 協定
        if (window.location.protocol === 'file:') {
            return 'http://production:3000/api';
        }
        
        // 其他自定義域名
        return '/api';
    }

    // 檢查伺服器是否可用
    async checkServerAvailability() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                timeout: 3000
            });
            
            if (response.ok) {
                this.isServerMode = true;
                console.log('🟢 後端伺服器已連接，使用自動同步模式');
            }
        } catch (error) {
            this.isServerMode = false;
            console.log('🟡 後端伺服器未連接，使用本地儲存模式');
        }
    }

    // 獲取所有用戶
    async getUsers() {
        if (this.isServerMode) {
            try {
                const response = await fetch(`${this.baseUrl}/users`);
                if (response.ok) {
                    return await response.json();
                }
            } catch (error) {
                console.warn('從伺服器獲取用戶失敗，使用本地資料:', error);
            }
        }
        
        // 備援：使用 localStorage
        return this.getUsersFromLocalStorage();
    }

    // 從 localStorage 獲取用戶
    getUsersFromLocalStorage() {
        const systemUsers = {
            'admin': {
                password: 'admin123',
                role: 'administrator',
                name: '系統管理員',
                permissions: ['view', 'edit', 'manage', 'export'],
                type: 'system'
            },
            'operator': {
                password: 'op123',
                role: 'operator',
                name: '系統操作員',
                permissions: ['view', 'edit'],
                type: 'system'
            },
            'viewer': {
                password: 'view123',
                role: 'viewer',
                name: '資料查看員',
                permissions: ['view'],
                type: 'system'
            }
        };

        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
        
        return {
            systemUsers: systemUsers,
            registeredUsers: registeredUsers,
            metadata: {
                totalUsers: Object.keys(systemUsers).length + Object.keys(registeredUsers).length,
                totalRegistered: Object.keys(registeredUsers).length,
                lastUpdated: new Date().toISOString(),
                source: 'localStorage'
            }
        };
    }

    // 用戶登入
    async login(loginInput, password) {
        if (this.isServerMode) {
            try {
                const response = await fetch(`${this.baseUrl}/users/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ loginInput, password })
                });

                if (response.ok) {
                    const result = await response.json();
                    return { success: true, user: result.user };
                } else {
                    const error = await response.json();
                    return { success: false, error: error.error };
                }
            } catch (error) {
                console.warn('伺服器登入失敗，使用本地驗證:', error);
            }
        }

        // 備援：使用本地驗證
        return this.loginWithLocalStorage(loginInput, password);
    }

    // 本地登入驗證
    loginWithLocalStorage(loginInput, password) {
        const usersData = this.getUsersFromLocalStorage();
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
            return {
                success: true,
                user: {
                    username: username,
                    name: foundUser.name,
                    role: foundUser.role,
                    permissions: foundUser.permissions,
                    email: foundUser.email || ''
                }
            };
        } else {
            return { success: false, error: '帳號或密碼錯誤' };
        }
    }

    // 註冊用戶
    async register(userData) {
        if (this.isServerMode) {
            try {
                const response = await fetch(`${this.baseUrl}/users/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(userData)
                });

                if (response.ok) {
                    console.log('✅ 用戶已自動同步到伺服器');
                    return { success: true };
                } else {
                    const error = await response.json();
                    return { success: false, error: error.error };
                }
            } catch (error) {
                console.warn('伺服器註冊失敗，使用本地儲存:', error);
            }
        }

        // 備援：使用 localStorage
        return this.registerWithLocalStorage(userData);
    }

    // 本地註冊
    registerWithLocalStorage(userData) {
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
        
        // 檢查重複
        if (registeredUsers.hasOwnProperty(userData.username)) {
            return { success: false, error: '帳號已存在' };
        }

        for (let user of Object.values(registeredUsers)) {
            if (user.email === userData.email) {
                return { success: false, error: '信箱已存在' };
            }
        }

        // 新增用戶
        registeredUsers[userData.username] = {
            password: userData.password,
            role: 'citizen',
            name: userData.nickname,
            email: userData.email,
            phone: userData.phone,
            permissions: ['view'],
            registrationDate: new Date().toISOString(),
            status: 'active',
            type: 'registered'
        };

        localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
        console.log('📱 用戶已儲存到本地');
        return { success: true };
    }

    // 獲取用戶統計
    async getUserStats() {
        if (this.isServerMode) {
            try {
                const response = await fetch(`${this.baseUrl}/users/stats`);
                if (response.ok) {
                    return await response.json();
                }
            } catch (error) {
                console.warn('從伺服器獲取統計失敗:', error);
            }
        }

        // 備援：本地計算
        const usersData = this.getUsersFromLocalStorage();
        return {
            totalSystemUsers: Object.keys(usersData.systemUsers).length,
            totalRegisteredUsers: Object.keys(usersData.registeredUsers).length,
            activeUsers: Object.values(usersData.registeredUsers).filter(u => u.status === 'active').length,
            totalUsers: Object.keys(usersData.systemUsers).length + Object.keys(usersData.registeredUsers).length,
            lastUpdated: usersData.metadata.lastUpdated,
            source: this.isServerMode ? 'server' : 'localStorage'
        };
    }

    // 檢查伺服器狀態
    isUsingServer() {
        return this.isServerMode;
    }

    // 獲取伺服器狀態訊息
    getStatusMessage() {
        return this.isServerMode 
            ? '🟢 已連接後端伺服器 (自動同步)'
            : '🟡 使用本地儲存 (需手動同步)';
    }
}

// 全域 API 客戶端
window.apiClient = new ApiClient();