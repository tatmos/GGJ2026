"""
座標変換モジュール

実世界の緯度・経度をゲーム座標に変換する。
2点以上の対応点から線形変換係数を計算。
"""

import json
from dataclasses import dataclass
from typing import Tuple, List, Optional


@dataclass
class ReferencePoint:
    """対応点（実世界座標とゲーム座標のペア）"""
    name: str
    lat: float  # 緯度
    lng: float  # 経度
    game_x: float  # ゲームX座標
    game_z: float  # ゲームZ座標


@dataclass
class TransformParams:
    """座標変換パラメータ"""
    scale_x: float  # 経度 → ゲームX の係数
    scale_z: float  # 緯度 → ゲームZ の係数
    offset_x: float
    offset_z: float
    origin_lat: float
    origin_lng: float
    origin_name: str

    def to_dict(self) -> dict:
        return {
            "scale_x": self.scale_x,
            "scale_z": self.scale_z,
            "offset_x": self.offset_x,
            "offset_z": self.offset_z,
            "origin": {
                "lat": self.origin_lat,
                "lng": self.origin_lng,
                "name": self.origin_name
            }
        }

    def real_to_game(self, lat: float, lng: float) -> Tuple[float, float]:
        """緯度・経度をゲーム座標に変換"""
        x = lng * self.scale_x + self.offset_x
        z = lat * self.scale_z + self.offset_z
        return (round(x, 2), round(z, 2))

    def game_to_real(self, game_x: float, game_z: float) -> Tuple[float, float]:
        """ゲーム座標を緯度・経度に変換"""
        lng = (game_x - self.offset_x) / self.scale_x
        lat = (game_z - self.offset_z) / self.scale_z
        return (lat, lng)


def calculate_transform(points: List[ReferencePoint]) -> TransformParams:
    """
    2点以上の対応点から変換パラメータを計算（最小二乗法）。
    2点の場合は厳密解、3点以上は近似解。
    """
    if len(points) < 2:
        raise ValueError("最低2点の対応点が必要です")

    # 最小二乗法で scale と offset を計算
    # x = scale_x * lng + offset_x
    # z = scale_z * lat + offset_z

    n = len(points)
    sum_lat = sum(p.lat for p in points)
    sum_lng = sum(p.lng for p in points)
    sum_x = sum(p.game_x for p in points)
    sum_z = sum(p.game_z for p in points)

    sum_lat2 = sum(p.lat ** 2 for p in points)
    sum_lng2 = sum(p.lng ** 2 for p in points)
    sum_lat_z = sum(p.lat * p.game_z for p in points)
    sum_lng_x = sum(p.lng * p.game_x for p in points)

    # scale_x = (n * sum(lng*x) - sum(lng)*sum(x)) / (n * sum(lng^2) - sum(lng)^2)
    denom_x = n * sum_lng2 - sum_lng ** 2
    denom_z = n * sum_lat2 - sum_lat ** 2

    if abs(denom_x) < 1e-10 or abs(denom_z) < 1e-10:
        raise ValueError("対応点が直線上にあり、変換を計算できません")

    scale_x = (n * sum_lng_x - sum_lng * sum_x) / denom_x
    scale_z = (n * sum_lat_z - sum_lat * sum_z) / denom_z

    offset_x = (sum_x - scale_x * sum_lng) / n
    offset_z = (sum_z - scale_z * sum_lat) / n

    # 原点は最初の点を使用
    origin = points[0]

    return TransformParams(
        scale_x=scale_x,
        scale_z=scale_z,
        offset_x=offset_x,
        offset_z=offset_z,
        origin_lat=origin.lat,
        origin_lng=origin.lng,
        origin_name=origin.name
    )


def save_transform(params: TransformParams, path: str):
    """変換パラメータをJSONで保存"""
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(params.to_dict(), f, ensure_ascii=False, indent=2)
    print(f"変換パラメータを保存: {path}")


def load_transform(path: str) -> TransformParams:
    """変換パラメータをJSONから読み込み"""
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return TransformParams(
        scale_x=data["scale_x"],
        scale_z=data["scale_z"],
        offset_x=data["offset_x"],
        offset_z=data["offset_z"],
        origin_lat=data["origin"]["lat"],
        origin_lng=data["origin"]["lng"],
        origin_name=data["origin"]["name"]
    )


# ============================================================
# 使用例・テスト
# ============================================================

if __name__ == "__main__":
    # ============================================================
    # 対応点の設定（ゲーム内で確認して埋める）
    # ============================================================
    # 
    # 手順:
    # 1. ゲームを起動し、浅草橋駅付近の特徴的な場所に移動
    # 2. デバッグUIのPOS表示でゲーム座標を確認
    # 3. Google Mapsで同じ場所の緯度・経度を確認
    # 4. 下記の reference_points に追加
    #
    # 浅草橋駅: 約 35.6963, 139.7832
    # ============================================================

    # TODO: 実際のゲーム座標を確認して設定
    reference_points = [
        ReferencePoint(
            name="浅草橋駅",
            lat=35.6963,
            lng=139.7832,
            game_x=0.0,    # ← ゲーム内で確認して設定
            game_z=0.0     # ← ゲーム内で確認して設定
        ),
        ReferencePoint(
            name="蔵前橋通り交差点",  # 例
            lat=35.6980,
            lng=139.7850,
            game_x=20.0,   # ← ゲーム内で確認して設定
            game_z=-20.0   # ← ゲーム内で確認して設定
        ),
    ]

    print("=" * 50)
    print("座標変換テスト（仮の対応点）")
    print("=" * 50)

    try:
        params = calculate_transform(reference_points)
        print(f"\n変換パラメータ:")
        print(f"  scale_x (lng→X): {params.scale_x:.4f}")
        print(f"  scale_z (lat→Z): {params.scale_z:.4f}")
        print(f"  offset_x: {params.offset_x:.4f}")
        print(f"  offset_z: {params.offset_z:.4f}")

        # テスト変換
        test_lat, test_lng = 35.6970, 139.7840
        x, z = params.real_to_game(test_lat, test_lng)
        print(f"\nテスト変換:")
        print(f"  入力: lat={test_lat}, lng={test_lng}")
        print(f"  出力: game_x={x}, game_z={z}")

        # 逆変換で検証
        lat2, lng2 = params.game_to_real(x, z)
        print(f"  逆変換: lat={lat2:.6f}, lng={lng2:.6f}")

    except ValueError as e:
        print(f"エラー: {e}")

    print("\n" + "=" * 50)
    print("次のステップ:")
    print("1. ゲームを起動して対応点のゲーム座標を確認")
    print("2. reference_points を更新")
    print("3. 再度このスクリプトを実行して変換パラメータを確認")
    print("=" * 50)
