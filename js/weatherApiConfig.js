/**
 * 氣象 API 設定檔案
 * 請在各個平台申請 API Key 後填入
 */

const WeatherAPIConfig = {
    // 中央氣象署開放資料平臺
    CWA: {
        baseUrl: 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/',
        apiKey: '', // 建議改在 .env 設 CWA_API_KEY，由 npm start 代理（勿 commit 真 key）
        endpoints: {
            rainfall: 'O-A0002-001',      // 自動雨量站
            weather: 'O-A0001-001',       // 自動氣象站  
            forecast: 'F-C0032-001',      // 36小時預報
            typhoon: 'TY-001',            // 颱風資料
            warning: 'W-C0033-002'        // 特報資料
        },
        // 流量限制
        rateLimit: {
            requestsPerHour: 1000,        // 每小時1000次
            requestsPerDay: 10000         // 每日10000次
        }
    },
    
    // 水利署開放資料
    WRA: {
        baseUrl: 'https://data.wra.gov.tw/Service/OpenData.aspx',
        format: 'json',
        endpoints: {
            waterLevel: '2f159905-c425-4817-b237-dcdc2ec0b364',     // 即時水位
            waterAlert: 'c089ad45-5b5c-4bb8-a044-a96d6e1add8f',    // 警戒水位
            hydrology: 'cd36d958-9df6-4820-99b4-8570e4fb2527'      // 水文觀測
        }
    },
    
    // OpenWeatherMap (備用)
    OpenWeather: {
        baseUrl: 'https://api.openweathermap.org/data/2.5/',
        apiKey: '', // 請到 https://openweathermap.org/api 申請
        endpoints: {
            current: 'weather',
            forecast: 'forecast',
            radar: 'map'
        },
        rateLimit: {
            requestsPerMinute: 60,
            requestsPerMonth: 1000000
        }
    },
    
    // WeatherAPI (備用)
    WeatherAPI: {
        baseUrl: 'https://api.weatherapi.com/v1/',
        apiKey: '', // 請到 https://www.weatherapi.com/ 申請
        endpoints: {
            current: 'current.json',
            forecast: 'forecast.json',
            history: 'history.json'
        }
    }
};

/**
 * API 申請指南
 */
const APIGuide = {
    CWA: {
        name: '中央氣象署開放資料平臺',
        url: 'https://opendata.cwa.gov.tw/',
        steps: [
            '1. 前往 https://opendata.cwa.gov.tw/',
            '2. 點擊右上角「會員專區」→「加入會員」',
            '3. 填寫基本資料完成註冊',
            '4. 登入後到「會員專區」→「我的資料」',
            '5. 點擊「取得授權碼」',
            '6. 複製授權碼到 CWA.apiKey'
        ],
        features: [
            '✅ 官方權威資料',
            '✅ 涵蓋全台灣',
            '✅ 即時更新',
            '✅ 免費使用',
            '⚠️ 有流量限制'
        ]
    },
    
    WRA: {
        name: '水利署開放資料',
        url: 'https://data.gov.tw/',
        steps: [
            '1. 水利署資料多為開放格式，無需申請',
            '2. 直接使用 API 網址即可',
            '3. 建議先測試資料格式'
        ],
        features: [
            '✅ 水位權威資料',
            '✅ 即時更新',
            '✅ 完全免費',
            '✅ 無流量限制'
        ]
    }
};

/**
 * 測試 API 連接
 */
async function testAPIConnection() {
    const results = {};
    
    // 測試中央氣象署 API
    if (WeatherAPIConfig.CWA.apiKey) {
        try {
            const response = await fetch(
                `${WeatherAPIConfig.CWA.baseUrl}${WeatherAPIConfig.CWA.endpoints.weather}?Authorization=${WeatherAPIConfig.CWA.apiKey}&limit=1`
            );
            results.CWA = {
                status: response.ok ? 'success' : 'failed',
                statusCode: response.status
            };
        } catch (error) {
            results.CWA = { status: 'error', error: error.message };
        }
    } else {
        results.CWA = { status: 'no_key', message: '請先申請並填入 API Key' };
    }
    
    // 測試水利署 API
    try {
        const response = await fetch(
            `${WeatherAPIConfig.WRA.baseUrl}?format=${WeatherAPIConfig.WRA.format}&id=${WeatherAPIConfig.WRA.endpoints.waterLevel}`
        );
        results.WRA = {
            status: response.ok ? 'success' : 'failed',
            statusCode: response.status
        };
    } catch (error) {
        results.WRA = { status: 'error', error: error.message };
    }
    
    return results;
}

/**
 * 顯示 API 申請指南
 */
function showAPIGuide() {
    console.log('🌦️ 氣象 API 申請指南');
    console.log('========================');
    
    Object.entries(APIGuide).forEach(([key, guide]) => {
        console.log(`\n📋 ${guide.name}`);
        console.log(`🔗 ${guide.url}`);
        console.log('\n申請步驟：');
        guide.steps.forEach(step => console.log(`  ${step}`));
        console.log('\n特色：');
        guide.features.forEach(feature => console.log(`  ${feature}`));
        console.log('\n' + '='.repeat(50));
    });
    
    console.log('\n💡 建議優先順序：');
    console.log('1. 🥇 中央氣象署 (CWA) - 最重要！');
    console.log('2. 🥈 水利署 (WRA) - 水位資料');
    console.log('3. 🥉 OpenWeather - 國際備用');
}

// 匯出設定
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WeatherAPIConfig, APIGuide, testAPIConnection, showAPIGuide };
} else {
    window.WeatherAPIConfig = WeatherAPIConfig;
    window.APIGuide = APIGuide;
    window.testAPIConnection = testAPIConnection;
    window.showAPIGuide = showAPIGuide;
}