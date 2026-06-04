/**
 * 即時降雨資料更新系統
 * 使用中央氣象署降雨量資料 API (C-B0025-001)
 */

class RealtimeRainfallSystem {
    constructor() {
        this.apiKey = 'CWA-775D44F9-041E-4A3D-B44B-67EE7D294961';
        this.baseUrl = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/';
        this.endpoint = 'O-A0002-001'; // 即時雨量觀測資料 (每10分鐘更新)
        this.rainfallData = {};
        this.lastUpdate = null;
        this.updateInterval = null;
        this.isUpdating = false;
        
        // 更新頻率 (3分鐘 - API每10分鐘更新，我們稍微頻繁檢查)
        this.updateFrequency = 3 * 60 * 1000;
        
        console.log('🌧️ 即時降雨系統初始化');
    }
    
    /**
     * 獲取即時降雨資料
     */
    async fetchRainfallData() {
        try {
            console.log('🔄 正在獲取即時降雨資料...');
            
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
            const processedData = this.processRainfallData(data);
            
            // 更新全域降雨資料
            this.rainfallData = processedData;
            this.lastUpdate = new Date();
            
            // 更新氣象警示系統的降雨資料
            if (window.weatherAlert && window.weatherAlert.weatherData) {
                window.weatherAlert.weatherData.rainfall = {
                    current: this.calculateAverageRainfall(processedData),
                    stations: processedData,
                    lastUpdate: this.lastUpdate.toISOString()
                };
            }
            
            console.log(`✅ 降雨資料更新完成，共 ${Object.keys(processedData).length} 個站點`);
            
            // 觸發更新事件
            this.dispatchUpdateEvent(processedData);
            
            return processedData;
            
        } catch (error) {
            console.error('❌ 降雨資料獲取失敗:', error);
            this.showErrorNotification(error.message);
            throw error;
        }
    }
    
    /**
     * 處理和轉換降雨資料格式 (O-A0002-001 格式)
     */
    processRainfallData(rawData) {
        const processedData = {};
        
        if (!rawData.records?.Station) {
            console.warn('⚠️ 降雨資料格式異常');
            return processedData;
        }
        
        rawData.records.Station.forEach(station => {
            const stationId = station.StationId;
            const stationName = station.StationName;
            
            // 初始化站點資料
            const stationData = {
                stationId: stationId,
                stationName: stationName,
                lat: parseFloat(station.GeoInfo?.Coordinates?.[0]?.StationLatitude) || null,
                lng: parseFloat(station.GeoInfo?.Coordinates?.[0]?.StationLongitude) || null,
                address: station.GeoInfo?.StationAddress || '',
                altitude: parseFloat(station.GeoInfo?.StationAltitude) || 0,
                countyName: station.GeoInfo?.CountyName || '',
                townName: station.GeoInfo?.TownName || '',
                maintainer: station.Authority || '中央氣象署',
                rainfall: {
                    min_10: null,     // 10分鐘累積雨量
                    hour_1: null,     // 1小時累積雨量
                    hour_3: null,     // 3小時累積雨量
                    hour_6: null,     // 6小時累積雨量
                    hour_12: null,    // 12小時累積雨量
                    hour_24: null,    // 24小時累積雨量
                    today: null,      // 本日0時至目前累積雨量
                    yesterday: null,  // 前1日累積雨量
                    day_2: null       // 前2日累積雨量
                },
                datetime: station.ObsTime?.DateTime || null,
                status: 'active'
            };
            
            // 解析降雨元素 (O-A0002-001 的資料結構)
            if (station.RainfallElement?.Past10Min) {
                stationData.rainfall.min_10 = parseFloat(station.RainfallElement.Past10Min.Precipitation) || 0;
            }
            
            if (station.RainfallElement?.Past1hr) {
                stationData.rainfall.hour_1 = parseFloat(station.RainfallElement.Past1hr.Precipitation) || 0;
            }
            
            if (station.RainfallElement?.Past3hr) {
                stationData.rainfall.hour_3 = parseFloat(station.RainfallElement.Past3hr.Precipitation) || 0;
            }
            
            if (station.RainfallElement?.Past6hr) {
                stationData.rainfall.hour_6 = parseFloat(station.RainfallElement.Past6hr.Precipitation) || 0;
            }
            
            if (station.RainfallElement?.Past12hr) {
                stationData.rainfall.hour_12 = parseFloat(station.RainfallElement.Past12hr.Precipitation) || 0;
            }
            
            if (station.RainfallElement?.Past24hr) {
                stationData.rainfall.hour_24 = parseFloat(station.RainfallElement.Past24hr.Precipitation) || 0;
            }
            
            if (station.RainfallElement?.Now) {
                stationData.rainfall.today = parseFloat(station.RainfallElement.Now.Precipitation) || 0;
            }
            
            // 如果找不到 RainfallElement，嘗試舊格式的 WeatherElement
            if (!station.RainfallElement && station.WeatherElement) {
                station.WeatherElement.forEach(element => {
                    const elementName = element.ElementName;
                    const elementValue = parseFloat(element.ElementValue) || 0;
                    
                    switch (elementName) {
                        case 'RAIN':
                        case 'NOW':
                            stationData.rainfall.today = elementValue;
                            break;
                        case 'MIN_10':
                            stationData.rainfall.min_10 = elementValue;
                            break;
                        case 'HOUR_1':
                        case 'H_1':
                            stationData.rainfall.hour_1 = elementValue;
                            break;
                        case 'HOUR_3':
                        case 'H_3':
                            stationData.rainfall.hour_3 = elementValue;
                            break;
                        case 'HOUR_6':
                        case 'H_6':
                            stationData.rainfall.hour_6 = elementValue;
                            break;
                        case 'HOUR_12':
                        case 'H_12':
                            stationData.rainfall.hour_12 = elementValue;
                            break;
                        case 'HOUR_24':
                        case 'H_24':
                        case 'DAY':
                            stationData.rainfall.hour_24 = elementValue;
                            break;
                    }
                });
            }
            
            // 如果有任何降雨資料才加入
            const hasRainfallData = Object.values(stationData.rainfall).some(value => value !== null && value >= 0);
            if (hasRainfallData) {
                processedData[stationId] = stationData;
            }
        });
        
        console.log(`🌧️ 處理完成，共 ${Object.keys(processedData).length} 個雨量站`);
        return processedData;
    }
    
    /**
     * 計算平均降雨量（用於氣象警示系統）
     */
    calculateAverageRainfall(rainfallData) {
        const stations = Object.values(rainfallData);
        if (stations.length === 0) return 0;
        
        // 優先使用1小時累積雨量，其次使用10分鐘雨量推算
        let totalRainfall = 0;
        let validStations = 0;
        
        stations.forEach(station => {
            let rainfallValue = null;
            
            // 優先使用1小時雨量
            if (station.rainfall.hour_1 !== null && station.rainfall.hour_1 >= 0) {
                rainfallValue = station.rainfall.hour_1;
            } 
            // 其次使用10分鐘雨量換算成小時雨量 (x6)
            else if (station.rainfall.min_10 !== null && station.rainfall.min_10 >= 0) {
                rainfallValue = station.rainfall.min_10 * 6; // 10分鐘 x 6 = 1小時
            }
            // 最後使用今日累積雨量的估算值
            else if (station.rainfall.today !== null && station.rainfall.today >= 0) {
                // 假設平均分布到當前小時數
                const currentHour = new Date().getHours() || 1;
                rainfallValue = station.rainfall.today / currentHour;
            }
            
            if (rainfallValue !== null) {
                totalRainfall += rainfallValue;
                validStations++;
            }
        });
        
        return validStations > 0 ? totalRainfall / validStations : 0;
    }
    
    /**
     * 開始自動更新
     */
    startAutoUpdate() {
        if (this.updateInterval) {
            console.log('🔄 降雨自動更新已在運行中');
            return;
        }
        
        console.log(`🚀 開始自動更新即時降雨資料 (每 ${this.updateFrequency / 1000 / 60} 分鐘)`);
        console.log(`📡 使用 CWA ${this.endpoint} API (每10分鐘更新)`);
        
        // 立即執行一次
        this.fetchRainfallData();
        
        // 設定定期更新
        this.updateInterval = setInterval(() => {
            if (!this.isUpdating) {
                this.fetchRainfallData();
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
            console.log('⏹️ 降雨自動更新已停止');
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
            await this.fetchRainfallData();
            this.showSuccessNotification('降雨資料更新成功！');
        } catch (error) {
            this.showErrorNotification(`更新失敗: ${error.message}`);
        } finally {
            this.isUpdating = false;
        }
    }
    
    /**
     * 獲取特定站點的降雨資料
     */
    getStationData(stationId) {
        return this.rainfallData[stationId] || null;
    }
    
    /**
     * 獲取區域降雨統計
     */
    getRegionalStats(region = 'all') {
        const stations = Object.values(this.rainfallData);
        
        const stats = {
            stationCount: stations.length,
            averageHourly: 0,
            maxHourly: 0,
            maxStation: null,
            highRainStations: [], // > 50mm/hr
            moderateRainStations: [] // 10-50mm/hr
        };
        
        let totalRainfall = 0;
        let validStations = 0;
        
        stations.forEach(station => {
            // 使用多層級雨量資料
            let hourlyRain = null;
            
            // 優先使用1小時雨量
            if (station.rainfall.hour_1 !== null && station.rainfall.hour_1 >= 0) {
                hourlyRain = station.rainfall.hour_1;
            }
            // 使用10分鐘雨量推算
            else if (station.rainfall.min_10 !== null && station.rainfall.min_10 >= 0) {
                hourlyRain = station.rainfall.min_10 * 6;
            }
            
            if (hourlyRain !== null && hourlyRain >= 0) {
                totalRainfall += hourlyRain;
                validStations++;
                
                if (hourlyRain > stats.maxHourly) {
                    stats.maxHourly = hourlyRain;
                    stats.maxStation = station;
                }
                
                if (hourlyRain >= 50) {
                    stats.highRainStations.push(station);
                } else if (hourlyRain >= 10) {
                    stats.moderateRainStations.push(station);
                }
            }
        });
        
        stats.averageHourly = validStations > 0 ? totalRainfall / validStations : 0;
        
        return stats;
    }
    
    /**
     * 觸發更新事件
     */
    dispatchUpdateEvent(data) {
        const stats = this.getRegionalStats();
        
        const event = new CustomEvent('rainfallUpdated', {
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
            new Notification('降雨資料更新', {
                body: message,
                icon: '/favicon.ico',
                tag: 'rainfall-update'
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
        const indicator = document.getElementById('rainfallStatus');
        if (indicator) {
            indicator.className = `status-indicator ${type}`;
            indicator.textContent = message;
            
            setTimeout(() => {
                indicator.style.opacity = '0.6';
            }, 3000);
        }
        
        const lastUpdateEl = document.getElementById('lastRainfallUpdate');
        if (lastUpdateEl && this.lastUpdate) {
            lastUpdateEl.textContent = this.lastUpdate.toLocaleString();
        }
    }
    
    /**
     * 創建狀態面板 UI
     */
    createStatusPanel() {
        const panel = document.createElement('div');
        panel.id = 'rainfallStatusPanel';
        panel.innerHTML = `
            <div class="rainfall-status-panel">
                <div class="status-header">
                    <span>🌧️ 即時降雨</span>
                    <button onclick="rainfallSystem.manualUpdate()" class="refresh-btn" title="手動更新">🔄</button>
                </div>
                <div id="rainfallStatus" class="status-indicator">準備中...</div>
                <div class="rainfall-stats" id="rainfallStats">
                    <div class="stat-item">
                        <span class="stat-label">平均雨量:</span>
                        <span class="stat-value" id="avgRainfall">-- mm/hr</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">最大雨量:</span>
                        <span class="stat-value" id="maxRainfall">-- mm/hr</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">測站數量:</span>
                        <span class="stat-value" id="stationCount">--</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">警戒站點:</span>
                        <span class="stat-value" id="alertStations">--</span>
                    </div>
                </div>
                <div class="status-info">
                    <small>最後更新: <span id="lastRainfallUpdate">--</span></small>
                </div>
            </div>
        `;
        
        // 添加樣式
        const style = document.createElement('style');
        style.textContent = `
            .rainfall-status-panel {
                position: fixed;
                bottom: 80px;
                right: 20px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 1400;
                min-width: 220px;
            }
            
            .rainfall-stats {
                margin: 8px 0;
                font-size: 12px;
            }
            
            .stat-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 4px;
            }
            
            .stat-label {
                color: #666;
            }
            
            .stat-value {
                font-weight: bold;
                color: #2c3e50;
            }
            
            @media (max-width: 768px) {
                .rainfall-status-panel {
                    bottom: 70px;
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
        const stats = this.getRegionalStats();
        
        const avgEl = document.getElementById('avgRainfall');
        if (avgEl) {
            avgEl.textContent = `${stats.averageHourly.toFixed(1)} mm/hr`;
        }
        
        const maxEl = document.getElementById('maxRainfall');
        if (maxEl) {
            maxEl.textContent = `${stats.maxHourly.toFixed(1)} mm/hr`;
            
            // 根據雨量大小設定顏色
            if (stats.maxHourly >= 50) {
                maxEl.style.color = '#dc3545'; // 紅色 - 豪雨
            } else if (stats.maxHourly >= 25) {
                maxEl.style.color = '#fd7e14'; // 橙色 - 大雨
            } else if (stats.maxHourly >= 10) {
                maxEl.style.color = '#ffc107'; // 黃色 - 中雨
            } else {
                maxEl.style.color = '#28a745'; // 綠色 - 小雨
            }
        }
        
        const countEl = document.getElementById('stationCount');
        if (countEl) {
            countEl.textContent = stats.stationCount;
        }
        
        const alertEl = document.getElementById('alertStations');
        if (alertEl) {
            const alertCount = stats.highRainStations.length + stats.moderateRainStations.length;
            alertEl.textContent = alertCount;
            alertEl.style.color = alertCount > 0 ? '#dc3545' : '#28a745';
        }
    }
    
    /**
     * 獲取更新狀態
     */
    getUpdateStatus() {
        return {
            isUpdating: this.isUpdating,
            lastUpdate: this.lastUpdate,
            stationCount: Object.keys(this.rainfallData).length,
            autoUpdateEnabled: !!this.updateInterval
        };
    }
}

// 建立全域實例
window.rainfallSystem = new RealtimeRainfallSystem();