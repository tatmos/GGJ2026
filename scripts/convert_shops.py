"""
お店情報をゲーム座標に変換してゲーム用JSONを生成するスクリプト

1. shops_raw.json（Overpass APIの生データ）を読み込み
2. coord_transform.py の変換パラメータで座標変換
3. ゲーム用の食べ物データ（data/food_spawns.json）を出力
"""

import json
import os
import random
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict

# 食べ物の種類とカテゴリのマッピング
# OSMのカテゴリ → ゲームのfoodTypeId
CATEGORY_TO_FOOD_TYPE = {
    # 飲食店系 → エネルギー回復
    "restaurant": "energy",
    "food_court": "energy",
    "deli": "energy",

    # カフェ・バー系 → 速度Up（カフェイン的な）
    "cafe": "speedUp",
    "bar": "speedUp",
    "pub": "speedUp",

    # ファストフード → 回復短縮（素早い）
    "fast_food": "recoveryCooldownShort",

    # コンビニ・スーパー → ランダム
    "convenience": "random",
    "supermarket": "random",

    # パン・お菓子 → エネルギー
    "bakery": "energy",
    "confectionery": "energy",
}

# ゲーム内での食べ物の出現率（CATEGORY_TO_FOOD_TYPE が "random" の場合）
RANDOM_WEIGHTS = {
    "energy": 70,
    "speedUp": 20,
    "recoveryCooldownShort": 10,
}


@dataclass
class FoodSpawn:
    """ゲーム用の食べ物スポーン情報"""
    id: str
    name: str
    nameJa: str  # 日本語名
    category: str
    cuisine: str  # 料理ジャンル
    foodTypeId: str
    gameX: float
    gameZ: float
    realLat: float
    realLng: float


def random_food_type() -> str:
    """ランダムで食べ物タイプを選択"""
    total = sum(RANDOM_WEIGHTS.values())
    r = random.random() * total
    for type_id, weight in RANDOM_WEIGHTS.items():
        r -= weight
        if r <= 0:
            return type_id
    return "energy"


def convert_shop_to_food(
    shop: Dict[str, Any],
    transform_params: Dict[str, Any]
) -> Optional[FoodSpawn]:
    """お店情報をFoodSpawnに変換"""
    lat = shop["lat"]
    lng = shop["lng"]

    # 座標変換
    scale_x = transform_params["scale_x"]
    scale_z = transform_params["scale_z"]
    offset_x = transform_params["offset_x"]
    offset_z = transform_params["offset_z"]

    game_x = lng * scale_x + offset_x
    game_z = lat * scale_z + offset_z

    # カテゴリから食べ物タイプを決定
    category = shop["category"]
    food_type = CATEGORY_TO_FOOD_TYPE.get(category, "energy")
    if food_type == "random":
        food_type = random_food_type()

    # tagsから追加情報を取得
    tags = shop.get("tags", {})
    name_ja = tags.get("name:ja", "")
    cuisine = tags.get("cuisine", "")

    return FoodSpawn(
        id=f"shop_{shop['osm_id']}",
        name=shop["name"],
        nameJa=name_ja,
        category=category,
        cuisine=cuisine,
        foodTypeId=food_type,
        gameX=round(game_x, 2),
        gameZ=round(game_z, 2),
        realLat=lat,
        realLng=lng
    )


def load_shops_raw(path: str) -> List[Dict[str, Any]]:
    """shops_raw.json を読み込み"""
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get("shops", [])


def load_transform_params(path: str) -> Dict[str, Any]:
    """変換パラメータを読み込み"""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_food_spawns(spawns: List[FoodSpawn], path: str, transform_params: Dict[str, Any]):
    """ゲーム用JSONを保存"""
    data = {
        "version": "1.0",
        "description": "浅草橋駅周辺のお店に基づく食べ物スポーン位置",
        "transform": transform_params,
        "count": len(spawns),
        "spawns": [asdict(s) for s in spawns]
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"保存完了: {path} ({len(spawns)} 件)")


def print_summary(spawns: List[FoodSpawn]):
    """変換結果のサマリーを表示"""
    print("\n" + "=" * 50)
    print("変換結果サマリー")
    print("=" * 50)

    # 食べ物タイプ別集計
    types: Dict[str, int] = {}
    for spawn in spawns:
        types[spawn.foodTypeId] = types.get(spawn.foodTypeId, 0) + 1

    print(f"\n総数: {len(spawns)} 件")
    print("\n食べ物タイプ別:")
    for type_id, count in sorted(types.items(), key=lambda x: -x[1]):
        print(f"  {type_id}: {count} 件")

    # 座標範囲
    if spawns:
        min_x = min(s.gameX for s in spawns)
        max_x = max(s.gameX for s in spawns)
        min_z = min(s.gameZ for s in spawns)
        max_z = max(s.gameZ for s in spawns)
        print(f"\nゲーム座標範囲:")
        print(f"  X: {min_x:.2f} ~ {max_x:.2f}")
        print(f"  Z: {min_z:.2f} ~ {max_z:.2f}")

    print("\n最初の10件:")
    for spawn in spawns[:10]:
        print(f"  - {spawn.name} ({spawn.foodTypeId}) @ ({spawn.gameX}, {spawn.gameZ})")


# ============================================================
# 仮の変換パラメータ（対応点を設定するまでのテスト用）
# ============================================================
DEFAULT_TRANSFORM_PARAMS = {
    "scale_x": 11132.0,   # 経度1度 ≒ 約91km（東京付近） → 調整が必要
    "scale_z": -11132.0,  # 緯度1度 ≒ 約111km、符号反転（北が+Z）
    "offset_x": -1556000.0,  # 139.78 * 11132 ≒ 1556000 を引いて原点に
    "offset_z": 397500.0,    # 35.70 * 11132 ≒ 397500 を足して原点に
    "origin": {
        "lat": 35.6963,
        "lng": 139.7832,
        "name": "浅草橋駅（仮）"
    }
}


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(script_dir), "data")

    shops_raw_path = os.path.join(data_dir, "shops_raw.json")
    transform_path = os.path.join(data_dir, "transform.json")
    output_path = os.path.join(data_dir, "food_spawns.json")

    print("=" * 50)
    print("お店情報をゲーム座標に変換")
    print("=" * 50)

    # shops_raw.json の存在確認
    if not os.path.exists(shops_raw_path):
        print(f"\nエラー: {shops_raw_path} が見つかりません")
        print("先に fetch_shops.py を実行してください")
        exit(1)

    # 変換パラメータの読み込み（なければ仮パラメータを使用）
    if os.path.exists(transform_path):
        print(f"\n変換パラメータを読み込み: {transform_path}")
        transform_params = load_transform_params(transform_path)
    else:
        print(f"\n変換パラメータが見つかりません: {transform_path}")
        print("仮のパラメータを使用します（対応点を設定後に再実行してください）")
        transform_params = DEFAULT_TRANSFORM_PARAMS

        # 仮パラメータを保存
        os.makedirs(data_dir, exist_ok=True)
        with open(transform_path, 'w', encoding='utf-8') as f:
            json.dump(transform_params, f, ensure_ascii=False, indent=2)
        print(f"仮パラメータを保存: {transform_path}")

    # 変換実行
    shops = load_shops_raw(shops_raw_path)
    print(f"\nお店データ読み込み: {len(shops)} 件")

    spawns = []
    for shop in shops:
        spawn = convert_shop_to_food(shop, transform_params)
        if spawn:
            spawns.append(spawn)

    print_summary(spawns)
    save_food_spawns(spawns, output_path, transform_params)

    print("\n" + "=" * 50)
    print("次のステップ:")
    print("1. ゲームを起動して対応点のゲーム座標を確認")
    print("2. data/transform.json を更新")
    print("3. このスクリプトを再実行")
    print("4. food.js を修正して food_spawns.json を読み込む")
    print("=" * 50)
