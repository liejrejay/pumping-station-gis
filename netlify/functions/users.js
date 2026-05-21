const fs = require('fs').promises;
const path = require('path');

// Netlify Functions 處理用戶 API
exports.handler = async (event, context) => {
    const { httpMethod, path: requestPath, body } = event;
    
    // CORS 處理
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };

    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // 模擬用戶資料 (生產環境應使用資料庫)
        const defaultUsers = {
            systemUsers: [
                {
                    id: 'admin001',
                    username: 'admin',
                    password: 'admin123',
                    role: 'administrator',
                    name: '系統管理員',
                    email: 'admin@example.com'
                },
                {
                    id: 'op001',
                    username: 'operator',
                    password: 'op123',
                    role: 'operator',
                    name: '操作員',
                    email: 'operator@example.com'
                },
                {
                    id: 'view001',
                    username: 'viewer',
                    password: 'view123',
                    role: 'viewer',
                    name: '查看員',
                    email: 'viewer@example.com'
                }
            ],
            registeredUsers: [],
            metadata: {
                lastUpdated: new Date().toISOString(),
                totalRegistered: 0
            }
        };

        const requestData = body ? JSON.parse(body) : {};
        
        // 路由處理
        if (requestPath.includes('/register')) {
            // 用戶註冊
            if (httpMethod === 'POST') {
                const newUser = {
                    id: `user_${Date.now()}`,
                    username: requestData.username,
                    password: requestData.password, // 實際應用中需要加密
                    email: requestData.email,
                    phone: requestData.phone,
                    nickname: requestData.nickname,
                    role: 'citizen',
                    registeredAt: new Date().toISOString()
                };

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        message: '註冊成功',
                        user: { ...newUser, password: undefined }
                    })
                };
            }
        }
        
        else if (requestPath.includes('/login')) {
            // 用戶登入
            if (httpMethod === 'POST') {
                const { loginId, password } = requestData;
                
                // 檢查系統用戶
                const systemUser = defaultUsers.systemUsers.find(u => 
                    (u.username === loginId || u.email === loginId) && u.password === password
                );
                
                if (systemUser) {
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            user: { ...systemUser, password: undefined }
                        })
                    };
                }
                
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        message: '帳號或密碼錯誤'
                    })
                };
            }
        }
        
        else if (requestPath.includes('/stats')) {
            // 用戶統計
            if (httpMethod === 'GET') {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        totalUsers: defaultUsers.systemUsers.length + defaultUsers.registeredUsers.length,
                        systemUsers: defaultUsers.systemUsers.length,
                        registeredUsers: defaultUsers.registeredUsers.length,
                        administrators: defaultUsers.systemUsers.filter(u => u.role === 'administrator').length,
                        operators: defaultUsers.systemUsers.filter(u => u.role === 'operator').length,
                        viewers: defaultUsers.systemUsers.filter(u => u.role === 'viewer').length,
                        citizens: defaultUsers.registeredUsers.length
                    })
                };
            }
        }
        
        else {
            // 獲取所有用戶
            if (httpMethod === 'GET') {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(defaultUsers)
                };
            }
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' })
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};