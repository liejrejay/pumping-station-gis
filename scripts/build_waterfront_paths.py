#!/usr/bin/env python3
"""建置大漢溪親水廊道線段圖層（LineString）。

1. 從新北市自行車道資料讀取「大漢溪」相關點位（僅作為「此段有河濱自行車道」的依據）
2. 以 data/dahan-river.geojson 河道為準，僅保留距河道在一定範圍內的點
3. 沿河道裁切出有涵蓋的河段 → 輸出親水廊道線（沿路走向，非出入口折線）

輸出: data/dahan-waterfront-paths.geojson

Usage:
    python3 scripts/build_waterfront_paths.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BIKE_SRC = ROOT / "新北市自行車道資料.geojson"
RIVER_PATH = ROOT / "data" / "dahan-river.geojson"
OUT_PATH = ROOT / "data" / "dahan-waterfront-paths.geojson"

# 河濱自行車道在堤外，距河道中心線可能達數百米
MAX_DIST_TO_RIVER_M = 650
# 沿河道每隔多少公尺檢查一次是否有鄰近自行車道點
SAMPLE_STEP_M = 120
# 連續兩個「有涵蓋」樣本點間，允許的最大空隙（公尺），超過則斷線
MAX_GAP_ALONG_RIVER_M = 2200


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin(
        (lon2 - lon1) * p / 2
    ) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def point_segment_dist_m(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return haversine_m(py, px, ay, ax)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    qx, qy = ax + t * dx, ay + t * dy
    return haversine_m(py, px, qy, qx)


def load_bike_points() -> list[tuple[float, float]]:
    if not BIKE_SRC.is_file():
        raise SystemExit(f"找不到 {BIKE_SRC}")
    data = json.loads(BIKE_SRC.read_text(encoding="utf-8"))
    pts: list[tuple[float, float]] = []
    for feat in data.get("features", []):
        props = feat.get("properties") or {}
        loc = props.get("location") or ""
        name = props.get("name") or ""
        if "大漢溪" not in loc:
            continue
        if "租借站" in name:
            continue
        lng, lat = feat["geometry"]["coordinates"]
        pts.append((lng, lat))
    return pts


def load_river_lines() -> list[list[tuple[float, float]]]:
    data = json.loads(RIVER_PATH.read_text(encoding="utf-8"))
    lines: list[list[tuple[float, float]]] = []
    for feat in data.get("features", []):
        coords = feat["geometry"].get("coordinates") or []
        if len(coords) >= 2:
            lines.append([(c[0], c[1]) for c in coords])
    return lines


def min_dist_point_to_lines(lng: float, lat: float, lines: list[list[tuple[float, float]]]) -> float:
    best = float("inf")
    for line in lines:
        for i in range(len(line) - 1):
            ax, ay = line[i]
            bx, by = line[i + 1]
            d = point_segment_dist_m(lng, lat, ax, ay, bx, by)
            if d < best:
                best = d
    return best


def filter_points_near_river(
    pts: list[tuple[float, float]], lines: list[list[tuple[float, float]]]
) -> list[tuple[float, float]]:
    kept = []
    for lng, lat in pts:
        if min_dist_point_to_lines(lng, lat, lines) <= MAX_DIST_TO_RIVER_M:
            kept.append((lng, lat))
    return kept


def densify_line(line: list[tuple[float, float]], step_m: float) -> list[tuple[float, float, float]]:
    """回傳 (lng, lat, dist_from_start)"""
    if len(line) < 2:
        return []
    out: list[tuple[float, float, float]] = []
    acc = 0.0
    ax, ay = line[0]
    out.append((ax, ay, acc))
    for i in range(1, len(line)):
        bx, by = line[i]
        seg_len = haversine_m(ay, ax, by, bx)
        if seg_len <= 0:
            continue
        n = max(1, int(math.ceil(seg_len / step_m)))
        for k in range(1, n + 1):
            t = k / n
            lng = ax + (bx - ax) * t
            lat = ay + (by - ay) * t
            d = haversine_m(ay, ax, lat, lng)
            acc += d
            out.append((lng, lat, acc))
        ax, ay = bx, by
    return out


def near_any_bike(lng: float, lat: float, bikes: list[tuple[float, float]], max_m: float) -> bool:
    for bx, by in bikes:
        if haversine_m(lat, lng, by, bx) <= max_m:
            return True
    return False


def clip_covered_ranges(
    samples: list[tuple[float, float, float]], bikes: list[tuple[float, float]]
) -> list[tuple[int, int]]:
    covered = [
        near_any_bike(lng, lat, bikes, MAX_DIST_TO_RIVER_M) for lng, lat, _ in samples
    ]
    ranges: list[tuple[int, int]] = []
    start = None
    last_i = -1
    for i, ok in enumerate(covered):
        if ok:
            if start is None:
                start = i
            last_i = i
        elif start is not None:
            if last_i - start >= 1:
                ranges.append((start, last_i))
            start = None
    if start is not None and last_i - start >= 1:
        ranges.append((start, last_i))
    return ranges


def merge_ranges(ranges: list[tuple[int, int]], samples: list[tuple[float, float, float]]) -> list[tuple[int, int]]:
    if not ranges:
        return []
    merged = [ranges[0]]
    for s, e in ranges[1:]:
        ps, pe = merged[-1]
        gap_m = samples[s][2] - samples[pe][2]
        if gap_m <= MAX_GAP_ALONG_RIVER_M:
            merged[-1] = (ps, e)
        else:
            merged.append((s, e))
    return merged


def range_to_linestring(samples: list[tuple[float, float, float]], s: int, e: int) -> list[list[float]]:
    coords = [[samples[i][0], samples[i][1]] for i in range(s, e + 1)]
    # 去重相鄰重複
    dedup = [coords[0]]
    for c in coords[1:]:
        if c != dedup[-1]:
            dedup.append(c)
    return dedup if len(dedup) >= 2 else []


def main() -> None:
    if not RIVER_PATH.is_file():
        raise SystemExit(f"請先建立河道圖資: {RIVER_PATH}")

    river_lines = load_river_lines()
    raw_bikes = load_bike_points()
    bikes = filter_points_near_river(raw_bikes, river_lines)

    features = []
    seg_id = 0
    for river_line in river_lines:
        samples = densify_line(river_line, SAMPLE_STEP_M)
        if len(samples) < 2:
            continue
        ranges = merge_ranges(clip_covered_ranges(samples, bikes), samples)
        for s, e in ranges:
            coords = range_to_linestring(samples, s, e)
            if len(coords) < 2:
                continue
            seg_id += 1
            length_m = samples[e][2] - samples[s][2]
            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": {
                        "name": "大漢溪親水自行車道",
                        "category": "親水廊道",
                        "river": "大漢溪",
                        "segment_id": seg_id,
                        "length_m": round(length_m),
                        "source": "河道裁切＋新北市自行車道出入口（空間篩選）",
                    },
                }
            )

    collection = {
        "type": "FeatureCollection",
        "name": "dahan-waterfront-paths",
        "description": "大漢溪流域親水廊道（沿河道線段；僅含距河道與河濱自行車道涵蓋之河段）",
        "metadata": {
            "max_dist_to_river_m": MAX_DIST_TO_RIVER_M,
            "bike_points_raw": len(raw_bikes),
            "bike_points_near_river": len(bikes),
            "line_segments": len(features),
        },
        "features": features,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(collection, ensure_ascii=False, indent=2), encoding="utf-8")
    meta = collection["metadata"]
    print(
        f"✅ 親水廊道 {len(features)} 段 → {OUT_PATH.relative_to(ROOT)}\n"
        f"   自行車道點 {meta['bike_points_raw']} → 河道範圍內 {meta['bike_points_near_river']}"
    )


if __name__ == "__main__":
    main()
