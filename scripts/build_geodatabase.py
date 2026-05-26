#!/usr/bin/env python3
"""Build the project's geodatabase (4 layers).

Outputs (under ``data/``):
    - pumping-stations.geojson  ← built by build_geojson.py (kept as-is)
    - water-level-stations.geojson
    - dahan-river.geojson
    - districts.geojson

Sources:
    * Pumping stations  : NTPC open data + legacy Plus Code list
    * Water level stations : 水利署 opendata 站別清單 + TWD97→WGS84 轉換
    * 大漢溪 river course  : OSM Overpass API (waterway=river, name~"大漢溪")
    * 沿岸行政區邊界      : OSM Nominatim (polygon_geojson)

Usage:
    .venv/bin/python scripts/build_geodatabase.py
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

USER_AGENT = "pumping-station-gis/1.0 (https://github.com/liejrejay/pumping-station-gis)"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def http_get_json(url: str, timeout: int = 60) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


# ---------------------------------------------------------------
# 1. Water-level stations  →  data/water-level-stations.geojson
# ---------------------------------------------------------------
WL_CATALOG_API = "https://opendata.wra.gov.tw/api/v2/c4acc691-7416-40ca-9464-292c0c00da92?page=1&size=1000"


def build_water_level_stations() -> int:
    print("[water-level] Fetching WRA catalog …")
    rows = http_get_json(WL_CATALOG_API)
    if not isinstance(rows, list):
        raise SystemExit("WRA catalog payload is not a list")

    try:
        from pyproj import Transformer
    except ImportError as e:
        raise SystemExit("Run: pip install pyproj") from e
    tr = Transformer.from_crs("EPSG:3826", "EPSG:4326", always_xy=True)

    fallback_latlng = {
        "1140H118": (24.9853, 121.3819),  # 柑園橋（即時）
    }

    features = []
    dahan = [r for r in rows if r.get("rivername") == "大漢溪"]
    for r in dahan:
        sid = r.get("basinidentifier", "")
        name = r.get("observatoryname", "")
        addr = r.get("locationaddress", "")
        status = r.get("observationstatus", "")  # 現存 / 已廢
        xy = (r.get("locationbytwd97_xy") or "").split()
        lat = lng = None
        if len(xy) == 2:
            try:
                x, y = float(xy[0]), float(xy[1])
                lng, lat = tr.transform(x, y)
            except Exception:
                lat, lng = fallback_latlng.get(sid, (None, None))
        else:
            lat, lng = fallback_latlng.get(sid, (None, None))
        if lat is None:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": {
                    "stationid": sid,
                    "name": name,
                    "river": "大漢溪",
                    "status": status,
                    "address": addr,
                    "elev_zero_m": float(r.get("elevationofwaterlevelzeropoint") or 0) / 100.0,
                    "source": "WRA opendata",
                },
            }
        )
    out = DATA_DIR / "water-level-stations.geojson"
    with out.open("w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=False, indent=2)
    print(f"[water-level] wrote {len(features)} stations → {out}")
    return len(features)


# ---------------------------------------------------------------
# 2. 大漢溪 river course  →  data/dahan-river.geojson
# ---------------------------------------------------------------
OVERPASS_MIRRORS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]
OVERPASS_QUERY = '[out:json][timeout:90];(way["waterway"="river"]["name"~"大漢溪"];);out geom;'


def overpass_get():
    last_err = None
    for url in OVERPASS_MIRRORS:
        try:
            full = url + "?" + urllib.parse.urlencode({"data": OVERPASS_QUERY})
            print(f"[river] Trying {url} …")
            req = urllib.request.Request(full, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as r:
                body = r.read()
            payload = json.loads(body)
            return payload
        except Exception as e:
            last_err = e
            print(f"  failed: {e}")
            time.sleep(2)
    raise SystemExit(f"Overpass query failed on all mirrors: {last_err}")


def build_dahan_river() -> int:
    payload = overpass_get()
    elements = payload.get("elements", []) if isinstance(payload, dict) else []
    line_features = []
    for el in elements:
        if el.get("type") != "way":
            continue
        geom = el.get("geometry", [])
        if len(geom) < 2:
            continue
        coords = [[g["lon"], g["lat"]] for g in geom]
        line_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": coords},
                "properties": {
                    "osm_way_id": el.get("id"),
                    "name": el.get("tags", {}).get("name", "大漢溪"),
                    "waterway": el.get("tags", {}).get("waterway", "river"),
                    "source": "OSM",
                },
            }
        )

    out = DATA_DIR / "dahan-river.geojson"
    with out.open("w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": line_features}, f, ensure_ascii=False, indent=2)
    print(f"[river] wrote {len(line_features)} line features → {out}")
    return len(line_features)


# ---------------------------------------------------------------
# 3. 沿岸行政區邊界  →  data/districts.geojson
# ---------------------------------------------------------------
TARGET_DISTRICTS = [
    "新北市新莊區",
    "新北市板橋區",
    "新北市三重區",
    "新北市泰山區",
    "新北市土城區",
    "新北市三峽區",
    "新北市樹林區",
    "新北市鶯歌區",
]


def nominatim_polygon(query: str) -> dict | None:
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "json", "polygon_geojson": 1, "limit": 1, "accept-language": "zh-TW"}
    )
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    if not data:
        return None
    return data[0]


def build_districts() -> int:
    features = []
    for q in TARGET_DISTRICTS:
        print(f"[districts] querying {q} …")
        try:
            row = nominatim_polygon(q)
        except Exception as e:
            print(f"  failed: {e}")
            row = None
        if row is None:
            print("  (no result)")
            time.sleep(1.1)
            continue
        geo = row.get("geojson")
        if not geo:
            print("  (no geojson)")
            time.sleep(1.1)
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": geo,
                "properties": {
                    "name": q,
                    "display_name": row.get("display_name", ""),
                    "osm_id": row.get("osm_id"),
                    "osm_type": row.get("osm_type"),
                    "source": "OSM Nominatim",
                },
            }
        )
        time.sleep(1.1)  # nominatim 1 req/sec
    out = DATA_DIR / "districts.geojson"
    with out.open("w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=False, indent=2)
    print(f"[districts] wrote {len(features)} polygons → {out}")
    return len(features)


# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------
def main():
    print("Building geodatabase under", DATA_DIR)
    n_wl = build_water_level_stations()
    n_river = build_dahan_river()
    n_dist = build_districts()
    print()
    print("Summary:")
    print(f"  water-level-stations.geojson : {n_wl} features")
    print(f"  dahan-river.geojson          : {n_river} features")
    print(f"  districts.geojson            : {n_dist} features")
    print()
    print("Note: pumping-stations.geojson is generated separately by scripts/build_geojson.py")


if __name__ == "__main__":
    main()
