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
  
  // マスク（顔の前面）
  const maskGeo = new THREE.PlaneGeometry(0.5, 0.4);
  const maskMat = new THREE.MeshStandardMaterial({
    color: primaryMask?.color ?? 0xffffff,
    side: THREE.DoubleSide,
    emissive: primaryMask?.color ?? 0xffffff,
    emissiveIntensity: 0.3,
  });
  const mask = new THREE.Mesh(maskGeo, maskMat);
  mask.position.set(0, 2.2, 0.35);
  group.add(mask);
  
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

/**
 * 敵を更新（毎フレーム）
 */
export function updateEnemies(dt, playerPos, getHeightAt) {
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
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    // 追跡
    if (dist < ENEMY_CONFIG.chaseRange && dist > ENEMY_CONFIG.attackRange) {
      const speed = enemy.speed * dt;
      const dirX = dx / dist;
      const dirZ = dz / dist;
      
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
