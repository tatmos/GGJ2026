# 永続アイテム（装備・宝石）仕様書

## 概要

永続アイテムは、取得すると**装備スロット**に入り、所持している間ずっと効果が続くアイテム。
食べ物（一時バフ）とは異なり、スロットに空きがある限り効果が継続する。

---

## スロットシステム

| 項目 | 値 |
|------|-----|
| 初期スロット数 | 5 |
| バッグ1つあたり | +2枠 |
| 宝石と装備 | 同じ枠を共有 |
| バッグ | **別枠・無制限** |

- スロットが満杯の場合、新しいアイテムは取得できない（または交換選択）
- **バッグは別枠**（無制限に取得可能）で、取得するたびに装備スロットが+2される

---

## 宝石（Gem）

### 誕生石 12種類

| 月 | 英名 | 日本語名 | 色コード | 効果 | 効果値 |
|----|------|----------|----------|------|--------|
| 1 | garnet | ガーネット | #8B0000 | attack | +10% |
| 2 | amethyst | アメジスト | #9966CC | buffDuration | +15% |
| 3 | aquamarine | アクアマリン | #7FFFD4 | recoveryCooldown | -10% |
| 4 | diamond | ダイヤモンド | #E0E0E0 | allStats | +3% |
| 5 | emerald | エメラルド | #50C878 | speed | +10% |
| 6 | pearl | パール | #FDEEF4 | defense | +10% |
| 7 | ruby | ルビー | #E0115F | attack | +15% |
| 8 | peridot | ペリドット | #E6E200 | pickupRange | +20% |
| 9 | sapphire | サファイア | #0F52BA | defense | +15% |
| 10 | opal | オパール | #A8C3BC | magnetism | +20% |
| 11 | topaz | トパーズ | #FFC87C | speed | +12% |
| 12 | turquoise | ターコイズ | #40E0D0 | detection | +25% |

### 出現条件

- `shop=jewelry` のお店から出現
- 12種類からランダム選択（均等確率）
- レア度なし（全て同じ価値）

---

## 装備（Equipment）

### 装備タイプ一覧

| typeId | 名前 | 効果 | 効果値 | 出現元（OSMカテゴリ） | 色 |
|--------|------|------|--------|---------------------|-----|
| bag | バッグ | slotExpand | +2 | bag, variety_store | #8B4513 |
| magnet | 磁石 | magnetism | +30% | sports, electronics | #C0C0C0 |
| shoes | 靴 | speed | +15% | shoes | #FFD700 |
| glasses | メガネ | detection | +30% | optician | #87CEEB |
| armor | 防具 | defense | +20% | clothes (部分) | #4169E1 |
| weapon | 武器 | attack | +20% | sports (部分) | #DC143C |
| watch | 時計 | buffDuration | +20% | jewelry, watches | #FFD700 |
| medicine | 薬 | recoveryCooldown | -15% | pharmacy, chemist | #98FB98 |
| wings | 翼 | verticalSpeed | +25% | sports, outdoor | #E6E6FA |
| bicycle | 自転車 | groundSpeed | +30% | bicycle | #FF6347 |
| fishing | 釣り具 | magnetism | +25% | outdoor | #20B2AA |
| hat | 帽子 | defense | +10% | clothes, hats | #DDA0DD |
| towel | タオル | energyRegen | +10% | department_store | #FFFACD |
| flag | 旗 | allStats | +2% | gift, variety_store | #FF4500 |
| clothes | 服 | defense | +15% | clothes | #9370DB |
| cookware | 料理道具 | foodBuffBoost | +20% | houseware | #FFA07A |

### OSMカテゴリと装備のマッピング

```
shop=bag → bag
shop=shoes → shoes
shop=sports → magnet, weapon, wings (ランダム)
shop=electronics → magnet
shop=optician → glasses
shop=clothes → armor, hat, clothes (ランダム)
shop=jewelry → 宝石（装備ではない）
shop=watches → watch
amenity=pharmacy → medicine
shop=chemist → medicine
shop=bicycle → bicycle
shop=outdoor → wings, fishing (ランダム)
shop=houseware → cookware
shop=department_store → towel, ランダム装備
shop=gift → flag
shop=variety_store → bag, flag (ランダム)
```

---

## ビジュアル

### 3D表示

| 項目 | 仕様 |
|------|------|
| 形状 | 八面体（ダイヤモンド形） |
| サイズ | 半径 1.5（食べ物の球体より少し大きめ） |
| 光の柱 | あり（食べ物と同様、高さ70） |
| 回転 | Y軸回転（食べ物より少し遅め） |

### 色

- **宝石**: 誕生石の色（上記テーブル参照）
- **装備**: 効果ごとの色（上記テーブル参照）

### 光の柱の色

- アイテム色をベースに、少し明るくした色

---

## 効果の種類

| 効果ID | 説明 | 計算方法 |
|--------|------|----------|
| attack | 攻撃力 | baseAttack × (1 + 合計%) |
| defense | 防御力 | baseDefense × (1 + 合計%) |
| speed | 移動速度 | baseSpeed × (1 + 合計%) |
| verticalSpeed | 上下速度 | baseVerticalSpeed × (1 + 合計%) |
| groundSpeed | 地上速度 | baseGroundSpeed × (1 + 合計%) |
| pickupRange | 取得範囲 | baseRange × (1 + 合計%) |
| magnetism | 吸引力 | baseMagnetism × (1 + 合計%) |
| detection | 索敵範囲 | baseDetection × (1 + 合計%) |
| buffDuration | バフ持続 | baseDuration × (1 + 合計%) |
| recoveryCooldown | 回復CD | baseCooldown × (1 - 合計%) |
| energyRegen | エネルギー回復 | baseRegen × (1 + 合計%) |
| foodBuffBoost | 食事バフ強化 | foodEffect × (1 + 合計%) |
| slotExpand | スロット拡張 | baseSlots + 合計値 |
| allStats | 全能力 | 上記すべてに微量加算 |

---

## データ構造

### equipment_spawns.json

```json
[
  {
    "id": "equip_001",
    "gameX": 50.5,
    "gameZ": -30.2,
    "category": "gem",
    "typeId": "ruby",
    "name": "Ruby",
    "nameJa": "ルビー",
    "effect": "attack",
    "value": 0.15,
    "color": "#E0115F",
    "shopName": "○○ジュエリー",
    "shopCategory": "jewelry"
  },
  {
    "id": "equip_002",
    "gameX": 80.1,
    "gameZ": 20.5,
    "category": "equipment",
    "typeId": "shoes",
    "name": "Shoes",
    "nameJa": "靴",
    "effect": "speed",
    "value": 0.15,
    "color": "#FFD700",
    "shopName": "ABCマート",
    "shopCategory": "shoes"
  }
]
```

### プレイヤー状態（gameState.inventory）

```javascript
gameState.inventory = {
  maxSlots: 5,
  items: [
    { typeId: 'ruby', category: 'gem', effect: 'attack', value: 0.15, ... },
    { typeId: 'shoes', category: 'equipment', effect: 'speed', value: 0.15, ... }
  ]
};
```

---

## UI表示

### 装備パネル（画面右側）

```
┌─────────────────────────┐
│ 装備 (2/5)              │
├─────────────────────────┤
│ 💎 ルビー     攻撃+15%  │
│ 👟 靴         速度+15%  │
│ [空き]                  │
│ [空き]                  │
│ [空き]                  │
└─────────────────────────┘
```

### アイコン（絵文字）

| カテゴリ/タイプ | アイコン |
|----------------|----------|
| 宝石 | 💎 |
| バッグ | 🎒 |
| 磁石 | 🧲 |
| 靴 | 👟 |
| メガネ | 👓 |
| 防具 | 🛡️ |
| 武器 | ⚔️ |
| 時計 | ⌚ |
| 薬 | 💊 |
| 翼 | 🪽 |
| 自転車 | 🚲 |
| 釣り具 | 🎣 |
| 帽子 | 🎩 |
| タオル | 🧻 |
| 旗 | 🚩 |
| 服 | 👕 |
| 料理道具 | 🍳 |

---

## 転生時の扱い

- 装備・宝石は**すべてリセット**（マスクのみ一部引き継ぎ）

---

## 関連ファイル

- `js/equipment.js` - 装備の3D表示・取得処理
- `js/inventory.js` - インベントリ管理
- `js/ui.js` - 装備UI表示
- `data/equipment_spawns.json` - 装備配置データ
- `scripts/fetch_shops.py` - OSMデータ取得（拡張）
- `scripts/convert_shops.py` - 装備データ変換（拡張）
