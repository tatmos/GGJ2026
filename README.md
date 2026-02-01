# 3D 街中ラン

自動で前進する3Dの街を、A/Dで旋回・W/Sで加速・減速しながら進む体験です。エネルギーを消費する代わりに、食べ物アイテムで回復できます。

## 操作

| キー | 操作 |
|------|------|
| **A** | 左に旋回 |
| **D** | 右に旋回 |
| **W** | 加速（エネルギー消費） |
| **S** | 減速（エネルギー消費） |
| **Q** | 上昇 |
| **E** | 下降 |
| 食べ物（黄色い球）に近づく | エネルギー回復 |

## 起動方法

**「Connection Failed / ERR_CONNECTION_REFUSED」や「npm error canceled」が出る場合**  
ファイルを直接開かず、**必ずローカルサーバーを起動してから**ブラウザでURLを開いてください。**サーバーが動いている間はターミナルを閉じたり Ctrl+C で止めないでください。**

### 方法A: バッチファイルで起動（いちばん簡単）

1. **初回だけ** ターミナルで `npm install` を実行（`serve` をインストール）
2. プロジェクトフォルダで **`start.bat` をダブルクリック**
3. 別窓でサーバーが立ち、数秒後にブラウザが開きます。**「GGJ2026 Server」の窓は閉じないでください。**

### 方法B: ターミナルで起動

1. **初回だけ** `npm install`
2. ターミナルで `npm start` を実行
3. **このターミナルはそのまま開いたまま**にして、Chrome や Edge で **http://localhost:3000** を開く（Cursor 内蔵ブラウザではなく外のブラウザで）

### 方法C: Live Server 拡張（Cursor / VS Code）

1. 拡張機能「Live Server」をインストール
2. `index.html` を右クリック → **「Open with Live Server」**
3. ブラウザが自動で開きます

### 方法D: Python のみ使う場合

```bash
cd D:\MyDearest\github\GGJ2026
python -m http.server 3000
```

ターミナルを閉じずに、ブラウザで **http://localhost:3000** を開きます。

## PLATEAUの3D都市モデルを使う

[PLATEAU](https://www.mlit.go.jp/plateau/) の建物モデル（glTF形式）を使うと、実在の街並みでプレイできます。

1. **データの入手**  
   [G空間情報センター](https://www.geospatial.jp/) などから、対象地域のPLATEAUデータ（FBXまたはOBJ）をダウンロードします。

2. **glTF形式へ変換**  
   - BlenderでFBX/OBJを開く  
   - スケールを **100** に（メートル単位にするため）  
   - 軸: **Yが前方・Zが上** に設定  
   - ファイル → エクスポート → glTF 2.0 (.glb) で保存  

3. **プロジェクトに配置**  
   - プロジェクト内に `gltf` フォルダを作成  
   - 変換したファイルを `gltf/city.glb` として保存  

4. **別ファイル名・別パスにする場合**  
   `js/city.js` 内の `PLATEAU_GLTF_PATH` を書き換えてください。

```javascript
const PLATEAU_GLTF_PATH = 'gltf/あなたのファイル.glb';
```

`gltf/city.glb` が存在しない、または読み込みに失敗した場合は、自動的に手続き生成された街が表示されます。

**建物との当たり判定**  
建物との当たり判定は行いません。空間を自由に飛び回ることを優先しています。

**近接時の表示**  
カメラが建物に近づくと、その付近のポリゴンだけ半透明・ワイヤーフレーム・市松模様で表示され、埋まっても周囲が見えるようになります。近接判定は AABB 最近点で行います。Debug パネルで「段階的表示」をオンにすると、距離に応じて 3 段階（通常 → やや半透明 → 半透明＋ワイヤーフレーム）で徐々に変化します（オフ時は近い／遠いの 2 段階で切り替え。負荷比較用）。

**Debug パネル**  
右上の Debug にチェックを入れると、FPS 表示と「段階的表示」チェックボックスが表示されます。段階的表示のオン／オフで負荷を比較できます。

**建物が縦長に見える／平面に見える場合**  
Blenderでオブジェクトに回転（例: X 90°）がついたままエクスポートすると、Three.js で向きがずれます。

- **縦長（壁のように見える）** … `js/city.js` 内の `GLB_NEEDS_X_ROTATION` を `false` のままにし、Blenderで **オブジェクトモード → オブジェクト → 適用 → 回転** で回転をメッシュに適用してから glTF でエクスポートし直してください。
- **平面のように見える** … `js/city.js` 内の `GLB_NEEDS_X_ROTATION` を `true` にすると、読み込み時に X 軸 -90° 回転をかけて表示します。

## 参考

- [PLATEAU - Three.jsで活用する（3D都市モデルの読み込みと表示）](https://www.mlit.go.jp/plateau/learning/tpc12-1/)
- [Three.js](https://threejs.org/)

---

## Credits

### Development

- **Developer**: tatmos

### Development Environment

- [Cursor](https://cursor.sh/) (auto, Opus 4.5)
- [Blender](https://www.blender.org/)
- Python
- [PLATEAU GIS Converter](https://github.com/Project-PLATEAU/PLATEAU-GIS-Converter)

### Third-Party Assets & Data

| Asset | Source | License |
|-------|--------|---------|
| 3D City Model | [PLATEAU](https://www.mlit.go.jp/plateau/) by MLIT Japan (国土交通省) | CC BY 4.0 |
| Map Data | [OpenStreetMap](https://www.openstreetmap.org/) | ODbL |
| 3D Engine | [Three.js](https://threejs.org/) | MIT License |

---

## License

This game was created for **[Global Game Jam 2026](https://globalgamejam.org/)**.

### Game License

This work is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/).

You are free to:
- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

Under the following terms:
- **Attribution** — You must give appropriate credit
- **NonCommercial** — You may not use the material for commercial purposes
- **ShareAlike** — If you remix, you must distribute under the same license

### Third-Party Licenses

Third-party components retain their original licenses. See [LICENSE](LICENSE) for details.
