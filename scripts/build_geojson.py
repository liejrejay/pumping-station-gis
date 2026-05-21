#!/usr/bin/env python3
"""Convert Plus Code pumping station locations to GeoJSON."""

import json
from pathlib import Path

try:
    from openlocationcode import openlocationcode as olc
except ImportError:
    raise SystemExit("Run: pip install openlocationcode")

# Plus Code, village/area, district
STATIONS = [
    ("2FQ6+45", "文明里", "新北市新莊區"),
    ("2CGV+24", "瓊林里", "新北市新莊區"),
    ("2FJ2+X7", "瓊林里", "新北市新莊區"),
    ("2CHW+7C", "新莊區", "新北市"),
    ("2FPC+83", "溪頭里", "新北市板橋區"),
    ("2CFJ+X7", "新莊區", "新北市"),
    ("XCJH+2C", "溪福里", "新北市板橋區"),
    ("2FH4+85", "中正里", "新北市板橋區"),
    ("2FQ6+8G", "文明里", "新北市新莊區"),
    ("2FFM+GV", "振義里", "新北市板橋區"),
    ("3F36+68", "頭前里", "新北市新莊區"),
    ("2FFM+HH", "振義里", "新北市板橋區"),
    ("2FVC+48", "中興里", "新北市三重區"),
    ("2FH4+78", "中正里", "新北市板橋區"),
    ("2FH4+77", "中正里", "新北市板橋區"),
    ("2FPJ+P8", "柏翠里", "新北市板橋區"),
    ("3C4Q+GV", "中原里", "新北市新莊區"),
    ("2FH4+87", "中正里", "新北市板橋區"),
    ("3F52+P4", "中原里", "新北市新莊區"),
    ("2C2P+F3", "西盛里", "新北市新莊區"),
    ("2CHR+3F", "新莊區", "新北市"),
    ("2FJQ+8F", "華江里", "臺北市萬華區"),
    ("3C9W+P6", "楓樹里", "新北市泰山區"),
    ("2CCR+RG", "瓊林里", "新北市新莊區"),
    ("2CCX+C7", "香社里", "新北市板橋區"),
    ("2CCX+G6", "香社里", "新北市板橋區"),
    ("XCJQ+GH", "員福里", "新北市土城區"),
    ("2F9P+6F", "板橋區", "新北市"),
    ("3F55+95", "昌平里", "新北市新莊區"),
    ("3F78+QW", "三重區", "新北市"),
    ("2FRX+GR", "菜園里", "臺北市萬華區"),
    ("2CHP+32", "建安里", "新北市新莊區"),
    ("3C9V+JJ", "楓樹里", "新北市泰山區"),
    ("3F87+3X", "福基里", "新北市新莊區"),
    ("3G42+V5", "同慶里", "新北市三重區"),
    ("3CMX+C3", "五股區", "新北市"),
    ("2F9P+4G", "光復里", "新北市板橋區"),
    ("2F5X+9H", "中和區", "新北市"),
    ("W8HV+WF", "鳶山里", "新北市三峽區"),
    ("2CHH+2W", "建福里", "新北市新莊區"),
    ("2G73+3P", "保順里", "新北市永和區"),
    ("3G93+7V", "三重區", "新北市"),
    ("2F5Q+VR", "中原里", "新北市中和區"),
    ("3F8G+73", "二重里", "新北市三重區"),
    ("3G93+4V", "三重區", "新北市"),
    ("3G45+X7", "大有里", "臺北市大同區"),
    ("2F5V+25", "中原里", "新北市中和區"),
    ("2GX4+WG", "玉泉里", "臺北市大同區"),
    ("3CPW+8V", "成泰里", "新北市五股區"),
    ("2F5R+3V", "中原里", "新北市中和區"),
    ("3GH2+PF", "五常里", "新北市三重區"),
    ("2F3X+X2", "福善里", "新北市中和區"),
    ("3F2J+8W", "德厚里", "新北市三重區"),
    ("XCHG+M8", "彭福里", "新北市樹林區"),
    ("2FH4+52", "中正里", "新北市板橋區"),
    ("2CHW+RM", "泰豐里", "新北市新莊區"),
    ("3FM5+Q7", "蘆洲區", "新北市"),
    ("3FG9+G8", "蘆洲區", "新北市"),
    ("2G5P+R2", "文山區", "臺北市"),
    ("3J79+7Q", "環河里", "新北市汐止區"),
]

# Approximate reference lat/lng for Plus Code recovery (northern Taiwan)
REF = {
    "新北市新莊區": (25.037, 121.452),
    "新北市板橋區": (25.014, 121.462),
    "新北市三重區": (25.066, 121.488),
    "新北市泰山區": (25.054, 121.431),
    "新北市土城區": (24.973, 121.442),
    "新北市中和區": (24.999, 121.498),
    "新北市永和區": (25.008, 121.518),
    "新北市五股區": (25.083, 121.436),
    "新北市三峽區": (24.934, 121.369),
    "新北市樹林區": (24.991, 121.424),
    "新北市蘆洲區": (25.085, 121.473),
    "新北市汐止區": (25.068, 121.654),
    "臺北市萬華區": (25.036, 121.499),
    "臺北市大同區": (25.063, 121.513),
    "臺北市文山區": (25.004, 121.570),
    "新北市": (25.012, 121.465),
    "臺北市": (25.034, 121.565),
}


def decode_plus_code(code: str, district: str) -> tuple[float, float]:
    ref = REF.get(district, (25.03, 121.47))
    full = olc.recoverNearest(code.upper().replace(" ", ""), ref[0], ref[1])
    dec = olc.decode(full)
    return dec.latitudeCenter, dec.longitudeCenter


def main():
    features = []
    for i, (code, village, district) in enumerate(STATIONS, start=1):
        lat, lng = decode_plus_code(code, district)
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": {
                    "id": i,
                    "name": f"抽水站 {i}",
                    "plus_code": code,
                    "village": village,
                    "district": district,
                    "label": f"{village} · {district}",
                    "river": "大漢溪",
                },
            }
        )

    geojson = {"type": "FeatureCollection", "features": features}
    out = Path(__file__).resolve().parents[1] / "data" / "pumping-stations.geojson"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(features)} features to {out}")


if __name__ == "__main__":
    main()
