#!/usr/bin/env python3
"""One-shot cleanup of data/pumping-stations.geojson (no network)."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEOJSON = ROOT / "data" / "pumping-stations.geojson"

# lon, lat (GeoJSON order applied when writing)
COORD_OVERRIDES = {
    "新莊抽水站": (121.4573, 25.0405),
    "湳仔溝抽水站": (121.4477, 25.0205),
    "湳仔溝二抽水站": (121.4481, 25.0209),
}

# legacy plus_code → drop (duplicate of official NTPC station)
DROP_PLUS_CODES = {
    "2FQ6+45",
    "2FQ6+8G",
    "2CGV+24",
    "2CCR+RG",
    "2CHW+7C",
    "2FFM+HH",
    "3G93+7V",
    "3G93+4V",
}

# Official address fragments: legacy rows matching these are removed
OFFICIAL_ADDR_PATTERNS = [
    re.compile(r"新莊.*環漢路.*142"),
    re.compile(r"新莊.*環漢路.*630"),
    re.compile(r"新莊.*環漢路.*535"),
]


def haversine_m(c1: list[float], c2: list[float]) -> float:
    R = 6371000.0
    lon1, lat1, lon2, lat2 = c1[0], c1[1], c2[0], c2[1]
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def norm_addr(addr: str) -> str:
    return (addr or "").replace("臺", "台").replace(" ", "")


def is_legacy(f: dict) -> bool:
    return f["properties"].get("source") != "NTPC open data"


def matches_official_address(addr: str) -> bool:
    a = norm_addr(addr)
    return any(p.search(a) for p in OFFICIAL_ADDR_PATTERNS)


def split_nanzihou(feature: dict) -> list[dict]:
    lon, lat = feature["geometry"]["coordinates"]
    base = {k: v for k, v in feature["properties"].items() if k not in ("name", "label", "year_ce", "year_ce_range")}
    return [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": list(COORD_OVERRIDES["湳仔溝抽水站"])},
            "properties": {
                **base,
                "name": "湳仔溝抽水站",
                "label": "湳仔溝抽水站",
                "pump_type": "豎軸式",
                "year_ce": 1995,
                "year_ce_range": None,
                "geocode_quality": "approximate",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": list(COORD_OVERRIDES["湳仔溝二抽水站"])},
            "properties": {
                **base,
                "name": "湳仔溝二抽水站",
                "label": "湳仔溝二抽水站",
                "pump_type": "豎軸式",
                "year_ce": 2006,
                "year_ce_range": None,
                "geocode_quality": "approximate",
            },
        },
    ]


def should_drop_legacy(f: dict, official_coords: list[list[float]]) -> bool:
    p = f["properties"]
    if p.get("plus_code") in DROP_PLUS_CODES:
        return True
    if matches_official_address(p.get("address") or ""):
        return True
    c = f["geometry"]["coordinates"]
    if any(haversine_m(c, o) < 80 for o in official_coords):
        name = p.get("name") or ""
        if "暫名" in name and matches_official_address(p.get("address") or ""):
            return True
    return False


def dedupe_legacy_by_name(features: list[dict]) -> list[dict]:
    """Keep one legacy feature per station name (longest address wins)."""
    legacy = [f for f in features if is_legacy(f)]
    other = [f for f in features if not is_legacy(f)]
    groups: dict[str, list[dict]] = {}
    for f in legacy:
        name = f["properties"].get("name") or ""
        groups.setdefault(name, []).append(f)

    kept: list[dict] = []
    for name, group in groups.items():
        if len(group) == 1:
            kept.append(group[0])
            continue
        best = max(group, key=lambda x: len(x["properties"].get("address") or ""))
        kept.append(best)
        if len(group) > 1:
            print(f"  dedupe name '{name}': kept 1 of {len(group)}")
    return other + kept


def main() -> None:
    data = json.loads(GEOJSON.read_text(encoding="utf-8"))
    features: list[dict] = []
    official_coords: list[list[float]] = []

    for f in data["features"]:
        p = f["properties"]
        name = p.get("name") or ""

        if name == "湳仔溝抽水站 / 湳仔溝二抽水站" or (
            "湳仔溝" in name and "湳仔溝二" in name
        ):
            print("split: 湳仔溝 + 湳仔溝二")
            for nf in split_nanzihou(f):
                features.append(nf)
                official_coords.append(nf["geometry"]["coordinates"])
            continue

        if p.get("source") == "NTPC open data":
            if name in COORD_OVERRIDES:
                f = json.loads(json.dumps(f))
                f["geometry"]["coordinates"] = list(COORD_OVERRIDES[name])
                if name == "新莊抽水站":
                    f["properties"]["geocode_quality"] = "approximate"
                    print("fix coords: 新莊抽水站")
            features.append(f)
            official_coords.append(f["geometry"]["coordinates"])
            continue

        if should_drop_legacy(f, official_coords):
            print(f"drop legacy: {p.get('name')} ({p.get('plus_code', '')})")
            continue

        features.append(f)

    before = len(features)
    features = dedupe_legacy_by_name(features)
    if len(features) < before:
        print(f"dedupe by name: {before} -> {len(features)}")

    for idx, f in enumerate(features, start=1):
        f["properties"]["id"] = idx
        f["properties"]["label"] = f["properties"].get("name") or f["properties"].get("address") or str(idx)

    out = {"type": "FeatureCollection", "features": features}
    GEOJSON.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    n_ntpc = sum(1 for f in features if f["properties"].get("source") == "NTPC open data")
    n_legacy = len(features) - n_ntpc
    print(f"\nWrote {len(features)} features ({n_ntpc} NTPC, {n_legacy} legacy) -> {GEOJSON}")


if __name__ == "__main__":
    main()
