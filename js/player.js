export const baseSpeed = 18;
export const turnSpeed = 1.8;
export const energyCostPerSec = 15;
/** 加速・減速していない時のエネルギー回復（/秒） */
export const energyRecoveryPerSec = 2.5;
/** 加速・減速直後の回復待ち（秒）。この間はエネルギー回復しない。成長・バフで短縮可能。 */
export const recoveryCooldownSec = 1.0;
/** 上昇・下降の速度（Qで上昇・Eで下降） */
export const verticalSpeed = 12;
/** 高度の下限（この位置まで自動下降する） */
export const minHeight = 26;
export const maxHeight = 160;
/** 加速も減速もしていない状態が続いたとき、この秒数経過後に自動下降開始。成長要素として延長可能 */
export const hoverGraceTimeSec = 1.0;
/** ホバー猶予経過後の自動下降速度（m/秒）。26mまで徐々に降りる */
export const autoDescendSpeed = 8;

export const keys = { w: false, a: false, s: false, d: false, q: false, e: false };

// ========================================
// 街の境界設定
// ========================================

/** 境界を超えた時の旋回速度（ラジアン/秒） */
export const BOUNDARY_TURN_SPEED = 1.5;

/** 境界の余裕（バウンディングボックスからこの距離を超えると警告開始） */
export const BOUNDARY_MARGIN = 20;

/** 境界の最大距離（これを超えると最大旋回） */
export const BOUNDARY_MAX_MARGIN = 80;

/**
 * 角度の差を -π 〜 π の範囲で取得
 */
function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * バウンディングボックス外への距離を計算
 * @returns {{ distance: number, isOutside: boolean }}
 */
function getDistanceOutsideBounds(x, z, bounds) {
  let dx = 0, dz = 0;
  
  if (x < bounds.minX) dx = bounds.minX - x;
  else if (x > bounds.maxX) dx = x - bounds.maxX;
  
  if (z < bounds.minZ) dz = bounds.minZ - z;
  else if (z > bounds.maxZ) dz = z - bounds.maxZ;
  
  const distance = Math.sqrt(dx * dx + dz * dz);
  return { distance, isOutside: distance > 0 };
}

/**
 * 境界チェックと自動旋回（バウンディングボックス版）
 * @param {number} x 現在のX座標
 * @param {number} z 現在のZ座標
 * @param {number} currentYaw 現在のyaw
 * @param {number} dt デルタタイム
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number, centerX: number, centerZ: number }} bounds バウンディングボックス
 * @returns {{ yaw: number, outsideBoundary: boolean }} 調整後のyawと境界外フラグ
 */
export function checkBoundaryAndAdjustYaw(x, z, currentYaw, dt, bounds) {
  const { distance, isOutside } = getDistanceOutsideBounds(x, z, bounds);
  
  // 境界内または余裕の範囲内
  if (!isOutside || distance <= BOUNDARY_MARGIN) {
    return { yaw: currentYaw, outsideBoundary: distance > BOUNDARY_MARGIN };
  }
  
  // 街の中心への方向を計算
  const dx = bounds.centerX - x;
  const dz = bounds.centerZ - z;
  const targetYaw = Math.atan2(-dx, -dz);
  const diff = normalizeAngle(targetYaw - currentYaw);
  
  // 境界からの超過度合いで旋回強度を決定（0〜1）
  const overRatio = Math.min(1, (distance - BOUNDARY_MARGIN) / (BOUNDARY_MAX_MARGIN - BOUNDARY_MARGIN));
  const turnAmount = diff * overRatio * BOUNDARY_TURN_SPEED * dt;
  
  // 目標に近い場合はそのまま
  if (Math.abs(diff) < 0.01) {
    return { yaw: currentYaw, outsideBoundary: true };
  }
  
  return { 
    yaw: currentYaw + turnAmount, 
    outsideBoundary: true 
  };
}

export function resolveCollisions(camera) {
  const p = camera.position;
  if (p.y < minHeight) p.y = minHeight;
  if (p.y > maxHeight) p.y = maxHeight;
}
