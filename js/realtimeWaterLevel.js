/**
 * 即時水位資料更新系統
 * 使用中央氣象署水位資料 API
 */

class RealtimeWaterLevelSystem {
    constructor() {
        this.apiKey = 'CWA-775D44F9-041E-4A3D-B44B-67EE7D294961';
        this.baseUrl = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/';
        this.endpoint = 'C-B0025-001'; // 水位資料
        this.waterLevelData = {};
        this.lastUpdate = null;
        this.updateInterval = null;
        this.isUpdating = false;
        
        // 更新頻率 (5分鐘)
        this.updateFrequency = 5 * 60 * 1000; // 5分鐘
        
        console.log('🌊 即時水位系統初始化');
    }
    
    /**
     * 獲取即時水位資料
     */
    async fetchWaterLevelData() {
        try {
            console.log('🔄 正在獲取即時水位資料...');
            
            const url = `${this.baseUrl}${this.endpoint}?Authorization=${this.apiKey}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success !== "true") {
                throw new Error(`API 回應失敗: ${data.result?.message || '未知錯誤'}`);
            }
            
            // 轉換資料格式
            const processedData = this.processWaterLevelData(data);
            
            // 更新全域水位資料
            this.waterLevelData = processedData;
            this.lastUpdate = new Date();
            
            // 更新主系統的水位資料
            if (window.realtimeWaterLevels) {
                Object.assign(window.realtimeWaterLevels, processedData);
            } else {
                window.realtimeWaterLevels = processedData;
            }
            
            console.log(`✅ 水位資料更新完成，共 ${Object.keys(processedData).length} 個站點`);
            
            // 觸發更新事件
            this.dispatchUpdateEvent(processedData);
            
            return processedData;
            
        } catch (error) {
            console.error('❌ 水位資料獲取失敗:', error);
            
            // 顯示錯誤通知
            this.showErrorNotification(error.message);
            
            throw error;
        }
    }
    
    /**
     * 處理和轉換水位資料格式
     */
    processWaterLevelData(rawData) {
        const processedData = {};
        
        if (!rawData.records?.location) {
            console.warn('⚠️ 水位資料格式異常');
            return processedData;
        }
        
        rawData.records.location.forEach(location => {
            const stationId = location.stationId;
            const stationName = location.locationName;
            
            // 初始化站點資料
            const stationData = {
                stationId: stationId,
                stationName: stationName,
                waterlevel: null,
                datetime: null,
                status: 'unknown',
                lat: parseFloat(location.lat) || null,
                lng: parseFloat(location.lon) || null,
                address: location.address || '',
                river: location.river || '未知河川'
            };
            
            // 解析水位元素
            if (location.weatherElement) {
                location.weatherElement.forEach(element => {
                    if (element.elementName === 'WLMSL') { // 水位 (海拔高度基準)
                        const elementTime = element.elementTime;
                        if (elementTime && elementTime.length > 0) {
                            const latestData = elementTime[elementTime.length - 1]; // 取最新時間的資料
                            stationData.waterlevel = latestData.elementValue;
                            stationData.datetime = latestData.dataTime;
                            stationData.status = 'active';
                        }
                    }
                });
            }
            
            // 如果有有效的水位資料才加入
            if (stationData.waterlevel !== null && stationData.waterlevel !== '') {
                processedData[stationId] = stationData;
            }
        });
        
        return processedData;
    }
    
    /**
     * 開始自動更新
     */
    startAutoUpdate() {
        if (this.updateInterval) {
            console.log('🔄 自動更新已在運行中');
            return;
        }
        
        console.log(`🚀 開始自動更新水位資料 (每 ${this.updateFrequency / 1000 / 60} 分鐘)`);
        
        // 立即執行一次
        this.fetchWaterLevelData();
        
        // 設定定期更新
        this.updateInterval = setInterval(() => {
            if (!this.isUpdating) {
                this.fetchWaterLevelData();
            }
        }, this.updateFrequency);
    }
    
    /**
     * 停止自動更新
     */
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('⏹️ 水位自動更新已停止');
        }
    }
    
    /**
     * 手動更新
     */
    async manualUpdate() {
        if (this.isUpdating) {
            console.log('⏳ 更新進行中，請稍候...');
            return;
        }
        
        this.isUpdating = true;
        
        try {
            await this.fetchWaterLevelData();
            this.showSuccessNotification('水位資料更新成功！');
        } catch (error) {
            this.showErrorNotification(`更新失敗: ${error.message}`);
        } finally {
            this.isUpdating = false;
        }
    }
    
    /**
     * 獲取特定站點的水位資料
     */
    getStationData(stationId) {
        return this.waterLevelData[stationId] || null;
    }
    
    /**
     * 獲取所有站點資料
     */
    getAllStationData() {
        return this.waterLevelData;
    }
    
    /**
     * 獲取更新狀態
     */
    getUpdateStatus() {
        return {
            isUpdating: this.isUpdating,
            lastUpdate: this.lastUpdate,
            stationCount: Object.keys(this.waterLevelData).length,
            autoUpdateEnabled: !!this.updateInterval
        };
    }
    
    /**
     * 觸發更新事件
     */
    dispatchUpdateEvent(data) {
        const event = new CustomEvent('waterLevelUpdated', {
            detail: {
                data: data,
                timestamp: new Date(),
                stationCount: Object.keys(data).length
            }
        });
        
        window.dispatchEvent(event);
        
        // 更新氣象警示系統
        if (window.weatherAlert && window.weatherAlert.updateWaterLevelData) {
            window.weatherAlert.updateWaterLevelData(data);
        }
        
        // 更新地圖上的標記
        if (window.updateWaterLevelMarkers) {
            window.updateWaterLevelMarkers(data);
        }
    }
    
    /**
     * 顯示成功通知
     */
    showSuccessNotification(message) {
        console.log(`✅ ${message}`);
        
        // 更新 UI 狀態指示器
        this.updateStatusIndicator('success', message);
        
        // 如果支援瀏覽器通知
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('水位資料更新', {
                body: message,
                icon: '/favicon.ico',
                tag: 'water-level-update'
            });
        }
    }
    
    /**
     * 顯示錯誤通知
     */
    showErrorNotification(message) {
        console.error(`❌ ${message}`);
        
        // 更新 UI 狀態指示器
        this.updateStatusIndicator('error', message);
    }
    
    /**
     * 更新狀態指示器
     */
    updateStatusIndicator(type, message) {
        const indicator = document.getElementById('waterLevelStatus');
        if (indicator) {
            indicator.className = `status-indicator ${type}`;
            indicator.textContent = message;
            
            // 3秒後淡出
            setTimeout(() => {
                indicator.style.opacity = '0.6';
            }, 3000);
        }
        
        // 更新最後更新時間
        const lastUpdateEl = document.getElementById('lastWaterUpdate');
        if (lastUpdateEl && this.lastUpdate) {
            lastUpdateEl.textContent = this.lastUpdate.toLocaleString();
        }
    }
    
    /**
     * 創建狀態面板 UI
     */
    createStatusPanel() {
        const host = document.getElementById('waterLevelPanelHost');
        if (!host) return;

        const existing = document.getElementById('waterLevelStatusPanel');
        if (existing) {
            if (existing.parentElement !== host) host.appendChild(existing);
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'waterLevelStatusPanel';
        panel.innerHTML = `
            <div class="water-status-panel">
                <div class="status-header">
                    <span>💧 即時水位</span>
                </div>
                <div class="status-hint">請使用上方「立即更新」一次刷新全部資料</div>
                <div id="waterLevelStatus" class="status-indicator">準備中...</div>
                <div class="status-info">
                    <small>最後更新: <span id="lastWaterUpdate">--</span></small>
                </div>
            </div>
        `;
        
        // 添加樣式
        const style = document.createElement('style');
        style.textContent = `
            .water-status-panel {
                position: static;
                width: 100%;
                box-sizing: border-box;
                background: #f5f9fc;
                border: 1px solid #d6e4f0;
                border-radius: 8px;
                padding: 8px 10px;
                box-shadow: none;
            }
            
            .status-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
                font-weight: 600;
                font-size: 0.8rem;
                color: #1a5276;
            }
            
            .refresh-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 16px;
                padding: 2px;
                border-radius: 4px;
                transition: background 0.2s;
            }
            
            .refresh-btn:hover {
                background: rgba(0, 0, 0, 0.1);
            }
            
            .status-indicator {
                padding: 5px 8px;
                border-radius: 4px;
                font-size: 0.78rem;
                margin-bottom: 4px;
                transition: all 0.3s ease;
            }
            
            .status-indicator.success {
                background: #d4edda;
                color: #155724;
            }
            
            .status-indicator.error {
                background: #f8d7da;
                color: #721c24;
            }
            
            .status-info {
                font-size: 0.68rem;
                color: #666;
                text-align: center;
            }

            .status-hint {
                font-size: 0.65rem;
                color: #888;
                text-align: center;
                margin-bottom: 6px;
            }
            
            @media (max-width: 768px) {
                .water-status-panel {
                    padding: 8px 10px;
                    font-size: 12px;
                }
            }
        `;
        
        if (!document.getElementById('water-level-panel-styles')) {
            style.id = 'water-level-panel-styles';
            document.head.appendChild(style);
        }
        host.appendChild(panel);
    }
}

// 建立全域實例
window.waterLevelSystem = new RealtimeWaterLevelSystem();