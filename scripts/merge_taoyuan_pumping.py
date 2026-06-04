#!/usr/bin/env python3
"""Merge Taoyuan Dahan-basin pumping stations into data/pumping-stations.geojson."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEOJSON = ROOT / "data" / "pumping-stations.geojson"
REF = ROOT / "data" / "taoyuan-pumping-reference.json"


def main() -> None:
    with REF.open(encoding="utf-8") as f:
        ref = json.load(f)
    with GEOJSON.open(encoding="utf-8") as f:
        gj = json.load(f)

    existing = {(f["properties"].get("name") or "").strip() for f in gj.get("features", [])}
    added = 0
    next_id = max((f["properties"].get("id") or 0) for f in gj["features"]) + 1 if gj["features"] else 1

    for s in ref.get("stations", []):
        name = (s.get("name") or "").strip()
        if not name or name in existing:
            continue
        gj["features"].append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(s["lng"]), float(s["lat"])],
                },
                "properties": {
                    "id": next_id,
                    "name": name,
                    "label": name,
                    "address": s.get("address", ""),
                    "river": s.get("river", "大漢溪"),
                    "pump_type": s.get("pump_type"),
                    "year_ce": None,
                    "year_ce_range": None,
                    "source": s.get("source", "taoyuan-pumping-reference"),
                    "geocode_quality": "reference",
                    "county": "桃園市",
                },
            }
        )
        existing.add(name)
        next_id += 1
        added += 1

    with GEOJSON.open("w", encoding="utf-8") as f:
        json.dump(gj, f, ensure_ascii=False, indent=2)
    print(f"[merge] added {added} Taoyuan stations → {GEOJSON} (total {len(gj['features'])})")


if __name__ == "__main__":
    main()
