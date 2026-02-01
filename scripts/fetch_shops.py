"""
Overpass API（OpenStreetMap）からお店情報を取得するスクリプト

浅草橋駅周辺の飲食店・コンビニ等を取得し、JSONで保存する。
"""

import json
import urllib.request
import urllib.parse
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict

# Overpass API エンドポイント
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# 浅草橋駅の座標（中心点）
DEFAULT_CENTER_LAT = 35.6963
DEFAULT_CENTER_LNG = 139.7832
DEFAULT_RADIUS_M = 500  # 検索半径（メートル）


@dataclass
class Shop:
    """お店情報"""
    osm_id: int
    name: str
    name_en: Optional[str]
    category: str  # restaurant, cafe, convenience, etc.
    lat: float
    lng: float
    tags: Dict[str, str]  # OSMの全タグ


def build_overpass_query(center_lat: float, center_lng: float, radius_m: int) -> str:
    """
    Overpass QL クエリを構築。
    飲食店・カフェ・コンビニ・ファストフード等を検索。
    """
    # 検索対象のタグ
    amenities = [
        "restaurant",
        "cafe",
        "fast_food",
        "bar",
        "pub",
        "food_court",
    ]
    shops = [
        "convenience",
        "supermarket",
        "bakery",
        "confectionery",
        "deli",
    ]

    amenity_filter = "|".join(amenities)
    shop_filter = "|".join(shops)

    query = f"""
[out:json][timeout:30];
(
  node["amenity"~"^({amenity_filter})$"](around:{radius_m},{center_lat},{center_lng});
  node["shop"~"^({shop_filter})$"](around:{radius_m},{center_lat},{center_lng});
  way["amenity"~"^({amenity_filter})$"](around:{radius_m},{center_lat},{center_lng});
  way["shop"~"^({shop_filter})$"](around:{radius_m},{center_lat},{center_lng});
);
out center tags;
"""
    return query.strip()


def fetch_overpass(query: str) -> Dict[str, Any]:
    """Overpass API にクエリを送信して結果を取得"""
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(OVERPASS_URL, data=data, method="POST")
    req.add_header("User-Agent", "GGJ2026-ShopFetcher/1.0")

    print(f"Overpass API にリクエスト中...")
    with urllib.request.urlopen(req, timeout=60) as response:
        result = json.loads(response.read().decode("utf-8"))
    print(f"取得完了: {len(result.get('elements', []))} 件")
    return result


def parse_element(elem: Dict[str, Any]) -> Optional[Shop]:
    """OSM要素をShopオブジェクトに変換"""
    tags = elem.get("tags", {})
    name = tags.get("name")

    # 名前がないものはスキップ
    if not name:
        return None

    # カテゴリ判定
    category = tags.get("amenity") or tags.get("shop") or "other"

    # 座標取得（wayの場合はcenterを使用）
    if elem["type"] == "node":
        lat = elem["lat"]
        lng = elem["lon"]
    elif "center" in elem:
        lat = elem["center"]["lat"]
        lng = elem["center"]["lon"]
    else:
        return None

    return Shop(
        osm_id=elem["id"],
        name=name,
        name_en=tags.get("name:en"),
        category=category,
        lat=lat,
        lng=lng,
        tags=tags
    )


def fetch_shops(
    center_lat: float = DEFAULT_CENTER_LAT,
    center_lng: float = DEFAULT_CENTER_LNG,
    radius_m: int = DEFAULT_RADIUS_M
) -> List[Shop]:
    """お店情報を取得"""
    query = build_overpass_query(center_lat, center_lng, radius_m)
    result = fetch_overpass(query)

    shops = []
    for elem in result.get("elements", []):
        shop = parse_element(elem)
        if shop:
            shops.append(shop)

    # 名前でソート
    shops.sort(key=lambda s: s.name)
    return shops


def save_shops_raw(shops: List[Shop], path: str):
    """お店情報をJSONで保存（座標変換前）"""
    data = {
        "version": "1.0",
        "source": "OpenStreetMap (Overpass API)",
        "center": {
            "lat": DEFAULT_CENTER_LAT,
            "lng": DEFAULT_CENTER_LNG
        },
        "radius_m": DEFAULT_RADIUS_M,
        "count": len(shops),
        "shops": [asdict(s) for s in shops]
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"保存完了: {path} ({len(shops)} 件)")


def print_summary(shops: List[Shop]):
    """取得結果のサマリーを表示"""
    print("\n" + "=" * 50)
    print("取得結果サマリー")
    print("=" * 50)

    # カテゴリ別集計
    categories: Dict[str, int] = {}
    for shop in shops:
        categories[shop.category] = categories.get(shop.category, 0) + 1

    print(f"\n総数: {len(shops)} 件")
    print("\nカテゴリ別:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count} 件")

    print("\n最初の10件:")
    for shop in shops[:10]:
        print(f"  - {shop.name} ({shop.category})")


if __name__ == "__main__":
    import os

    print("=" * 50)
    print("浅草橋駅周辺のお店情報を取得")
    print("=" * 50)
    print(f"中心: {DEFAULT_CENTER_LAT}, {DEFAULT_CENTER_LNG}")
    print(f"半径: {DEFAULT_RADIUS_M}m")
    print()

    try:
        shops = fetch_shops()
        print_summary(shops)

        # 保存先
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.join(os.path.dirname(script_dir), "data")
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "shops_raw.json")

        save_shops_raw(shops, output_path)

        print("\n" + "=" * 50)
        print("次のステップ:")
        print("1. coord_transform.py で対応点を設定")
        print("2. convert_shops.py で座標変換してゲーム用JSONを生成")
        print("=" * 50)

    except Exception as e:
        print(f"エラー: {e}")
        raise
