/**
 * 手機版優化模組
 */

class MobileOptimization {
    constructor() {
        this.isMobile = this.detectMobile();
        this.isTablet = this.detectTablet();
        this.isTouch = 'ontouchstart' in window;
        this.init();
    }

    // 偵測是否為手機
    detectMobile() {
        return window.innerWidth <= 767 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // 偵測是否為平板
    detectTablet() {
        return window.innerWidth >= 768 && window.innerWidth <= 1023;
    }

    // 初始化手機優化
    init() {
        if (this.isMobile) {
            this.initMobileOptimizations();
        }
        
        if (this.isTouch) {
            this.initTouchOptimizations();
        }

        this.initResponsiveMap();
        this.initKeyboardHandling();
        this.initOrientationChange();
        
        console.log(`📱 設備類型: ${this.getDeviceType()}`);
    }

    // 獲取設備類型
    getDeviceType() {
        if (this.isMobile) return '手機';
        if (this.isTablet) return '平板';
        return '桌面';
    }

    // 手機專用優化
    initMobileOptimizations() {
        // 防止雙擊縮放
        document.addEventListener('dblclick', (e) => {
            e.preventDefault();
        }, { passive: false });

        // 優化觸控滾動
        document.body.style.touchAction = 'pan-x pan-y';
        document.getElementById('map').style.touchAction = 'pan-x pan-y';

        // 手機版控制面板優化
        this.optimizeMobilePanels();
        
        // 手機版彈出視窗優化
        this.optimizeMobilePopups();
    }

    // 觸控優化
    initTouchOptimizations() {
        // 增加觸控目標大小
        const style = document.createElement('style');
        style.textContent = `
            .leaflet-control-zoom a {
                width: 44px !important;
                height: 44px !important;
                line-height: 44px !important;
                font-size: 18px !important;
            }
            .leaflet-control-layers-toggle {
                width: 44px !important;
                height: 44px !important;
            }
        `;
        document.head.appendChild(style);

        // 觸控回饋
        document.addEventListener('touchstart', (e) => {
            if (e.target.classList.contains('btn') || 
                e.target.classList.contains('login-btn') || 
                e.target.classList.contains('register-btn')) {
                e.target.style.transform = 'scale(0.95)';
            }
        });

        document.addEventListener('touchend', (e) => {
            if (e.target.classList.contains('btn') || 
                e.target.classList.contains('login-btn') || 
                e.target.classList.contains('register-btn')) {
                setTimeout(() => {
                    e.target.style.transform = '';
                }, 100);
            }
        });
    }

    // 響應式地圖優化
    initResponsiveMap() {
        if (typeof map !== 'undefined') {
            // 手機版地圖控制項位置調整
            if (this.isMobile) {
                // 縮放控制項移到右下角
                map.zoomControl.setPosition('bottomright');
            }

            // 地圖大小改變時重新計算
            window.addEventListener('resize', () => {
                setTimeout(() => {
                    if (typeof map !== 'undefined') {
                        map.invalidateSize();
                    }
                }, 100);
            });
        }
    }

    // 鍵盤處理優化
    initKeyboardHandling() {
        if (this.isMobile) {
            // iOS 鍵盤彈出時調整視窗
            let initialViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

            const handleViewportChange = () => {
                if (window.visualViewport) {
                    const currentHeight = window.visualViewport.height;
                    const heightDiff = initialViewportHeight - currentHeight;
                    
                    if (heightDiff > 150) { // 鍵盤彈出
                        document.body.style.height = currentHeight + 'px';
                        document.body.style.overflow = 'hidden';
                    } else { // 鍵盤隱藏
                        document.body.style.height = '';
                        document.body.style.overflow = '';
                    }
                }
            };

            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', handleViewportChange);
            }

            // 防止輸入時頁面縮放 (iOS)
            document.querySelectorAll('input, textarea, select').forEach(input => {
                input.addEventListener('focus', () => {
                    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
                        input.style.fontSize = '16px';
                    }
                });
            });
        }
    }

    // 螢幕方向改變處理
    initOrientationChange() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                // 重新計算地圖大小
                if (typeof map !== 'undefined') {
                    map.invalidateSize();
                }
                
                // 調整控制面板位置
                this.adjustPanelPositions();
                
                // 重新計算視窗高度
                this.updateViewportHeight();
            }, 500);
        });
    }

    // 手機版面板優化
    optimizeMobilePanels() {
        const panel = document.querySelector('.panel');
        const userPanel = document.querySelector('.user-panel');

        if (panel) {
            // 可收合的控制面板
            const title = panel.querySelector('h1');
            if (title) {
                title.style.cursor = 'pointer';
                title.addEventListener('click', () => {
                    const content = panel.querySelectorAll('p, div:not(h1)');
                    content.forEach(el => {
                        el.style.display = el.style.display === 'none' ? '' : 'none';
                    });
                    
                    // 切換收合圖示
                    const currentText = title.textContent;
                    if (currentText.includes('▼')) {
                        title.textContent = currentText.replace('▼', '▶');
                    } else if (currentText.includes('▶')) {
                        title.textContent = currentText.replace('▶', '▼');
                    } else {
                        title.textContent += ' ▼';
                    }
                });
                
                // 預設收合狀態
                title.textContent += ' ▼';
            }
        }

        if (userPanel) {
            // 用戶面板滑動隱藏
            let isUserPanelVisible = true;
            let touchStartY = 0;

            userPanel.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
            });

            userPanel.addEventListener('touchmove', (e) => {
                const touchY = e.touches[0].clientY;
                const deltaY = touchY - touchStartY;

                if (deltaY > 50 && isUserPanelVisible) {
                    // 向下滑動隱藏
                    userPanel.style.transform = 'translateY(100%)';
                    isUserPanelVisible = false;
                } else if (deltaY < -50 && !isUserPanelVisible) {
                    // 向上滑動顯示
                    userPanel.style.transform = 'translateY(0)';
                    isUserPanelVisible = true;
                }
            });
        }
    }

    // 手機版彈出視窗優化
    optimizeMobilePopups() {
        // 監聽 Leaflet 彈出視窗
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof map !== 'undefined') {
                map.on('popupopen', (e) => {
                    const popup = e.popup;
                    const popupEl = popup.getElement();
                    
                    if (popupEl && this.isMobile) {
                        // 手機版彈出視窗樣式調整
                        popupEl.style.maxWidth = '90vw';
                        popupEl.querySelector('.leaflet-popup-content').style.fontSize = '14px';
                        
                        // 添加關閉手勢
                        let startX, startY;
                        
                        popupEl.addEventListener('touchstart', (e) => {
                            startX = e.touches[0].clientX;
                            startY = e.touches[0].clientY;
                        });
                        
                        popupEl.addEventListener('touchmove', (e) => {
                            if (!startX || !startY) return;
                            
                            const deltaX = e.touches[0].clientX - startX;
                            const deltaY = e.touches[0].clientY - startY;
                            
                            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                                // 水平滑動關閉彈出視窗
                                map.closePopup(popup);
                            }
                        });
                    }
                });
            }
        });
    }

    // 調整面板位置
    adjustPanelPositions() {
        if (this.isMobile) {
            const panel = document.querySelector('.panel');
            const userPanel = document.querySelector('.user-panel');
            
            if (window.orientation === 90 || window.orientation === -90) {
                // 橫向模式
                if (panel) panel.style.fontSize = '0.8rem';
                if (userPanel) userPanel.style.fontSize = '0.7rem';
            } else {
                // 直向模式
                if (panel) panel.style.fontSize = '0.9rem';
                if (userPanel) userPanel.style.fontSize = '0.75rem';
            }
        }
    }

    // 更新視窗高度
    updateViewportHeight() {
        // 修正 iOS Safari 100vh 問題
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    // 獲取安全區域
    getSafeAreaInsets() {
        const style = getComputedStyle(document.documentElement);
        return {
            top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
            right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
            bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
            left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0')
        };
    }

    // 添加觸覺回饋 (如果支援)
    addHapticFeedback(type = 'light') {
        if (navigator.vibrate) {
            switch (type) {
                case 'light':
                    navigator.vibrate(10);
                    break;
                case 'medium':
                    navigator.vibrate(20);
                    break;
                case 'heavy':
                    navigator.vibrate(30);
                    break;
            }
        }
    }

    // 偵測網路狀態
    initNetworkDetection() {
        if ('onLine' in navigator) {
            const updateStatus = () => {
                const status = navigator.onLine ? '🟢 在線' : '🔴 離線';
                console.log(`網路狀態: ${status}`);
                
                // 可以在 UI 上顯示網路狀態
                const statusEl = document.getElementById('networkStatus');
                if (statusEl) {
                    statusEl.textContent = status;
                }
            };

            window.addEventListener('online', updateStatus);
            window.addEventListener('offline', updateStatus);
            updateStatus();
        }
    }
}

// 初始化手機優化
window.addEventListener('DOMContentLoaded', () => {
    window.mobileOpt = new MobileOptimization();
});