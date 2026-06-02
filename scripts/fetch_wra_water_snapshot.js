#!/usr/bin/env node
/** 抓取大漢溪 8 站 WRA 即時水位快照 → data/wra-water-latest.json（供 GitHub Pages） */
const fs = require('fs');
const path = require('path');
const {
  buildDahanWaterLevelSummary,
  DAHAN_WATER_STATION_IDS,
} = require('../lib/wraWaterLevel');

async function main() {
  const outPath = path.join(__dirname, '..', 'data', 'wra-water-latest.json');
  try {
    const summary = await buildDahanWaterLevelSummary();
    const payload = {
      ...summary,
      stationIds: DAHAN_WATER_STATION_IDS,
    };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(
      `✅ wra-water-latest.json（${summary.stationCount}/${summary.totalWanted} 站）`
    );
  } catch (err) {
    console.warn('⚠️  WRA 水位快照失敗:', err.message);
    process.exitCode = 0;
  }
}

main();
