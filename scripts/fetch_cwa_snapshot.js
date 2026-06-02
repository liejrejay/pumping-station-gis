#!/usr/bin/env node
/** 抓取大漢溪流域 CWA 即時氣象快照 → data/cwa-weather-latest.json（供 GitHub Pages 靜態讀取） */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const outPath = path.join(root, 'data', 'cwa-weather-latest.json');

if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const key = process.env.CWA_API_KEY;
if (!key) {
  console.warn('⚠️  未設定 CWA_API_KEY，略過氣象快照');
  process.exit(0);
}

const { buildDahanWeatherSummary } = require('../lib/cwaWeather');

buildDahanWeatherSummary(key)
  .then((data) => {
    const payload = {
      ...data,
      source: 'CWA_SNAPSHOT',
      snapshotAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log('✅ 氣象快照 → data/cwa-weather-latest.json');
  })
  .catch((err) => {
    console.error('❌ 氣象快照失敗:', err.message);
    process.exit(1);
  });
