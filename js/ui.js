export function updateLoadProgress(percent) {
  const pct = Math.min(100, Math.max(0, percent));
  const fill = document.getElementById('loadingProgressFill');
  const text = document.getElementById('loadingProgressPct');
  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = Math.round(pct) + '%';
}

export function hideLoading() {
  updateLoadProgress(100);
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.add('hidden');
}

export function updateEnergyBar(energy) {
  const el = document.getElementById('energyBar');
  if (!el) return;
  el.style.width = Math.max(0, energy) + '%';
  el.classList.remove('low', 'critical');
  if (energy < 25) el.classList.add('critical');
  else if (energy < 50) el.classList.add('low');
}

export function updateDirectionMeter(yaw) {
  const needle = document.getElementById('directionNeedle');
  if (!needle) return;
  const deg = -yaw * (180 / Math.PI);
  needle.style.transform = `rotate(${deg}deg)`;
}

const maxSpeed = 18 * 1.6;

export function updateSpeedMeter(speedMultiplier) {
  const speed = 18 * speedMultiplier;
  const el = document.getElementById('speedValue');
  const gauge = document.getElementById('speedGauge');
  if (el) el.textContent = Math.round(speed);
  if (gauge) gauge.style.width = Math.min(100, (speed / maxSpeed) * 100) + '%';
}

export function updateAltitudeMeter(camera, minHeight, maxHeight) {
  const alt = camera.position.y;
  const el = document.getElementById('altValue');
  const gauge = document.getElementById('altGauge');
  if (el) el.textContent = Math.round(alt);
  if (gauge) {
    const pct = Math.min(100, ((alt - minHeight) / (maxHeight - minHeight)) * 100);
    gauge.style.width = Math.max(0, pct) + '%';
  }
}

export function updatePosMeter(camera) {
  const elX = document.getElementById('posX');
  const elY = document.getElementById('posY');
  const elZ = document.getElementById('posZ');
  if (elX) elX.textContent = Math.round(camera.position.x);
  if (elY) elY.textContent = Math.round(camera.position.y);
  if (elZ) elZ.textContent = Math.round(camera.position.z);
}

/** ステータスパネル: survivalSec, reincarnation, attack, defense, evasion, pickupRange, grip, absorb, search */
export function updateStatusPanel(obj) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  const m = Math.floor((obj.survivalSec ?? 0) / 60);
  const s = Math.floor((obj.survivalSec ?? 0) % 60);
  set('statusSurvival', `${m}:${s.toString().padStart(2, '0')}`);
  set('statusReincarnation', String(obj.reincarnation ?? 0));
  set('statusAttack', String(obj.attack ?? 10));
  set('statusDefense', String(obj.defense ?? 5));
  set('statusEvasion', String(obj.evasion ?? 5));
  set('statusPickupRange', String(obj.pickupRange ?? 5));
  set('statusGrip', String(obj.grip ?? 1));
  set('statusAbsorb', String(obj.absorb ?? 1));
  set('statusSearch', String(obj.search ?? 5));
}

/** 所持アイテム: items = [{ id, name? }], maxSlots */
export function updateInventory(items, maxSlots) {
  const countEl = document.getElementById('inventoryCount');
  const maxEl = document.getElementById('inventoryMax');
  const slotsEl = document.getElementById('inventorySlots');
  if (!slotsEl) return;
  if (countEl) countEl.textContent = String(items?.length ?? 0);
  if (maxEl) maxEl.textContent = String(maxSlots ?? 5);
  const max = maxSlots ?? 5;
  slotsEl.innerHTML = '';
  for (let i = 0; i < max; i++) {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';
    if (items && items[i]) {
      slot.title = items[i].name ?? '';
      slot.textContent = items[i].name?.slice(0, 1) ?? '?';
    }
    slotsEl.appendChild(slot);
  }
}

/** 所持マスク: masks = [{ id, name?, level? }] */
export function updateMaskList(masks) {
  const countEl = document.getElementById('maskCount');
  const slotsEl = document.getElementById('maskSlots');
  if (!slotsEl) return;
  const list = masks ?? [];
  if (countEl) countEl.textContent = String(list.length);
  slotsEl.innerHTML = '';
  list.forEach((m) => {
    const slot = document.createElement('div');
    slot.className = 'mask-slot';
    slot.title = m.name ? (m.level ? `${m.name} Lv${m.level}` : m.name) : '';
    slot.textContent = m.level ?? '';
    slotsEl.appendChild(slot);
  });
}

/** 一時効果: activeBuffs = [{ id, name?, remainingSec }], queue = [{ id, name? }] */
export function updateBuffQueue(activeBuffs, queue) {
  const activeEl = document.getElementById('buffActive');
  const queueEl = document.getElementById('buffQueue');
  if (!activeEl || !queueEl) return;
  const active = activeBuffs ?? [];
  const q = queue ?? [];
  activeEl.innerHTML = '';
  active.forEach((b) => {
    const item = document.createElement('div');
    item.className = 'buff-item';
    item.title = `${b.name ?? ''} ${(b.remainingSec ?? 0).toFixed(1)}s`;
    item.textContent = Math.ceil(b.remainingSec ?? 0);
    activeEl.appendChild(item);
  });
  queueEl.innerHTML = '';
  q.slice(0, 3).forEach((b) => {
    const item = document.createElement('div');
    item.className = 'buff-item';
    item.title = b.name ?? '';
    item.textContent = b.name?.slice(0, 1) ?? '?';
    queueEl.appendChild(item);
  });
}

/** 敵位置ガイド: enemies = [{ id, x, y, z, ... }], playerPos, yaw, searchRange. 索敵範囲内の敵を方向・距離表示 */
export function updateEnemyGuide(enemies, playerPos, yaw, searchRange) {
  const listEl = document.getElementById('enemyGuideList');
  const containerEl = document.getElementById('enemyGuide');
  if (!listEl || !containerEl) return;
  const list = enemies ?? [];
  const range = searchRange ?? 50;
  const px = playerPos?.x ?? 0;
  const pz = playerPos?.z ?? 0;
  const inRange = list.filter((e) => {
    const dx = (e.x ?? 0) - px;
    const dz = (e.z ?? 0) - pz;
    return Math.sqrt(dx * dx + dz * dz) <= range;
  });
  listEl.innerHTML = '';
  if (inRange.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'enemy-guide-empty';
    empty.textContent = '索敵中';
    listEl.appendChild(empty);
  }
  inRange.forEach((e) => {
    const dx = (e.x ?? 0) - px;
    const dz = (e.z ?? 0) - pz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(-dx, -dz);
    const relAngle = angle - yaw;
    const deg = (relAngle * 180 / Math.PI + 360) % 360;
    const item = document.createElement('div');
    item.className = 'enemy-guide-item';
    const arrow = document.createElement('span');
    arrow.className = 'enemy-guide-arrow';
    arrow.style.transform = `rotate(${deg}deg)`;
    item.appendChild(arrow);
    const distSpan = document.createElement('span');
    distSpan.textContent = Math.round(dist) + 'm';
    item.appendChild(distSpan);
    listEl.appendChild(item);
  });
  if (list.length === 0) {
    containerEl.classList.add('empty');
  } else {
    containerEl.classList.remove('empty');
  }
}

/** ボス（ライバル）パネル: hp, maxHp, maskCount. 非表示にする場合は visible=false または hp を null に */
export function updateBossPanel(hp, maxHp, maskCount) {
  const panel = document.getElementById('bossPanel');
  const hpEl = document.getElementById('bossHp');
  const maxEl = document.getElementById('bossHpMax');
  const maskEl = document.getElementById('bossMaskCount');
  if (!panel) return;
  if (hp == null || hp === undefined) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  if (hpEl) hpEl.textContent = String(Math.max(0, hp));
  if (maxEl) maxEl.textContent = String(maxHp ?? 100);
  if (maskEl) maskEl.textContent = String(maskCount ?? 0);
}

/** 敵1体分の体力ゲージ用DOMを生成。親に追加して頭上などに配置する用。id は敵の一意キー */
export function createEnemyHealthBar(id) {
  const wrap = document.createElement('div');
  wrap.className = 'enemy-health-wrap';
  wrap.dataset.enemyId = String(id);
  wrap.innerHTML = '<div class="enemy-health-bg"><div class="enemy-health-bar"></div></div>';
  const bar = wrap.querySelector('.enemy-health-bar');
  return { element: wrap, setHP(hp, maxHp) {
    if (!bar) return;
    const pct = maxHp > 0 ? Math.min(100, (hp / maxHp) * 100) : 0;
    bar.style.width = pct + '%';
  } };
}
