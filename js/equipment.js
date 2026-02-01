import * as THREE from 'three';

/** 装備の取得範囲 */
export const equipmentCollectRadius = 3.0;

/** アイテムから出る光の高さ（Y方向の長さ） */
const beamHeight = 70;

/** 装備アイテムの配列 */
const equipments = [];

/** 八面体ジオメトリ（ダイヤモンド形） */
const equipmentGeo = new THREE.OctahedronGeometry(0.6, 0);

export function getEquipments() {
  return equipments;
}

/**
 * 装備アイテムをシーンに追加する。
 * @param {THREE.Scene} scene
 * @param {Object} spawnData equipment_spawns.json のスポーンデータ
 */
export function addEquipment(scene, spawnData) {
  const {
    id,
    shopName,
    shopNameJa,
    shopCategory,
    itemCategory,
    typeId,
    name,
    nameJa,
    effect,
    value,
    color,
    icon,
    gameX,
    gameZ
  } = spawnData;

  // 色をパース
  const meshColor = new THREE.Color(color);
  const beamColor = meshColor.clone().lerp(new THREE.Color(0xffffff), 0.3);

  // メッシュ作成
  const material = new THREE.MeshStandardMaterial({
    color: meshColor,
    emissive: meshColor,
    emissiveIntensity: 0.3,
    metalness: 0.5,
    roughness: 0.3
  });
  const mesh = new THREE.Mesh(equipmentGeo, material);
  mesh.position.set(gameX, 0.8, gameZ);
  mesh.castShadow = true;
  scene.add(mesh);

  // ビーム（光の柱）作成
  const beamGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0)
  ]);
  const beamMat = new THREE.LineBasicMaterial({
    color: beamColor,
    transparent: true,
    opacity: 0.7,
    depthTest: true,
    depthWrite: false
  });
  const beam = new THREE.Line(beamGeo, beamMat);
  beam.scale.y = beamHeight;
  beam.position.set(gameX, 0, gameZ);
  beam.visible = false;
  scene.add(beam);

  equipments.push({
    id,
    mesh,
    beam,
    x: gameX,
    z: gameZ,
    collected: false,
    shopName,
    shopNameJa,
    shopCategory,
    itemCategory,
    typeId,
    name,
    nameJa,
    effect,
    value,
    color,
    icon
  });
}

/** 装備の最低高度（プレイヤーのminHeightと同じ） */
const MIN_EQUIPMENT_HEIGHT = 26;

/**
 * 装備の高さを地形に合わせて更新
 * @param {Function} getHeightAt 座標から高さを取得する関数
 */
export function updateEquipmentHeights(getHeightAt) {
  equipments.forEach((e) => {
    if (e.collected) return;
    const h = getHeightAt(e.x, e.z);
    const baseY = Math.max(h, MIN_EQUIPMENT_HEIGHT);
    const y = baseY + 0.8;
    e.mesh.position.y = y;
    if (e.beam) {
      e.beam.position.set(e.x, baseY, e.z);
      e.beam.visible = true;
    }
  });
}

/** 装備の回転アニメーション（毎フレーム呼び出し） */
export function updateEquipmentAnimation(dt) {
  const rotSpeed = 0.8; // 食べ物より少し遅め
  equipments.forEach((e) => {
    if (e.collected) return;
    e.mesh.rotation.y += rotSpeed * dt;
    // Y軸で少し揺れる
    e.mesh.position.y += Math.sin(Date.now() * 0.003 + e.x) * 0.002;
  });
}

/**
 * equipment_spawns.json を読み込んで装備を配置する。
 * @param {THREE.Scene} scene
 * @param {string} jsonPath JSONファイルのパス
 * @returns {Promise<number>} 配置した装備の数
 */
export async function loadEquipmentSpawnsFromJson(scene, jsonPath = 'data/equipment_spawns.json') {
  try {
    const response = await fetch(jsonPath);
    if (!response.ok) {
      console.warn(`[Equipment] ${jsonPath} の読み込みに失敗: ${response.status}`);
      return 0;
    }
    const data = await response.json();
    const spawns = data.spawns || [];
    console.log(`[Equipment] ${jsonPath} から ${spawns.length} 件のスポーン情報を読み込み`);

    for (const spawn of spawns) {
      addEquipment(scene, spawn);
    }
    return spawns.length;
  } catch (e) {
    console.warn(`[Equipment] ${jsonPath} の読み込みエラー:`, e);
    return 0;
  }
}

/**
 * 装備を回収済みにする
 * @param {Object} equipment 装備オブジェクト
 * @param {THREE.Scene} scene
 */
export function collectEquipment(equipment, scene) {
  if (equipment.collected) return;
  equipment.collected = true;
  scene.remove(equipment.mesh);
  scene.remove(equipment.beam);
}
