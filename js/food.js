import * as THREE from 'three';

export const collectRadius = 2.5;
/** エネルギー即回復量（energy タイプ用）。バフ定義は buffs.js の BUFF_TYPES.energy.value を参照 */
export const energyPerFood = 25;
/** アイテムから出る光の高さ（Y方向の長さ）。建物で隠れるよう depthTest: true で描画 */
const beamHeight = 70;

/** 食べ物の種類ごとのメッシュ色（0xRRGGBB）。buffs.js の BUFF_TYPES と対応 */
const FOOD_COLORS = {
  energy: 0xfbbf24,
  speedUp: 0x22c55e,
  recoveryCooldownShort: 0x3b82f6
};
const FOOD_BEAM_COLORS = {
  energy: 0xffdd44,
  speedUp: 0x4ade80,
  recoveryCooldownShort: 0x60a5fa
};

/** スポーン時の種類抽選ウェイト（energy 多め、他は少なめ） */
const SPAWN_WEIGHTS = [
  { id: 'energy', weight: 85 },
  { id: 'speedUp', weight: 10 },
  { id: 'recoveryCooldownShort', weight: 5 }
];

function randomFoodTypeId() {
  const total = SPAWN_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of SPAWN_WEIGHTS) {
    r -= w.weight;
    if (r <= 0) return w.id;
  }
  return 'energy';
}

const foods = [];
const foodGeo = new THREE.SphereGeometry(0.4, 12, 12);

export function getFoods() {
  return foods;
}

/**
 * 食べ物をシーンに追加する。
 * @param {THREE.Scene} scene
 * @param {number} x
 * @param {number} z
 * @param {string} [typeId] 未指定ならランダム（energy / speedUp / recoveryCooldownShort）
 * @param {string} [name] お店の名前（デバッグ・表示用）
 * @param {string} [nameJa] 日本語名
 * @param {string} [cuisine] 料理ジャンル
 */
export function addFood(scene, x, z, typeId, name, nameJa, cuisine) {
  const id = typeId ?? randomFoodTypeId();
  const color = FOOD_COLORS[id] ?? FOOD_COLORS.energy;
  const beamColor = FOOD_BEAM_COLORS[id] ?? FOOD_BEAM_COLORS.energy;
  const mesh = new THREE.Mesh(foodGeo, new THREE.MeshStandardMaterial({ color }));
  mesh.position.set(x, 0.6, z);
  mesh.castShadow = true;
  scene.add(mesh);
  const beamGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0)
  ]);
  const beamMat = new THREE.LineBasicMaterial({
    color: beamColor,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
    depthWrite: false
  });
  const beam = new THREE.Line(beamGeo, beamMat);
  beam.scale.y = beamHeight;
  beam.position.set(x, 0, z);
  beam.visible = false;
  scene.add(beam);
  foods.push({
    mesh, beam, x, z, collected: false, typeId: id,
    name: name || '',
    nameJa: nameJa || '',
    cuisine: cuisine || ''
  });
}

/** 食べ物の最低高度（プレイヤーのminHeightと同じにする） */
const MIN_FOOD_HEIGHT = 26;

export function updateFoodHeights(getHeightAt) {
  foods.forEach((f) => {
    if (f.collected) return;
    const h = getHeightAt(f.x, f.z);
    // 最低高度を MIN_FOOD_HEIGHT 以上にする
    const baseY = Math.max(h, MIN_FOOD_HEIGHT);
    const y = baseY + 0.5;
    f.mesh.position.y = y;
    if (f.beam) {
      f.beam.position.set(f.x, baseY, f.z);
      f.beam.visible = true;
    }
  });
}

/**
 * food_spawns.json を読み込んで食べ物を配置する。
 * @param {THREE.Scene} scene
 * @param {string} jsonPath JSONファイルのパス（デフォルト: 'data/food_spawns.json'）
 * @returns {Promise<number>} 配置した食べ物の数
 */
export async function loadFoodSpawnsFromJson(scene, jsonPath = 'data/food_spawns.json') {
  try {
    const response = await fetch(jsonPath);
    if (!response.ok) {
      console.warn(`[Food] ${jsonPath} の読み込みに失敗: ${response.status}`);
      return 0;
    }
    const data = await response.json();
    const spawns = data.spawns || [];
    console.log(`[Food] ${jsonPath} から ${spawns.length} 件のスポーン情報を読み込み`);

    for (const spawn of spawns) {
      addFood(scene, spawn.gameX, spawn.gameZ, spawn.foodTypeId, spawn.name, spawn.nameJa, spawn.cuisine);
    }
    return spawns.length;
  } catch (e) {
    console.warn(`[Food] ${jsonPath} の読み込みエラー:`, e);
    return 0;
  }
}

