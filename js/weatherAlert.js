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
            
            // 水位警示
            waterLevel: {
                normal: { threshold: 2.0, color: '#28a745', level: 'safe' },       // 正常 <2m
                attention: { threshold: 3.0, color: '#ffc107', level: 'warning' }, // 注意 2-3m
                warning: { threshold: 4.0, color: '#fd7e14', level: 'warning' },   // 警戒 3-4m
                danger: { threshold: 5.0, color: '#dc3545', level: 'danger' },     // 危險 4-5m
                emergency: { threshold: 6.0, color: '#721c24', level: 'critical' } // 緊急 >5m
            },
            
            // 綜合風險評估
            riskMatrix: {
                low: { score: 0-30, color: '#28a745', action: 'monitor' },
                medium: { score: 31-60, color: '#ffc107', action: 'prepare' },
                high: { score: 61-80, color: '#fd7e14', action: 'alert' },
                critical: { score: 81-100, color: '#dc3545', action: 'emergency' }
            }
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
        try {
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
            const errBody = await res.json().catch(() => ({}));
            if (res.status === 503) {
                console.warn('⚠️', errBody.hint || errBody.error);
                this.weatherData = this.emptyWeatherData('NO_KEY', errBody.hint || errBody.error);
                return this.weatherData;
            }
            throw new Error(errBody.error || `HTTP ${res.status}`);
        } catch (serverErr) {
            console.warn('[weather] 伺服器代理不可用:', serverErr.message);
        }

        // 2) 備援：weatherApiConfig.js 內直接填 CWA.apiKey（僅本機／靜態站）
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
            '請在 .env 設定 CWA_API_KEY 並用 npm start 開啟（勿用 file://）'
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
     * 風險評估演算法
     */
    calculateRiskScore(stationData) {
        let riskScore = 0;
        const factors = [];
        
        // 1. 降雨因子 (40% 權重)
        const rainfall = this.weatherData.rainfall?.current || 0;
        let rainfallScore = 0;
        if (rainfall > 100) rainfallScore = 40;
        else if (rainfall > 50) rainfallScore = 30;
        else if (rainfall > 25) rainfallScore = 20;
        else if (rainfall > 10) rainfallScore = 10;
        
        riskScore += rainfallScore;
        factors.push(`降雨: ${rainfall.toFixed(1)}mm/hr (${rainfallScore}分)`);
        
        // 2. 水位因子 (35% 權重)
        const waterLevel = stationData.waterLevel || 0;
        let waterLevelScore = 0;
        if (waterLevel > 6) waterLevelScore = 35;
        else if (waterLevel > 5) waterLevelScore = 28;
        else if (waterLevel > 4) waterLevelScore = 21;
        else if (waterLevel > 3) waterLevelScore = 14;
        else if (waterLevel > 2) waterLevelScore = 7;
        
        riskScore += waterLevelScore;
        factors.push(`水位: ${waterLevel.toFixed(2)}m (${waterLevelScore}分)`);
        
        // 3. 預報因子 (15% 權重)
        const rainForecast = this.weatherData.rainfall?.forecast_3hr || 0;
        let forecastScore = 0;
        if (rainForecast > 50) forecastScore = 15;
        else if (rainForecast > 30) forecastScore = 10;
        else if (rainForecast > 15) forecastScore = 5;
        
        riskScore += forecastScore;
        factors.push(`3小時預報: ${rainForecast.toFixed(1)}mm (${forecastScore}分)`);
        
        // 4. 季節/時間因子 (10% 權重)
        const month = new Date().getMonth() + 1;
        const seasonScore = (month >= 5 && month <= 9) ? 10 : 5; // 汛期
        riskScore += seasonScore;
        factors.push(`季節因子: ${seasonScore}分`);
        
        return {
            totalScore: Math.min(riskScore, 100),
            factors: factors,
            level: this.getRiskLevel(riskScore)
        };
    }
    
    /**
     * 取得風險等級
     */
    getRiskLevel(score) {
        if (score >= 81) return 'critical';
        if (score >= 61) return 'high'; 
        if (score >= 31) return 'medium';
        return 'low';
    }
    
    /**
     * 檢查並生成警示
     */
    async checkAlerts() {
        if (!this.isMonitoring) return;
        
        // 更新氣象資料
        await this.fetchWeatherData();
        
        const newAlerts = [];
        
        // 檢查每個抽水站
        Object.values(this.pumpingStations).forEach(station => {
            const riskAssessment = this.calculateRiskScore(station);
            
            // 產生對應的警示
            if (riskAssessment.totalScore >= 31) {
                const alert = {
                    id: `alert_${station.id}_${Date.now()}`,
                    stationId: station.id,
                    stationName: station.name,
                    type: 'weather_risk',
                    level: riskAssessment.level,
                    score: riskAssessment.totalScore,
                    factors: riskAssessment.factors,
                    message: this.generateAlertMessage(station, riskAssessment),
                    timestamp: new Date().toISOString(),
                    acknowledged: false
                };
                
                newAlerts.push(alert);
            }
        });
        
        // 更新警示列表
        this.alerts = [...newAlerts, ...this.alerts.filter(a => !a.acknowledged)];
        
        // 發送通知
        newAlerts.forEach(alert => this.sendNotification(alert));
        
        // 更新 UI
        this.updateAlertUI();
        
        return newAlerts;
    }
    
    /**
     * 生成警示訊息
     */
    generateAlertMessage(station, risk) {
        const messages = {
            low: `${station.name} - 正常監控中`,
            medium: `${station.name} - 請注意天氣變化，建議準備應變措施`,
            high: `${station.name} - 天氣條件惡化，建議啟動應變機制`,
            critical: `${station.name} - 極端天氣警報！立即啟動緊急應變！`
        };
        
        return messages[risk.level] || messages.medium;
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
                this.showAlertDetail(alert);
            };
        }
        
        // 2. 音效提醒
        if (alert.level === 'high' || alert.level === 'critical') {
            this.playAlertSound();
        }
        
        // 3. 視覺提醒 (閃爍、顏色變化)
        this.highlightStationOnMap(alert.stationId, alert.level);
        
        console.log(`🚨 ${alert.level.toUpperCase()} 警示:`, alert.message);
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
        
        alertPanel.innerHTML = `
            <div class="alert-header">
                <h3>🚨 警示通知 (${activeAlerts.length})</h3>
                <button onclick="weatherAlert.clearAllAlerts()" class="btn-clear">清除全部</button>
            </div>
            <div class="alert-list">
                ${activeAlerts.map(alert => this.renderAlert(alert)).join('')}
            </div>
        `;
        
        // 更新警示計數
        const alertBadge = document.getElementById('alertBadge');
        if (alertBadge) {
            alertBadge.textContent = activeAlerts.length;
            alertBadge.style.display = activeAlerts.length > 0 ? 'block' : 'none';
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
        
        return `
            <div class="alert-item alert-${alert.level}" style="border-left: 4px solid ${levelColors[alert.level]}">
                <div class="alert-content">
                    <div class="alert-title">
                        <strong>${alert.stationName}</strong>
                        <span class="alert-time">${new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div class="alert-message">${alert.message}</div>
                    <div class="alert-score">風險評分: ${alert.score}/100</div>
                    <div class="alert-factors">
                        ${alert.factors.map(f => `<small>${f}</small>`).join('<br>')}
                    </div>
                </div>
                <div class="alert-actions">
                    <button onclick="weatherAlert.acknowledgeAlert('${alert.id}')" class="btn-ack">確認</button>
                    <button onclick="weatherAlert.showAlertDetail('${alert.id}')" class="btn-detail">詳情</button>
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