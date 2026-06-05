/**
 * 中央氣象署開放資料 — 大漢溪流域即時氣象彙整
 * 資料集：O-A0001-001（氣象站）、O-A0002-001（雨量站）
 */

const CWA_BASE = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/';

const DAHAN_BOUNDS = {
  minLat: 24.65,
  maxLat: 25.06,
  minLng: 121.24,
  maxLng: 121.5,
};

function inDahanBasin(lat, lng) {
  return (
    lat >= DAHAN_BOUNDS.minLat &&
    lat <= DAHAN_BOUNDS.maxLat &&
    lng >= DAHAN_BOUNDS.minLng &&
    lng <= DAHAN_BOUNDS.maxLng
  );
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > -90 ? n : null;
}

/** 從 GeoInfo 取 WGS84 座標 */
function wgs84(station) {
  const coords = station?.GeoInfo?.Coordinates || [];
  const wgs = coords.find((c) => c.CoordinateName === 'WGS84') || coords[0];
  if (!wgs) return { lat: null, lng: null };
  return {
    lat: num(wgs.StationLatitude),
    lng: num(wgs.StationLongitude),
  };
}

function stationList(cwaData) {
  const raw = cwaData.records?.Station ?? cwaData.records?.location ?? [];
  return Array.isArray(raw) ? raw : [raw];
}

async function fetchCwaDataset(datasetId, apiKey) {
  const url = `${CWA_BASE}${datasetId}?Authorization=${encodeURIComponent(apiKey)}&format=JSON`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CWA ${datasetId} HTTP ${res.status}`);
  const data = await res.json();
  if (data.success !== 'true') {
    throw new Error(data.message || `CWA ${datasetId} 回傳失敗`);
  }
  return data;
}

function parseWeatherStations(cwaData) {
  const out = [];
  stationList(cwaData).forEach((st) => {
    const { lat, lng } = wgs84(st);
    if (lat == null || lng == null || !inDahanBasin(lat, lng)) return;

    const wx = st.WeatherElement || {};
    out.push({
      id: st.StationId || st.stationId,
      name: st.StationName || st.locationName,
      lat,
      lng,
      temp: num(wx.AirTemperature),
      humidity: num(wx.RelativeHumidity),
      windSpeed: num(wx.WindSpeed),
      pressure: num(wx.AirPressure),
    });
  });
  return out;
}

function parseRainStations(cwaData) {
  const out = [];
  stationList(cwaData).forEach((st) => {
    const { lat, lng } = wgs84(st);
    if (lat == null || lng == null || !inDahanBasin(lat, lng)) return;

    const rain = st.RainfallElement || {};
    const el = st.weatherElement ? null : rain;
    let rainfall_1hr = num(rain.Past1hr?.Precipitation ?? rain.Now?.Precipitation);
    let rainfall_24hr = num(rain.Past24hr?.Precipitation);

    // 舊版 location + weatherElement 陣列
    if (st.weatherElement || st.WeatherElement?.length) {
      const arr = st.weatherElement || st.WeatherElement;
      (Array.isArray(arr) ? arr : []).forEach((e) => {
        if (e.elementName === 'NOW') rainfall_1hr = num(e.elementValue);
        if (e.elementName === 'H_24R') rainfall_24hr = num(e.elementValue);
      });
    }

    out.push({
      id: st.StationId || st.stationId,
      name: st.StationName || st.locationName,
      lat,
      lng,
      rainfall_1hr: rainfall_1hr ?? 0,
      rainfall_24hr: rainfall_24hr ?? 0,
    });
  });
  return out;
}

function avg(nums) {
  const valid = nums.filter((n) => n != null && Number.isFinite(n));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function max(nums) {
  const valid = nums.filter((n) => n != null && Number.isFinite(n));
  return valid.length ? Math.max(...valid) : null;
}

async function buildDahanWeatherSummary(apiKey) {
  const [wxRaw, rainRaw] = await Promise.all([
    fetchCwaDataset('O-A0001-001', apiKey),
    fetchCwaDataset('O-A0002-001', apiKey),
  ]);

  const wxStations = parseWeatherStations(wxRaw);
  const rainStations = parseRainStations(rainRaw);

  const rainfallCurrent = max(rainStations.map((s) => s.rainfall_1hr)) ?? 0;
  const rainfall24 = max(rainStations.map((s) => s.rainfall_24hr)) ?? 0;

  const pick =
    rainStations.find((s) => /板橋|新莊|三重|鶯歌|三峽|樹林|土城|大溪/.test(s.name)) ||
    wxStations.find((s) => /板橋|新莊|三重|鶯歌|三峽|樹林|土城|大溪/.test(s.name));

  return {
    rainfall: {
      current: rainfallCurrent,
      max_24hr: rainfall24,
      forecast_3hr: null,
      forecast_6hr: null,
      stations: rainStations,
    },
    temperature: avg(wxStations.map((s) => s.temp)),
    humidity: avg(wxStations.map((s) => s.humidity)),
    windSpeed: avg(wxStations.map((s) => s.windSpeed)), // 氣象署原始單位：m/s
    windSpeedUnit: 'm/s',
    pressure: avg(wxStations.map((s) => s.pressure)),
    wxStations,
    rainStations,
    stationCount: { weather: wxStations.length, rainfall: rainStations.length },
    representativeStation: pick?.name || '大漢溪流域',
    lastUpdate: new Date().toISOString(),
    source: 'CWA',
  };
}

module.exports = {
  DAHAN_BOUNDS,
  buildDahanWeatherSummary,
};
