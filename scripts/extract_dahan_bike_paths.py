#!/usr/bin/env python3
"""從新北市自行車道 GeoJSON 篩選大漢溪親水自行車道出入口。

來源檔（專案根目錄）: 新北市自行車道資料.geojson
輸出: data/dahan-waterfront-bike.geojson

Usage:
    python3 scripts/extract_dahan_bike_paths.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "新北市自行車道資料.geojson"
OUT = ROOT / "data" / "dahan-waterfront-bike.geojson"


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"找不到來源檔: {SRC}")

    data = json.loads(SRC.read_text(encoding="utf-8"))
    features = []
    for feat in data.get("features", []):
        props = feat.get("properties") or {}
        loc = props.get("location") or ""
        name = props.get("name") or ""
        if "大漢溪" not in loc:
            continue
        if "租借站" in name:
            continue
        out_props = dict(props)
        out_props["layer"] = "bike_access"
        out_props["category"] = "親水自行車道"
        features.append(
            {"type": "Feature", "geometry": feat["geometry"], "properties": out_props}
        )

    collection = {
        "type": "FeatureCollection",
        "name": "dahan-waterfront-bike",
        "description": "大漢溪流域親水自行車道出入口（篩選自新北市自行車道開放資料）",
        "features": features,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(collection, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ 已寫入 {len(features)} 筆 → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
