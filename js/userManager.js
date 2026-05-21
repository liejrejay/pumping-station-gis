/**
 * 用戶管理模組
 * 負責用戶資料的讀取、寫入和驗證
 */

class UserManager {
    constructor() {
        this.usersFilePath = 'data/users.json';
        this.usersData = null;
    }

    // 載入用戶資料
    async loadUsers() {
        try {
            const response = await fetch(this.usersFilePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.usersData = await response.json();
            return this.usersData;
        } catch (error) {
            console.warn('無法載入用戶檔案，使用 localStorage 備援:', error);
            return this.loadFromLocalStorage();
        }
    }

    // 從 localStorage 載入 (備援方案)
    loadFromLocalStorage() {
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
        
        this.usersData = {
            systemUsers: systemUsers,
            registeredUsers: registeredUsers,
            metadata: {
                totalUsers: Object.keys(systemUsers).length + Object.keys(registeredUsers).length,
                totalRegistered: Object.keys(registeredUsers).length,
                lastUpdated: new Date().toISOString(),
                source: 'localStorage'
            }
        };

        return this.usersData;
    }

    // 獲取所有用戶
    getAllUsers() {
        if (!this.usersData) return {};
        return { ...this.usersData.systemUsers, ...this.usersData.registeredUsers };
    }

    // 根據帳號或信箱查找用戶
    findUserByLogin(loginInput) {
        const allUsers = this.getAllUsers();
        
        // 先嘗試用帳號查找
        if (allUsers[loginInput]) {
            return { username: loginInput, user: allUsers[loginInput] };
        }
        
        // 再嘗試用信箱查找 (只在註冊用戶中)
        if (this.usersData && this.usersData.registeredUsers) {
            for (let username in this.usersData.registeredUsers) {
                const user = this.usersData.registeredUsers[username];
                if (user.email === loginInput) {
                    return { username: username, user: user };
                }
            }
        }
        
        return null;
    }

    // 檢查用戶是否存在
    checkUserExists(username, email = null) {
        const allUsers = this.getAllUsers();
        
        // 檢查帳號是否重複
        if (allUsers.hasOwnProperty(username)) {
            return { exists: true, type: 'username' };
        }
        
        // 檢查信箱是否重複 (如果提供)
        if (email && this.usersData && this.usersData.registeredUsers) {
            for (let user in this.usersData.registeredUsers) {
                if (this.usersData.registeredUsers[user].email === email) {
                    return { exists: true, type: 'email' };
                }
            }
        }
        
        return { exists: false };
    }

    // 註冊新用戶
    async registerUser(userData) {
        try {
            // 確保有載入資料
            if (!this.usersData) {
                await this.loadUsers();
            }

            // 檢查重複
            const existCheck = this.checkUserExists(userData.username, userData.email);
            if (existCheck.exists) {
                throw new Error(existCheck.type === 'username' ? '帳號已存在' : '信箱已存在');
            }

            // 準備用戶資料
            const newUser = {
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

            // 嘗試儲存到檔案 (實際上由於瀏覽器限制，會使用 localStorage)
            return this.saveUserToStorage(userData.username, newUser);

        } catch (error) {
            console.error('註冊用戶失敗:', error);
            throw error;
        }
    }

    // 儲存用戶到儲存系統
    saveUserToStorage(username, userData) {
        // 由於瀏覽器安全限制，無法直接寫入檔案
        // 使用 localStorage 作為主要儲存方式
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
        registeredUsers[username] = userData;
        localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));

        // 更新內存中的資料
        if (this.usersData) {
            this.usersData.registeredUsers = registeredUsers;
            this.usersData.metadata.totalRegistered = Object.keys(registeredUsers).length;
            this.usersData.metadata.lastUpdated = new Date().toISOString();
        }

        console.log(`用戶 ${username} 已儲存到 localStorage`);
        return true;
    }

    // 匯出所有註冊用戶資料 (管理員功能)
    exportRegisteredUsers() {
        if (!this.usersData) return null;

        const exportData = {
            exportTime: new Date().toISOString(),
            totalUsers: this.usersData.metadata.totalRegistered,
            users: this.usersData.registeredUsers
        };

        return JSON.stringify(exportData, null, 2);
    }

    // 獲取用戶統計資料
    getUserStats() {
        if (!this.usersData) return null;

        const stats = {
            totalSystemUsers: Object.keys(this.usersData.systemUsers || {}).length,
            totalRegisteredUsers: Object.keys(this.usersData.registeredUsers || {}).length,
            totalUsers: 0,
            activeUsers: 0,
            lastUpdated: this.usersData.metadata?.lastUpdated || 'Unknown'
        };

        stats.totalUsers = stats.totalSystemUsers + stats.totalRegisteredUsers;

        // 計算活躍用戶
        if (this.usersData.registeredUsers) {
            stats.activeUsers = Object.values(this.usersData.registeredUsers)
                .filter(user => user.status === 'active').length;
        }

        return stats;
    }
}

// 全域用戶管理器實例
window.userManager = new UserManager();