/**
 * 戦闘システム
 * 
 * - 自動戦闘（近づくと自動で攻撃）
 * - ダメージ計算
 * - 攻撃エフェクト
 */

import * as THREE from 'three';
import { ENEMY_CONFIG, getEnemiesInRange } from './enemy.js';

/** 戦闘設定 */
export const COMBAT_CONFIG = {
  /** プレイヤー攻撃範囲 */
  playerAttackRange: 6,
  /** プレイヤー基本攻撃力 */
  playerBaseAttack: 10,
  /** プレイヤー攻撃クールダウン（秒） */
  playerAttackCooldown: 0.8,
  /** ダメージ表示時間（秒） */
  damageNumberDuration: 1.0,
};

/** 戦闘状態 */
const combatState = {
  playerAttackCooldown: 0,
  damageNumbers: [],
};

/**
 * ダメージ計算
 */
export function calculateDamage(baseAttack, attackMult, defense, defenseMult) {
  const attack = baseAttack * (1 + attackMult);
  const def = defense * (1 + defenseMult);
  const damage = Math.max(1, attack - def * 0.5);
  // ランダム幅 ±20%
  return Math.floor(damage * (0.8 + Math.random() * 0.4));
}

/**
 * プレイヤーの攻撃を実行
 */
export function playerAttack(dt, playerPos, playerStats, enemies, scene) {
  // クールダウン更新
  if (combatState.playerAttackCooldown > 0) {
    combatState.playerAttackCooldown -= dt;
    return { attacked: false, damage: 0, target: null };
  }
  
  // 攻撃範囲内の敵を取得
  const inRange = getEnemiesInRange(playerPos, COMBAT_CONFIG.playerAttackRange);
  if (inRange.length === 0) {
    return { attacked: false, damage: 0, target: null };
  }
  
  // 最も近い敵を攻撃
  let closest = null;
  let closestDist = Infinity;
  for (const enemy of inRange) {
    const dx = playerPos.x - enemy.x;
    const dz = playerPos.z - enemy.z;
    const dist = dx * dx + dz * dz;
    if (dist < closestDist) {
      closestDist = dist;
      closest = enemy;
    }
  }
  
  if (!closest) {
    return { attacked: false, damage: 0, target: null };
  }
  
  // ダメージ計算
  const attackMult = playerStats.attackMult ?? 0;
  const damage = calculateDamage(
    COMBAT_CONFIG.playerBaseAttack + (playerStats.baseAttack ?? 0),
    attackMult,
    0, // 敵の防御力（今は0）
    0
  );
  
  // ダメージを与える
  closest.takeDamage(damage);
  
  // ダメージ表示
  spawnDamageNumber(scene, closest.x, closest.y + 2.5, closest.z, damage, 0xffff44);
  
  // 攻撃エフェクト
  spawnAttackEffect(scene, playerPos, { x: closest.x, y: closest.y + 1.5, z: closest.z });
  
  // クールダウンセット
  combatState.playerAttackCooldown = COMBAT_CONFIG.playerAttackCooldown;
  
  return { attacked: true, damage, target: closest };
}

/**
 * 敵の攻撃を処理
 * @returns {{ totalDamage: number, attackers: Array }} 合計ダメージと攻撃した敵のリスト
 */
export function enemyAttacks(dt, playerPos, enemies, playerStats) {
  let totalDamage = 0;
  const attackers = [];
  
  for (const enemy of enemies) {
    if (!enemy.isAlive) continue;
    
    // 距離チェック
    const dx = playerPos.x - enemy.x;
    const dz = playerPos.z - enemy.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist > ENEMY_CONFIG.attackRange) continue;
    
    // 攻撃実行
    const damage = enemy.tryAttack(dt);
    if (damage > 0) {
      // プレイヤーの防御で軽減
      const defenseMult = playerStats.defenseMult ?? 0;
      const actualDamage = Math.max(1, Math.floor(damage * (1 - defenseMult * 0.5)));
      totalDamage += actualDamage;
      attackers.push(enemy);
    }
  }
  
  return { totalDamage, attackers };
}

/**
 * ダメージ数字をスポーン
 */
function spawnDamageNumber(scene, x, y, z, damage, color) {
  // スプライトでダメージ数字を表示
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(damage.toString(), 64, 32);
  
  // 縁取り
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(damage.toString(), 64, 32);
  ctx.fillText(damage.toString(), 64, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(2, 1, 1);
  scene.add(sprite);
  
  combatState.damageNumbers.push({
    sprite,
    startY: y,
    timer: 0,
    duration: COMBAT_CONFIG.damageNumberDuration,
  });
}

/**
 * 攻撃エフェクト（線）
 */
function spawnAttackEffect(scene, from, to) {
  const points = [
    new THREE.Vector3(from.x, from.y, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.8,
  });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  
  // 0.1秒後に削除
  setTimeout(() => {
    scene.remove(line);
    geometry.dispose();
    material.dispose();
  }, 100);
}

/**
 * ダメージ数字を更新
 */
export function updateDamageNumbers(dt, scene) {
  const toRemove = [];
  
  for (const dn of combatState.damageNumbers) {
    dn.timer += dt;
    
    // 上に浮かぶ
    dn.sprite.position.y = dn.startY + dn.timer * 2;
    
    // フェードアウト
    dn.sprite.material.opacity = 1 - (dn.timer / dn.duration);
    
    if (dn.timer >= dn.duration) {
      toRemove.push(dn);
    }
  }
  
  for (const dn of toRemove) {
    scene.remove(dn.sprite);
    dn.sprite.material.map.dispose();
    dn.sprite.material.dispose();
    const index = combatState.damageNumbers.indexOf(dn);
    if (index !== -1) {
      combatState.damageNumbers.splice(index, 1);
    }
  }
}

/**
 * 戦闘状態をリセット
 */
export function resetCombatState() {
  combatState.playerAttackCooldown = 0;
  combatState.damageNumbers = [];
}
