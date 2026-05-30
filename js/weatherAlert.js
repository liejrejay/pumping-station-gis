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
        try {
            // 使用中央氣象署 API (需要申請 API Key)
            const weatherAPI = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/';
            
            // 獲取即時雨量資料
            const rainfallData = await this.fetchRainfallData();
            
            // 獲取天氣預報
            const forecastData = await this.fetchForecastData();
            
            // 獲取颱風資訊
            const typhoonData = await this.fetchTyphoonData();
            
            this.weatherData = {
                rainfall: rainfallData,
                forecast: forecastData,
                typhoon: typhoonData,
                lastUpdate: new Date().toISOString()
            };
            
            console.log('✅ 氣象資料更新完成', this.weatherData);
            return this.weatherData;
            
        } catch (error) {
            console.error('❌ 氣象資料獲取失敗:', error);
            
            // 使用模擬資料進行測試
            this.weatherData = this.generateMockWeatherData();
            return this.weatherData;
        }
    }
    
    /**
     * 獲取降雨資料
     */
    async fetchRainfallData() {
        // 這裡可以整合多個資料源
        const sources = [
            'https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0002-001', // 自動雨量站
            'https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001'  // 自動氣象站
        ];
        
        // 實際使用時需要 API Key
        // const response = await fetch(`${sources[0]}?Authorization=${API_KEY}`);
        // return await response.json();
        
        // 模擬資料
        return {
            stations: [
                { id: 'C0A570', name: '板橋', rainfall_1hr: 15.5, rainfall_24hr: 45.2 },
                { id: 'C0A590', name: '新莊', rainfall_1hr: 23.1, rainfall_24hr: 67.8 },
                { id: 'C0A580', name: '三重', rainfall_1hr: 18.7, rainfall_24hr: 52.3 }
            ]
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
     * 生成模擬氣象資料
     */
    generateMockWeatherData() {
        const now = new Date();
        return {
            rainfall: {
                current: Math.random() * 50,     // 0-50mm/hr
                forecast_3hr: Math.random() * 30,
                forecast_6hr: Math.random() * 40,
                trend: Math.random() > 0.5 ? 'increasing' : 'decreasing'
            },
            temperature: 20 + Math.random() * 15, // 20-35°C
            humidity: 60 + Math.random() * 40,     // 60-100%
            windSpeed: Math.random() * 20,         // 0-20 m/s
            pressure: 1000 + Math.random() * 50,   // 1000-1050 hPa
            lastUpdate: now.toISOString()
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