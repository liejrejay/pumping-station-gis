/**
 * 即時水位監測系統
 * 主要資料源：水利署防災雲 WraApi 即時水位
 * https://fhy.wra.gov.tw/WraApi/v1/Water/RealTimeInfo
 */

class RealtimeWaterLevelSystem {
    constructor() {
        // 水利署防災雲 — 即時水位（免 API Key）
        this.fhyWaterLevelApi = 'https://fhy.wra.gov.tw/WraApi/v1/Water/RealTimeInfo';

        // 水利署 IoW 平台（選用，需 Access Token）
        this.iowApiBase = 'https://iot.wra.gov.tw';
        this.accessToken = null;
        this.tokenExpiry = null;
        
        // 即時水位資料
        this.waterLevelData = {};
        this.lastUpdate = null;
        this.updateInterval = null;
        this.isUpdating = false;
        
        // 更新頻率 (10分鐘 - 水位站每10分鐘更新一次)
        this.updateFrequency = 10 * 60 * 1000;
        
        // 大漢溪流域水位站 (根據原系統配置)
        this.targetStations = [
            { stationid: "1140H001", name: "玉峰(馬利哥灣)", lat: 24.656435, lng: 121.298120, address: "新竹縣尖石鄉玉峰村" },
            { stationid: "1140H043", name: "高義", lat: 24.714366, lng: 121.364322, address: "桃園市復興區高義里" },
            { stationid: "1140H054", name: "霞雲", lat: 24.768025, lng: 121.362343, address: "桃園市復興區羅浮里" },
            { stationid: "1140H076", name: "石門(後池)", lat: 24.822952, lng: 121.253027, address: "桃園市龍潭區大坪里" },
            { stationid: "1140H105", name: "城林橋", lat: 24.979353, lng: 121.430520, address: "新北市土城區城林橋" },
            { stationid: "1140H067", name: "三鶯橋", lat: 24.944756, lng: 121.353383, address: "新北市鶯歌區南靖里" },
            { stationid: "1140H111", name: "新海大橋(即時)", lat: 25.033318, lng: 121.454806, address: "新北市板橋區環河路" },
            { stationid: "1140H118", name: "柑園橋(即時)", lat: 24.985300, lng: 121.381900, address: "新北市樹林區佳園路二段" },
        ];
        
        console.log('💧 即時水位系統初始化 (FHY WraApi)');
    }

    /** 是否為儀器故障／缺值代碼 */
    isErrorWaterLevel(value) {
        const v = parseFloat(value);
        if (value == null || Number.isNaN(v)) return true;
        if (v < -100) return true;   // -1001, -1002, -999998 等
        if (v < 0) return true;
        return false;
    }

    /** 是否為河川水位（公尺，約 0–50）；過高多為水庫高程 */
    isRiverStageWaterLevel(value) {
        const v = parseFloat(value);
        return !this.isErrorWaterLevel(v) && v <= 50;
    }

    /** 依河川水位判斷警戒（僅適用 isRiverStageWaterLevel） */
    classifyAlert(waterLevel) {
        if (!this.isRiverStageWaterLevel(waterLevel)) {
            const v = parseFloat(waterLevel);
            if (this.isErrorWaterLevel(v)) {
                return { alertLevel: 'unknown', status: '無資料' };
            }
            return { alertLevel: 'info', status: '高程/水庫' };
        }
        let alertLevel = 'normal';
        let status = '正常';
        if (waterLevel >= 5.0) {
            alertLevel = 'critical';
            status = '危險';
        } else if (waterLevel >= 4.0) {
            alertLevel = 'high';
            status = '警戒';
        } else if (waterLevel >= 3.0) {
            alertLevel = 'medium';
            status = '注意';
        }
        return { alertLevel, status };
    }

    /**
     * 從水利署防災雲取得即時水位
     */
    async fetchWaterLevelFromFhy() {
        console.log('🔄 從 FHY WraApi 獲取即時水位...');

        const response = await fetch(this.fhyWaterLevelApi, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`FHY API 失敗: HTTP ${response.status}`);
        }

        const rows = await response.json();
        if (!Array.isArray(rows)) {
            throw new Error('FHY API 回應格式異常');
        }

        return this.processFhyWaterLevelData(rows);
    }

    /**
     * 處理 FHY API 格式：{ StationNo, Time, WaterLevel }
     */
    processFhyWaterLevelData(rows) {
        const processedData = {};
        const targetById = Object.fromEntries(
            this.targetStations.map((s) => [s.stationid, s])
        );
        const targetIds = new Set(this.targetStations.map((s) => s.stationid));

        rows.forEach((row) => {
            const stationId = row.StationNo || row.stationNo;
            if (!stationId || !targetIds.has(stationId)) return;

            const raw = parseFloat(row.WaterLevel ?? row.waterLevel);
            const meta = targetById[stationId];
            const { alertLevel, status } = this.classifyAlert(raw);

            processedData[stationId] = {
                stationid: stationId,
                stationName: meta.name,
                waterLevel: this.isErrorWaterLevel(raw) ? null : raw,
                datetime: row.Time || row.time || new Date().toISOString(),
                lat: meta.lat,
                lng: meta.lng,
                address: meta.address,
                alertLevel,
                status,
                isRiverStage: this.isRiverStageWaterLevel(raw),
                trend: 'stable',
                dataSource: 'FHY'
            };
        });

        // 目標站若在 API 回應中沒出現，仍列出（無資料）
        this.targetStations.forEach((meta) => {
            if (!processedData[meta.stationid]) {
                processedData[meta.stationid] = {
                    stationid: meta.stationid,
                    stationName: meta.name,
                    waterLevel: null,
                    datetime: null,
                    lat: meta.lat,
                    lng: meta.lng,
                    address: meta.address,
                    alertLevel: 'unknown',
                    status: '無資料',
                    isRiverStage: false,
                    trend: 'stable',
                    dataSource: 'FHY'
                };
            }
        });

        const validCount = Object.values(processedData).filter(
            (s) => s.waterLevel != null
        ).length;
        console.log(`💧 FHY 處理完成：${validCount}/${this.targetStations.length} 站有有效水位`);

        return processedData;
    }
    
    /**
     * 獲取 Access Token (IoW 平台需要)
     * 注意：這需要用戶先在 IoW 平台註冊並獲取 API 認證資訊
     */
    async getAccessToken(clientId = null, clientSecret = null) {
        try {
            if (!clientId || !clientSecret) {
                console.warn('⚠️ 未提供 IoW API 認證資訊，將使用備用資料源');
                return null;
            }
            
            const response = await fetch(`${this.iowApiBase}/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`
            });
            
            if (!response.ok) {
                throw new Error(`Token 取得失敗: HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            this.accessToken = data.access_token;
            this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000); // 提前1分鐘更新
            
            console.log('✅ IoW Access Token 取得成功');
            return this.accessToken;
            
        } catch (error) {
            console.error('❌ IoW Token 取得失敗:', error);
            return null;
        }
    }
    
    /**
     * 檢查並更新 Access Token
     */
    async ensureValidToken(clientId, clientSecret) {
        if (!this.accessToken || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
            return await this.getAccessToken(clientId, clientSecret);
        }
        return this.accessToken;
    }
    
    /**
     * 從 IoW 平台獲取水位資料
     */
    async fetchWaterLevelFromIoW() {
        try {
            if (!this.accessToken) {
                throw new Error('未提供 Access Token');
            }
            
            console.log('🔄 從 IoW 平台獲取水位資料...');
            
            // 使用河川水位站 API
            const response = await fetch(`${this.iowApiBase}/riverstations`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`IoW API 失敗: HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return this.processIoWWaterLevelData(data);
            
        } catch (error) {
            console.error('❌ IoW 水位資料獲取失敗:', error);
            throw error;
        }
    }
    
    /**
     * 最後備援：模擬資料（僅在 FHY / IoW 皆失敗時）
     */
    async fetchWaterLevelFromBackup() {
        console.warn('⚠️ 使用模擬水位資料（真實 API 無法連線）');
        return this.generateMockWaterLevelData();
    }
    
    /**
     * 生成模擬水位資料（用於展示系統功能）
     */
    generateMockWaterLevelData() {
        const mockData = {};
        const currentTime = new Date();
        
        this.targetStations.forEach((station, index) => {
            // 基於站點位置和時間生成合理的水位資料
            const baseLevel = 2.0 + (index * 0.5); // 基準水位 2.0-6.0 公尺
            const variation = Math.sin(Date.now() / 1000000) * 0.8; // 模擬水位變化
            const randomFactor = (Math.random() - 0.5) * 0.4; // 隨機因子
            
            const waterLevel = Math.max(0.1, baseLevel + variation + randomFactor);
            
            // 根據水位判斷警戒等級
            let alertLevel = 'normal';
            let status = '正常';
            
            if (waterLevel >= 5.0) {
                alertLevel = 'critical';
                status = '危險';
            } else if (waterLevel >= 4.0) {
                alertLevel = 'high';
                status = '警戒';
            } else if (waterLevel >= 3.0) {
                alertLevel = 'medium';
                status = '注意';
            }
            
            mockData[station.stationid] = {
                stationid: station.stationid,
                stationName: station.name,
                waterLevel: parseFloat(waterLevel.toFixed(2)),
                datetime: currentTime.toISOString(),
                lat: station.lat,
                lng: station.lng,
                address: station.address,
                alertLevel: alertLevel,
                status: status,
                trend: Math.random() > 0.5 ? 'rising' : 'falling',
                isRiverStage: true,
                dataSource: 'mock'
            };
        });
        
        return mockData;
    }
    
    /**
     * 處理 IoW 平台的水位資料格式
     */
    processIoWWaterLevelData(rawData) {
        const processedData = {};
        const targetStationIds = new Set(this.targetStations.map(s => s.stationid));
        
        if (Array.isArray(rawData)) {
            rawData.forEach(station => {
                const stationId = station.stationId || station.station_id;
                
                if (targetStationIds.has(stationId)) {
                    const waterLevel = parseFloat(station.waterLevel || station.water_level || 0);
                    const targetStation = this.targetStations.find(s => s.stationid === stationId);
                    
                    // 判斷警戒等級
                    let alertLevel = 'normal';
                    let status = '正常';
                    
                    if (waterLevel >= 5.0) {
                        alertLevel = 'critical';
                        status = '危險';
                    } else if (waterLevel >= 4.0) {
                        alertLevel = 'high';
                        status = '警戒';
                    } else if (waterLevel >= 3.0) {
                        alertLevel = 'medium';
                        status = '注意';
                    }
                    
                    processedData[stationId] = {
                        stationid: stationId,
                        stationName: targetStation?.name || station.stationName || stationId,
                        waterLevel: waterLevel,
                        datetime: station.datetime || station.recordTime || new Date().toISOString(),
                        lat: targetStation?.lat || station.latitude,
                        lng: targetStation?.lng || station.longitude,
                        address: targetStation?.address || station.address || '',
                        alertLevel: alertLevel,
                        status: status,
                        trend: 'stable',
                        dataSource: 'IoW'
                    };
                }
            });
        }
        
        return processedData;
    }
    
    /**
     * 獲取即時水位資料（主要方法）
     */
    async fetchWaterLevelData(clientId = null, clientSecret = null) {
        try {
            console.log('🔄 正在獲取即時水位資料...');
            
            let waterLevelData = null;

            // 1. 優先：水利署防災雲 WraApi（免金鑰）
            try {
                waterLevelData = await this.fetchWaterLevelFromFhy();
            } catch (error) {
                console.warn('⚠️ FHY WraApi 失敗:', error.message);
            }

            // 2. 選用：IoW 平台（有認證時）
            if ((!waterLevelData || Object.keys(waterLevelData).length === 0) && clientId && clientSecret) {
                try {
                    await this.ensureValidToken(clientId, clientSecret);
                    waterLevelData = await this.fetchWaterLevelFromIoW();
                } catch (error) {
                    console.warn('⚠️ IoW 平台失敗:', error.message);
                }
            }

            // 3. 最後才用模擬資料
            if (!waterLevelData || Object.keys(waterLevelData).length === 0) {
                waterLevelData = await this.fetchWaterLevelFromBackup();
            }
            
            // 更新全域水位資料
            this.waterLevelData = waterLevelData;
            this.lastUpdate = new Date();
            
            // 更新氣象警示系統的水位資料
            if (window.weatherAlert && window.weatherAlert.weatherData) {
                const stats = this.getWaterLevelStats(waterLevelData);
                window.weatherAlert.weatherData.waterLevel = {
                    current: stats.averageLevel,
                    max: stats.maxLevel,
                    alertStations: stats.alertStations,
                    stations: waterLevelData,
                    lastUpdate: this.lastUpdate.toISOString()
                };
            }
            
            console.log(`✅ 水位資料更新完成，共 ${Object.keys(waterLevelData).length} 個站點`);
            
            // 觸發更新事件
            this.dispatchUpdateEvent(waterLevelData);
            
            return waterLevelData;
            
        } catch (error) {
            console.error('❌ 水位資料獲取失敗:', error);
            this.showErrorNotification(error.message);
            throw error;
        }
    }
    
    /**
     * 計算水位統計資訊
     */
    getWaterLevelStats(waterLevelData) {
        const stations = Object.values(waterLevelData);
        
        const stats = {
            stationCount: stations.length,
            averageLevel: 0,
            maxLevel: 0,
            minLevel: Infinity,
            maxLevelStation: null,
            minLevelStation: null,
            alertStations: [],
            normalStations: [],
            dataSource: stations.find((s) => s.dataSource === 'FHY')?.dataSource ||
                stations[0]?.dataSource || 'unknown'
        };
        
        if (stations.length === 0) return stats;
        
        let totalLevel = 0;
        
        stations.forEach(station => {
            const level = station.waterLevel;

            if (level !== null && !isNaN(level) && station.isRiverStage !== false) {
                if (!this.isRiverStageWaterLevel(level)) return;

                totalLevel += level;

                if (level > stats.maxLevel) {
                    stats.maxLevel = level;
                    stats.maxLevelStation = station;
                }

                if (level < stats.minLevel) {
                    stats.minLevel = level;
                    stats.minLevelStation = station;
                }

                if (station.alertLevel !== 'normal' && station.alertLevel !== 'info' && station.alertLevel !== 'unknown') {
                    stats.alertStations.push(station);
                } else {
                    stats.normalStations.push(station);
                }
            }
        });
        
        stats.averageLevel = stations.length > 0 ? totalLevel / stations.length : 0;
        
        if (stats.minLevel === Infinity) stats.minLevel = 0;
        
        return stats;
    }
    
    /**
     * 開始自動更新
     */
    startAutoUpdate(clientId = null, clientSecret = null) {
        if (this.updateInterval) {
            console.log('🔄 水位自動更新已在運行中');
            return;
        }
        
        console.log(`🚀 開始自動更新即時水位資料 (每 ${this.updateFrequency / 1000 / 60} 分鐘)`);
        console.log(`📡 資料來源: FHY WraApi → ${clientId ? 'IoW' : '—'} → 模擬備援`);
        
        // 立即執行一次
        this.fetchWaterLevelData(clientId, clientSecret);
        
        // 設定定期更新
        this.updateInterval = setInterval(() => {
            if (!this.isUpdating) {
                this.fetchWaterLevelData(clientId, clientSecret);
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
    async manualUpdate(clientId = null, clientSecret = null) {
        if (this.isUpdating) {
            console.log('⏳ 更新進行中，請稍候...');
            return;
        }
        
        this.isUpdating = true;
        
        try {
            await this.fetchWaterLevelData(clientId, clientSecret);
            this.showSuccessNotification('水位資料更新成功！');
        } catch (error) {
            this.showErrorNotification(`更新失敗: ${error.message}`);
        } finally {
            this.isUpdating = false;
        }
    }
    
    /**
     * 觸發更新事件
     */
    dispatchUpdateEvent(data) {
        const stats = this.getWaterLevelStats(data);
        
        const event = new CustomEvent('waterLevelUpdated', {
            detail: {
                data: data,
                stats: stats,
                timestamp: new Date(),
                stationCount: Object.keys(data).length
            }
        });
        
        window.dispatchEvent(event);
        
        // 更新氣象警示系統
        if (window.weatherAlert && window.weatherAlert.checkAlerts) {
            setTimeout(() => {
                window.weatherAlert.checkAlerts();
            }, 1000);
        }
    }
    
    /**
     * 顯示成功通知
     */
    showSuccessNotification(message) {
        console.log(`✅ ${message}`);
        this.updateStatusIndicator('success', message);
        
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
            
            setTimeout(() => {
                indicator.style.opacity = '0.6';
            }, 3000);
        }
        
        const lastUpdateEl = document.getElementById('lastWaterLevelUpdate');
        if (lastUpdateEl && this.lastUpdate) {
            lastUpdateEl.textContent = this.lastUpdate.toLocaleString();
        }
    }
    
    /**
     * 創建狀態面板 UI
     */
    createStatusPanel() {
        const panel = document.createElement('div');
        panel.id = 'waterLevelStatusPanel';
        panel.innerHTML = `
            <div class="water-level-status-panel">
                <div class="status-header">
                    <span>💧 即時水位</span>
                    <button onclick="waterLevelSystem.manualUpdate()" class="refresh-btn" title="手動更新">🔄</button>
                </div>
                <div id="waterLevelStatus" class="status-indicator">準備中...</div>
                <div class="water-level-stats" id="waterLevelStats">
                    <div class="stat-item">
                        <span class="stat-label">平均水位:</span>
                        <span class="stat-value" id="avgWaterLevel">-- m</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">最高水位:</span>
                        <span class="stat-value" id="maxWaterLevel">-- m</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">警戒站點:</span>
                        <span class="stat-value" id="alertWaterStations">--</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">資料來源:</span>
                        <span class="stat-value" id="dataSource">--</span>
                    </div>
                </div>
                <div class="status-info">
                    <small>最後更新: <span id="lastWaterLevelUpdate">--</span></small>
                </div>
            </div>
        `;
        
        // 添加樣式
        const style = document.createElement('style');
        style.textContent = `
            .water-level-status-panel {
                position: fixed;
                bottom: 320px;
                right: 20px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 1400;
                min-width: 220px;
            }
            
            .water-level-stats {
                margin: 8px 0;
                font-size: 12px;
            }
            
            @media (max-width: 768px) {
                .water-level-status-panel {
                    bottom: 310px;
                    right: 10px;
                    left: 10px;
                    min-width: auto;
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(panel);
    }
    
    /**
     * 更新狀態面板統計資訊
     */
    updateStatsDisplay() {
        const stats = this.getWaterLevelStats(this.waterLevelData);
        
        const avgEl = document.getElementById('avgWaterLevel');
        if (avgEl) {
            avgEl.textContent = `${stats.averageLevel.toFixed(2)} m`;
        }
        
        const maxEl = document.getElementById('maxWaterLevel');
        if (maxEl) {
            maxEl.textContent = `${stats.maxLevel.toFixed(2)} m`;
            
            // 根據水位設定顏色
            if (stats.maxLevel >= 5.0) {
                maxEl.style.color = '#dc3545'; // 紅色 - 危險
            } else if (stats.maxLevel >= 4.0) {
                maxEl.style.color = '#fd7e14'; // 橙色 - 警戒
            } else if (stats.maxLevel >= 3.0) {
                maxEl.style.color = '#ffc107'; // 黃色 - 注意
            } else {
                maxEl.style.color = '#28a745'; // 綠色 - 正常
            }
        }
        
        const alertEl = document.getElementById('alertWaterStations');
        if (alertEl) {
            const alertCount = stats.alertStations.length;
            alertEl.textContent = alertCount;
            alertEl.style.color = alertCount > 0 ? '#dc3545' : '#28a745';
        }
        
        const sourceEl = document.getElementById('dataSource');
        if (sourceEl) {
            const sourceText = stats.dataSource === 'FHY' ? '水利署即時' :
                             stats.dataSource === 'mock' ? '模擬資料' :
                             stats.dataSource === 'IoW' ? 'IoW 平台' : '未知';
            sourceEl.textContent = sourceText;
            sourceEl.style.color = stats.dataSource === 'FHY' ? '#28a745' :
                                   stats.dataSource === 'mock' ? '#ffc107' : '#17a2b8';
        }
    }
    
    /**
     * 獲取更新狀態
     */
    getUpdateStatus() {
        return {
            isUpdating: this.isUpdating,
            lastUpdate: this.lastUpdate,
            stationCount: Object.keys(this.waterLevelData).length,
            autoUpdateEnabled: !!this.updateInterval,
            hasAccessToken: !!this.accessToken
        };
    }
}

// 建立全域實例
window.waterLevelSystem = new RealtimeWaterLevelSystem();