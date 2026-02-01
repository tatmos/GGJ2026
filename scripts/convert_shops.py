"""
お店情報をゲーム座標に変換してゲーム用JSONを生成するスクリプト

1. shops_raw.json（Overpass APIの生データ）を読み込み
2. coord_transform.py の変換パラメータで座標変換
3. ゲーム用の食べ物データ（data/food_spawns.json）を出力
4. ゲーム用の装備データ（data/equipment_spawns.json）を出力
"""

import json
import os
import random
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict

# ============================================================
# 食べ物の定義
# ============================================================

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

# 食べ物系カテゴリの一覧
FOOD_CATEGORIES = set(CATEGORY_TO_FOOD_TYPE.keys())

# ============================================================
# 装備の定義
# ============================================================

# 誕生石（12種類）
BIRTHSTONES = [
    {"id": "garnet", "name": "Garnet", "nameJa": "ガーネット", "color": "#8B0000", "effect": "attack", "value": 0.10},
    {"id": "amethyst", "name": "Amethyst", "nameJa": "アメジスト", "color": "#9966CC", "effect": "buffDuration", "value": 0.15},
    {"id": "aquamarine", "name": "Aquamarine", "nameJa": "アクアマリン", "color": "#7FFFD4", "effect": "recoveryCooldown", "value": -0.10},
    {"id": "diamond", "name": "Diamond", "nameJa": "ダイヤモンド", "color": "#E0E0E0", "effect": "allStats", "value": 0.03},
    {"id": "emerald", "name": "Emerald", "nameJa": "エメラルド", "color": "#50C878", "effect": "speed", "value": 0.10},
    {"id": "pearl", "name": "Pearl", "nameJa": "パール", "color": "#FDEEF4", "effect": "defense", "value": 0.10},
    {"id": "ruby", "name": "Ruby", "nameJa": "ルビー", "color": "#E0115F", "effect": "attack", "value": 0.15},
    {"id": "peridot", "name": "Peridot", "nameJa": "ペリドット", "color": "#E6E200", "effect": "pickupRange", "value": 0.20},
    {"id": "sapphire", "name": "Sapphire", "nameJa": "サファイア", "color": "#0F52BA", "effect": "defense", "value": 0.15},
    {"id": "opal", "name": "Opal", "nameJa": "オパール", "color": "#A8C3BC", "effect": "magnetism", "value": 0.20},
    {"id": "topaz", "name": "Topaz", "nameJa": "トパーズ", "color": "#FFC87C", "effect": "speed", "value": 0.12},
    {"id": "turquoise", "name": "Turquoise", "nameJa": "ターコイズ", "color": "#40E0D0", "effect": "detection", "value": 0.25},
]

# 装備タイプ
EQUIPMENT_TYPES = {
    "bag": {"name": "Bag", "nameJa": "バッグ", "effect": "slotExpand", "value": 2, "color": "#8B4513", "icon": "🎒"},
    "magnet": {"name": "Magnet", "nameJa": "磁石", "effect": "magnetism", "value": 0.30, "color": "#C0C0C0", "icon": "🧲"},
    "shoes": {"name": "Shoes", "nameJa": "靴", "effect": "speed", "value": 0.15, "color": "#FFD700", "icon": "👟"},
    "glasses": {"name": "Glasses", "nameJa": "メガネ", "effect": "detection", "value": 0.30, "color": "#87CEEB", "icon": "👓"},
    "armor": {"name": "Armor", "nameJa": "防具", "effect": "defense", "value": 0.20, "color": "#4169E1", "icon": "🛡️"},
    "weapon": {"name": "Weapon", "nameJa": "武器", "effect": "attack", "value": 0.20, "color": "#DC143C", "icon": "⚔️"},
    "watch": {"name": "Watch", "nameJa": "時計", "effect": "buffDuration", "value": 0.20, "color": "#FFD700", "icon": "⌚"},
    "medicine": {"name": "Medicine", "nameJa": "薬", "effect": "recoveryCooldown", "value": -0.15, "color": "#98FB98", "icon": "💊"},
    "wings": {"name": "Wings", "nameJa": "翼", "effect": "verticalSpeed", "value": 0.25, "color": "#E6E6FA", "icon": "🪽"},
    "bicycle": {"name": "Bicycle", "nameJa": "自転車", "effect": "groundSpeed", "value": 0.30, "color": "#FF6347", "icon": "🚲"},
    "fishing": {"name": "Fishing Rod", "nameJa": "釣り具", "effect": "magnetism", "value": 0.25, "color": "#20B2AA", "icon": "🎣"},
    "hat": {"name": "Hat", "nameJa": "帽子", "effect": "defense", "value": 0.10, "color": "#DDA0DD", "icon": "🎩"},
    "towel": {"name": "Towel", "nameJa": "タオル", "effect": "energyRegen", "value": 0.10, "color": "#FFFACD", "icon": "🧻"},
    "flag": {"name": "Flag", "nameJa": "旗", "effect": "allStats", "value": 0.02, "color": "#FF4500", "icon": "🚩"},
    "clothes": {"name": "Clothes", "nameJa": "服", "effect": "defense", "value": 0.15, "color": "#9370DB", "icon": "👕"},
    "cookware": {"name": "Cookware", "nameJa": "料理道具", "effect": "foodBuffBoost", "value": 0.20, "color": "#FFA07A", "icon": "🍳"},
}

# OSMカテゴリから装備タイプへのマッピング（複数候補の場合はランダム）
CATEGORY_TO_EQUIPMENT = {
    "jewelry": ["gem"],  # 宝石店 → 宝石
    "bag": ["bag"],
    "shoes": ["shoes"],
    "clothes": ["armor", "hat", "clothes"],  # ランダム
    "sports": ["magnet", "weapon", "wings"],  # ランダム
    "electronics": ["magnet"],
    "optician": ["glasses"],
    "watches": ["watch"],
    "pharmacy": ["medicine"],
    "chemist": ["medicine"],
    "bicycle": ["bicycle"],
    "outdoor": ["wings", "fishing"],  # ランダム
    "fishing": ["fishing"],
    "houseware": ["cookware"],
    "department_store": ["towel", "bag", "hat"],  # ランダム
    "gift": ["flag"],
    "variety_store": ["bag", "flag"],  # ランダム
    "hats": ["hat"],
}

# 装備系カテゴリの一覧
EQUIPMENT_CATEGORIES = set(CATEGORY_TO_EQUIPMENT.keys())


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


@dataclass
class EquipmentSpawn:
    """ゲーム用の装備スポーン情報"""
    id: str
    shopName: str
    shopNameJa: str
    shopCategory: str
    itemCategory: str  # "gem" or "equipment"
    typeId: str
    name: str
    nameJa: str
    effect: str
    value: float
    color: str
    icon: str
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


def transform_coordinates(
    lat: float,
    lng: float,
    transform_params: Dict[str, Any]
) -> Tuple[float, float]:
    """緯度経度をゲーム座標に変換"""
    scale_x = transform_params["scale_x"]
    scale_z = transform_params["scale_z"]
    offset_x = transform_params["offset_x"]
    offset_z = transform_params["offset_z"]

    game_x = lng * scale_x + offset_x
    game_z = lat * scale_z + offset_z
    return round(game_x, 2), round(game_z, 2)


def convert_shop_to_food(
    shop: Dict[str, Any],
    transform_params: Dict[str, Any]
) -> Optional[FoodSpawn]:
    """お店情報をFoodSpawnに変換"""
    category = shop["category"]
    
    # 食べ物系カテゴリでなければスキップ
    if category not in FOOD_CATEGORIES:
        return None
    
    lat = shop["lat"]
    lng = shop["lng"]
    game_x, game_z = transform_coordinates(lat, lng, transform_params)

    # カテゴリから食べ物タイプを決定
    food_type = CATEGORY_TO_FOOD_TYPE.get(category, "energy")
    if food_type == "random":
        food_type = random_food_type()

    # tagsから追加情報を取得
    tags = shop.get("tags", {})
    name_ja = tags.get("name:ja", "")
    cuisine = tags.get("cuisine", "")

    return FoodSpawn(
        id=f"food_{shop['osm_id']}",
        name=shop["name"],
        nameJa=name_ja,
        category=category,
        cuisine=cuisine,
        foodTypeId=food_type,
        gameX=game_x,
        gameZ=game_z,
        realLat=lat,
        realLng=lng
    )


def convert_shop_to_equipment(
    shop: Dict[str, Any],
    transform_params: Dict[str, Any]
) -> Optional[EquipmentSpawn]:
    """お店情報をEquipmentSpawnに変換"""
    category = shop["category"]
    
    # 装備系カテゴリでなければスキップ
    if category not in EQUIPMENT_CATEGORIES:
        return None
    
    lat = shop["lat"]
    lng = shop["lng"]
    game_x, game_z = transform_coordinates(lat, lng, transform_params)

    # カテゴリから装備タイプを決定
    equip_types = CATEGORY_TO_EQUIPMENT.get(category, ["bag"])
    selected_type = random.choice(equip_types)
    
    # tagsから追加情報を取得
    tags = shop.get("tags", {})
    shop_name_ja = tags.get("name:ja", "")
    
    # 宝石の場合
    if selected_type == "gem":
        gem = random.choice(BIRTHSTONES)
        return EquipmentSpawn(
            id=f"equip_{shop['osm_id']}",
            shopName=shop["name"],
            shopNameJa=shop_name_ja,
            shopCategory=category,
            itemCategory="gem",
            typeId=gem["id"],
            name=gem["name"],
            nameJa=gem["nameJa"],
            effect=gem["effect"],
            value=gem["value"],
            color=gem["color"],
            icon="💎",
            gameX=game_x,
            gameZ=game_z,
            realLat=lat,
            realLng=lng
        )
    
    # 装備の場合
    equip = EQUIPMENT_TYPES.get(selected_type)
    if not equip:
        return None
    
    return EquipmentSpawn(
        id=f"equip_{shop['osm_id']}",
        shopName=shop["name"],
        shopNameJa=shop_name_ja,
        shopCategory=category,
        itemCategory="equipment",
        typeId=selected_type,
        name=equip["name"],
        nameJa=equip["nameJa"],
        effect=equip["effect"],
        value=equip["value"],
        color=equip["color"],
        icon=equip["icon"],
        gameX=game_x,
        gameZ=game_z,
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
    """食べ物用JSONを保存"""
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


def save_equipment_spawns(spawns: List[EquipmentSpawn], path: str, transform_params: Dict[str, Any]):
    """装備用JSONを保存"""
    data = {
        "version": "1.0",
        "description": "浅草橋駅周辺のお店に基づく装備スポーン位置",
        "transform": transform_params,
        "count": len(spawns),
        "spawns": [asdict(s) for s in spawns]
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"保存完了: {path} ({len(spawns)} 件)")


def print_food_summary(spawns: List[FoodSpawn]):
    """食べ物の変換結果サマリーを表示"""
    print("\n" + "=" * 50)
    print("食べ物変換結果サマリー")
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


def print_equipment_summary(spawns: List[EquipmentSpawn]):
    """装備の変換結果サマリーを表示"""
    print("\n" + "=" * 50)
    print("装備変換結果サマリー")
    print("=" * 50)

    # カテゴリ別集計
    categories: Dict[str, int] = {}
    types: Dict[str, int] = {}
    for spawn in spawns:
        categories[spawn.itemCategory] = categories.get(spawn.itemCategory, 0) + 1
        types[spawn.typeId] = types.get(spawn.typeId, 0) + 1

    print(f"\n総数: {len(spawns)} 件")
    
    print("\nカテゴリ別:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count} 件")
    
    print("\nタイプ別:")
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
        print(f"  - {spawn.icon} {spawn.nameJa} ({spawn.effect}: {spawn.value:+.0%}) @ ({spawn.gameX}, {spawn.gameZ})")


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
    food_output_path = os.path.join(data_dir, "food_spawns.json")
    equipment_output_path = os.path.join(data_dir, "equipment_spawns.json")

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

    # 食べ物の変換
    food_spawns = []
    for shop in shops:
        spawn = convert_shop_to_food(shop, transform_params)
        if spawn:
            food_spawns.append(spawn)

    print_food_summary(food_spawns)
    save_food_spawns(food_spawns, food_output_path, transform_params)
    
    # 装備の変換
    equipment_spawns = []
    for shop in shops:
        spawn = convert_shop_to_equipment(shop, transform_params)
        if spawn:
            equipment_spawns.append(spawn)

    # 保存を先に実行（表示エラーでもデータは保存される）
    save_equipment_spawns(equipment_spawns, equipment_output_path, transform_params)
    
    try:
        print_equipment_summary(equipment_spawns)
    except UnicodeEncodeError:
        # Windows PowerShellで絵文字が表示できない場合
        print(f"\n装備: {len(equipment_spawns)} 件（詳細表示はスキップ）")

    print("\n" + "=" * 50)
    print("変換完了!")
    print(f"  食べ物: {len(food_spawns)} 件 → {food_output_path}")
    print(f"  装備:   {len(equipment_spawns)} 件 → {equipment_output_path}")
    print("=" * 50)
