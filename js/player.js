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

export function resolveCollisions(camera) {
  const p = camera.position;
  if (p.y < minHeight) p.y = minHeight;
  if (p.y > maxHeight) p.y = maxHeight;
}
