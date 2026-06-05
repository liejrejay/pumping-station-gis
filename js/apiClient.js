/**
 * API 客戶端 - 與共用後端伺服器通訊（全組註冊／登入／統計）
 */

class ApiClient {
    constructor() {
        this.baseUrl = this.getApiBaseUrl();
        this.isServerMode = false;
        this.checkServerAvailability();
    }

    getApiBaseUrl() {
        if (typeof window.getSharedApiBase === 'function') {
            const shared = window.getSharedApiBase();
            if (shared) return shared;
        }

        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3000/api';
        }
        if (window.location.protocol === 'file:') {
            return 'http://localhost:3000/api';
        }
        return null;
    }

    async checkServerAvailability() {
        this.baseUrl = this.getApiBaseUrl();
        if (!this.baseUrl) {
            this.isServerMode = false;
            if (window.requiresSharedBackend?.()) {
                console.warn(
                    '[API] 公開站未設定 PUBLIC_API_BASE_URL，無法全組共用用戶資料'
                );
            } else {
                console.log('🟡 後端未設定，使用本地儲存模式');
            }
            return false;
        }

        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                cache: 'no-store',
            });

            if (response.ok) {
                this.isServerMode = true;
                console.log('🟢 已連接共用後端:', this.baseUrl);
                return true;
            }
        } catch (error) {
            console.warn('後端連線失敗:', error.message);
        }

        this.isServerMode = false;
        console.log('🟡 後端未連線，使用本地儲存模式');
        return false;
    }

    needsSharedBackendError() {
        return (
            window.requiresSharedBackend?.() &&
            !this.getApiBaseUrl()
        );
    }

    usesSharedBackend() {
        return (
            window.requiresSharedBackend?.() && !!this.getApiBaseUrl()
        );
    }

    resolveBaseUrl() {
        return this.getApiBaseUrl() || this.baseUrl;
    }

    async postJson(path, body) {
        const base = this.resolveBaseUrl();
        if (!base) throw new Error('API 未設定');
        const response = await fetch(`${base}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify(body),
        });
        return response;
    }

    async getUsers() {
        if (this.isServerMode) {
            try {
                const response = await fetch(`${this.baseUrl}/users`, {
                    cache: 'no-store',
                });
                if (response.ok) {
                    return await response.json();
                }
            } catch (error) {
                console.warn('從伺服器獲取用戶失敗:', error);
            }
        }

        return this.getUsersFromLocalStorage();
    }

    getUsersFromLocalStorage() {
        const systemUsers = {
            admin: {
                password: 'admin123',
                role: 'administrator',
                name: '系統管理員',
                permissions: ['view', 'edit', 'manage', 'export'],
                type: 'system',
            },
            operator: {
                password: 'op123',
                role: 'operator',
                name: '系統操作員',
                permissions: ['view', 'edit'],
                type: 'system',
            },
            viewer: {
                password: 'view123',
                role: 'viewer',
                name: '資料查看員',
                permissions: ['view'],
                type: 'system',
            },
        };

        const registeredUsers = JSON.parse(
            localStorage.getItem('registeredUsers') || '{}'
        );

        return {
            systemUsers,
            registeredUsers,
            metadata: {
                totalUsers:
                    Object.keys(systemUsers).length +
                    Object.keys(registeredUsers).length,
                totalRegistered: Object.keys(registeredUsers).length,
                lastUpdated: new Date().toISOString(),
                source: 'localStorage',
            },
        };
    }

    async login(loginInput, password) {
        if (this.needsSharedBackendError()) {
            return {
                success: false,
                error:
                    '公開網站尚未設定共用後端 API，請聯絡管理員設定 PUBLIC_API_BASE_URL',
            };
        }

        const tryServer = this.usesSharedBackend() || this.isServerMode;
        if (tryServer) {
            try {
                const response = await this.postJson('/users/login', {
                    loginInput,
                    password,
                });

                if (response.ok) {
                    const result = await response.json();
                    this.isServerMode = true;
                    return { success: true, user: result.user };
                }
                const error = await response.json();
                return { success: false, error: error.error };
            } catch (error) {
                console.warn('伺服器登入失敗:', error);
                if (this.usesSharedBackend()) {
                    return {
                        success: false,
                        error:
                            '無法連線共用後端（Render 可能休眠中，請等 30 秒再試）',
                    };
                }
            }
        }

        return this.loginWithLocalStorage(loginInput, password);
    }

    loginWithLocalStorage(loginInput, password) {
        const usersData = this.getUsersFromLocalStorage();
        const allUsers = {
            ...usersData.systemUsers,
            ...usersData.registeredUsers,
        };

        let foundUser = null;
        let username = null;

        if (allUsers[loginInput]) {
            foundUser = allUsers[loginInput];
            username = loginInput;
        } else {
            for (const [user, userData] of Object.entries(
                usersData.registeredUsers
            )) {
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
                    username,
                    name: foundUser.name,
                    role: foundUser.role,
                    permissions: foundUser.permissions,
                    email: foundUser.email || '',
                },
            };
        }
        return { success: false, error: '帳號或密碼錯誤' };
    }

    async register(userData) {
        if (this.needsSharedBackendError()) {
            return {
                success: false,
                error:
                    '公開網站尚未設定共用後端，無法全組註冊。請聯絡管理員部署 API 並設定 Secret',
            };
        }

        const tryServer = this.usesSharedBackend() || this.isServerMode;
        if (tryServer) {
            try {
                const response = await this.postJson('/users/register', userData);

                if (response.ok) {
                    this.isServerMode = true;
                    console.log('✅ 用戶已寫入共用後端');
                    return { success: true, savedTo: 'server' };
                }
                const error = await response.json();
                return { success: false, error: error.error };
            } catch (error) {
                console.warn('伺服器註冊失敗:', error);
                if (this.usesSharedBackend()) {
                    return {
                        success: false,
                        error:
                            '無法連線共用後端（Render 可能休眠中，請等 30 秒再試）',
                    };
                }
            }
        }

        if (this.usesSharedBackend()) {
            return {
                success: false,
                error: '無法連線共用後端，註冊未寫入全組資料庫',
            };
        }

        return this.registerWithLocalStorage(userData);
    }

    registerWithLocalStorage(userData) {
        const registeredUsers = JSON.parse(
            localStorage.getItem('registeredUsers') || '{}'
        );

        if (registeredUsers.hasOwnProperty(userData.username)) {
            return { success: false, error: '帳號已存在' };
        }

        for (const user of Object.values(registeredUsers)) {
            if (user.email === userData.email) {
                return { success: false, error: '信箱已存在' };
            }
        }

        registeredUsers[userData.username] = {
            password: userData.password,
            role: 'citizen',
            name: userData.nickname,
            email: userData.email,
            phone: userData.phone,
            permissions: ['view'],
            registrationDate: new Date().toISOString(),
            status: 'active',
            type: 'registered',
        };

        localStorage.setItem(
            'registeredUsers',
            JSON.stringify(registeredUsers)
        );
        console.log('📱 用戶已儲存到本機瀏覽器（其他組員看不到）');
        return { success: true };
    }

    async getUserStats() {
        const base = this.resolveBaseUrl();
        if (base && (this.usesSharedBackend() || this.isServerMode)) {
            try {
                const response = await fetch(`${base}/users/stats`, {
                    cache: 'no-store',
                });
                if (response.ok) {
                    this.isServerMode = true;
                    const stats = await response.json();
                    return {
                        ...stats,
                        source: 'server',
                        queriedAt: new Date().toISOString(),
                    };
                }
            } catch (error) {
                console.warn('從伺服器獲取統計失敗:', error);
            }
        }

        if (this.usesSharedBackend()) {
            return null;
        }

        const usersData = this.getUsersFromLocalStorage();
        const regDates = Object.values(usersData.registeredUsers)
            .map((u) => u.registrationDate)
            .filter(Boolean);
        const dataLastModified = regDates.sort().reverse()[0] || null;
        return {
            totalSystemUsers: Object.keys(usersData.systemUsers).length,
            totalRegisteredUsers: Object.keys(usersData.registeredUsers).length,
            activeUsers: Object.values(usersData.registeredUsers).filter(
                (u) => u.status === 'active'
            ).length,
            totalUsers:
                Object.keys(usersData.systemUsers).length +
                Object.keys(usersData.registeredUsers).length,
            dataLastModified,
            lastUpdated: new Date().toISOString(),
            source: 'localStorage',
        };
    }

    isUsingServer() {
        return this.isServerMode;
    }

    getStatusMessage() {
        if (this.needsSharedBackendError()) {
            return '🔴 未設定共用後端（全組無法同步）';
        }
        return this.isServerMode
            ? '🟢 已連接共用後端（全組同步）'
            : '🟡 僅本機瀏覽器（其他組員看不到）';
    }
}

window.apiClient = new ApiClient();
