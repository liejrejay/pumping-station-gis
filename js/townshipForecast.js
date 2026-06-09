/**
 * 新北市鄉鎮天氣預報 (F-D0047-071) — 用於整體風險評估
 * https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-071
 */

class TownshipForecastSystem {
  constructor() {
    this.apiKey =
      window.WeatherAPIConfig?.CWA?.apiKey ||
      'CWA-775D44F9-041E-4A3D-B44B-67EE7D294961';
    this.endpoint = 'F-D0047-071';
    this.baseUrl = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/';

    /** 大漢溪流域相關鄉鎮（新北市 F-D0047-071 涵蓋） */
    this.basinTownships = [
      '板橋區',
      '土城區',
      '鶯歌區',
      '三峽區',
      '樹林區',
      '新莊區',
      '三重區',
      '淡水區',
    ];

    /** 鄉鎮中心（用於由座標對應預報） */
    this.townCenters = {
      板橋區: { lat: 25.011, lng: 121.451 },
      土城區: { lat: 24.972, lng: 121.443 },
      鶯歌區: { lat: 24.955, lng: 121.345 },
      三峽區: { lat: 24.934, lng: 121.369 },
      樹林區: { lat: 24.99, lng: 121.425 },
      新莊區: { lat: 25.036, lng: 121.452 },
      三重區: { lat: 25.061, lng: 121.484 },
      淡水區: { lat: 25.167, lng: 121.441 },
    };

    this.forecastsByTown = {};
    this.lastUpdate = null;
    this.updateInterval = null;
    this.isUpdating = false;
    this.updateFrequency = 30 * 60 * 1000; // 30 分鐘
  }

  getCurrentTimeSlot(timeArray) {
    if (!timeArray?.length) return null;
    const now = new Date();
    const current = timeArray.find((t) => {
      const start = new Date(t.StartTime);
      const end = new Date(t.EndTime);
      return now >= start && now < end;
    });
    return current || timeArray[0];
  }

  readElementValue(slot) {
    if (!slot?.ElementValue?.length) return null;
    const row = slot.ElementValue[0];
    const key = Object.keys(row)[0];
    const raw = row[key];
    if (raw === undefined || raw === null || raw === '' || raw === '-99') return null;
    const num = parseFloat(raw);
    return Number.isNaN(num) ? raw : num;
  }

  findElement(elements, ...names) {
    if (!elements) return null;
    for (const name of names) {
      const el = elements.find((e) => e.ElementName === name);
      if (el) return el;
    }
    return elements.find((e) =>
      names.some((n) => e.ElementName && e.ElementName.includes(n))
    );
  }

  parseLocationForecast(location) {
    const elements = location.WeatherElement || [];
    const popEl = this.findElement(elements, '12小時降雨機率', '降雨機率');
    const tempEl = this.findElement(elements, '平均溫度');
    const maxEl = this.findElement(elements, '最高溫度');
    const minEl = this.findElement(elements, '最低溫度');
    const rhEl = this.findElement(elements, '平均相對濕度', '相對濕度');
    const windEl = this.findElement(elements, '風速');
    const wxEl = this.findElement(elements, '天氣預報綜合描述', '天氣現象');

    const popSlot = popEl ? this.getCurrentTimeSlot(popEl.Time) : null;
    const tempSlot = tempEl ? this.getCurrentTimeSlot(tempEl.Time) : null;
    const maxSlot = maxEl ? this.getCurrentTimeSlot(maxEl.Time) : null;
    const minSlot = minEl ? this.getCurrentTimeSlot(minEl.Time) : null;
    const rhSlot = rhEl ? this.getCurrentTimeSlot(rhEl.Time) : null;
    const windSlot = windEl ? this.getCurrentTimeSlot(windEl.Time) : null;
    const wxSlot = wxEl ? this.getCurrentTimeSlot(wxEl.Time) : null;

    const periodStart = popSlot?.StartTime || tempSlot?.StartTime;
    const periodEnd = popSlot?.EndTime || tempSlot?.EndTime;

    return {
      locationName: location.LocationName,
      lat: parseFloat(location.Latitude),
      lng: parseFloat(location.Longitude),
      periodStart,
      periodEnd,
      pop: this.readElementValue(popSlot),
      temperature: this.readElementValue(tempSlot),
      maxTemp: this.readElementValue(maxSlot),
      minTemp: this.readElementValue(minSlot),
      humidity: this.readElementValue(rhSlot),
      windSpeed: this.readElementValue(windSlot),
      weatherDesc: this.readElementValue(wxSlot) || null,
    };
  }

  async fetchAllForecasts() {
    const url = `${this.baseUrl}${this.endpoint}?Authorization=${this.apiKey}&format=JSON`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`F-D0047-071 HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.success !== 'true') {
      throw new Error(data.result?.message || 'F-D0047-071 回應失敗');
    }

    const locations = data.records?.Locations?.[0]?.Location || [];
    const byTown = {};

    locations.forEach((loc) => {
      if (!this.basinTownships.includes(loc.LocationName)) return;
      byTown[loc.LocationName] = this.parseLocationForecast(loc);
    });

    this.forecastsByTown = byTown;
    this.lastUpdate = new Date();

    console.log(
      `📋 鄉鎮預報已更新：${Object.keys(byTown).length}/${this.basinTownships.length} 個流域鄉鎮`
    );

    window.dispatchEvent(
      new CustomEvent('townshipForecastUpdated', {
        detail: { data: byTown, timestamp: this.lastUpdate },
      })
    );

    return byTown;
  }

  /** 依座標找最近鄉鎮預報 */
  getForecastForPoint(lat, lng) {
    let bestName = this.basinTownships[0];
    let bestD = Infinity;

    Object.entries(this.townCenters).forEach(([name, c]) => {
      const d = this.haversineM(lat, lng, c.lat, c.lng);
      if (d < bestD) {
        bestD = d;
        bestName = name;
      }
    });

    return {
      township: bestName,
      forecast: this.forecastsByTown[bestName] || null,
      distanceKm: (bestD / 1000).toFixed(1),
    };
  }

  haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * 單一鄉鎮預報風險分數 (0–100)
   */
  scoreForecast(forecast) {
    if (!forecast) return { score: 0, factors: ['無預報資料'] };

    let score = 0;
    const factors = [];

    const pop = forecast.pop != null ? Number(forecast.pop) : 0;
    let popScore = 0;
    if (pop >= 80) popScore = 45;
    else if (pop >= 60) popScore = 35;
    else if (pop >= 40) popScore = 25;
    else if (pop >= 20) popScore = 12;
    score += popScore;
    factors.push(`降雨機率 ${pop}% (${popScore}分)`);

    const desc = String(forecast.weatherDesc || '');
    let wxScore = 0;
    if (/大暴雨|豪雨|雷雨|雷陣雨/.test(desc)) wxScore = 30;
    else if (/大雨|暴雨|陣雨/.test(desc)) wxScore = 20;
    else if (/雨/.test(desc)) wxScore = 10;
    score += wxScore;
    if (wxScore) factors.push(`天氣「${desc}」 (${wxScore}分)`);

    const wind = forecast.windSpeed != null ? Number(forecast.windSpeed) : 0;
    let windScore = 0;
    if (wind >= 14) windScore = 15;
    else if (wind >= 8) windScore = 8;
    score += windScore;
    if (windScore) factors.push(`預報風速 ${wind}m/s (${windScore}分)`);

    return {
      score: Math.min(score, 100),
      factors,
      level: this.getRiskLevel(Math.min(score, 100)),
    };
  }

  getRiskLevel(score) {
    if (score >= 81) return 'critical';
    if (score >= 61) return 'high';
    if (score >= 31) return 'medium';
    return 'low';
  }

  /**
   * 流域整體預報風險（取各鄉鎮最高風險與平均）
   */
  getBasinForecastRisk() {
    const towns = this.basinTownships
      .map((name) => ({
        name,
        forecast: this.forecastsByTown[name],
        ...this.scoreForecast(this.forecastsByTown[name]),
      }))
      .filter((t) => t.forecast);

    if (!towns.length) {
      return {
        score: 0,
        level: 'low',
        factors: ['鄉鎮預報載入中'],
        towns: [],
        maxPop: 0,
      };
    }

    const scores = towns.map((t) => t.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const maxTown = towns.find((t) => t.score === maxScore);

    const blended = Math.round(avgScore * 0.4 + maxScore * 0.6);
    const maxPop = Math.max(...towns.map((t) => Number(t.forecast.pop) || 0));

    return {
      score: blended,
      level: this.getRiskLevel(blended),
      avgScore: Math.round(avgScore),
      maxScore,
      maxTown: maxTown?.name,
      maxPop,
      towns,
      factors: [
        `流域 ${towns.length} 鄉鎮預報`,
        `最高風險：${maxTown?.name} (${maxScore}分)`,
        `平均 ${Math.round(avgScore)}分`,
        `最大降雨機率 ${maxPop}%`,
      ],
      lastUpdate: this.lastUpdate,
      source: 'CWA F-D0047-071',
    };
  }

  startAutoUpdate() {
    if (this.updateInterval) return;
    this.fetchAllForecasts().catch((e) =>
      console.warn('鄉鎮預報初次載入失敗:', e.message)
    );
    this.updateInterval = setInterval(() => {
      if (!this.isUpdating) this.fetchAllForecasts();
    }, this.updateFrequency);
  }

  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

window.townshipForecastSystem = new TownshipForecastSystem();
