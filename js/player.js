export const baseSpeed = 18;
export const turnSpeed = 1.8;
export const energyCostPerSec = 15;
/** 加速・減速していない時のエネルギー回復（/秒） */
export const energyRecoveryPerSec = 2.5;
export const verticalSpeed = 12;
export const minHeight = 1.6;
export const maxHeight = 160;

export const keys = { w: false, a: false, s: false, d: false, q: false, e: false };

export function resolveCollisions(camera) {
  const p = camera.position;
  if (p.y < minHeight) p.y = minHeight;
  if (p.y > maxHeight) p.y = maxHeight;
}
