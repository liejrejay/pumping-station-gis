#!/usr/bin/env python3
"""Rebuild pumping-stations.geojson: 19-station reference table + legacy 暫名 stations."""

from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEOJSON = ROOT / "data" / "pumping-stations.geojson"

# (站名, 民國年, 完整地址, 河川, 型式, (經度, 緯度))
MASTER_REFERENCE: list[tuple[str, int, str, str, str, tuple[float, float]]] = [
    ("華江抽水站", 86, "新北市板橋區長江路2段311巷18號之1", "大漢溪", "豎軸式", (121.4701312, 25.0357016)),
    ("新海抽水站", 86, "新北市板橋區中正路511號", "大漢溪", "豎軸式", (121.4555218, 25.0284731)),
    ("湳仔溝抽水站", 84, "新北市板橋區環河西路5段500號", "大漢溪", "豎軸式", (121.4477, 25.0205)),
    ("湳仔溝二抽水站", 95, "新北市板橋區環河西路5段500號", "大漢溪", "豎軸式", (121.4481, 25.0209)),
    ("土城抽水站含臨時站", 85, "新北市土城區擺接堡路301號", "大漢溪", "豎軸式及沉水式", (121.4391, 24.9818)),
    ("沙崙抽水站", 95, "新北市板橋區溪城路90-2號", "大漢溪", "豎軸式", (121.4284131, 24.9802862)),
    ("西盛抽水站", 85, "新北市新莊區環漢路3段530號", "大漢溪", "豎軸式", (121.4350082, 25.0014598)),
    ("塔寮坑抽水站", 86, "新北市新莊區環漢路630號", "大漢溪", "豎軸式", (121.4570, 25.0394)),
    ("塔寮坑二抽水站", 105, "新北市新莊區環漢路2段535號", "大漢溪", "豎軸式", (121.4498, 25.0316)),
    ("西盛溝抽水站", 95, "新北市新莊區新樹路85巷11-1號", "塔寮坑溪", "豎軸式", (121.4412, 25.0277)),
    ("建國抽水站", 95, "新北市新莊區建國一路113-1號", "塔寮坑溪", "豎軸式", (121.4320, 25.0265)),
    ("潭底溝抽水站", 96, "新北市新莊區建國二路81-1號", "塔寮坑溪", "豎軸式", (121.4307, 25.0249)),
    ("公館溝抽水站", 95, "新北市新莊區環漢路2段385號", "大漢溪", "豎軸式", (121.4528, 25.0356)),
    ("新莊抽水站", 86, "新北市新莊區環漢路2段142號", "大漢溪", "豎軸式", (121.4573, 25.0405)),
    ("後港抽水站", 93, "新北市新莊區後港一路139-1號", "塔寮坑溪", "豎軸式", (121.4298, 25.0276)),
    ("昌平抽水站", 97, "新北市新莊區福壽街336號", "中港大排", "豎軸式", (121.4580, 25.0584)),
    ("中隆抽水站", 97, "新北市新莊區中央路182號", "中港大排", "豎軸式", (121.4503, 25.0593)),
    ("頭前抽水站", 99, "新北市新莊區福美街12號", "中港大排", "沉水式", (121.4608, 25.0531)),
    ("重新抽水站", 93, "新北市三重區中興南街82號", "大漢溪", "豎軸式", (121.4705964, 25.0428182)),
]

# Git revision that still contains the full legacy 暫名 set (before master-only rebuild)
LEGACY_GIT_REV = "d6e63e9"


def build_feature(
    idx: int,
    name: str,
    roc: int,
    address: str,
    river: str,
    pump_type: str,
    lon: float,
    lat: float,
) -> dict:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {
            "id": idx,
            "name": name,
            "label": name,
            "address": address,
            "river": river,
            "pump_type": pump_type,
            "year_ce": roc + 1911,
            "year_ce_range": None,
            "source": "reference table",
            "geocode_quality": "reference",
        },
    }


def _dist_m(c1: list[float], c2: list[float]) -> float:
    lon1, lat1 = c1
    lon2, lat2 = c2
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def filter_legacy_duplicates(
    ref_features: list[dict], legacy: list[dict], *, near_m: float = 50.0
) -> list[dict]:
    """Drop legacy plus_code rows that duplicate a reference-table station."""
    ref_names = {(f["properties"].get("name") or "").strip() for f in ref_features}
    ref_points = [
        (f["geometry"]["coordinates"], (f["properties"].get("name") or "").strip())
        for f in ref_features
    ]
    kept: list[dict] = []
    for lf in legacy:
        p = lf["properties"]
        name = (p.get("name") or "").strip()
        if "暫名" in name:
            kept.append(lf)
            continue
        if name in ref_names:
            print(f"  skip legacy duplicate (name): {name}")
            continue
        coords = lf["geometry"]["coordinates"]
        if any(
            rname == name and _dist_m(coords, rc) <= near_m for rc, rname in ref_points
        ):
            print(f"  skip legacy duplicate (near {name})")
            continue
        kept.append(lf)
    return kept


def load_legacy_features_from_current_geojson() -> list[dict]:
    """Fallback when git history is unavailable."""
    if not GEOJSON.exists():
        return []
    data = json.loads(GEOJSON.read_text(encoding="utf-8"))
    legacy: list[dict] = []
    for f in data["features"]:
        p = f.get("properties") or {}
        name = p.get("name") or ""
        source = p.get("source") or ""
        if "暫名" in name or source == "legacy plus_code":
            legacy.append(json.loads(json.dumps(f)))
    return legacy


def load_legacy_features_from_git(rev: str = LEGACY_GIT_REV) -> list[dict]:
    """Restore 暫名／legacy plus_code stations from git history."""
    try:
        raw = subprocess.check_output(
            ["git", "show", f"{rev}:data/pumping-stations.geojson"],
            text=True,
            encoding="utf-8",
            stderr=subprocess.DEVNULL,
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as err:
        print(f"warn: cannot load legacy from git ({err}); skipping 暫名 stations")
        return []

    data = json.loads(raw)
    legacy: list[dict] = []
    for f in data["features"]:
        p = f.get("properties") or {}
        name = p.get("name") or ""
        source = p.get("source") or ""
        if "暫名" in name or source == "legacy plus_code":
            legacy.append(json.loads(json.dumps(f)))
    return legacy


def renumber_features(features: list[dict]) -> None:
    for idx, f in enumerate(features, start=1):
        p = f["properties"]
        p["id"] = idx
        p["label"] = p.get("name") or p.get("address") or str(idx)


def main() -> None:
    features: list[dict] = [
        build_feature(0, name, roc, addr, river, ptype, lon, lat)  # id set in renumber
        for name, roc, addr, river, ptype, (lon, lat) in MASTER_REFERENCE
    ]

    legacy = load_legacy_features_from_git()
    if not legacy:
        legacy = load_legacy_features_from_current_geojson()
        print(f"loaded {len(legacy)} legacy stations from existing {GEOJSON.name}")
    else:
        print(f"loaded {len(legacy)} legacy stations from git {LEGACY_GIT_REV}")
    legacy = filter_legacy_duplicates(features, legacy)
    print(f"append {len(legacy)} legacy stations after dedupe")
    features.extend(legacy)

    renumber_features(features)

    out = {"type": "FeatureCollection", "features": features}
    GEOJSON.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    n_ref = sum(1 for f in features if f["properties"].get("source") == "reference table")
    n_legacy = sum(1 for f in features if "暫名" in (f["properties"].get("name") or ""))
    by_river: dict[str, int] = {}
    for f in features:
        r = f["properties"].get("river") or "—"
        by_river[r] = by_river.get(r, 0) + 1

    print(f"Wrote {len(features)} stations -> {GEOJSON}")
    print(f"  reference table: {n_ref}, 暫名: {n_legacy}")
    for r in sorted(by_river):
        print(f"  {r}: {by_river[r]}")


if __name__ == "__main__":
    main()
