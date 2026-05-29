#!/usr/bin/env node
/** 從 .env 產生 js/runtime-config.js（已 gitignore，勿 commit） */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const outPath = path.join(root, "js", "runtime-config.js");

let key = process.env.GOOGLE_MAPS_API_KEY || "";

if (!key && fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^GOOGLE_MAPS_API_KEY\s*=\s*(.*)$/);
    if (m) {
      key = m[1].replace(/^['"]|['"]$/g, "");
      break;
    }
  }
}

if (!key) {
  console.warn("⚠️  未找到 GOOGLE_MAPS_API_KEY（請建立 .env，見 .env.example）");
  fs.writeFileSync(
    outPath,
    'window.GOOGLE_MAPS_API_KEY = "";\nconsole.warn("[Config] 請在 .env 設定 GOOGLE_MAPS_API_KEY");\n'
  );
  process.exit(0);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  `window.GOOGLE_MAPS_API_KEY = ${JSON.stringify(key)};\n`
);
console.log("✅ 已寫入 js/runtime-config.js（本機用，不會 commit）");
