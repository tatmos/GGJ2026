"""
対応点から変換パラメータを計算し、transform.jsonを更新する
"""
import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(os.path.dirname(script_dir), "data")
input_path = os.path.join(data_dir, "transform.json")
output_path = os.path.join(data_dir, "transform.json")

# 対応点を読み込み
with open(input_path, 'r', encoding='utf-8') as f:
    points = json.load(f)

print('対応点:')
for p in points:
    print(f"  {p['name']}: ({p['lat']}, {p['lng']}) -> ({p['gameX']}, {p['gameZ']})")

if len(points) < 2:
    print("エラー: 2点以上の対応点が必要です")
    exit(1)

# 変換パラメータを計算（2点の場合）
p1, p2 = points[0], points[1]

# scale = (game座標の差) / (緯度経度の差)
dLng = p2['lng'] - p1['lng']
dLat = p2['lat'] - p1['lat']

if abs(dLng) < 1e-10 or abs(dLat) < 1e-10:
    print("エラー: 対応点の緯度または経度が同じです")
    exit(1)

scale_x = (p2['gameX'] - p1['gameX']) / dLng
scale_z = (p2['gameZ'] - p1['gameZ']) / dLat

# offset = game座標 - scale * 緯度経度
offset_x = p1['gameX'] - scale_x * p1['lng']
offset_z = p1['gameZ'] - scale_z * p1['lat']

print(f"\n計算結果:")
print(f"  scale_x (lng→X): {scale_x:.4f}")
print(f"  scale_z (lat→Z): {scale_z:.4f}")
print(f"  offset_x: {offset_x:.4f}")
print(f"  offset_z: {offset_z:.4f}")

# 検証: 各点を変換してみる
print(f"\n検証:")
for p in points:
    calc_x = p['lng'] * scale_x + offset_x
    calc_z = p['lat'] * scale_z + offset_z
    print(f"  {p['name']}: 計算({calc_x:.2f}, {calc_z:.2f}) vs 実際({p['gameX']}, {p['gameZ']})")

# 変換パラメータを保存
transform_params = {
    "scale_x": scale_x,
    "scale_z": scale_z,
    "offset_x": offset_x,
    "offset_z": offset_z,
    "origin": {
        "lat": p1['lat'],
        "lng": p1['lng'],
        "name": p1['name']
    },
    "reference_points": points
}

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(transform_params, f, ensure_ascii=False, indent=2)

print(f"\n変換パラメータを保存: {output_path}")
