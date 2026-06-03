/**
 * 依地圖點位顯示最近氣象署測站資料（O-A0001 逐時 + O-A0002 雨量）
 */
const LocalWeatherDisplay = {
  center: { lat: 24.99, lng: 121.40 },
  basinCounties: ['新北', '臺北', '台北', '桃園', '新竹', '基隆'],
  /** 使用者點選站點後鎖定顯示該地點氣象 */
  pinned: null,

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
  },

  inBasinCounty(countyName) {
    if (!countyName) return false;
    return this.basinCounties.some((c) => countyName.includes(c));
  },

  getWeatherStations() {
    return window.temperatureSystem?.temperatureData
      ? Object.values(window.temperatureSystem.temperatureData)
      : [];
  },

  getRainStations() {
    return window.rainfallSystem?.rainfallData
      ? Object.values(window.rainfallSystem.rainfallData)
      : [];
  },

  /** 依座標找最近測站 */
  pickNearestAt(lat, lng, stations) {
    const list = stations.filter(
      (s) => s.lat != null && s.lng != null && !Number.isNaN(s.lat)
    );
    if (!list.length) return null;

    let best = null;
    let bestD = Infinity;
    list.forEach((s) => {
      const d = this.haversineM(lat, lng, s.lat, s.lng);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    });
    return best
      ? { station: best, distanceKm: (bestD / 1000).toFixed(1), distanceM: bestD }
      : null;
  },

  pickNearest(stations, preferBasin = true) {
    const list = stations.filter(
      (s) => s.lat != null && s.lng != null && !Number.isNaN(s.lat)
    );
    if (!list.length) return null;

    const pool = preferBasin
      ? list.filter((s) => this.inBasinCounty(s.countyName))
      : [];
    const candidates = pool.length ? pool : list;

    let best = null;
    let bestD = Infinity;
    candidates.forEach((s) => {
      const d = this.haversineM(this.center.lat, this.center.lng, s.lat, s.lng);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    });
    return best ? { station: best, distanceKm: (bestD / 1000).toFixed(1) } : null;
  },

  getHourlyRainfall(station) {
    if (!station?.rainfall) return null;
    const r = station.rainfall;
    if (r.hour_1 != null && r.hour_1 >= 0) return r.hour_1;
    if (r.min_10 != null && r.min_10 >= 0) return r.min_10 * 6;
    return null;
  },

  /**
   * 指定經緯度的氣象快照
   * @param {number} lat
   * @param {number} lng
   * @param {{ pinName?: string, isDefault?: boolean }} options
   */
  getSnapshotAt(lat, lng, options = {}) {
    const { pinName = null, isDefault = false } = options;
    const tempStations = this.getWeatherStations();
    const rainStations = this.getRainStations();

    const nearestTemp = this.pickNearestAt(lat, lng, tempStations);
    const nearestRain = this.pickNearestAt(lat, lng, rainStations);

    if (!nearestTemp && !nearestRain) {
      return {
        ready: false,
        message: '氣象資料載入中，請稍候…',
        pinName,
        pinLat: lat,
        pinLng: lng,
        isDefault,
      };
    }

    const t = nearestTemp?.station;
    const r =
      (t && rainStations.find((s) => s.stationId === t.stationId)) ||
      nearestRain?.station;

    let rainfall = null;
    if (t?.weather?.rainfall != null) {
      rainfall = t.weather.rainfall;
    } else if (r) {
      rainfall = this.getHourlyRainfall(r);
    }

    let lastUpdate = null;
    if (t?.datetime) lastUpdate = new Date(t.datetime);
    else if (r?.datetime) lastUpdate = new Date(r.datetime);

    const distKm = nearestTemp?.distanceKm || nearestRain?.distanceKm;

    return {
      ready: true,
      pinName,
      pinLat: lat,
      pinLng: lng,
      isDefault,
      stationName: t?.stationName || r?.stationName || '—',
      stationId: t?.stationId || r?.stationId,
      county: t?.countyName || r?.countyName || '',
      distanceKm: distKm,
      rainfall: rainfall != null ? rainfall : null,
      temperature: t?.weather?.temperature ?? null,
      humidity: t?.weather?.humidity ?? null,
      windSpeed: t?.weather?.windSpeed ?? null,
      windDirection: t?.weather?.windDirection ?? null,
      weatherDesc: t?.weather?.weatherDesc ?? null,
      dailyHigh: t?.weather?.dailyHigh ?? null,
      dailyLow: t?.weather?.dailyLow ?? null,
      lastUpdate,
      source: 'CWA O-A0001-001 逐時觀測',
    };
  },

  /** 流域預設代表站（未點選任何設施時） */
  getSnapshot() {
    if (this.pinned) {
      return this.getSnapshotAt(this.pinned.lat, this.pinned.lng, {
        pinName: this.pinned.name,
        isDefault: false,
      });
    }
    return this.getSnapshotAt(this.center.lat, this.center.lng, {
      isDefault: true,
    });
  },

  /** 點選地圖站點：鎖定該地點並更新氣象面板 */
  showWeatherForPoint(lat, lng, name) {
    this.pinned = { lat, lng, name: name || '選定地點' };
    const snap = this.getSnapshotAt(lat, lng, { pinName: this.pinned.name });

    const panel = document.getElementById('weatherAlertPanel');
    if (panel && !panel.classList.contains('show')) {
      panel.classList.add('show');
    }

    if (typeof window.applyWeatherSnapshotToPanel === 'function') {
      window.applyWeatherSnapshotToPanel(snap);
    }

    return snap;
  },

  clearPin() {
    this.pinned = null;
    const btn = document.getElementById('weatherResetPinBtn');
    if (btn) btn.style.display = 'none';
    if (typeof window.updateWeatherDisplay === 'function') {
      window.updateWeatherDisplay();
    }
  },

  formatValue(val, digits = 1) {
    if (val == null || Number.isNaN(val)) return '--';
    return Number(val).toFixed(digits);
  },

  /** InfoWindow 內嵌氣象區塊 */
  buildPopupWeatherHtml(snap) {
    if (!snap?.ready) {
      return `
        <div style="margin-top:8px;padding:8px;background:#f8f9fa;border-radius:6px;font-size:0.85rem;color:#666;">
          🌦️ 氣象：${snap?.message || '載入中…'}
        </div>`;
    }

    const hiLo =
      snap.dailyHigh != null && snap.dailyLow != null
        ? ` · 今日 ${this.formatValue(snap.dailyLow, 1)}～${this.formatValue(snap.dailyHigh, 1)}°C`
        : '';
    const wx = snap.weatherDesc ? ` · ${snap.weatherDesc}` : '';
    const obs = snap.lastUpdate
      ? snap.lastUpdate.toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' })
      : '--';

    return `
      <div style="margin-top:8px;padding:10px;background:linear-gradient(135deg,#e8f4fc 0%,#f0f8ff 100%);border-radius:8px;border:1px solid #bee5eb;">
        <div style="font-weight:600;color:#0b5394;margin-bottom:6px;font-size:0.9rem;">🌦️ 當地氣象（最近測站）</div>
        <div style="font-size:0.78rem;color:#555;margin-bottom:8px;">
          ${snap.stationName}${snap.county ? `（${snap.county}）` : ''}${wx}<br>
          距此處約 <strong>${snap.distanceKm} km</strong>${hiLo}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.85rem;">
          <div>🌡️ <strong>${this.formatValue(snap.temperature, 1)}</strong> °C</div>
          <div>💧 <strong>${this.formatValue(snap.humidity, 0)}</strong> %</div>
          <div>🌧️ <strong>${this.formatValue(snap.rainfall, 1)}</strong> mm</div>
          <div>💨 <strong>${this.formatValue(snap.windSpeed, 1)}</strong> m/s</div>
        </div>
        <div style="font-size:0.72rem;color:#888;margin-top:6px;">觀測 ${obs} · 點選已同步至右側氣象面板</div>
      </div>`;
  },
};

window.LocalWeatherDisplay = LocalWeatherDisplay;
