#!/usr/bin/env python3
"""Build data/taoyuan-dahan-facilities.geojson — 大漢溪沿岸設施（政府開放資料）.

Sources:
- 經濟部水利署 WRA 河川水位站目錄（大漢溪 + 地址含桃園市）
- 親水園區／水利景點（桃園市大溪區等）
- 抽水站：data/pumping-stations.geojson 中河系為大漢溪者（含新北市開放資料）
"""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT = DATA_DIR / "taoyuan-dahan-facilities.geojson"
WL_CATALOG_API = "https://opendata.wra.gov.tw/api/v2/c4acc691-7416-40ca-9464-292c0c00da92?page=1&size=1000"
USER_AGENT = "pumping-station-gis/1.0"

# 桃園市大漢溪親水／水利景點（手動整理，座標與前台一致）
WATERFRONT_TAOYUAN = [
    {
        "name": "大漢溪山豬湖生態親水園區",
        "address": "桃園市大溪區",
        "lat": 24.8876875,
        "lng": 121.2863125,
        "category": "親水園區",
    },
    {
        "name": "大嵙崁親水園區",
        "address": "桃園市大溪區瑞興里",
        "lat": 24.9044375,
        "lng": 121.2941875,
        "category": "親水園區",
    },
    {
        "name": "中庄調整池",
        "address": "桃園市大溪區",
        "lat": 24.8941875,
        "lng": 121.2891875,
        "category": "水利設施",
    },
    {
        "name": "大鶯綠野景觀自行車道",
        "address": "桃園市大溪區",
        "lat": 24.9104375,
        "lng": 121.2921875,
        "category": "親水步道",
    },
]


def http_get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def features_from_local_wl() -> list[dict]:
    """Fallback: 從 data/water-level-stations.geojson 篩選桃園地址（來源仍為 WRA）。"""
    wl_path = DATA_DIR / "water-level-stations.geojson"
    with wl_path.open(encoding="utf-8") as f:
        gj = json.load(f)
    out = []
    for feat in gj.get("features") or []:
        p = feat.get("properties") or {}
        if "桃園" not in (p.get("address") or ""):
            continue
        out.append(
            {
                "type": "Feature",
                "geometry": feat["geometry"],
                "properties": {
                    "facility_type": "水位站",
                    "stationid": p.get("stationid"),
                    "name": p.get("name"),
                    "river": "大漢溪",
                    "status": p.get("status"),
                    "address": p.get("address"),
                    "county": "桃園市",
                    "source": p.get("source", "WRA opendata"),
                    "source_url": WL_CATALOG_API,
                },
            }
        )
    return out


def features_from_wra_catalog() -> list[dict]:
    print("[taoyuan-dahan] Fetching WRA water-level catalog …")
    rows = http_get_json(WL_CATALOG_API)
    if not isinstance(rows, list):
        raise SystemExit("WRA catalog payload is not a list")

    try:
        from pyproj import Transformer

        tr = Transformer.from_crs("EPSG:3826", "EPSG:4326", always_xy=True)
    except ImportError as e:
        raise SystemExit("Run: pip install pyproj") from e

    features: list[dict] = []
    for r in rows:
        if r.get("rivername") != "大漢溪":
            continue
        addr = r.get("locationaddress") or ""
        if "桃園" not in addr:
            continue
        sid = r.get("basinidentifier", "")
        xy = (r.get("locationbytwd97_xy") or "").split()
        lat = lng = None
        if len(xy) == 2:
            try:
                x, y = float(xy[0]), float(xy[1])
                lng, lat = tr.transform(x, y)
            except Exception:
                pass
        if lat is None:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": {
                    "facility_type": "水位站",
                    "stationid": sid,
                    "name": r.get("observatoryname", ""),
                    "river": "大漢溪",
                    "status": r.get("observationstatus", ""),
                    "address": addr,
                    "county": "桃園市",
                    "source": "WRA opendata",
                    "source_url": WL_CATALOG_API,
                },
            }
        )
    return features


def features_from_pumping_dahan() -> list[dict]:
    """河系為大漢溪之抽水站（新北市開放資料 + 參考表座標）。"""
    pump_path = DATA_DIR / "pumping-stations.geojson"
    with pump_path.open(encoding="utf-8") as f:
        gj = json.load(f)
    out: list[dict] = []
    for feat in gj.get("features") or []:
        p = feat.get("properties") or {}
        river = (p.get("river") or "").strip()
        if "大漢" not in river:
            continue
        addr = p.get("address") or ""
        if "桃園" in addr:
            county = "桃園市"
        elif "新北" in addr:
            county = "新北市"
        else:
            county = ""
        out.append(
            {
                "type": "Feature",
                "geometry": feat["geometry"],
                "properties": {
                    "facility_type": "抽水站",
                    "name": p.get("name") or p.get("label"),
                    "river": "大漢溪",
                    "address": addr,
                    "pump_type": p.get("pump_type"),
                    "year_ce": p.get("year_ce"),
                    "construction_year": p.get("construction_year") or p.get("year_ce"),
                    "county": county,
                    "source": p.get("source", "pumping-stations.geojson"),
                    "status": "運作中",
                },
            }
        )
    return out


def main() -> None:
    try:
        features = features_from_wra_catalog()
    except Exception as e:
        print(f"[taoyuan-dahan] WRA API failed ({e}); using local water-level-stations.geojson")
        features = features_from_local_wl()

    for w in WATERFRONT_TAOYUAN:
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [w["lng"], w["lat"]],
                },
                "properties": {
                    "facility_type": w["category"],
                    "name": w["name"],
                    "river": "大漢溪",
                    "status": "景點",
                    "address": w["address"],
                    "county": "桃園市",
                    "source": "親水廊道清冊",
                },
            }
        )

    features.extend(features_from_pumping_dahan())

    OUT.parent.mkdir(parents=True, exist_ok=True)
    collection = {
        "type": "FeatureCollection",
        "name": "taoyuan-dahan-facilities",
        "description": "大漢溪流域設施（桃園水位站、親水景點、河系大漢溪抽水站）",
        "features": features,
    }
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(collection, f, ensure_ascii=False, indent=2)
    wl = sum(1 for f in features if f["properties"]["facility_type"] == "水位站")
    pump = sum(1 for f in features if f["properties"]["facility_type"] == "抽水站")
    other = len(features) - wl - pump
    print(
        f"[taoyuan-dahan] wrote {len(features)} features "
        f"({wl} 水位站, {pump} 抽水站, {other} 景點) → {OUT}"
    )


if __name__ == "__main__":
    main()
