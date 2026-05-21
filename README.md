# 大漢溪抽水站 GIS

將 Plus Code 抽水站地點轉為 GeoJSON，並提供互動地圖。

## 檔案

| 檔案 | 說明 |
|------|------|
| `data/pumping-stations.geojson` | 60 處抽水站（GeoJSON FeatureCollection） |
| `index.html` | Leaflet 互動地圖 |
| `scripts/build_geojson.py` | 從 Plus Code 重新產生 GeoJSON |

## 在 geojson.io 使用

1. 開啟 [geojson.io](https://geojson.io)
2. **Open** → 選擇 `data/pumping-stations.geojson`，或直接拖曳檔案到頁面
3. 即可檢視、編輯與匯出

## 本機地圖網站

```bash
cd GIS
python3 -m http.server 8080
```

瀏覽器開啟：http://localhost:8080

## 重新產生 GeoJSON

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python scripts/build_geojson.py
```
