#!/usr/bin/env python3
"""Verify pumping-stations.geojson against the 19-station master reference."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from apply_master_reference import MASTER_REFERENCE, GEOJSON  # noqa: E402


def roc(ce: int | None) -> int | None:
    return ce - 1911 if ce else None


def main() -> None:
    data = json.loads(GEOJSON.read_text(encoding="utf-8"))
    feats = data["features"]
    by_name = {f["properties"]["name"]: f for f in feats}

    print(f"=== 對照表 {len(MASTER_REFERENCE)} 站 vs GeoJSON ({len(feats)} 筆) ===\n")
    ok = 0
    for name, roc_y, addr, river, ptype, (lon, lat) in MASTER_REFERENCE:
        ce = roc_y + 1911
        f = by_name.get(name)
        if not f:
            print(f"【{name}】 MISSING")
            continue
        p = f["properties"]
        c = f["geometry"]["coordinates"]
        issues = []
        if p.get("year_ce") != ce:
            issues.append(f"年份: {p.get('year_ce')} (民國{roc(p.get('year_ce'))}) vs 民國{roc_y}")
        if p.get("address") != addr:
            issues.append(f"地址: {p.get('address')}")
        if p.get("river") != river:
            issues.append(f"河川: {p.get('river')} vs {river}")
        if p.get("pump_type") != ptype:
            issues.append(f"型式: {p.get('pump_type')} vs {ptype}")
        if abs(c[0] - lon) > 0.0001 or abs(c[1] - lat) > 0.0001:
            issues.append(f"座標: {c} vs [{lon}, {lat}]")
        if issues:
            print(f"【{name}】")
            for i in issues:
                print(f"  ! {i}")
        else:
            print(f"【{name}】 OK")
            ok += 1

    extra = set(by_name) - {n for n, *_ in MASTER_REFERENCE}
    if extra:
        print(f"\n多餘站名: {extra}")
    if len(feats) != len(MASTER_REFERENCE):
        print(f"\n筆數: 預期 {len(MASTER_REFERENCE)}，實際 {len(feats)}")
    print(f"\n通過: {ok}/{len(MASTER_REFERENCE)}")


if __name__ == "__main__":
    main()
