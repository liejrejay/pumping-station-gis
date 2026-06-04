#!/usr/bin/env node
/** 從 .env 產生 js/runtime-config.js（已 gitignore，勿 commit） */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const outPath = path.join(root, "js", "runtime-config.js");

function readEnvFile() {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const text = fs.readFileSync(envPath, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
  return out;
}

const fileEnv = readEnvFile();
const mapsKey =
  process.env.GOOGLE_MAPS_API_KEY || fileEnv.GOOGLE_MAPS_API_KEY || "";
const apiBase =
  process.env.PUBLIC_API_BASE_URL || fileEnv.PUBLIC_API_BASE_URL || "";

const lines = [];
if (mapsKey) {
  lines.push(`window.GOOGLE_MAPS_API_KEY = ${JSON.stringify(mapsKey)};`);
} else {
  lines.push('window.GOOGLE_MAPS_API_KEY = "";');
  lines.push(
    'console.warn("[Config] 請在 .env 設定 GOOGLE_MAPS_API_KEY");'
  );
}
lines.push(
  `window.PUBLIC_API_BASE_URL = ${JSON.stringify(apiBase)};`
);
lines.push("");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n"));
console.log("✅ 已寫入 js/runtime-config.js");
if (apiBase) console.log("   PUBLIC_API_BASE_URL =", apiBase);
