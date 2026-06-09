/** 系統僅保留兩種身分：系統管理員、註冊民眾 */
(function () {
    const DEFAULT_SYSTEM_USERS = {
        admin: {
            password: 'admin123',
            role: 'administrator',
            name: '系統管理員',
            permissions: ['view', 'edit', 'manage', 'export'],
            type: 'system',
        },
    };

    const ROLE_LABELS = {
        administrator: '系統管理員',
        citizen: '註冊民眾',
    };

    function getRoleText(role) {
        return ROLE_LABELS[role] || '註冊民眾';
    }

    function isAllowedRole(role) {
        return role === 'administrator' || role === 'citizen';
    }

    window.DEFAULT_SYSTEM_USERS = DEFAULT_SYSTEM_USERS;
    window.getRoleText = getRoleText;
    window.isAllowedRole = isAllowedRole;
})();
