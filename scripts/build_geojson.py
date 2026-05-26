#!/usr/bin/env python3
"""Build pumping-stations.geojson for 大漢溪 catchment.

Sources:
- NTPC open data API (大漢溪 12 stations, with name/address/year/pump_type).
- Local Plus Code list (legacy 60 entries; non-大漢溪 districts dropped).

Pipeline:
1. Fetch NTPC dataset, filter river == "大漢溪", convert ROC year → CE year,
   prefix addresses with "新北市", and merge entries sharing the same address.
2. Forward-geocode merged API entries via OpenStreetMap Nominatim (name first,
   then address fallback, then a hard-coded approximate point).
3. Decode Plus Codes → lat/lng for the legacy list (kept districts only),
   reverse-geocode for a detailed address, then drop any legacy entry within
   ~100 m of an API entry (API entries win).
4. Emit a single GeoJSON FeatureCollection.
"""

from __future__ import annotations

import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Iterable

try:
    from openlocationcode import openlocationcode as olc
except ImportError as e:
    raise SystemExit("Run: pip install openlocationcode requests") from e

NTPC_API = (
    "https://data.ntpc.gov.tw/api/datasets/"
    "3cdc5b9c-ce48-4dd6-8079-b9b3fa4b7296/json?page=0&size=1000"
)
NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "pumping-station-gis/1.0 (https://github.com/liejrejay/pumping-station-gis)"
REQ_INTERVAL = 1.1  # seconds between Nominatim requests (per usage policy)

# Districts considered to lie along the 大漢溪 corridor in 新北市.
DAHAN_DISTRICTS = {
    "新北市新莊區",
    "新北市板橋區",
    "新北市三重區",
    "新北市泰山區",
    "新北市土城區",
    "新北市三峽區",
    "新北市樹林區",
}
# Generic 新北市 entries are kept (they sit in those districts as well).
GENERIC_KEEP = {"新北市"}

# Legacy Plus Code list: (plus_code, village, district).
LEGACY_STATIONS: list[tuple[str, str, str]] = [
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

# District reference points for Plus Code recovery.
REF: dict[str, tuple[float, float]] = {
    "新北市新莊區": (25.037, 121.452),
    "新北市板橋區": (25.014, 121.462),
    "新北市三重區": (25.066, 121.488),
    "新北市泰山區": (25.054, 121.431),
    "新北市土城區": (24.973, 121.442),
    "新北市三峽區": (24.934, 121.369),
    "新北市樹林區": (24.991, 121.424),
    "新北市": (25.012, 121.465),
}

# Hard-coded approximate coordinates for entries that Nominatim can't pin.
# These are rough mid-points of the addressed road segment, used only as
# a last-resort fallback.  Quality flag set to "approximate".
APPROX_OVERRIDES: dict[str, tuple[float, float]] = {
    "新北市新莊區環漢路2段142號": (25.0405, 121.4573),  # 新莊抽水站
    "新北市新莊區環漢路2段385號": (25.0356, 121.4528),  # 公館溝抽水站 (already in OSM but double-safety)
    "新北市新莊區環漢路2段535號": (25.0316, 121.4498),  # 塔寮坑二抽水站
    "新北市新莊區環漢路630號": (25.0394, 121.4570),    # 塔寮坑抽水站
    "新北市新莊區環漢路3段530號": (25.0014, 121.4350),  # 西盛抽水站 (already in OSM)
    "新北市板橋區環河西路5段500號": (25.0205, 121.4477),  # 湳仔溝抽水站 (already in OSM)
    "新北市板橋區溪城路90-2號": (24.9803, 121.4284),   # 沙崙抽水站 (already in OSM)
    "新北市板橋區中正路511號": (25.0285, 121.4555),    # 新海抽水站
    "新北市板橋區長江路2段311巷18號之1": (25.0357, 121.4701),  # 華江抽水站
    "新北市土城區擺接堡路301號": (24.9818, 121.4391),  # 土城抽水站
    "新北市三重區中興南街82號": (25.0428, 121.4706),   # 重新抽水站
}


def http_get_json(url: str, timeout: int = 30) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def roc_to_ce(roc_year: str | int | None) -> int | None:
    if roc_year in (None, ""):
        return None
    try:
        return int(str(roc_year).strip()) + 1911
    except ValueError:
        return None


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    R = 6371000.0
    lat1, lon1, lat2, lon2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


# ---------- Nominatim helpers ----------

def _nominatim_get(url: str) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def nominatim_search(q: str) -> list[dict]:
    url = NOMINATIM_SEARCH + "?" + urllib.parse.urlencode(
        {"format": "jsonv2", "q": q, "limit": 3, "accept-language": "zh-TW", "countrycodes": "tw"}
    )
    return _nominatim_get(url)  # type: ignore[return-value]


def nominatim_reverse(lat: float, lon: float) -> dict:
    url = NOMINATIM_REVERSE + "?" + urllib.parse.urlencode(
        {"format": "jsonv2", "lat": lat, "lon": lon, "accept-language": "zh-TW", "zoom": 18}
    )
    return _nominatim_get(url)  # type: ignore[return-value]


def is_in_new_taipei(display_name: str) -> bool:
    return "新北市" in display_name and "臺北市" not in display_name.split("新北市", 1)[0]


def geocode_api_entry(name: str, address: str) -> tuple[tuple[float, float], str]:
    """Return ((lat, lon), quality) for an API station.

    Strategy:
        1. Search OSM by station name; accept only matches within 新北市
           whose display name actually contains "抽水站".
        2. Search OSM by address; accept any match within 新北市.
        3. Hard-coded approximate override (mid-point of the addressed road).
        4. Fall back to a generic 新北市 centroid.
    """
    try:
        results = nominatim_search(name)
    except Exception:
        results = []
    time.sleep(REQ_INTERVAL)
    for r in results:
        disp = r.get("display_name", "")
        if is_in_new_taipei(disp) and "抽水站" in disp:
            return (float(r["lat"]), float(r["lon"])), "osm_named"

    try:
        results = nominatim_search(address)
    except Exception:
        results = []
    time.sleep(REQ_INTERVAL)
    for r in results:
        disp = r.get("display_name", "")
        if is_in_new_taipei(disp):
            return (float(r["lat"]), float(r["lon"])), "osm_address"

    if address in APPROX_OVERRIDES:
        lat, lon = APPROX_OVERRIDES[address]
        return (lat, lon), "approximate"

    return (25.012, 121.465), "fallback_centroid"


def reverse_geocode(lat: float, lon: float) -> str:
    try:
        r = nominatim_reverse(lat, lon)
    except Exception:
        return ""
    finally:
        time.sleep(REQ_INTERVAL)
    if not isinstance(r, dict):
        return ""
    addr = r.get("address", {}) or {}
    parts = [
        addr.get("city") or addr.get("state") or "",
        addr.get("city_district") or addr.get("suburb") or addr.get("town") or "",
        addr.get("neighbourhood") or addr.get("village") or "",
        addr.get("road") or "",
        addr.get("house_number") or "",
    ]
    detail = "".join(p for p in parts if p)
    return detail or r.get("display_name", "")


# ---------- Plus Code decoding ----------

def decode_plus_code(code: str, district: str) -> tuple[float, float]:
    ref = REF.get(district, REF["新北市"])
    full = olc.recoverNearest(code.upper().replace(" ", ""), ref[0], ref[1])
    dec = olc.decode(full)
    return dec.latitudeCenter, dec.longitudeCenter


# ---------- Pipeline ----------

def fetch_api_dahan() -> list[dict]:
    raw = http_get_json(NTPC_API)
    if not isinstance(raw, list):
        raise SystemExit(f"Unexpected NTPC payload: {type(raw)}")
    dahan = [r for r in raw if "大漢" in (r.get("river") or "")]

    by_addr: dict[str, dict] = {}
    for s in dahan:
        addr = (s.get("address") or "").strip()
        if not addr:
            continue
        full_addr = addr if addr.startswith("新北市") else f"新北市{addr}"
        title = (s.get("title") or "").strip()
        pump_type = (s.get("pump_type") or "").strip()
        year_ce = roc_to_ce(s.get("year"))

        if full_addr in by_addr:
            entry = by_addr[full_addr]
            if title and title not in entry["names"]:
                entry["names"].append(title)
            if pump_type and pump_type not in entry["pump_types"]:
                entry["pump_types"].append(pump_type)
            if year_ce is not None:
                entry["years"].append(year_ce)
        else:
            by_addr[full_addr] = {
                "address": full_addr,
                "names": [title] if title else [],
                "pump_types": [pump_type] if pump_type else [],
                "years": [year_ce] if year_ce is not None else [],
                "river": "大漢溪",
            }
    return list(by_addr.values())


def keep_legacy(stations: Iterable[tuple[str, str, str]]) -> list[tuple[str, str, str]]:
    return [s for s in stations if s[2] in DAHAN_DISTRICTS or s[2] in GENERIC_KEEP]


def main() -> None:
    print("[1/4] Fetching NTPC API …")
    api_entries = fetch_api_dahan()
    print(f"      Got {len(api_entries)} unique 大漢溪 entries (after address-merge).")

    print("[2/4] Geocoding API entries via Nominatim …")
    api_features: list[dict] = []
    for i, e in enumerate(api_entries, start=1):
        primary_name = e["names"][0] if e["names"] else "(未命名)"
        (lat, lon), quality = geocode_api_entry(primary_name, e["address"])
        joined_name = " / ".join(e["names"]) if e["names"] else "(未命名)"
        joined_type = " / ".join(e["pump_types"]) if e["pump_types"] else None
        years = e["years"]
        year_min = min(years) if years else None
        year_max = max(years) if years else None
        api_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "name": joined_name,
                    "address": e["address"],
                    "river": e["river"],
                    "pump_type": joined_type,
                    "year_ce": year_min,
                    "year_ce_range": [year_min, year_max] if year_min != year_max else None,
                    "source": "NTPC open data",
                    "geocode_quality": quality,
                },
            }
        )
        print(f"      [{i:>2}/{len(api_entries)}] {joined_name}  ({quality})")

    print("[3/4] Decoding Plus Code legacy stations …")
    legacy_kept = keep_legacy(LEGACY_STATIONS)
    print(f"      Kept {len(legacy_kept)} of {len(LEGACY_STATIONS)} legacy entries.")

    legacy_features: list[dict] = []
    api_points = [tuple(f["geometry"]["coordinates"][::-1]) for f in api_features]  # (lat, lon)
    for i, (code, village, district) in enumerate(legacy_kept, start=1):
        lat, lon = decode_plus_code(code, district)
        # Drop if within 100 m of any API station (API wins).
        if any(haversine_m((lat, lon), p) <= 100.0 for p in api_points):
            print(f"      [{i:>2}/{len(legacy_kept)}] {code} dropped (≤100m to API station)")
            continue
        addr = reverse_geocode(lat, lon)
        legacy_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "name": f"{village} 抽水站(暫名)",
                    "address": addr or f"{district}{village}",
                    "river": "大漢溪",
                    "pump_type": None,
                    "year_ce": None,
                    "year_ce_range": None,
                    "source": "legacy plus_code",
                    "geocode_quality": "plus_code",
                    "plus_code": code,
                    "village": village,
                    "district": district,
                },
            }
        )
        print(f"      [{i:>2}/{len(legacy_kept)}] {code} {village}  →  {addr[:60] if addr else '(no addr)'}")

    print("[4/4] Writing GeoJSON …")
    features = api_features + legacy_features
    for idx, f in enumerate(features, start=1):
        f["properties"]["id"] = idx
        f["properties"]["label"] = f["properties"].get("name") or f["properties"].get("address") or str(idx)

    out = Path(__file__).resolve().parents[1] / "data" / "pumping-stations.geojson"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": features}, fh, ensure_ascii=False, indent=2)
    print(f"\nWrote {len(features)} features ({len(api_features)} from API, {len(legacy_features)} legacy) → {out}")


if __name__ == "__main__":
    main()
