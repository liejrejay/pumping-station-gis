/**
 * 水利署 OpenData 即時水位（大漢溪 8 站）
 * https://opendata.wra.gov.tw/
 */

const WRA_WATER_LEVEL_URL =
  'https://opendata.wra.gov.tw/api/v2/73c4c3de-4045-4765-abeb-89f9f9cd5ff0?page=1&size=1000';

/** 與 index.html WATER_LEVEL_STATIONS 一致 */
const DAHAN_WATER_STATION_IDS = [
  '1140H001',
  '1140H043',
  '1140H054',
  '1140H076',
  '1140H105',
  '1140H067',
  '1140H111',
  '1140H118',
];

async function fetchWraWaterLevelRows() {
  const res = await fetch(WRA_WATER_LEVEL_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`WRA HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('WRA 回應格式異常（非陣列）');
  return data;
}

function normalizeRow(row) {
  const wl = row.waterlevel;
  if (wl === null || wl === undefined || wl === '') return null;
  return {
    stationid: row.stationid,
    waterlevel: String(wl),
    datetime: row.datetime || row.recordtime || null,
  };
}

/**
 * @returns {Record<string, { stationid, waterlevel, datetime }>}
 */
function pickDahanStations(rows, stationIds = DAHAN_WATER_STATION_IDS) {
  const wanted = new Set(stationIds);
  const out = {};
  for (const row of rows) {
    if (!wanted.has(row.stationid)) continue;
    const norm = normalizeRow(row);
    if (norm) out[row.stationid] = norm;
  }
  return out;
}

async function buildDahanWaterLevelSummary() {
  const rows = await fetchWraWaterLevelRows();
  const stations = pickDahanStations(rows);
  return {
    source: 'WRA',
    updatedAt: new Date().toISOString(),
    stationCount: Object.keys(stations).length,
    totalWanted: DAHAN_WATER_STATION_IDS.length,
    stations,
  };
}

module.exports = {
  WRA_WATER_LEVEL_URL,
  DAHAN_WATER_STATION_IDS,
  fetchWraWaterLevelRows,
  pickDahanStations,
  buildDahanWaterLevelSummary,
};
