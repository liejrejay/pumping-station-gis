# -*- coding: utf-8 -*-
import json
from collections import Counter
from math import radians, sin, cos, sqrt, atan2
from pathlib import Path

REF = [
    ("華江抽水站", 86, "板橋區長江路2段311巷18號之1", "大漢溪", "豎軸式"),
    ("新海抽水站", 86, "板橋區中正路511號", "大漢溪", "豎軸式"),
    ("湳仔溝抽水站", 84, "板橋區環河西路5段500號", "大漢溪", "豎軸式"),
    ("湳仔溝二抽水站", 95, "板橋區環河西路5段500號", "大漢溪", "豎軸式"),
    ("土城抽水站含臨時站", 85, "土城區擺接堡路301號", "大漢溪", "豎軸式及沉水式"),
    ("沙崙抽水站", 95, "板橋區溪城路90-2號", "大漢溪", "豎軸式"),
    ("西盛抽水站", 85, "新莊區環漢路3段530號", "大漢溪", "豎軸式"),
    ("塔寮坑抽水站", 86, "新莊區環漢路630號", "大漢溪", "豎軸式"),
    ("塔寮坑二抽水站", 105, "新莊區環漢路2段535號", "大漢溪", "豎軸式"),
    ("公館溝抽水站", 95, "新莊區環漢路2段385號", "大漢溪", "豎軸式"),
    ("新莊抽水站", 86, "新莊區環漢路2段142號", "大漢溪", "豎軸式"),
    ("重新抽水站", 93, "三重區中興南街82號", "大漢溪", "豎軸式"),
]


def norm_addr(a):
    return (a or "").replace("新北市", "").replace("臺北市", "").replace("台北市", "").strip()


def roc(ce):
    return ce - 1911 if ce else None


def dist_m(c1, c2):
    R = 6371000
    la1, lo1, la2, lo2 = map(radians, [c1[1], c1[0], c2[1], c2[0]])
    h = sin((la2 - la1) / 2) ** 2 + cos(la1) * cos(la2) * sin((lo2 - lo1) / 2) ** 2
    return 2 * R * atan2(sqrt(h), sqrt(1 - h))


def main():
    path = Path(__file__).resolve().parent.parent / "data" / "pumping-stations.geojson"
    feats = json.loads(path.read_text(encoding="utf-8"))["features"]
    official = [f for f in feats if f["properties"].get("source") == "NTPC open data"]
    legacy = [f for f in feats if f["properties"].get("source") != "NTPC open data"]

    print("=== 對照表 12 站 vs GeoJSON ===\n")
    for name, roc_y, addr, river, ptype in REF:
        ce = roc_y + 1911
        matches = [f for f in feats if name in (f["properties"].get("name") or "")]
        print(f"【{name}】")
        if not matches:
            print("  MISSING in geojson\n")
            continue
        for f in matches:
            p = f["properties"]
            issues = []
            if p.get("year_ce") != ce:
                issues.append(
                    f"year: data {p.get('year_ce')} (ROC {roc(p.get('year_ce'))}) vs table CE {ce} (ROC {roc_y})"
                )
            na = norm_addr(p.get("address"))
            if norm_addr(addr) not in na:
                issues.append(f"address: {p.get('address')} vs {addr}")
            if p.get("river") != river:
                issues.append(f"river: {p.get('river')}")
            pt = p.get("pump_type") or ""
            if name not in ("湳仔溝抽水站", "湳仔溝二抽水站"):
                if pt != ptype:
                    issues.append(f"pump_type: {pt or '(empty)'} vs {ptype}")
            if issues:
                print(f"  name field: {p.get('name')} (id={p.get('id')})")
                for i in issues:
                    print(f"  ! {i}")
            else:
                print(f"  OK (id={p.get('id')})")
        print()

    print("=== MERGE/SPLIT ===")
    for f in official:
        if "/" in (f["properties"].get("name") or ""):
            print(f"  - {f['properties']['name']} (should be 2 separate stations)")

    print("\n=== COORD DUPLICATE (official, <50m) ===")
    for i, a in enumerate(official):
        for b in official[i + 1 :]:
            d = dist_m(a["geometry"]["coordinates"], b["geometry"]["coordinates"])
            if d < 50:
                print(f"  - {a['properties']['name']} <-> {b['properties']['name']} {d:.0f}m")

    print(f"\n=== LEGACY ({len(legacy)} stations) ===")
    print(f"  missing year_ce: {sum(1 for f in legacy if f['properties'].get('year_ce') is None)}")
    print(f"  missing pump_type: {sum(1 for f in legacy if not f['properties'].get('pump_type'))}")

    names = [f["properties"].get("name") for f in feats]
    dup = {n: c for n, c in Counter(names).items() if c > 1}
    print("\n=== DUPLICATE NAMES ===")
    for n, c in sorted(dup.items(), key=lambda x: -x[1]):
        print(f"  - {n} x{c}")

    print("\n=== LEGACY vs OFFICIAL address overlap ===")
    off = [(norm_addr(f["properties"].get("address")), f["properties"]["name"], f["properties"]["id"]) for f in official]
    for f in legacy:
        la = norm_addr(f["properties"].get("address"))
        for oa, on, oid in off:
            if not la or not oa:
                continue
            key_parts = ["環漢路二段142", "環漢路2段142", "環漢路二段630", "環漢路630", "環漢路二段535", "環漢路2段535"]
            if any(k.replace("二", "2") in la.replace("二", "2") and k.replace("二", "2") in oa.replace("二", "2") for k in key_parts):
                print(f"  - id{f['properties']['id']} {f['properties']['name']}")
                print(f"    addr: {f['properties'].get('address')}")
                print(f"    may duplicate id{oid} {on} ({oa})")


if __name__ == "__main__":
    main()
