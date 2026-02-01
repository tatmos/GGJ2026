# サウンドシステム仕様書

## 1. 概要

Web Audio APIを使用したプログラム生成サウンドシステム。
外部ファイルを使わず、リアルタイムで効果音を生成。

---

## 2. 設定

| 項目 | デフォルト値 | 説明 |
|------|-------------|------|
| マスターボリューム | 0.3 (30%) | 全体の音量 |
| サウンド有効 | true | ON/OFF切り替え |

### 設定変更API

```javascript
import { setSoundEnabled, setMasterVolume } from './sound.js';

// サウンドをOFF
setSoundEnabled(false);

// ボリュームを50%に
setMasterVolume(0.5);
```

---

## 3. 効果音一覧

### 3.1 アイテム取得系

| 関数名 | 発生タイミング | 波形 | 音程 | 特徴 |
|--------|---------------|------|------|------|
| `playSoundItemPickup` | 食べ物取得 | sine | 880→1100Hz | 短い2音の上昇 |
| `playSoundEquipmentPickup` | 装備取得 | triangle | 440→660→880Hz | 3音のコード上昇 |
| `playSoundMaskPickup` | マスク新規取得 | sine | C5→E5→G5→C6 | 4音の上昇コード |
| `playSoundMaskSynth` | マスク合成 | sine | 440→880→1320Hz | 高速上昇音 |

### 3.2 戦闘系

| 関数名 | 発生タイミング | 波形 | 音程 | 特徴 |
|--------|---------------|------|------|------|
| `playSoundAttack` | プレイヤー攻撃 | sawtooth + noise | 220Hz | 短いアタック音 |
| `playSoundDamage` | 被ダメージ | sawtooth + noise | 150Hz | 低音のインパクト |
| `playSoundEnemyDefeat` | 敵撃破 | square + noise | 330→220→110Hz | 下降音で消滅感 |

### 3.3 成長・イベント系

| 関数名 | 発生タイミング | 波形 | 音程 | 特徴 |
|--------|---------------|------|------|------|
| `playSoundGrowth` | 成長選択表示 | sine | C5→E5→G5 | 期待感のある上昇 |
| `playSoundGrowthComplete` | 成長完了 | triangle | G5→B5→D6→G6 | 達成感のあるファンファーレ |
| `playSoundRivalAppear` | ライバル出現 | sawtooth | 220→165→110Hz | 不穏な下降警告音 |

### 3.4 敗北・転生系

| 関数名 | 発生タイミング | 波形 | 音程 | 特徴 |
|--------|---------------|------|------|------|
| `playSoundDefeat` | 敗北 | sine | A4→G4→F4→E4 | ゆっくり下降する悲しい音 |
| `playSoundReincarnate` | 転生 | sine | C4→E4→G4→C5→E5→G5 | 希望のある上昇スケール |

### 3.5 マスク関連

| 関数名 | 発生タイミング | 波形 | 音程 | 特徴 |
|--------|---------------|------|------|------|
| `playSoundMaskDrop` | プレイヤーがマスクを落とす | sine | 660→440→330Hz | 下降音で損失感 |
| `playSoundEnemyPickupMask` | 敵がマスクを拾う | square | 330→440Hz | 短い警告上昇音 |

### 3.6 その他

| 関数名 | 発生タイミング | 波形 | 音程 | 特徴 |
|--------|---------------|------|------|------|
| `playSoundBoundaryWarning` | 境界警告（未使用） | square | 440Hz | 短いビープ音 |

---

## 4. 技術仕様

### 4.1 波形タイプ

| タイプ | 音の特徴 | 主な用途 |
|--------|---------|---------|
| `sine` | 柔らかく滑らか | UI音、取得音 |
| `triangle` | やや明るい | 装備取得、達成音 |
| `square` | 硬くレトロ | 警告音、敵関連 |
| `sawtooth` | 鋭く金属的 | 攻撃音、ダメージ |
| noise | ホワイトノイズ | インパクト、爆発 |

### 4.2 エンベロープ

```
音量
  ^
  |   /\
  |  /  \____
  | /        \
  |/          \
  +-------------> 時間
   attack decay sustain release
```

- **attack**: 0.01秒（立ち上がり）
- **decay**: 0.1秒（減衰）
- **sustain**: 0.7 × 音量
- **release**: duration終了まで

### 4.3 音階参照（Hz）

| 音名 | C | D | E | F | G | A | B |
|------|---|---|---|---|---|---|---|
| 4オクターブ | 262 | 294 | 330 | 349 | 392 | 440 | 494 |
| 5オクターブ | 523 | 587 | 659 | 698 | 784 | 880 | 988 |
| 6オクターブ | 1047 | 1175 | 1319 | 1397 | 1568 | 1760 | 1976 |

---

## 5. 呼び出し箇所一覧

| ファイル | 箇所 | 効果音 |
|---------|------|--------|
| `main.js` | keydown時 | `initSound()` 初期化 |
| `main.js` | 食べ物取得 | `playSoundItemPickup()` |
| `main.js` | 装備取得 | `playSoundEquipmentPickup()` |
| `main.js` | マスク取得（新規） | `playSoundMaskPickup()` |
| `main.js` | マスク取得（合成） | `playSoundMaskSynth()` |
| `main.js` | プレイヤー攻撃 | `playSoundAttack()` |
| `main.js` | 被ダメージ | `playSoundDamage()` |
| `main.js` | 敵撃破 | `playSoundEnemyDefeat()` |
| `main.js` | 成長選択表示 | `playSoundGrowth()` |
| `main.js` | 成長完了 | `playSoundGrowthComplete()` |
| `main.js` | ライバル出現 | `playSoundRivalAppear()` |
| `main.js` | 敗北 | `playSoundDefeat()` |
| `main.js` | 転生 | `playSoundReincarnate()` |
| `main.js` | マスクを落とす | `playSoundMaskDrop()` |
| `main.js` | 敵がマスクを拾う | `playSoundEnemyPickupMask()` |

---

## 6. 将来の拡張予定

### 6.1 サウンドファイル対応

```javascript
// 現在（プログラム生成）
playSoundItemPickup();

// 将来（ファイル読み込み）
playSoundFile('sounds/item_pickup.mp3');
```

### 6.2 追加候補の効果音

| 効果音 | 発生タイミング |
|--------|---------------|
| 移動音 | 飛行中のループ音 |
| 環境音 | 街の雰囲気BGM |
| 衝突音 | 建物に当たった時 |
| レベルアップ音 | マスクレベルが上がった時 |
| 警告音 | エネルギー低下時 |

### 6.3 UI設定

- ボリュームスライダー
- 効果音ON/OFFチェックボックス
- BGM ON/OFFチェックボックス

---

## 7. デバッグ

コンソールでサウンドを直接テスト:

```javascript
// 個別テスト
import('./js/sound.js').then(s => {
  s.initSound();
  s.playSoundItemPickup();
});

// 全サウンド連続再生
import('./js/sound.js').then(s => {
  s.initSound();
  const sounds = [
    s.playSoundItemPickup,
    s.playSoundEquipmentPickup,
    s.playSoundMaskPickup,
    s.playSoundAttack,
    s.playSoundDamage,
    s.playSoundEnemyDefeat,
  ];
  sounds.forEach((fn, i) => setTimeout(fn, i * 500));
});
```
