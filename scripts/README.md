# 地図データ処理スクリプト

浅草橋駅周辺のお店情報を取得し、ゲーム座標に変換するPythonスクリプト群。

## 必要環境

- Python 3.8+
- 追加ライブラリ不要（標準ライブラリのみ使用）

## スクリプト一覧

| ファイル | 説明 |
|----------|------|
| `coord_transform.py` | 座標変換モジュール（緯度経度 ↔ ゲーム座標） |
| `fetch_shops.py` | Overpass API でお店情報を取得 |
| `convert_shops.py` | お店情報をゲーム座標に変換 |

## 使い方

### Step 1: お店情報を取得

```bash
cd scripts
python fetch_shops.py
```

- Overpass API（OpenStreetMap）から浅草橋駅周辺500mのお店を取得
- 出力: `data/shops_raw.json`

### Step 2: 対応点を設定

ゲーム内で特徴的なランドマーク（浅草橋駅など）のゲーム座標を確認し、`data/transform.json` を編集:

```json
{
  "scale_x": 11132.0,
  "scale_z": -11132.0,
  "offset_x": 0.0,
  "offset_z": 0.0,
  "origin": {
    "lat": 35.6963,
    "lng": 139.7832,
    "name": "浅草橋駅"
  }
}
```

または、`coord_transform.py` の `reference_points` に対応点を設定して実行:

```bash
python coord_transform.py
```

### Step 3: ゲーム座標に変換

```bash
python convert_shops.py
```

- 出力: `data/food_spawns.json`

### Step 4: ゲームで使用

`food_spawns.json` を `food.js` で読み込んで食べ物を配置。

## 出力ファイル

### data/shops_raw.json

OSMから取得した生データ:

```json
{
  "version": "1.0",
  "source": "OpenStreetMap (Overpass API)",
  "shops": [
    {
      "osm_id": 123456,
      "name": "○○食堂",
      "category": "restaurant",
      "lat": 35.6970,
      "lng": 139.7840,
      "tags": { ... }
    }
  ]
}
```

### data/food_spawns.json

ゲーム用データ:

```json
{
  "version": "1.0",
  "transform": { ... },
  "spawns": [
    {
      "id": "shop_123456",
      "name": "○○食堂",
      "category": "restaurant",
      "foodTypeId": "energy",
      "gameX": 12.5,
      "gameZ": -8.3,
      "realLat": 35.6970,
      "realLng": 139.7840
    }
  ]
}
```

## カテゴリと食べ物タイプの対応

| OSMカテゴリ | ゲームの食べ物タイプ |
|-------------|----------------------|
| restaurant, food_court, deli, bakery, confectionery | `energy`（黄） |
| cafe, bar, pub | `speedUp`（緑） |
| fast_food | `recoveryCooldownShort`（青） |
| convenience, supermarket | ランダム |

## 座標変換について

PLATEAUモデルは平面直角座標系（メートル単位）で出力されています。
実世界の緯度・経度との対応を取るには、ゲーム内の2点以上のランドマーク座標を手動で確認し、線形変換係数を計算します。

詳細は `coord_transform.py` のコメントを参照。
