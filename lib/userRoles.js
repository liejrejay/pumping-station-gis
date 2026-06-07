/** 系統僅保留兩種身分：系統管理員、註冊民眾 */
const SYSTEM_USERS = {
    admin: {
        password: 'admin123',
        role: 'administrator',
        name: '系統管理員',
        permissions: ['view', 'edit', 'manage', 'export'],
        createdDate: '2026-01-01T00:00:00.000Z',
        type: 'system',
    },
};

const ROLE_LABELS = {
    administrator: '系統管理員',
    citizen: '註冊民眾',
};

function normalizeUsersData(data) {
    if (!data) return data;

    const systemUsers = {};
    for (const [username, user] of Object.entries(data.systemUsers || {})) {
        if (user?.role === 'administrator') {
            systemUsers[username] = user;
        }
    }
    for (const [username, user] of Object.entries(SYSTEM_USERS)) {
        if (!systemUsers[username]) {
            systemUsers[username] = user;
        }
    }

    data.systemUsers = systemUsers;
    if (!data.metadata) data.metadata = {};
    data.metadata.totalRegistered = Object.keys(data.registeredUsers || {}).length;
    data.metadata.totalUsers =
        Object.keys(systemUsers).length + data.metadata.totalRegistered;
    return data;
}

function getRoleLabel(role) {
    return ROLE_LABELS[role] || '註冊民眾';
}

module.exports = {
    SYSTEM_USERS,
    ROLE_LABELS,
    normalizeUsersData,
    getRoleLabel,
};
