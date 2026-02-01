import * as THREE from 'three';

/**
 * マスクシステム
 * 
 * - 敵を倒すとマスクをドロップ
 * - マスクを回収すると能力吸収
 * - 同種マスクは合成（Lvアップ）
 */

/** ドロップしたマスクの配列 */
const droppedMasks = [];

/** マスク取得範囲 */
export const MASK_COLLECT_RADIUS = 4;

/**
 * マスクの3Dメッシュを生成（目と装飾付き）
 */
function createMaskMesh(color) {
  const group = new THREE.Group();
  
  // マスク本体（少し丸みを帯びた形状）
  const maskGeo = new THREE.PlaneGeometry(0.8, 0.65, 4, 4);
  // 頂点を少し曲げてお面らしく
  const positions = maskGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const px = positions.getX(i);
    const py = positions.getY(i);
    const pz = Math.sqrt(Math.max(0, 0.15 - px * px * 0.2 - py * py * 0.3)) * 0.4;
    positions.setZ(i, pz);
  }
  maskGeo.computeVertexNormals();
  
  const maskMat = new THREE.MeshStandardMaterial({
    color: color,
    side: THREE.DoubleSide,
    emissive: color,
    emissiveIntensity: 0.4,
  });
  const maskBase = new THREE.Mesh(maskGeo, maskMat);
  group.add(maskBase);
  
  // 目の穴（左目）
  const eyeGeo = new THREE.CircleGeometry(0.12, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.18, 0.08, 0.08);
  group.add(leftEye);
  
  // 目の穴（右目）
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.18, 0.08, 0.08);
  group.add(rightEye);
  
  // 眉（左）
  const browGeo = new THREE.PlaneGeometry(0.16, 0.035);
  const browMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
  const leftBrow = new THREE.Mesh(browGeo, browMat);
  leftBrow.position.set(-0.18, 0.22, 0.09);
  leftBrow.rotation.z = 0.25;
  group.add(leftBrow);
  
  // 眉（右）
  const rightBrow = new THREE.Mesh(browGeo, browMat);
  rightBrow.position.set(0.18, 0.22, 0.09);
  rightBrow.rotation.z = -0.25;
  group.add(rightBrow);
  
  // 口
  const mouthGeo = new THREE.PlaneGeometry(0.22, 0.06);
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(0, -0.15, 0.08);
  group.add(mouth);
  
  // マスクの縁取り
  const rimGeo = new THREE.RingGeometry(0.38, 0.42, 16);
  const rimMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(0.5),
    side: THREE.DoubleSide,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.z = -0.01;
  group.add(rim);
  
  return group;
}

/**
 * マスクをドロップ
 */
export function dropMask(scene, x, y, z, maskData) {
  const id = `mask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // マスクの3Dオブジェクト（目と装飾付き）
  const mesh = createMaskMesh(maskData.color);
  mesh.position.set(x, y + 1, z);
  mesh.rotation.x = -Math.PI / 4;
  scene.add(mesh);
  
  // 光の柱（太くて目立つ）
  const beamHeight = 40;
  const beamGroup = new THREE.Group();
  beamGroup.position.set(x, y, z);
  
  // メインの光の柱（円柱）
  const beamGeo = new THREE.CylinderGeometry(0.1, 0.3, beamHeight, 8);
  const beamMat = new THREE.MeshBasicMaterial({
    color: maskData.color,
    transparent: true,
    opacity: 0.5,
  });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.position.y = beamHeight / 2;
  beamGroup.add(beamMesh);
  
  // 内側の明るい柱
  const innerBeamGeo = new THREE.CylinderGeometry(0.05, 0.15, beamHeight, 8);
  const innerBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
  });
  const innerBeam = new THREE.Mesh(innerBeamGeo, innerBeamMat);
  innerBeam.position.y = beamHeight / 2;
  beamGroup.add(innerBeam);
  
  // 上部の光球
  const glowGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: maskData.color,
    transparent: true,
    opacity: 0.8,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.y = beamHeight;
  glow.name = 'beaconGlow';
  beamGroup.add(glow);
  
  // 下部のリング（地面に広がる光）
  const ringGeo = new THREE.RingGeometry(0.5, 1.5, 16);
  const ringMat = new THREE.MeshBasicMaterial({
    color: maskData.color,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  ring.name = 'groundRing';
  beamGroup.add(ring);
  
  scene.add(beamGroup);
  
  // beam変数はグループ全体を参照（後でアニメーションに使う）
  const beam = beamGroup;
  beam.material = beamMat; // 互換性のため
  
  const mask = {
    id,
    mesh,
    beam,
    x,
    y,
    z,
    collected: false,
    typeId: maskData.typeId,
    color: maskData.color,
    effect: maskData.effect,
    value: maskData.value,
    nameJa: maskData.nameJa,
  };
  
  droppedMasks.push(mask);
  console.log(`[Mask] ドロップ: ${maskData.nameJa} @ (${x.toFixed(1)}, ${z.toFixed(1)})`);
  
  return mask;
}

/**
 * 敵の死亡時にマスクをドロップ
 */
export function dropMasksFromEnemy(scene, enemy) {
  const masks = [];
  for (const maskData of enemy.masks) {
    const mask = dropMask(scene, enemy.x, enemy.y, enemy.z, maskData);
    masks.push(mask);
  }
  return masks;
}

/**
 * ドロップマスクを取得
 */
export function getDroppedMasks() {
  return droppedMasks;
}

/**
 * マスクのアニメーション更新
 */
export function updateDroppedMasks(dt, playerPos = null) {
  const time = performance.now() / 1000;
  
  for (const mask of droppedMasks) {
    if (mask.collected) continue;
    
    // 回転
    if (mask.mesh) {
      mask.mesh.rotation.y += dt * 2;
    }
    
    // 上下に浮遊
    if (mask.mesh) {
      mask.mesh.position.y = mask.y + 1 + Math.sin(Date.now() * 0.003) * 0.2;
    }
    
    // 光の柱の点滅
    if (mask.beam) {
      // プレイヤーとの距離に応じて点滅速度を変える
      let blinkSpeed = 3; // デフォルト
      let distToPlayer = 100;
      if (playerPos) {
        distToPlayer = Math.sqrt(
          (playerPos.x - mask.x) ** 2 + (playerPos.z - mask.z) ** 2
        );
        // 近いほど速く点滅（2Hz〜8Hz）
        blinkSpeed = Math.min(8, Math.max(2, 10 - distToPlayer / 10));
      }
      
      const blink = 0.3 + 0.7 * Math.abs(Math.sin(time * blinkSpeed * Math.PI));
      
      // ビームグループ内の全マテリアルを点滅
      mask.beam.traverse((child) => {
        if (child.material && child.material.opacity !== undefined) {
          // 元の透明度に基づいて点滅
          if (child.name === 'beaconGlow') {
            child.material.opacity = blink * 0.8;
            // 光球のサイズも脈動
            const pulse = 1 + 0.4 * Math.sin(time * blinkSpeed * Math.PI);
            child.scale.setScalar(pulse);
          } else if (child.name === 'groundRing') {
            child.material.opacity = blink * 0.5;
            // リングも脈動
            const ringPulse = 1 + 0.3 * Math.sin(time * blinkSpeed * Math.PI);
            child.scale.setScalar(ringPulse);
          } else {
            child.material.opacity = blink * 0.6;
          }
        }
      });
      
      // マスク本体も点滅
      if (mask.mesh && mask.mesh.children) {
        mask.mesh.traverse((child) => {
          if (child.material && child.material.emissiveIntensity !== undefined) {
            child.material.emissiveIntensity = 0.3 + 0.5 * blink;
          }
        });
      }
    }
  }
}

/**
 * マスクを回収
 */
export function collectMask(scene, mask) {
  if (mask.collected) return;
  
  mask.collected = true;
  
  // マスクメッシュを削除
  if (mask.mesh) {
    scene.remove(mask.mesh);
    mask.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
  
  // 光の柱グループを削除
  if (mask.beam) {
    scene.remove(mask.beam);
    mask.beam.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
  
  console.log(`[Mask] 回収: ${mask.nameJa}`);
}

/**
 * 回収済みマスクをクリーンアップ
 */
export function cleanupCollectedMasks() {
  const collected = droppedMasks.filter(m => m.collected);
  for (const mask of collected) {
    const index = droppedMasks.indexOf(mask);
    if (index !== -1) {
      droppedMasks.splice(index, 1);
    }
  }
  return collected;
}

/**
 * プレイヤーのマスクインベントリ管理
 */
export function createMaskInventory() {
  return {
    masks: [], // { typeId, level, effect, value, color, nameJa }
  };
}

/**
 * マスクをインベントリに追加（同種は合成）
 */
export function addMaskToInventory(inventory, maskData, absorbRate = 1.0) {
  // 同種マスクを検索
  const existing = inventory.masks.find(m => m.typeId === maskData.typeId);
  
  if (existing) {
    // 合成（Lvアップ）
    existing.level += 1;
    // 効果値は Lv * 基本値 * 0.1 増加
    existing.value = maskData.value * (1 + existing.level * 0.1);
    console.log(`[Mask] 合成: ${existing.nameJa} Lv${existing.level} (効果: ${(existing.value * 100).toFixed(0)}%)`);
    return { isNew: false, mask: existing };
  }
  
  // 新規追加
  const newMask = {
    typeId: maskData.typeId,
    level: 1,
    effect: maskData.effect,
    value: maskData.value * absorbRate,
    color: maskData.color,
    nameJa: maskData.nameJa,
  };
  inventory.masks.push(newMask);
  console.log(`[Mask] 新規取得: ${newMask.nameJa} (効果: ${(newMask.value * 100).toFixed(0)}%)`);
  return { isNew: true, mask: newMask };
}

/**
 * マスクからの効果合計を計算
 */
export function getMaskEffects(inventory) {
  const effects = {};
  
  for (const mask of inventory.masks) {
    if (!effects[mask.effect]) {
      effects[mask.effect] = 0;
    }
    effects[mask.effect] += mask.value;
  }
  
  return effects;
}

/**
 * UI表示用のマスクリストを取得
 */
export function getMasksForDisplay(inventory) {
  return inventory.masks.map(m => ({
    typeId: m.typeId,
    level: m.level,
    effect: m.effect,
    value: m.value,
    color: m.color,
    nameJa: m.nameJa,
  }));
}
