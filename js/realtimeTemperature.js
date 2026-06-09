/**
 * 即時氣象觀測系統
 * 使用中央氣象署 O-A0001-001（氣象觀測站-全測站逐時氣象資料）
 * 含：氣溫、濕度、風速、風向、氣壓、天氣現象、當日雨量
 */

class RealtimeTemperatureSystem {
    constructor() {
        this.apiKey = (window.WeatherAPIConfig?.CWA?.apiKey) || 'CWA-775D44F9-041E-4A3D-B44B-67EE7D294961';
        this.baseUrl = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/';
        this.endpoint = 'O-A0001-001'; // 全測站逐時氣象資料
        this.temperatureData = {};
        this.lastUpdate = null;
        this.updateInterval = null;
        this.isUpdating = false;
        
        // 更新頻率 (10分鐘 - 逐時資料約每小時更新)
        this.updateFrequency = 10 * 60 * 1000;
        
        console.log('🌡️ 即時氣象觀測系統初始化 (O-A0001-001)');
    }

    /** 氣象署缺值／故障碼 */
    parseCwaValue(value) {
        if (value === undefined || value === null || value === '') return null;
        const v = parseFloat(value);
        if (Number.isNaN(v)) return null;
        if (v <= -90) return null; // -99, -999 等
        return v;
    }

    /** 優先使用 WGS84 座標 */
    getStationCoords(geoInfo) {
        const coords = geoInfo?.Coordinates || [];
        const wgs =
            coords.find((c) => c.CoordinateName === 'WGS84') ||
            coords[coords.length - 1] ||
            coords[0];
        return {
            lat: parseFloat(wgs?.StationLatitude) || null,
            lng: parseFloat(wgs?.StationLongitude) || null,
        };
    }
    
    /**
     * 獲取即時氣溫資料
     */
    async fetchTemperatureData() {
        try {
            console.log('🔄 正在獲取即時氣溫資料...');
            
            const url = `${this.baseUrl}${this.endpoint}?Authorization=${this.apiKey}&format=JSON`;
            
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
            const processedData = this.processTemperatureData(data);
            
            // 更新全域氣溫資料
            this.temperatureData = processedData;
            this.lastUpdate = new Date();
            
            // 更新氣象警示系統的氣溫資料
            if (window.weatherAlert && window.weatherAlert.weatherData) {
                const stats = this.getTemperatureStats(processedData);
                window.weatherAlert.weatherData.temperature = {
                    current: stats.averageTemp,
                    max: stats.maxTemp,
                    min: stats.minTemp,
                    stations: processedData,
                    lastUpdate: this.lastUpdate.toISOString()
                };
            }
            
            console.log(`✅ 氣溫資料更新完成，共 ${Object.keys(processedData).length} 個站點`);
            
            // 觸發更新事件
            this.dispatchUpdateEvent(processedData);
            
            return processedData;
            
        } catch (error) {
            console.error('❌ 氣溫資料獲取失敗:', error);
            this.showErrorNotification(error.message);
            throw error;
        }
    }
    
    /**
     * 處理 O-A0001-001 逐時氣象資料
     */
    processTemperatureData(rawData) {
        const processedData = {};
        
        if (!rawData.records?.Station) {
            console.warn('⚠️ 氣象資料格式異常');
            return processedData;
        }
        
        rawData.records.Station.forEach(station => {
            const stationId = station.StationId;
            const stationName = station.StationName;
            const { lat, lng } = this.getStationCoords(station.GeoInfo);
            
            // 初始化站點資料
            const stationData = {
                stationId: stationId,
                stationName: stationName,
                lat,
                lng,
                address: station.GeoInfo?.StationAddress || '',
                altitude: parseFloat(station.GeoInfo?.StationAltitude) || 0,
                countyName: station.GeoInfo?.CountyName || '',
                townName: station.GeoInfo?.TownName || '',
                maintainer: station.Authority || '中央氣象署',
                weather: {
                    temperature: null,        // 當前氣溫 (°C)
                    humidity: null,          // 相對濕度 (%)
                    pressure: null,          // 氣壓 (hPa)
                    windSpeed: null,         // 風速 (m/s)
                    windDirection: null,     // 風向 (度)
                    visibility: null,        // 能見度
                    weatherDesc: null,       // 天氣現象描述
                    uvIndex: null,          // 紫外線指數
                    dailyHigh: null,        // 當日最高溫
                    dailyLow: null,         // 當日最低溫
                    rainfall: null          // 當日降水量
                },
                datetime: station.ObsTime?.DateTime || null,
                status: 'active'
            };
            
            const we = station.WeatherElement;
            if (we) {
                stationData.weather.temperature = this.parseCwaValue(we.AirTemperature);
                stationData.weather.humidity = this.parseCwaValue(we.RelativeHumidity);
                stationData.weather.pressure = this.parseCwaValue(we.AirPressure);
                stationData.weather.windSpeed = this.parseCwaValue(we.WindSpeed);
                stationData.weather.windDirection = this.parseCwaValue(we.WindDirection);
                stationData.weather.weatherDesc =
                    we.Weather && we.Weather !== '-99' ? we.Weather : null;
                stationData.weather.uvIndex = this.parseCwaValue(we.UVIndex);

                if (we.VisibilityDescription && we.VisibilityDescription !== '-99') {
                    stationData.weather.visibility = we.VisibilityDescription;
                }

                if (we.DailyExtreme?.DailyHigh?.TemperatureInfo?.AirTemperature) {
                    stationData.weather.dailyHigh = this.parseCwaValue(
                        we.DailyExtreme.DailyHigh.TemperatureInfo.AirTemperature
                    );
                }
                if (we.DailyExtreme?.DailyLow?.TemperatureInfo?.AirTemperature) {
                    stationData.weather.dailyLow = this.parseCwaValue(
                        we.DailyExtreme.DailyLow.TemperatureInfo.AirTemperature
                    );
                }

                // 本時段降水量 (mm)
                if (we.Now?.Precipitation !== undefined) {
                    stationData.weather.rainfall = this.parseCwaValue(we.Now.Precipitation);
                }
            }
            
            if (stationData.weather.temperature !== null) {
                stationData.dataSource = 'O-A0001';
                processedData[stationId] = stationData;
            }
        });
        
        console.log(`🌡️ O-A0001 處理完成，共 ${Object.keys(processedData).length} 個氣象站`);
        return processedData;
    }
    
    /**
     * 計算氣溫統計資訊
     */
    getTemperatureStats(temperatureData) {
        const stations = Object.values(temperatureData);
        
        const stats = {
            stationCount: stations.length,
            averageTemp: 0,
            maxTemp: -Infinity,
            minTemp: Infinity,
            maxTempStation: null,
            minTempStation: null,
            hotStations: [],      // > 35°C
            coldStations: [],     // < 10°C
            averageHumidity: 0,
            averagePressure: 0
        };
        
        if (stations.length === 0) return stats;
        
        let totalTemp = 0;
        let totalHumidity = 0;
        let totalPressure = 0;
        let validTempStations = 0;
        let validHumidityStations = 0;
        let validPressureStations = 0;
        
        stations.forEach(station => {
            const temp = station.weather.temperature;
            const humidity = station.weather.humidity;
            const pressure = station.weather.pressure;
            
            if (temp !== null) {
                totalTemp += temp;
                validTempStations++;
                
                if (temp > stats.maxTemp) {
                    stats.maxTemp = temp;
                    stats.maxTempStation = station;
                }
                
                if (temp < stats.minTemp) {
                    stats.minTemp = temp;
                    stats.minTempStation = station;
                }
                
                if (temp >= 35) {
                    stats.hotStations.push(station);
                } else if (temp <= 10) {
                    stats.coldStations.push(station);
                }
            }
            
            if (humidity !== null) {
                totalHumidity += humidity;
                validHumidityStations++;
            }
            
            if (pressure !== null) {
                totalPressure += pressure;
                validPressureStations++;
            }
        });
        
        stats.averageTemp = validTempStations > 0 ? totalTemp / validTempStations : 0;
        stats.averageHumidity = validHumidityStations > 0 ? totalHumidity / validHumidityStations : 0;
        stats.averagePressure = validPressureStations > 0 ? totalPressure / validPressureStations : 0;
        
        if (stats.maxTemp === -Infinity) stats.maxTemp = 0;
        if (stats.minTemp === Infinity) stats.minTemp = 0;
        
        return stats;
    }
    
    /**
     * 開始自動更新
     */
    startAutoUpdate() {
        if (this.updateInterval) {
            console.log('🔄 氣溫自動更新已在運行中');
            return;
        }
        
        console.log(`🚀 開始自動更新逐時氣象資料 (每 ${this.updateFrequency / 1000 / 60} 分鐘)`);
        console.log(`📡 使用 CWA ${this.endpoint} API (逐時觀測)`);
        
        // 立即執行一次
        this.fetchTemperatureData();
        
        // 設定定期更新
        this.updateInterval = setInterval(() => {
            if (!this.isUpdating) {
                this.fetchTemperatureData();
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
            console.log('⏹️ 氣溫自動更新已停止');
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
            await this.fetchTemperatureData();
            this.showSuccessNotification('氣溫資料更新成功！');
        } catch (error) {
            this.showErrorNotification(`更新失敗: ${error.message}`);
        } finally {
            this.isUpdating = false;
        }
    }
    
    /**
     * 獲取特定站點的氣溫資料
     */
    getStationData(stationId) {
        return this.temperatureData[stationId] || null;
    }
    
    /**
     * 觸發更新事件
     */
    dispatchUpdateEvent(data) {
        const stats = this.getTemperatureStats(data);
        
        const event = new CustomEvent('temperatureUpdated', {
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
            new Notification('氣溫資料更新', {
                body: message,
                icon: '/favicon.ico',
                tag: 'temperature-update'
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
        const indicator = document.getElementById('temperatureStatus');
        if (indicator) {
            indicator.className = `status-indicator ${type}`;
            indicator.textContent = message;
            
            setTimeout(() => {
                indicator.style.opacity = '0.6';
            }, 3000);
        }
        
        const lastUpdateEl = document.getElementById('lastTemperatureUpdate');
        if (lastUpdateEl && this.lastUpdate) {
            lastUpdateEl.textContent = this.lastUpdate.toLocaleString();
        }
    }
    
    /**
     * 創建狀態面板 UI
     */
    createStatusPanel() {
        const panel = document.createElement('div');
        panel.id = 'temperatureStatusPanel';
        panel.innerHTML = `
            <div class="temperature-status-panel">
                <div class="status-header">
                    <span>🌦️ 逐時氣象</span>
                    <button onclick="temperatureSystem.manualUpdate()" class="refresh-btn" title="手動更新">🔄</button>
                </div>
                <div id="temperatureStatus" class="status-indicator">準備中...</div>
                <div class="temperature-stats" id="temperatureStats">
                    <div class="stat-item">
                        <span class="stat-label">平均溫度:</span>
                        <span class="stat-value" id="avgTemperature">-- °C</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">最高溫度:</span>
                        <span class="stat-value" id="maxTemperature">-- °C</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">最低溫度:</span>
                        <span class="stat-value" id="minTemperature">-- °C</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">平均濕度:</span>
                        <span class="stat-value" id="avgHumidity">-- %</span>
                    </div>
                </div>
                <div class="status-info">
                    <small>最後更新: <span id="lastTemperatureUpdate">--</span></small>
                </div>
            </div>
        `;
        
        // 添加樣式
        const style = document.createElement('style');
        style.textContent = `
            .temperature-status-panel {
                position: fixed;
                bottom: 240px;
                right: 20px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 1400;
                min-width: 220px;
            }
            
            .temperature-stats {
                margin: 8px 0;
                font-size: 12px;
            }
            
            @media (max-width: 768px) {
                .temperature-status-panel {
                    bottom: 230px;
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
        const stats = this.getTemperatureStats(this.temperatureData);
        
        const avgEl = document.getElementById('avgTemperature');
        if (avgEl) {
            avgEl.textContent = `${stats.averageTemp.toFixed(1)} °C`;
            
            // 根據溫度設定顏色
            if (stats.averageTemp >= 35) {
                avgEl.style.color = '#dc3545'; // 紅色 - 高溫
            } else if (stats.averageTemp >= 25) {
                avgEl.style.color = '#fd7e14'; // 橙色 - 溫暖
            } else if (stats.averageTemp >= 15) {
                avgEl.style.color = '#28a745'; // 綠色 - 舒適
            } else {
                avgEl.style.color = '#007bff'; // 藍色 - 涼爽
            }
        }
        
        const maxEl = document.getElementById('maxTemperature');
        if (maxEl) {
            maxEl.textContent = `${stats.maxTemp.toFixed(1)} °C`;
            maxEl.style.color = stats.maxTemp >= 35 ? '#dc3545' : '#fd7e14';
        }
        
        const minEl = document.getElementById('minTemperature');
        if (minEl) {
            minEl.textContent = `${stats.minTemp.toFixed(1)} °C`;
            minEl.style.color = stats.minTemp <= 10 ? '#007bff' : '#28a745';
        }
        
        const humidityEl = document.getElementById('avgHumidity');
        if (humidityEl) {
            humidityEl.textContent = `${stats.averageHumidity.toFixed(0)} %`;
        }
    }
    
    /**
     * 獲取更新狀態
     */
    getUpdateStatus() {
        return {
            isUpdating: this.isUpdating,
            lastUpdate: this.lastUpdate,
            stationCount: Object.keys(this.temperatureData).length,
            autoUpdateEnabled: !!this.updateInterval
        };
    }
}

// 建立全域實例
window.temperatureSystem = new RealtimeTemperatureSystem();