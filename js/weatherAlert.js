/**
 * 氣象整合警示系統
 * 整合降雨、水位、抽水站狀態進行智慧預警
 */

class WeatherAlertSystem {
    constructor() {
        this.alerts = [];
        this.weatherData = {};
        this.waterLevelData = {};
        this.pumpingStations = {};
        this.alertRules = this.initAlertRules();
        this.isMonitoring = false;
        
        // 通知權限
        this.initNotificationPermission();
        
        // 警示音效
        this.alertSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhAjiS2e/LdSQFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhAjiS2e/LdSQFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwNjVC7');
    }
    
    /**
     * 初始化警示規則
     */
    initAlertRules() {
        return {
            // 降雨警示
            rainfall: {
                light: { threshold: 10, color: '#ffc107', level: 'warning' },      // 小雨 10mm/hr
                moderate: { threshold: 25, color: '#fd7e14', level: 'warning' },   // 中雨 25mm/hr  
                heavy: { threshold: 50, color: '#dc3545', level: 'danger' },       // 大雨 50mm/hr
                extreme: { threshold: 100, color: '#721c24', level: 'critical' }   // 豪雨 100mm/hr
            },
            
            // 水位警示（公尺）
            waterLevel: {
                attention: 3.0,
                warning: 4.0,
                danger: 5.0,
            },
        };
    }
    
    /**
     * 初始化通知權限
     */
    async initNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                await Notification.requestPermission();
            }
        }
    }
    
    /**
     * 獲取氣象資料
     */
    async fetchWeatherData() {
        console.log('🌦️ 開始獲取氣象資料...');

        // 1) 本機 node server：/api/weather/current（.env → CWA_API_KEY）
        const isLocalDev =
            location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        try {
            if (!isLocalDev) throw new Error('靜態站略過 API 代理');
            const res = await fetch('/api/weather/current', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const forecastData = await this.fetchForecastData();
                const typhoonData = await this.fetchTyphoonData();
                this.weatherData = {
                    ...data,
                    forecast: forecastData,
                    typhoon: typhoonData,
                    source: 'CWA_API',
                };
                console.log('✅ 中央氣象署即時資料', data.representativeStation);
                return this.weatherData;
            }
            if (res.status === 503) {
                console.warn('[weather] 本機未設定 CWA_API_KEY，改讀公開站快照');
            } else {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody.error || `HTTP ${res.status}`);
            }
        } catch (serverErr) {
            console.warn('[weather] 伺服器代理不可用:', serverErr.message);
        }

        // 2) GitHub Pages 等靜態站：讀部署時寫入的快照（電腦關機也能看）
        try {
            const snapUrl = typeof window.assetUrl === 'function'
                ? window.assetUrl('data/cwa-weather-latest.json')
                : new URL('data/cwa-weather-latest.json', window.location.href).href;
            const snapRes = await fetch(snapUrl, { cache: 'no-store' });
            if (snapRes.ok) {
                const data = await snapRes.json();
                const forecastData = await this.fetchForecastData();
                const typhoonData = await this.fetchTyphoonData();
                this.weatherData = {
                    ...data,
                    forecast: forecastData,
                    typhoon: typhoonData,
                    source: 'CWA_SNAPSHOT',
                };
                console.log('✅ 氣象快照', data.snapshotAt || data.lastUpdate);
                return this.weatherData;
            }
        } catch (snapErr) {
            console.warn('[weather] 快照不可用:', snapErr.message);
        }

        // 3) 備援：weatherApiConfig.js 內直接填 CWA.apiKey
        if (window.WeatherAPIConfig?.CWA?.apiKey) {
            try {
                const rainfallData = await this.fetchRainfallData();
                const wx = await this.fetchCwaWeatherStations();
                this.weatherData = {
                    rainfall: rainfallData,
                    temperature: wx.temperature,
                    humidity: wx.humidity,
                    windSpeed: wx.windSpeed,
                    pressure: wx.pressure,
                    representativeStation: wx.representativeStation,
                    forecast: await this.fetchForecastData(),
                    typhoon: await this.fetchTyphoonData(),
                    lastUpdate: new Date().toISOString(),
                    source: 'CWA_CLIENT',
                };
                console.log('✅ CWA 客戶端直連');
                return this.weatherData;
            } catch (e) {
                console.error('❌ CWA 直連失敗:', e);
            }
        }

        this.weatherData = this.emptyWeatherData(
            'UNCONFIGURED',
            '本機請 npm start；公開站請在 GitHub Secret 設定 CWA_API_KEY 後重新部署'
        );
        return this.weatherData;
    }

    /** 無 API 時回傳空值（不再使用隨機數） */
    emptyWeatherData(source, statusMessage) {
        return {
            rainfall: { current: null, forecast_3hr: null, forecast_6hr: null },
            temperature: null,
            humidity: null,
            windSpeed: null,
            pressure: null,
            lastUpdate: new Date().toISOString(),
            source,
            statusMessage,
        };
    }

    /** 從 O-A0001-001 取大漢溪流域溫濕度風速（客戶端直連用） */
    async fetchCwaWeatherStations() {
        const apiKey = window.WeatherAPIConfig.CWA.apiKey;
        const baseUrl = window.WeatherAPIConfig.CWA.baseUrl;
        const endpoint = window.WeatherAPIConfig.CWA.endpoints.weather;
        const response = await fetch(
            `${baseUrl}${endpoint}?Authorization=${encodeURIComponent(apiKey)}&format=JSON`
        );
        if (!response.ok) throw new Error(`CWA weather HTTP ${response.status}`);
        const data = await response.json();
        const stations = this.transformCWAWeatherStations(data);
        const avg = (arr) => {
            const v = arr.filter((n) => n != null && Number.isFinite(n));
            return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
        };
        return {
            temperature: avg(stations.map((s) => s.temp)),
            humidity: avg(stations.map((s) => s.humidity)),
            windSpeed: avg(stations.map((s) => s.windSpeed)),
            pressure: avg(stations.map((s) => s.pressure)),
            representativeStation: stations[0]?.name || '大漢溪流域',
        };
    }

    transformCWAWeatherStations(cwaData) {
        const minLat = 24.65, maxLat = 25.06, minLng = 121.24, maxLng = 121.5;
        const out = [];
        if (cwaData.success !== 'true' || !cwaData.records?.location) return out;
        cwaData.records.location.forEach((loc) => {
            const lat = parseFloat(loc.lat);
            const lng = parseFloat(loc.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return;
            const el = {};
            (loc.weatherElement || []).forEach((e) => { el[e.elementName] = e.elementValue; });
            out.push({
                name: loc.locationName,
                temp: parseFloat(el.TEMP) || null,
                humidity: parseFloat(el.HUMD) || null,
                windSpeed: parseFloat(el.WS) || null,
                pressure: parseFloat(el.PRES) || null,
            });
        });
        return out;
    }
    
    /**
     * 獲取降雨資料
     */
    async fetchRainfallData() {
        if (window.WeatherAPIConfig?.CWA?.apiKey) {
            try {
                const apiKey = window.WeatherAPIConfig.CWA.apiKey;
                const baseUrl = window.WeatherAPIConfig.CWA.baseUrl;
                const endpoint = window.WeatherAPIConfig.CWA.endpoints.rainfall;
                
                const response = await fetch(
                    `${baseUrl}${endpoint}?Authorization=${apiKey}&limit=50&format=json`
                );
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('✅ CWA 降雨資料獲取成功');
                
                // 轉換 CWA 資料格式
                return this.transformCWARainfallData(data);
                
            } catch (error) {
                console.error('❌ CWA 降雨資料獲取失敗:', error);
                throw error;
            }
        }
        
        // 模擬資料
        return {
            stations: [
                { id: 'C0A570', name: '板橋', rainfall_1hr: 15.5, rainfall_24hr: 45.2, lat: 25.0078, lng: 121.4593 },
                { id: 'C0A590', name: '新莊', rainfall_1hr: 23.1, rainfall_24hr: 67.8, lat: 25.0375, lng: 121.4315 },
                { id: 'C0A580', name: '三重', rainfall_1hr: 18.7, rainfall_24hr: 52.3, lat: 25.0630, lng: 121.4837 },
                { id: 'C0A600', name: '蘆洲', rainfall_1hr: 12.3, rainfall_24hr: 38.9, lat: 25.0853, lng: 121.4644 }
            ],
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * 轉換中央氣象署降雨資料格式
     */
    transformCWARainfallData(cwaData) {
        const stations = [];
        
        const minLat = 24.65, maxLat = 25.06, minLng = 121.24, maxLng = 121.5;
        if (cwaData.success === "true" && cwaData.records?.location) {
            cwaData.records.location.forEach(location => {
                const lat = parseFloat(location.lat);
                const lng = parseFloat(location.lon);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return;

                const station = {
                    id: location.stationId,
                    name: location.locationName,
                    lat,
                    lng,
                    rainfall_1hr: 0,
                    rainfall_24hr: 0
                };
                
                location.weatherElement?.forEach(element => {
                    if (element.elementName === 'NOW') {
                        station.rainfall_1hr = parseFloat(element.elementValue) || 0;
                    } else if (element.elementName === 'H_24R') {
                        station.rainfall_24hr = parseFloat(element.elementValue) || 0;
                    }
                });
                
                stations.push(station);
            });
        }

        const max1hr = stations.length
            ? Math.max(...stations.map((s) => s.rainfall_1hr))
            : 0;
        
        return {
            stations,
            current: max1hr,
            timestamp: new Date().toISOString(),
            source: 'CWA'
        };
    }
    
    /**
     * 獲取天氣預報
     */
    async fetchForecastData() {
        // 36小時天氣預報
        return {
            location: '新北市',
            forecasts: [
                { time: '2026-05-30T22:00:00', weather: '陰短暫雨', rainProb: 70, temp: 25 },
                { time: '2026-05-31T02:00:00', weather: '陰雨', rainProb: 80, temp: 23 },
                { time: '2026-05-31T08:00:00', weather: '雨', rainProb: 90, temp: 22 }
            ]
        };
    }
    
    /**
     * 獲取颱風資訊
     */
    async fetchTyphoonData() {
        return {
            active: false,
            storms: []
        };
    }
    
    
    /**
     * 依降雨／鄰近水位產生警示（不做綜合風險評分）
     */
    buildStationAlert(station) {
        const parts = [];
        let level = 'medium';
        const rainfall = this.weatherData.rainfall?.current || 0;
        const wl = station.waterLevel || 0;
        const wlRules = this.alertRules.waterLevel;

        if (rainfall >= 50) {
            parts.push(`雨勢 ${rainfall.toFixed(1)} mm/hr`);
            level = 'high';
        } else if (rainfall >= 25) {
            parts.push(`降雨 ${rainfall.toFixed(1)} mm/hr`);
        }

        if (wl > wlRules.danger) {
            parts.push(`鄰近水位 ${wl.toFixed(2)} m`);
            level = 'critical';
        } else if (wl > wlRules.warning) {
            parts.push(`鄰近水位 ${wl.toFixed(2)} m`);
            if (level !== 'critical') level = 'high';
        } else if (wl > wlRules.attention) {
            parts.push(`鄰近水位 ${wl.toFixed(2)} m`);
        }

        if (parts.length === 0) return null;

        return {
            level,
            message: `${station.name}：${parts.join('、')}`,
        };
    }

    /**
     * 檢查並生成警示
     */
    async checkAlerts() {
        if (!this.isMonitoring) return;

        await this.fetchWeatherData();

        const newAlerts = [];
        const seen = new Set();

        Object.values(this.pumpingStations).forEach((station) => {
            const info = this.buildStationAlert(station);
            if (!info) return;

            const key = `${station.id}_${info.level}`;
            if (seen.has(key)) return;
            seen.add(key);

            newAlerts.push({
                id: `alert_${station.id}_${Date.now()}`,
                stationId: station.id,
                stationName: station.name,
                type: 'weather_notice',
                level: info.level,
                message: info.message,
                timestamp: new Date().toISOString(),
                acknowledged: false,
            });
        });

        this.alerts = [...newAlerts, ...this.alerts.filter((a) => !a.acknowledged)];

        newAlerts.forEach((alert) => this.sendNotification(alert));
        this.updateAlertUI();
        if (typeof window.updateAlertToggleBadge === 'function') {
            window.updateAlertToggleBadge();
        }

        return newAlerts;
    }
    
    /**
     * 發送通知
     */
    sendNotification(alert) {
        // 1. 瀏覽器通知
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(`🚨 ${alert.level.toUpperCase()} 警示`, {
                body: alert.message,
                icon: '/favicon.ico',
                tag: alert.id,
                requireInteraction: alert.level === 'critical'
            });
            
            notification.onclick = () => {
                window.focus();
                this.goToStation(alert.stationId);
            };
        }
        
        if (alert.level === 'high' || alert.level === 'critical') {
            this.playAlertSound();
        }

        this.highlightStationOnMap(alert.stationId, alert.level);
        console.log(`📢 氣象通知:`, alert.message);
    }

    goToStation(stationId) {
        if (window.flyToPumpingStation && window.flyToPumpingStation(stationId)) {
            return;
        }
        this.highlightStationOnMap(stationId, 'medium');
    }

    showAlertDetail(alertId) {
        const alert = this.alerts.find((a) => a.id === alertId);
        if (alert) this.goToStation(alert.stationId);
    }
    
    /**
     * 播放警示音效
     */
    playAlertSound() {
        try {
            this.alertSound.play().catch(e => console.log('音效播放失敗:', e));
        } catch (error) {
            console.log('音效播放失敗:', error);
        }
    }
    
    /**
     * 地圖上高亮顯示警示站點
     */
    highlightStationOnMap(stationId, level) {
        // 這個函數需要與主地圖系統整合
        if (window.highlightPumpingStation) {
            window.highlightPumpingStation(stationId, level);
        }
    }
    
    /**
     * 更新警示 UI
     */
    updateAlertUI() {
        const alertPanel = document.getElementById('alertPanel');
        if (!alertPanel) return;
        
        const activeAlerts = this.alerts.filter(a => !a.acknowledged);
        
        if (activeAlerts.length === 0) {
            alertPanel.innerHTML = `
                <div class="no-alerts">
                    <div class="no-alerts-icon">✅</div>
                    <p>目前無未確認警示</p>
                </div>
            `;
        } else {
            alertPanel.innerHTML = `
                <div class="alert-list-header">
                    <strong>🚨 警示通知 (${activeAlerts.length})</strong>
                    <button type="button" onclick="weatherAlert.clearAllAlerts()" class="btn-clear">清除全部</button>
                </div>
                <div class="alert-list">
                    ${activeAlerts.map((alert) => this.renderAlert(alert)).join('')}
                </div>
            `;
        }
        
        const alertBadge = document.getElementById('alertBadge');
        if (alertBadge) {
            alertBadge.textContent = activeAlerts.length;
            alertBadge.style.display = activeAlerts.length > 0 ? 'flex' : 'none';
        }
        if (typeof window.updateAlertToggleBadge === 'function') {
            window.updateAlertToggleBadge();
        }
    }
    
    /**
     * 渲染單個警示
     */
    renderAlert(alert) {
        const levelColors = {
            low: '#28a745',
            medium: '#ffc107', 
            high: '#fd7e14',
            critical: '#dc3545'
        };
        
        const sid = alert.stationId;
        return `
            <div class="alert-item alert-${alert.level} alert-item--clickable"
                 style="border-left: 4px solid ${levelColors[alert.level] || '#ffc107'}"
                 role="button" tabindex="0"
                 onclick="weatherAlert.goToStation(${sid})"
                 onkeydown="if(event.key==='Enter')weatherAlert.goToStation(${sid})">
                <div class="alert-content">
                    <div class="alert-title">
                        <strong>${alert.stationName}</strong>
                        <span class="alert-time">${new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div class="alert-message">${alert.message}</div>
                    <div class="alert-goto-hint">點擊前往地圖上的抽水站 →</div>
                </div>
                <div class="alert-actions">
                    <button type="button" class="btn-goto" onclick="event.stopPropagation();weatherAlert.goToStation(${sid})">📍 定位</button>
                    <button type="button" class="btn-ack" onclick="event.stopPropagation();weatherAlert.acknowledgeAlert('${alert.id}')">確認</button>
                </div>
            </div>
        `;
    }
    
    /**
     * 確認警示
     */
    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedAt = new Date().toISOString();
            this.updateAlertUI();
        }
    }
    
    /**
     * 清除所有警示
     */
    clearAllAlerts() {
        this.alerts.forEach(alert => alert.acknowledged = true);
        this.updateAlertUI();
    }
    
    /**
     * 開始監控
     */
    startMonitoring(interval = 300000) { // 預設5分鐘檢查一次
        this.isMonitoring = true;
        console.log('🔄 氣象警示系統開始監控');
        
        // 立即執行一次檢查
        this.checkAlerts();
        
        // 設定定期檢查
        this.monitoringInterval = setInterval(() => {
            this.checkAlerts();
        }, interval);
    }
    
    /**
     * 停止監控
     */
    stopMonitoring() {
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        console.log('⏹️ 氣象警示系統停止監控');
    }
    
    /**
     * 更新抽水站資料
     */
    updatePumpingStations(stations) {
        stations.forEach(station => {
            this.pumpingStations[station.id] = station;
        });
    }
    
    /**
     * 更新水位資料
     */
    updateWaterLevelData(waterLevelData) {
        this.waterLevelData = waterLevelData;
        
        // 更新抽水站的水位資訊
        Object.values(this.pumpingStations).forEach(station => {
            if (station.nearestWaterStation) {
                const wlData = waterLevelData[station.nearestWaterStation.stationid];
                if (wlData) {
                    station.waterLevel = parseFloat(wlData.waterlevel) || 0;
                }
            }
        });
    }
}

// 全域實例
window.weatherAlert = new WeatherAlertSystem();