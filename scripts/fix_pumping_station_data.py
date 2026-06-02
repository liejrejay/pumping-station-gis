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
    "建國抽水站": (121.4320, 25.0265),
    "潭底溝抽水站": (121.4307, 25.0249),
    "後港抽水站": (121.4298, 25.0276),
    "公館溝抽水站": (121.4528, 25.0356),
}

# (name, 民國年, address without prefix, river, pump_type)
XINZHUANG_REFERENCE = [
    ("建國抽水站", 95, "新北市新莊區建國一路113-1號", "塔寮坑溪", "豎軸式"),
    ("潭底溝抽水站", 96, "新北市新莊區建國二路81-1號", "塔寮坑溪", "豎軸式"),
    ("公館溝抽水站", 95, "新北市新莊區環漢路2段385號", "大漢溪", "豎軸式"),
    ("新莊抽水站", 86, "新北市新莊區環漢路2段142號", "大漢溪", "豎軸式"),
    ("後港抽水站", 93, "新北市新莊區後港一路139-1號", "塔寮坑溪", "豎軸式"),
]

ALLOWED_RIVERS = frozenset({"大漢溪", "塔寮坑溪"})
XINZHUANG_REFERENCE_NAMES = frozenset(n for n, *_ in XINZHUANG_REFERENCE)

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
    re.compile(r"新莊.*環漢路.*385"),
    re.compile(r"新莊.*建國一路.*113"),
    re.compile(r"新莊.*建國二路.*81"),
    re.compile(r"新莊.*後港一路.*139"),
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


def is_xinzhuang_address(addr: str) -> bool:
    return "新莊區" in norm_addr(addr)


def make_reference_feature(
    name: str, roc: int, address: str, river: str, pump_type: str
) -> dict:
    lon, lat = COORD_OVERRIDES[name]
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {
            "name": name,
            "address": address,
            "river": river,
            "pump_type": pump_type,
            "year_ce": roc + 1911,
            "year_ce_range": None,
            "source": "reference table",
            "geocode_quality": "approximate",
        },
    }


def apply_xinzhuang_reference(features: list[dict]) -> list[dict]:
    """Drop 新莊暫名站、移除非允許河川，並套用新莊五站對照表。"""
    kept: list[dict] = []
    by_name: dict[str, dict] = {}

    for f in features:
        p = f["properties"]
        name = p.get("name") or ""
        addr = p.get("address") or ""
        river = (p.get("river") or "").strip()

        if is_legacy(f) and is_xinzhuang_address(addr):
            print(f"drop 新莊 legacy: {name}")
            continue

        if river and river not in ALLOWED_RIVERS:
            print(f"drop wrong river ({river}): {name}")
            continue

        if name in XINZHUANG_REFERENCE_NAMES:
            by_name[name] = f
            continue

        if is_legacy(f) and "暫名" in name:
            if "中和區" in name or "永和區" in addr:
                print(f"drop non-大漢溪 watershed legacy: {name}")
                continue

        kept.append(f)

    for name, roc, address, river, pump_type in XINZHUANG_REFERENCE:
        year_ce = roc + 1911
        if name in by_name:
            f = by_name[name]
            p = f["properties"]
            p["address"] = address
            p["river"] = river
            p["pump_type"] = pump_type
            p["year_ce"] = year_ce
            p["year_ce_range"] = None
            p["label"] = name
            p["source"] = p.get("source") or "reference table"
            if name in COORD_OVERRIDES:
                f["geometry"]["coordinates"] = list(COORD_OVERRIDES[name])
            print(f"update: {name} ({river}, 民國{roc})")
            kept.append(f)
        else:
            print(f"add: {name} ({river}, 民國{roc})")
            kept.append(make_reference_feature(name, roc, address, river, pump_type))

    return kept


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

    print("\n--- 新莊區對照表與河川篩選 ---")
    features = apply_xinzhuang_reference(features)

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
