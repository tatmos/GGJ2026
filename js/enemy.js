import * as THREE from 'three';

/**
 * 敵システム
 * 
 * - 1分ごとに雑魚敵がスポーン
 * - プレイヤーを追いかける
 * - 近づくと自動戦闘
 * - 倒すとマスクをドロップ
 */

/** 敵の配列 */
const enemies = [];

/** 敵の設定 */
export const ENEMY_CONFIG = {
  /** スポーン間隔（秒） */
  spawnIntervalSec: 60,
  /** 最大敵数 */
  maxEnemies: 10,
  /** 追跡開始距離 */
  chaseRange: 100,
  /** 攻撃範囲 */
  attackRange: 5,
  /** 基本移動速度 */
  baseSpeed: 8,
  /** 基本体力 */
  baseHp: 50,
  /** 基本攻撃力 */
  baseAttack: 5,
  /** 攻撃クールダウン（秒） */
  attackCooldown: 1.5,
  /** 敵の最低高度 */
  minHeight: 26,
};

/** マスクの種類と色 */
export const MASK_TYPES = {
  red: { color: 0xff4444, effect: 'attack', value: 0.05, nameJa: '赤マスク' },
  blue: { color: 0x4444ff, effect: 'defense', value: 0.05, nameJa: '青マスク' },
  green: { color: 0x44ff44, effect: 'speed', value: 0.05, nameJa: '緑マスク' },
  yellow: { color: 0xffff44, effect: 'pickupRange', value: 0.10, nameJa: '黄マスク' },
  purple: { color: 0xff44ff, effect: 'magnetism', value: 0.10, nameJa: '紫マスク' },
  cyan: { color: 0x44ffff, effect: 'detection', value: 0.10, nameJa: '水色マスク' },
  orange: { color: 0xff8844, effect: 'buffDuration', value: 0.05, nameJa: '橙マスク' },
  white: { color: 0xffffff, effect: 'allStats', value: 0.02, nameJa: '白マスク' },
};

const MASK_TYPE_IDS = Object.keys(MASK_TYPES);

/**
 * 敵クラス
 */
export class Enemy {
  constructor(id, x, z, strength = 1.0) {
    this.id = id;
    this.x = x;
    this.z = z;
    this.y = ENEMY_CONFIG.minHeight;
    
    // 強さ係数（プレイヤーより弱め）
    this.strength = strength;
    
    // ステータス
    this.maxHp = Math.floor(ENEMY_CONFIG.baseHp * strength);
    this.hp = this.maxHp;
    this.attack = Math.floor(ENEMY_CONFIG.baseAttack * strength);
    this.speed = ENEMY_CONFIG.baseSpeed * (0.8 + Math.random() * 0.4);
    
    // 戦闘状態
    this.attackCooldownRemaining = 0;
    this.isAlive = true;
    this.isDying = false;
    this.deathTimer = 0;
    
    // マスク（1〜3個所持）
    this.masks = this.generateMasks(strength);
    
    // 3Dオブジェクト
    this.mesh = null;
    this.healthBar = null;
    
    // 移動
    this.velocity = new THREE.Vector3();
    this.targetY = this.y;
    
    // 接近通知済みフラグ
    this.approachNotified = false;
    
    // 戦闘状態フラグ
    this.inCombat = false;
    this.halfHpNotified = false;
    this.lowHpNotified = false;
    this.hitCount = 0;
  }
  
  /**
   * マスクを生成
   */
  generateMasks(strength) {
    const count = Math.floor(1 + strength * 2);
    const masks = [];
    for (let i = 0; i < count; i++) {
      const typeId = MASK_TYPE_IDS[Math.floor(Math.random() * MASK_TYPE_IDS.length)];
      const maskType = MASK_TYPES[typeId];
      masks.push({
        typeId,
        color: maskType.color,
        effect: maskType.effect,
        value: maskType.value,
        nameJa: maskType.nameJa,
      });
    }
    return masks;
  }
  
  /**
   * ダメージを受ける
   */
  takeDamage(amount) {
    if (!this.isAlive) return 0;
    
    const actualDamage = Math.max(1, amount);
    this.hp -= actualDamage;
    
    if (this.hp <= 0) {
      this.hp = 0;
      this.isAlive = false;
      this.isDying = true;
    }
    
    return actualDamage;
  }
  
  /**
   * 攻撃実行
   */
  tryAttack(dt) {
    if (this.attackCooldownRemaining > 0) {
      this.attackCooldownRemaining -= dt;
      return 0;
    }
    
    this.attackCooldownRemaining = ENEMY_CONFIG.attackCooldown;
    return this.attack;
  }
}

/**
 * 人型敵の3Dモデルを作成
 */
function createHumanoidMesh(enemy) {
  const group = new THREE.Group();
  
  // マスクの色で全体の色調を決定
  const primaryMask = enemy.masks[0];
  const bodyColor = new THREE.Color(primaryMask?.color ?? 0x888888);
  const darkColor = bodyColor.clone().multiplyScalar(0.6);
  
  // 胴体
  const bodyGeo = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: darkColor });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.2;
  group.add(body);
  
  // 頭部
  const headGeo = new THREE.SphereGeometry(0.35, 8, 8);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffddbb });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.2;
  group.add(head);
  
  // マスク（顔の前面）- 目と装飾付き
  const maskGroup = new THREE.Group();
  maskGroup.position.set(0, 2.2, 0.35);
  
  // マスク本体（少し丸みを帯びた形状）
  const maskGeo = new THREE.PlaneGeometry(0.55, 0.45, 4, 4);
  // 頂点を少し曲げてお面らしく
  const positions = maskGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = Math.sqrt(Math.max(0, 0.1 - x * x * 0.3 - y * y * 0.4)) * 0.3;
    positions.setZ(i, z);
  }
  maskGeo.computeVertexNormals();
  
  const maskMat = new THREE.MeshStandardMaterial({
    color: primaryMask?.color ?? 0xffffff,
    side: THREE.DoubleSide,
    emissive: primaryMask?.color ?? 0xffffff,
    emissiveIntensity: 0.3,
  });
  const maskBase = new THREE.Mesh(maskGeo, maskMat);
  maskGroup.add(maskBase);
  
  // 目の穴（左目）
  const eyeGeo = new THREE.CircleGeometry(0.08, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.12, 0.05, 0.05);
  maskGroup.add(leftEye);
  
  // 目の穴（右目）
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.12, 0.05, 0.05);
  maskGroup.add(rightEye);
  
  // 眉（左）- 斜めの線
  const browGeo = new THREE.PlaneGeometry(0.12, 0.025);
  const browMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
  const leftBrow = new THREE.Mesh(browGeo, browMat);
  leftBrow.position.set(-0.12, 0.14, 0.06);
  leftBrow.rotation.z = 0.2;
  maskGroup.add(leftBrow);
  
  // 眉（右）
  const rightBrow = new THREE.Mesh(browGeo, browMat);
  rightBrow.position.set(0.12, 0.14, 0.06);
  rightBrow.rotation.z = -0.2;
  maskGroup.add(rightBrow);
  
  // 口（表情はマスクの種類で変える）
  const mouthGeo = new THREE.PlaneGeometry(0.15, 0.04);
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(0, -0.1, 0.05);
  maskGroup.add(mouth);
  
  // マスクの縁取り
  const rimGeo = new THREE.RingGeometry(0.26, 0.28, 16);
  const rimMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(primaryMask?.color ?? 0xffffff).multiplyScalar(0.6),
    side: THREE.DoubleSide,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.z = -0.01;
  maskGroup.add(rim);
  
  group.add(maskGroup);
  
  // 追加マスク（複数持っている場合は頭上に表示）
  for (let i = 1; i < enemy.masks.length; i++) {
    const extraMask = enemy.masks[i];
    const extraGeo = new THREE.CircleGeometry(0.15, 6);
    const extraMat = new THREE.MeshStandardMaterial({
      color: extraMask.color,
      side: THREE.DoubleSide,
      emissive: extraMask.color,
      emissiveIntensity: 0.5,
    });
    const extra = new THREE.Mesh(extraGeo, extraMat);
    extra.position.set((i - 1) * 0.3 - 0.15, 2.8, 0);
    extra.rotation.x = -Math.PI / 4;
    group.add(extra);
  }
  
  // 光のビーコン（上に伸びる光の線）
  const beaconHeight = 20;
  const beaconGeo = new THREE.CylinderGeometry(0.05, 0.15, beaconHeight, 8);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: primaryMask?.color ?? 0xffffff,
    transparent: true,
    opacity: 0.6,
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.y = 3 + beaconHeight / 2;
  beacon.name = 'beacon';
  group.add(beacon);
  
  // ビーコン上部の光球
  const topGlowGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const topGlowMat = new THREE.MeshBasicMaterial({
    color: primaryMask?.color ?? 0xffffff,
    transparent: true,
    opacity: 0.8,
  });
  const topGlow = new THREE.Mesh(topGlowGeo, topGlowMat);
  topGlow.position.y = 3 + beaconHeight;
  topGlow.name = 'beaconGlow';
  group.add(topGlow);
  
  // 腕
  const armGeo = new THREE.CapsuleGeometry(0.12, 0.6, 4, 8);
  const armMat = new THREE.MeshStandardMaterial({ color: darkColor });
  
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.6, 1.4, 0);
  leftArm.rotation.z = 0.3;
  group.add(leftArm);
  
  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.6, 1.4, 0);
  rightArm.rotation.z = -0.3;
  group.add(rightArm);
  
  // 足
  const legGeo = new THREE.CapsuleGeometry(0.15, 0.7, 4, 8);
  const legMat = new THREE.MeshStandardMaterial({ color: darkColor.clone().multiplyScalar(0.8) });
  
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.2, 0.35, 0);
  group.add(leftLeg);
  
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.2, 0.35, 0);
  group.add(rightLeg);
  
  // 影
  group.castShadow = true;
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
    }
  });
  
  return group;
}

/**
 * 体力ゲージを作成
 */
function createHealthBar() {
  const group = new THREE.Group();
  
  // 背景
  const bgGeo = new THREE.PlaneGeometry(1.2, 0.15);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
  const bg = new THREE.Mesh(bgGeo, bgMat);
  group.add(bg);
  
  // 体力バー
  const barGeo = new THREE.PlaneGeometry(1.1, 0.1);
  const barMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, side: THREE.DoubleSide });
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.z = 0.01;
  bar.name = 'healthFill';
  group.add(bar);
  
  return group;
}

/**
 * 敵をシーンに追加
 */
export function spawnEnemy(scene, x, z, strength = 1.0) {
  if (enemies.length >= ENEMY_CONFIG.maxEnemies) {
    return null;
  }
  
  const id = `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const enemy = new Enemy(id, x, z, strength);
  
  // 3Dモデル作成
  enemy.mesh = createHumanoidMesh(enemy);
  enemy.mesh.position.set(x, enemy.y, z);
  scene.add(enemy.mesh);
  
  // 体力ゲージ
  enemy.healthBar = createHealthBar();
  enemy.healthBar.position.set(0, 3.2, 0);
  enemy.mesh.add(enemy.healthBar);
  
  enemies.push(enemy);
  console.log(`[Enemy] スポーン: ${id} (強さ: ${strength.toFixed(2)}, HP: ${enemy.maxHp}, マスク: ${enemy.masks.length}個)`);
  
  return enemy;
}

/**
 * 全ての敵を取得
 */
export function getEnemies() {
  return enemies;
}

/**
 * 生存中の敵を取得
 */
export function getAliveEnemies() {
  return enemies.filter(e => e.isAlive);
}

/** マスク拾得範囲 */
const MASK_PICKUP_RANGE = 5;

/**
 * 敵がマスクを拾った時の処理
 */
function enemyPickupMask(enemy, mask, scene, collectMaskFn) {
  // マスクを回収
  collectMaskFn(scene, mask);
  
  // 敵のマスクリストに追加
  enemy.masks.push({
    typeId: mask.typeId,
    color: mask.color,
    effect: mask.effect,
    value: mask.value,
    nameJa: mask.nameJa,
  });
  
  // 敵の能力を強化（マスク効果を適用）
  switch (mask.effect) {
    case 'attack':
      enemy.attack = Math.floor(enemy.attack * (1 + mask.value));
      break;
    case 'defense':
      // 敵にはdefenseがないので、HPを少し増加
      enemy.maxHp = Math.floor(enemy.maxHp * (1 + mask.value));
      enemy.hp = Math.min(enemy.hp + 10, enemy.maxHp);
      break;
    case 'speed':
      enemy.speed *= (1 + mask.value);
      break;
    default:
      // その他の効果は攻撃力に少し反映
      enemy.attack = Math.floor(enemy.attack * (1 + mask.value * 0.5));
      break;
  }
  
  // メッシュに追加マスクを表示
  if (enemy.mesh) {
    const maskIndex = enemy.masks.length - 1;
    const extraGeo = new THREE.CircleGeometry(0.15, 6);
    const extraMat = new THREE.MeshStandardMaterial({
      color: mask.color,
      side: THREE.DoubleSide,
      emissive: mask.color,
      emissiveIntensity: 0.5,
    });
    const extra = new THREE.Mesh(extraGeo, extraMat);
    extra.position.set((maskIndex - 1) * 0.3 - 0.15, 2.8, 0);
    extra.rotation.x = -Math.PI / 4;
    enemy.mesh.add(extra);
  }
  
  console.log(`[Enemy] ${enemy.id} がマスクを拾った: ${mask.nameJa} (マスク数: ${enemy.masks.length})`);
  
  return mask;
}

/** 敵同士の戦闘距離 */
const ENEMY_VS_ENEMY_RANGE = 8;

/**
 * 最も弱い敵を探す（自分以外）
 */
function findWeakestEnemy(self, enemies) {
  let weakest = null;
  let weakestHp = Infinity;
  let weakestDist = Infinity;
  
  for (const other of enemies) {
    if (other === self || !other.isAlive) continue;
    
    const dx = other.x - self.x;
    const dz = other.z - self.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    // 戦闘範囲内で、より弱い敵を探す
    if (dist < ENEMY_CONFIG.chaseRange) {
      // HPが低い敵を優先
      if (other.hp < weakestHp || (other.hp === weakestHp && dist < weakestDist)) {
        weakestHp = other.hp;
        weakestDist = dist;
        weakest = other;
      }
    }
  }
  
  return { target: weakest, dist: weakestDist };
}

/**
 * 敵を更新（毎フレーム）
 */
export function updateEnemies(dt, playerPos, getHeightAt, droppedMasks = [], scene = null, collectMaskFn = null) {
  // 敵がマスクを拾ったリスト
  const pickedUpMasks = [];
  
  // 敵同士の戦闘結果リスト
  const enemyBattleResults = [];
  
  for (const enemy of enemies) {
    if (!enemy.isAlive) {
      // 死亡アニメーション
      if (enemy.isDying) {
        enemy.deathTimer += dt;
        if (enemy.mesh) {
          enemy.mesh.scale.setScalar(1 - enemy.deathTimer * 2);
          enemy.mesh.position.y -= dt * 5;
        }
        if (enemy.deathTimer > 0.5) {
          enemy.isDying = false;
        }
      }
      continue;
    }
    
    // プレイヤーとの距離
    const dx = playerPos.x - enemy.x;
    const dz = playerPos.z - enemy.z;
    const distToPlayer = Math.sqrt(dx * dx + dz * dz);
    
    // 近くにドロップマスクがあるかチェック
    let nearestMask = null;
    let nearestMaskDist = Infinity;
    
    for (const mask of droppedMasks) {
      if (mask.collected) continue;
      
      const mdx = mask.x - enemy.x;
      const mdz = mask.z - enemy.z;
      const maskDist = Math.sqrt(mdx * mdx + mdz * mdz);
      
      // マスクが拾得範囲内なら拾う
      if (maskDist < MASK_PICKUP_RANGE && scene && collectMaskFn) {
        const picked = enemyPickupMask(enemy, mask, scene, collectMaskFn);
        pickedUpMasks.push({ enemy, mask: picked });
        continue;
      }
      
      // プレイヤーより近いマスクがあれば優先ターゲットに
      if (maskDist < nearestMaskDist && maskDist < distToPlayer * 0.5) {
        nearestMaskDist = maskDist;
        nearestMask = mask;
      }
    }
    
    // 他の敵との関係をチェック（弱い敵がいれば攻撃対象に）
    const { target: weakestEnemy, dist: distToEnemy } = findWeakestEnemy(enemy, enemies);
    
    // 追跡ターゲットを決定（優先順位: マスク > 弱い敵 > プレイヤー）
    let targetX, targetZ, targetDist;
    let targetType = 'player'; // 'player', 'mask', 'enemy'
    let targetEnemy = null;
    
    if (nearestMask && nearestMaskDist < ENEMY_CONFIG.chaseRange && nearestMaskDist < distToPlayer * 0.5) {
      // マスクを追いかける
      targetX = nearestMask.x;
      targetZ = nearestMask.z;
      targetDist = nearestMaskDist;
      targetType = 'mask';
    } else if (weakestEnemy && distToEnemy < distToPlayer * 0.7 && weakestEnemy.hp < enemy.hp) {
      // 弱い敵を追いかける（自分より弱い敵のみ）
      targetX = weakestEnemy.x;
      targetZ = weakestEnemy.z;
      targetDist = distToEnemy;
      targetType = 'enemy';
      targetEnemy = weakestEnemy;
    } else {
      // プレイヤーを追いかける
      targetX = playerPos.x;
      targetZ = playerPos.z;
      targetDist = distToPlayer;
      targetType = 'player';
    }
    
    // 敵同士の戦闘
    if (targetType === 'enemy' && targetEnemy && targetDist < ENEMY_VS_ENEMY_RANGE) {
      // 攻撃実行
      const damage = enemy.tryAttack(dt);
      if (damage > 0) {
        const actualDamage = targetEnemy.takeDamage(damage);
        if (actualDamage > 0) {
          enemyBattleResults.push({
            attacker: enemy,
            target: targetEnemy,
            damage: actualDamage,
            killed: !targetEnemy.isAlive
          });
        }
      }
    }
    
    // 追跡
    if (targetDist < ENEMY_CONFIG.chaseRange && targetDist > ENEMY_CONFIG.attackRange) {
      const speed = enemy.speed * dt;
      const tdx = targetX - enemy.x;
      const tdz = targetZ - enemy.z;
      const dirX = tdx / targetDist;
      const dirZ = tdz / targetDist;
      
      enemy.x += dirX * speed;
      enemy.z += dirZ * speed;
      
      // 向きを更新
      if (enemy.mesh) {
        enemy.mesh.rotation.y = Math.atan2(dirX, dirZ);
      }
    }
    
    // 高さを地形に合わせる
    const groundHeight = getHeightAt(enemy.x, enemy.z);
    enemy.targetY = Math.max(groundHeight, ENEMY_CONFIG.minHeight);
    enemy.y = enemy.y + (enemy.targetY - enemy.y) * 0.1;
    
    // メッシュの位置を更新
    if (enemy.mesh) {
      enemy.mesh.position.set(enemy.x, enemy.y, enemy.z);
    }
    
    // 体力ゲージを更新
    if (enemy.healthBar) {
      const fill = enemy.healthBar.getObjectByName('healthFill');
      if (fill) {
        const ratio = enemy.hp / enemy.maxHp;
        fill.scale.x = ratio;
        fill.position.x = (ratio - 1) * 0.55;
        
        // 色を体力に応じて変更
        if (ratio > 0.5) {
          fill.material.color.setHex(0x44ff44);
        } else if (ratio > 0.25) {
          fill.material.color.setHex(0xffff44);
        } else {
          fill.material.color.setHex(0xff4444);
        }
      }
      
      // カメラに向ける（ビルボード効果は後で追加）
    }
  }
  
  return { pickedUpMasks, enemyBattleResults };
}

/**
 * 敵を削除
 */
export function removeEnemy(scene, enemy) {
  const index = enemies.indexOf(enemy);
  if (index !== -1) {
    enemies.splice(index, 1);
  }
  
  if (enemy.mesh) {
    scene.remove(enemy.mesh);
    enemy.mesh.traverse((child) => {
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
}

/**
 * 死亡した敵をクリーンアップ
 */
export function cleanupDeadEnemies(scene) {
  const toRemove = enemies.filter(e => !e.isAlive && !e.isDying);
  for (const enemy of toRemove) {
    removeEnemy(scene, enemy);
  }
  return toRemove;
}

/**
 * 攻撃範囲内の敵を取得
 */
export function getEnemiesInRange(playerPos, range) {
  return enemies.filter(e => {
    if (!e.isAlive) return false;
    const dx = playerPos.x - e.x;
    const dz = playerPos.z - e.z;
    return dx * dx + dz * dz < range * range;
  });
}
