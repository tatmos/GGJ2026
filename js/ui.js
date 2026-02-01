// ============================================================
// 成長選択ダイアログ
// ============================================================

/** 成長パラメータの定義 */
const GROWTH_PARAMS = [
  { id: 'attack', name: '攻撃力', icon: '⚔️', value: 2 },
  { id: 'defense', name: '防御力', icon: '🛡️', value: 1 },
  { id: 'evasion', name: '回避力', icon: '💨', value: 1 },
  { id: 'pickupRange', name: '取得範囲', icon: '🧲', value: 1 },
  { id: 'grip', name: 'グリップ', icon: '🎯', value: 0.2 },
  { id: 'absorb', name: '吸収力', icon: '✨', value: 0.1 },
  { id: 'search', name: '索敵', icon: '👁️', value: 2 }
];

/**
 * 成長選択ダイアログを表示
 * @param {number} optionCount 選択肢の数（3〜5）
 * @param {Function} onSelect 選択時のコールバック (paramId, value) => void
 */
export function showGrowthDialog(optionCount, onSelect) {
  const dialog = document.getElementById('growthDialog');
  const optionsEl = document.getElementById('growthOptions');
  if (!dialog || !optionsEl) return;
  
  // ランダムに選択肢を選ぶ
  const shuffled = [...GROWTH_PARAMS].sort(() => Math.random() - 0.5);
  const options = shuffled.slice(0, Math.min(optionCount, GROWTH_PARAMS.length));
  
  optionsEl.innerHTML = '';
  options.forEach(param => {
    const btn = document.createElement('div');
    btn.className = 'growth-option';
    btn.innerHTML = `
      <div class="growth-option-icon">${param.icon}</div>
      <div class="growth-option-name">${param.name}</div>
      <div class="growth-option-value">+${param.value}</div>
    `;
    btn.addEventListener('click', () => {
      hideGrowthDialog();
      onSelect(param.id, param.value);
    });
    optionsEl.appendChild(btn);
  });
  
  dialog.classList.remove('hidden');
}

/**
 * 成長選択ダイアログを非表示
 */
export function hideGrowthDialog() {
  const dialog = document.getElementById('growthDialog');
  if (dialog) dialog.classList.add('hidden');
}

// ============================================================
// 敗北・輪廻転生ダイアログ
// ============================================================

/**
 * 敗北ダイアログを表示
 * @param {number} survivalSec 生存時間（秒）
 * @param {number} reincarnation 転生回数
 * @param {number} maskCount 引き継ぐマスク数
 * @param {Function} onReincarnate 転生ボタンクリック時のコールバック
 */
export function showDefeatDialog(survivalSec, reincarnation, maskCount, onReincarnate) {
  const dialog = document.getElementById('defeatDialog');
  if (!dialog) return;
  
  // 統計を表示
  const m = Math.floor(survivalSec / 60);
  const s = Math.floor(survivalSec % 60);
  const timeEl = document.getElementById('defeatSurvivalTime');
  const reincEl = document.getElementById('defeatReincarnation');
  const maskEl = document.getElementById('defeatMaskCount');
  
  if (timeEl) timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  if (reincEl) reincEl.textContent = String(reincarnation);
  if (maskEl) maskEl.textContent = String(maskCount);
  
  // ボタンにイベント設定
  const button = document.getElementById('reincarnateButton');
  if (button) {
    const handler = () => {
      button.removeEventListener('click', handler);
      hideDefeatDialog();
      onReincarnate();
    };
    button.addEventListener('click', handler);
  }
  
  dialog.classList.remove('hidden');
}

/**
 * 敗北ダイアログを非表示
 */
export function hideDefeatDialog() {
  const dialog = document.getElementById('defeatDialog');
  if (dialog) dialog.classList.add('hidden');
}

/**
 * ライバル出現警告を表示（数秒後に自動で消える）
 */
export function showRivalWarning() {
  const el = document.getElementById('rivalWarning');
  if (!el) return;
  
  el.classList.remove('hidden');
  
  // 2秒後に消える
  setTimeout(() => {
    el.classList.add('hidden');
  }, 2000);
}

// ============================================================
// 戦闘ログ
// ============================================================

/** ログの最大表示数 */
const MAX_COMBAT_LOGS = 5;

/**
 * 戦闘ログを追加
 * @param {string} message メッセージ
 * @param {'attack'|'damage'|'defeat'|'mask'} type ログタイプ
 */
export function addCombatLog(message, type = 'attack') {
  const logEl = document.getElementById('combatLog');
  if (!logEl) return;
  
  const entry = document.createElement('div');
  entry.className = `combat-log-entry ${type}`;
  entry.textContent = message;
  logEl.appendChild(entry);
  
  // 古いログを削除
  while (logEl.children.length > MAX_COMBAT_LOGS) {
    logEl.removeChild(logEl.firstChild);
  }
  
  // 3秒後に自動削除
  setTimeout(() => {
    if (entry.parentNode === logEl) {
      logEl.removeChild(entry);
    }
  }, 3000);
}

// ============================================================
// ローディング
// ============================================================

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

/** 成長選択のインターバル（秒） */
const GROWTH_INTERVAL_SEC = 5 * 60; // 5分

/**
 * 境界警告の表示/非表示
 * @param {boolean} show 表示するか
 */
export function updateBoundaryWarning(show) {
  const el = document.getElementById('boundaryWarning');
  if (el) {
    el.classList.toggle('visible', show);
  }
}

/**
 * 大型生存時間表示を更新
 * @param {number} survivalSec 生存時間（秒）
 */
export function updateSurvivalDisplay(survivalSec) {
  const timeEl = document.getElementById('survivalTime');
  const milestoneEl = document.getElementById('survivalMilestone');
  
  if (timeEl) {
    const m = Math.floor(survivalSec / 60);
    const s = Math.floor(survivalSec % 60);
    timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }
  
  if (milestoneEl) {
    // 次の成長選択までの残り時間
    const elapsed = survivalSec % GROWTH_INTERVAL_SEC;
    const remaining = GROWTH_INTERVAL_SEC - elapsed;
    const rm = Math.floor(remaining / 60);
    const rs = Math.floor(remaining % 60);
    milestoneEl.textContent = `次の成長選択まで ${rm}:${rs.toString().padStart(2, '0')}`;
  }
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
/** マスク効果ラベル */
const MASK_EFFECT_LABELS = {
  attack: '攻撃',
  defense: '防御',
  speed: '速度',
  pickupRange: '範囲',
  magnetism: '吸引',
  detection: '索敵',
  buffDuration: '持続',
  allStats: '全能力',
};

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
    
    // 色を設定
    const colorHex = typeof m.color === 'number' 
      ? `#${m.color.toString(16).padStart(6, '0')}` 
      : (m.color || '#888');
    slot.style.backgroundColor = colorHex;
    slot.style.border = '2px solid rgba(255,255,255,0.5)';
    slot.style.position = 'relative';
    
    // マスクの顔を作成（目・眉・口）
    slot.innerHTML = `
      <div class="mask-face">
        <div class="mask-eye mask-eye-left"></div>
        <div class="mask-eye mask-eye-right"></div>
        <div class="mask-brow mask-brow-left"></div>
        <div class="mask-brow mask-brow-right"></div>
        <div class="mask-mouth"></div>
      </div>
      ${m.level && m.level > 1 ? `<span class="mask-level">${m.level}</span>` : ''}
    `;
    
    // ツールチップ
    const effectLabel = MASK_EFFECT_LABELS[m.effect] || m.effect || '';
    const valueText = m.value ? `${m.value > 0 ? '+' : ''}${(m.value * 100).toFixed(0)}%` : '';
    slot.title = `${m.nameJa || m.name || 'マスク'}${m.level ? ` Lv${m.level}` : ''}\n${effectLabel} ${valueText}`;
    
    slotsEl.appendChild(slot);
  });
}

/** バフタイプに対応する色（food.jsのFOOD_COLORSと対応） */
const BUFF_TYPE_COLORS = {
  energy: '#fbbf24',        // 黄
  speedUp: '#22c55e',       // 緑
  recoveryCooldownShort: '#3b82f6'  // 青
};

/** バフタイプに対応するアイコン */
const BUFF_TYPE_ICONS = {
  energy: '⚡',              // エネルギー
  speedUp: '🚀',             // 速度アップ
  recoveryCooldownShort: '⏱️'  // 回復短縮
};

/** バフタイプに対応する説明 */
const BUFF_TYPE_LABELS = {
  energy: 'エネルギー',
  speedUp: '速度UP',
  recoveryCooldownShort: '回復短縮'
};

/** 料理ジャンルに対応する絵文字 */
const CUISINE_EMOJIS = {
  // 日本料理
  japanese: '🍱',
  ramen: '🍜',
  sushi: '🍣',
  udon: '🍜',
  soba: '🍜',
  noodle: '🍜',
  curry: '🍛',
  tempura: '🍤',
  tonkatsu: '🍖',
  yakitori: '🍢',
  izakaya: '🍶',
  kaiseki: '🍱',
  donburi: '🍚',
  onigiri: '🍙',
  bento: '🍱',
  yakiniku: '🥩',
  teppanyaki: '🥩',
  okonomiyaki: '🥞',
  takoyaki: '🐙',
  gyudon: '🍚',
  
  // アジア料理
  chinese: '🥟',
  korean: '🥢',
  thai: '🍜',
  vietnamese: '🍜',
  indian: '🍛',
  indonesian: '🍛',
  malaysian: '🍜',
  taiwanese: '🥟',
  asian: '🥢',
  
  // 西洋料理
  italian: '🍝',
  french: '🥐',
  alsatian: '🥨',
  german: '🥨',
  spanish: '🥘',
  american: '🍔',
  burger: '🍔',
  pizza: '🍕',
  pasta: '🍝',
  steak: '🥩',
  steak_house: '🥩',
  
  // 軽食・カフェ
  cafe: '☕',
  coffee: '☕',
  coffee_shop: '☕',
  bakery: '🥖',
  breakfast: '🍳',
  sandwich: '🥪',
  
  // ファストフード・その他
  fast_food: '🍟',
  fried_food: '🍟',
  fried_chicken: '🍗',
  chicken: '🍗',
  seafood: '🦐',
  fish: '🐟',
  vegetarian: '🥗',
  vegan: '🥗',
  salad: '🥗',
  
  // デフォルト
  restaurant: '🍽️',
  bar: '🍺',
  pub: '🍺',
  
  // コンビニ・その他
  convenience: '🏪',
  supermarket: '🛒'
};

/** cuisineからベストマッチの絵文字を取得 */
function getCuisineEmoji(cuisine) {
  if (!cuisine) return '🍽️';
  // セミコロンやカンマで区切られている場合は最初のものを使用
  const cuisines = cuisine.toLowerCase().split(/[;,]/);
  for (const c of cuisines) {
    const trimmed = c.trim();
    if (CUISINE_EMOJIS[trimmed]) {
      return CUISINE_EMOJIS[trimmed];
    }
    // 部分一致も試す
    for (const [key, emoji] of Object.entries(CUISINE_EMOJIS)) {
      if (trimmed.includes(key) || key.includes(trimmed)) {
        return emoji;
      }
    }
  }
  return '🍽️';
}

/** 一時効果: activeBuffs = [{ id, name?, remainingSec, shopName?, shopNameJa?, cuisine? }], queue = [...] */
export function updateBuffQueue(activeBuffs, queue) {
  const activeEl = document.getElementById('buffActive');
  const queueEl = document.getElementById('buffQueue');
  if (!activeEl || !queueEl) return;
  const active = activeBuffs ?? [];
  const q = queue ?? [];
  activeEl.innerHTML = '';
  active.forEach((b) => {
    const item = document.createElement('div');
    item.className = 'buff-item buff-item-active';
    // 表示名（日本語名優先）
    const displayName = b.shopNameJa || b.shopName || b.name || '???';
    const cuisineText = b.cuisine ? `【${b.cuisine}】` : '';
    const buffIcon = BUFF_TYPE_ICONS[b.id] || '✨';
    const foodIcon = getCuisineEmoji(b.cuisine);
    const label = BUFF_TYPE_LABELS[b.id] || '';
    const remainingSec = b.remainingSec ?? 0;
    const durationMax = b.durationMax ?? 30;
    const progress = Math.max(0, Math.min(100, (remainingSec / durationMax) * 100));
    item.title = `${displayName} ${cuisineText} ${remainingSec.toFixed(1)}s`;
    // タイプに応じた色を設定
    const color = BUFF_TYPE_COLORS[b.id] || '#888';
    item.style.position = 'relative';
    item.style.backgroundColor = 'rgba(0,0,0,0.6)';
    item.style.color = '#fff';
    item.style.fontWeight = 'bold';
    item.style.padding = '8px 12px';
    item.style.textAlign = 'left';
    item.style.borderRadius = '6px';
    item.style.marginBottom = '4px';
    item.style.overflow = 'hidden';
    item.style.minWidth = '220px';
    item.innerHTML = `
      <div style="position:absolute;top:0;left:0;height:100%;width:${progress}%;background:${color};opacity:0.4;z-index:0;transition:width 0.1s;"></div>
      <div style="position:relative;z-index:1;">
        <div style="font-size:14px;white-space:normal;word-break:break-word;">
          <span style="font-size:20px;margin-right:4px;">${foodIcon}</span>${displayName}
        </div>
        <div style="font-size:11px;opacity:0.9;margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="background:${color};color:#000;padding:1px 6px;border-radius:3px;font-size:10px;">${buffIcon} ${label}</span>
          <span>${Math.ceil(remainingSec)}s</span>
          ${cuisineText ? `<span style="opacity:0.7;">${cuisineText}</span>` : ''}
        </div>
      </div>
    `;
    activeEl.appendChild(item);
  });
  queueEl.innerHTML = '';
  q.forEach((b, index) => {
    const item = document.createElement('div');
    item.className = 'buff-item';
    const displayName = b.shopNameJa || b.shopName || b.name || '???';
    const cuisineText = b.cuisine ? `【${b.cuisine}】` : '';
    const buffIcon = BUFF_TYPE_ICONS[b.id] || '✨';
    const foodIcon = getCuisineEmoji(b.cuisine);
    item.title = `${index + 1}. ${displayName} ${cuisineText} (${BUFF_TYPE_LABELS[b.id] || ''})`;
    // タイプに応じた色を設定
    const color = BUFF_TYPE_COLORS[b.id] || '#888';
    item.style.backgroundColor = color;
    item.style.color = '#000';
    item.style.fontWeight = 'bold';
    item.style.opacity = '0.85';
    item.style.minWidth = '80px';
    item.style.maxWidth = '160px';
    item.style.padding = '4px 8px';
    item.style.fontSize = '11px';
    item.style.whiteSpace = 'nowrap';
    item.style.overflow = 'hidden';
    item.style.textOverflow = 'ellipsis';
    item.style.borderRadius = '4px';
    item.innerHTML = `<span style="font-size:14px;">${foodIcon}</span><span style="margin-left:2px;font-size:9px;">${buffIcon}</span> ${displayName.slice(0, 6)}`;
    queueEl.appendChild(item);
  });
}

/**
 * マスクセンサー: ドロップされたマスクへの誘導表示
 * @param {Array} droppedMasks マスクの配列 [{ x, z, color, nameJa, ... }]
 * @param {Object} playerPos プレイヤー位置 { x, z }
 * @param {number} yaw プレイヤーの向き
 */
export function updateMaskSensor(droppedMasks, playerPos, yaw) {
  const containerEl = document.getElementById('maskSensor');
  const listEl = document.getElementById('maskSensorList');
  if (!containerEl || !listEl) return;
  
  const masks = droppedMasks ?? [];
  const px = playerPos?.x ?? 0;
  const pz = playerPos?.z ?? 0;
  
  // マスクがない場合は非表示
  if (masks.length === 0) {
    containerEl.classList.add('hidden');
    return;
  }
  
  containerEl.classList.remove('hidden');
  listEl.innerHTML = '';
  
  // 距離でソート（近い順）
  const sorted = masks.map(m => {
    const dx = (m.x ?? 0) - px;
    const dz = (m.z ?? 0) - pz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    return { ...m, dx, dz, dist };
  }).sort((a, b) => a.dist - b.dist);
  
  // 最大5件表示
  const toShow = sorted.slice(0, 5);
  
  toShow.forEach(m => {
    const angle = Math.atan2(-m.dx, -m.dz);
    const relAngle = angle - yaw;
    const deg = (relAngle * 180 / Math.PI + 360) % 360;
    
    const item = document.createElement('div');
    item.className = 'mask-sensor-item';
    
    // 矢印
    const arrow = document.createElement('span');
    arrow.className = 'mask-sensor-arrow';
    arrow.style.transform = `rotate(${deg}deg)`;
    item.appendChild(arrow);
    
    // マスクの色
    const colorDot = document.createElement('span');
    colorDot.className = 'mask-sensor-color';
    colorDot.style.backgroundColor = m.color || '#ff88ff';
    item.appendChild(colorDot);
    
    // 距離
    const distSpan = document.createElement('span');
    distSpan.textContent = `${Math.round(m.dist)}m`;
    item.appendChild(distSpan);
    
    listEl.appendChild(item);
  });
  
  // 追加のマスクがある場合
  if (sorted.length > 5) {
    const more = document.createElement('div');
    more.className = 'mask-sensor-empty';
    more.textContent = `+${sorted.length - 5} more`;
    listEl.appendChild(more);
  }
}

/** 敵位置ガイド: enemies = [{ id, x, y, z, ... }], playerPos, yaw, searchRange. 索敵範囲内の敵を方向・距離表示 */
export function updateEnemyGuide(enemies, playerPos, yaw, searchRange) {
  const listEl = document.getElementById('enemyGuideList');
  const containerEl = document.getElementById('enemyGuide');
  const labelEl = containerEl?.querySelector('.enemy-guide-label');
  if (!listEl || !containerEl) return;
  const list = enemies ?? [];
  const range = searchRange ?? 50;
  const px = playerPos?.x ?? 0;
  const pz = playerPos?.z ?? 0;
  
  // 索敵範囲をラベルに表示
  if (labelEl) {
    labelEl.textContent = `索敵 (${Math.round(range)}m)`;
  }
  
  // 範囲内・範囲外に分類
  const inRange = [];
  const outOfRange = [];
  list.forEach((e) => {
    const dx = (e.x ?? 0) - px;
    const dz = (e.z ?? 0) - pz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= range) {
      inRange.push({ ...e, dist, dx, dz });
    } else {
      outOfRange.push({ ...e, dist, dx, dz });
    }
  });
  
  listEl.innerHTML = '';
  
  // 範囲内の敵を表示
  inRange.forEach((e) => {
    const angle = Math.atan2(-e.dx, -e.dz);
    const relAngle = angle - yaw;
    const deg = (relAngle * 180 / Math.PI + 360) % 360;
    const item = document.createElement('div');
    item.className = 'enemy-guide-item';
    const arrow = document.createElement('span');
    arrow.className = 'enemy-guide-arrow';
    arrow.style.transform = `rotate(${deg}deg)`;
    item.appendChild(arrow);
    const distSpan = document.createElement('span');
    distSpan.textContent = Math.round(e.dist) + 'm';
    item.appendChild(distSpan);
    listEl.appendChild(item);
  });
  
  // 範囲外の敵は「???」で表示（存在だけ伝える）
  if (outOfRange.length > 0) {
    const unknown = document.createElement('div');
    unknown.className = 'enemy-guide-item enemy-guide-unknown';
    unknown.innerHTML = `<span class="enemy-guide-question">?</span><span>+${outOfRange.length}</span>`;
    listEl.appendChild(unknown);
  }
  
  // 敵がいない場合
  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'enemy-guide-empty';
    empty.textContent = '敵なし';
    listEl.appendChild(empty);
  }
  
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

/** アイテム取得時のポップアップ表示 */
let itemPopupEl = null;
let itemPopupTimeout = null;

export function showItemPopup(name, nameJa, cuisine, typeId) {
  if (!itemPopupEl) {
    itemPopupEl = document.createElement('div');
    itemPopupEl.id = 'itemPopup';
    itemPopupEl.style.cssText = `
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.85);
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      text-align: center;
      z-index: 200;
      pointer-events: none;
      transition: opacity 0.3s;
    `;
    document.body.appendChild(itemPopupEl);
  }

  // 表示名を決定（日本語名優先）
  const displayName = nameJa || name || '???';
  const cuisineText = cuisine ? `【${cuisine}】` : '';
  const foodIcon = getCuisineEmoji(cuisine);
  const buffIcon = BUFF_TYPE_ICONS[typeId] || '✨';
  const buffLabel = BUFF_TYPE_LABELS[typeId] || '';
  
  // 食べ物タイプに応じた色
  const typeColor = BUFF_TYPE_COLORS[typeId] || '#fff';

  itemPopupEl.innerHTML = `
    <div style="font-size:32px;margin-bottom:4px;">${foodIcon}</div>
    <div style="font-size:20px;font-weight:bold;color:${typeColor};margin-bottom:4px;">${displayName}</div>
    ${cuisineText ? `<div style="font-size:14px;color:#aaa;margin-bottom:4px;">${cuisineText}</div>` : ''}
    <div style="font-size:12px;color:${typeColor};"><span style="font-size:14px;">${buffIcon}</span> ${buffLabel}</div>
  `;
  itemPopupEl.style.opacity = '1';
  itemPopupEl.style.display = 'block';

  // 一定時間後にフェードアウト
  if (itemPopupTimeout) clearTimeout(itemPopupTimeout);
  itemPopupTimeout = setTimeout(() => {
    if (itemPopupEl) itemPopupEl.style.opacity = '0';
  }, 2000);
}

// ============================================================
// 装備関連UI
// ============================================================

let equipmentPopupEl = null;
let equipmentPopupTimeout = null;

/**
 * 装備取得時のポップアップを表示
 * @param {Object} equipment 装備オブジェクト
 */
export function showEquipmentPopup(equipment) {
  if (!equipmentPopupEl) {
    equipmentPopupEl = document.createElement('div');
    equipmentPopupEl.id = 'equipmentPopup';
    equipmentPopupEl.style.cssText = `
      position: fixed;
      top: 30%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.9);
      color: #fff;
      padding: 16px 32px;
      border-radius: 12px;
      font-size: 16px;
      text-align: center;
      z-index: 200;
      pointer-events: none;
      transition: opacity 0.3s;
      border: 2px solid;
    `;
    document.body.appendChild(equipmentPopupEl);
  }

  const {
    icon,
    nameJa,
    name,
    effect,
    value,
    color,
    itemCategory,
    shopNameJa,
    shopName
  } = equipment;

  const displayName = nameJa || name || '???';
  const shopDisplayName = shopNameJa || shopName || '';
  const valueText = effect === 'slotExpand' 
    ? `+${value}枠` 
    : `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`;
  
  const effectLabels = {
    attack: '攻撃力',
    defense: '防御力',
    speed: '移動速度',
    verticalSpeed: '上下速度',
    groundSpeed: '地上速度',
    pickupRange: '取得範囲',
    magnetism: '吸引力',
    detection: '索敵範囲',
    buffDuration: 'バフ持続',
    recoveryCooldown: '回復CD',
    energyRegen: 'エネルギー回復',
    foodBuffBoost: '食事バフ強化',
    slotExpand: 'スロット拡張',
    allStats: '全能力'
  };
  const effectLabel = effectLabels[effect] || effect;

  equipmentPopupEl.style.borderColor = color;
  equipmentPopupEl.innerHTML = `
    <div style="font-size:48px;margin-bottom:8px;">${icon}</div>
    <div style="font-size:24px;font-weight:bold;color:${color};margin-bottom:4px;">${displayName}</div>
    <div style="font-size:16px;color:#4ade80;margin-bottom:8px;">${effectLabel} ${valueText}</div>
    ${shopDisplayName ? `<div style="font-size:12px;color:#888;">from: ${shopDisplayName}</div>` : ''}
    <div style="font-size:10px;color:#666;margin-top:8px;">${itemCategory === 'gem' ? '💎 宝石' : '⚙️ 装備'}</div>
  `;
  equipmentPopupEl.style.opacity = '1';
  equipmentPopupEl.style.display = 'block';

  // 一定時間後にフェードアウト
  if (equipmentPopupTimeout) clearTimeout(equipmentPopupTimeout);
  equipmentPopupTimeout = setTimeout(() => {
    if (equipmentPopupEl) equipmentPopupEl.style.opacity = '0';
  }, 2500);
}

/** 効果ラベルのマッピング */
const EFFECT_LABELS = {
  attack: '攻撃',
  defense: '防御',
  speed: '速度',
  verticalSpeed: '上下',
  groundSpeed: '地上',
  pickupRange: '範囲',
  magnetism: '吸引',
  detection: '索敵',
  buffDuration: '持続',
  recoveryCooldown: 'CD',
  energyRegen: '回復',
  foodBuffBoost: '食事',
  slotExpand: '枠',
  allStats: '全能力'
};

/**
 * 装備インベントリUIを更新
 * @param {Object} inventorySummary { used, max, empty, bagCount }
 * @param {Array} items 装備アイテム配列
 * @param {Array} bags バッグ配列（省略可）
 */
export function updateEquipmentUI(inventorySummary, items, bags = []) {
  const panelEl = document.getElementById('equipmentPanel');
  if (!panelEl) return;

  const { used, max, bagCount } = inventorySummary;
  
  // ヘッダー更新
  const headerEl = panelEl.querySelector('.equipment-header');
  if (headerEl) {
    const bagText = bagCount > 0 ? ` 🎒×${bagCount}` : '';
    headerEl.textContent = `装備 (${used}/${max})${bagText}`;
  }
  
  // アイテムリスト更新
  const listEl = panelEl.querySelector('.equipment-list');
  if (!listEl) return;
  
  listEl.innerHTML = '';
  
  // バッグを表示（別枠）
  if (bags.length > 0) {
    const bagHeader = document.createElement('div');
    bagHeader.style.cssText = `
      font-size: 10px;
      color: #888;
      margin-bottom: 4px;
      padding-bottom: 2px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    `;
    bagHeader.textContent = `🎒 バッグ (${bags.length}個 = +${bags.length * 2}枠)`;
    listEl.appendChild(bagHeader);
    
    for (const bag of bags) {
      const bagEl = createEquipmentItemElement(bag, true);
      listEl.appendChild(bagEl);
    }
    
    // 区切り線
    const separator = document.createElement('div');
    separator.style.cssText = `
      height: 1px;
      background: rgba(255,255,255,0.2);
      margin: 6px 0;
    `;
    listEl.appendChild(separator);
  }
  
  // 装備アイテムを表示
  for (const item of items) {
    const itemEl = createEquipmentItemElement(item, false);
    listEl.appendChild(itemEl);
  }
  
  // 空きスロットを表示（最大3つまで）
  const emptyCount = Math.min(3, max - used);
  for (let i = 0; i < emptyCount; i++) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'equipment-item empty';
    emptyEl.style.cssText = `
      padding: 4px 8px;
      background: rgba(0,0,0,0.2);
      border-radius: 4px;
      border: 1px dashed rgba(255,255,255,0.2);
      margin-bottom: 4px;
      font-size: 11px;
      color: #666;
      text-align: center;
    `;
    emptyEl.textContent = '[空き]';
    listEl.appendChild(emptyEl);
  }
  
  // 残りの空きスロットがある場合
  if (max - used > 3) {
    const moreEl = document.createElement('div');
    moreEl.style.cssText = `
      font-size: 10px;
      color: #666;
      text-align: center;
    `;
    moreEl.textContent = `+${max - used - 3}枠`;
    listEl.appendChild(moreEl);
  }
}

/**
 * 装備アイテム要素を作成
 * @param {Object} item アイテム
 * @param {boolean} isBag バッグかどうか
 * @returns {HTMLElement}
 */
function createEquipmentItemElement(item, isBag) {
  const itemEl = document.createElement('div');
  itemEl.className = 'equipment-item';
  
  const valueText = item.effect === 'slotExpand' 
    ? `+${item.value}枠` 
    : `${item.value > 0 ? '+' : ''}${(item.value * 100).toFixed(0)}%`;
  
  const effectLabel = EFFECT_LABELS[item.effect] || item.effect;
  const shopDisplay = item.shopNameJa || item.shopName || '';
  
  itemEl.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    background: rgba(0,0,0,0.4);
    border-radius: 4px;
    border-left: 3px solid ${item.color};
    margin-bottom: 4px;
    font-size: 11px;
    ${isBag ? 'opacity: 0.8;' : ''}
  `;
  
  itemEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="font-size:16px;">${item.icon}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:bold;">${item.nameJa || item.name}</span>
      <span style="color:${item.color};font-weight:bold;">${effectLabel}${valueText}</span>
    </div>
    ${shopDisplay ? `<div style="font-size:9px;color:#888;margin-left:22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📍 ${shopDisplay}</div>` : ''}
  `;
  
  itemEl.title = `${item.nameJa || item.name}\n${effectLabel}: ${valueText}\nfrom: ${item.shopNameJa || item.shopName || '???'}`;
  
  return itemEl;
}

// ============================================================
// 円形レーダー
// ============================================================

/** レーダーの設定 */
const RADAR_CONFIG = {
  /** レーダーの半径（CSS上のピクセル） */
  radius: 75,
  /** レーダーの表示範囲（メートル） */
  range: 80,
  /** 最大ドット数 */
  maxDots: 50,
};

/**
 * 円形レーダーを更新
 * @param {Object} playerPos プレイヤーの位置 { x, y, z }
 * @param {number} yaw プレイヤーの向き（ラジアン）
 * @param {Array} enemies 敵の配列
 * @param {Array} droppedMasks ドロップマスクの配列
 * @param {Array} foods 食べ物の配列（オプション）
 * @param {Array} equipments 装備の配列（オプション）
 * @param {Object} rival ライバル（オプション）
 */
export function updateRadar(playerPos, yaw, enemies = [], droppedMasks = [], foods = [], equipments = [], rival = null) {
  const dotsContainer = document.getElementById('radarDots');
  const rangeEl = document.getElementById('radarRange');
  const northEl = document.getElementById('radarNorth');
  if (!dotsContainer) return;
  
  // Nマーカーを実際の北方向に回転（yawに応じて回転）
  // yaw=0の時、プレイヤーは-Z（北）を向いている → Nは上
  // yaw増加で左旋回 → Nは右に回転
  if (northEl) {
    const northAngleDeg = (yaw * 180 / Math.PI);
    northEl.style.transform = `rotate(${northAngleDeg}deg)`;
  }
  
  // ドットをクリア
  dotsContainer.innerHTML = '';
  
  const { radius, range, maxDots } = RADAR_CONFIG;
  let dotCount = 0;
  
  /**
   * ワールド座標をレーダー座標に変換
   */
  function worldToRadar(targetX, targetZ) {
    // プレイヤーからの相対位置
    const dx = targetX - playerPos.x;
    const dz = targetZ - playerPos.z;
    
    // 距離
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    // プレイヤーの向きを考慮して回転（前方が上になるように）
    // yaw=0の時、カメラは-Z方向を向いている
    // 左旋回（A）でyaw増加 → レーダーは右に回転するべき
    const rotatedX = dx * Math.cos(-yaw) + dz * Math.sin(-yaw);
    const rotatedZ = -dx * Math.sin(-yaw) + dz * Math.cos(-yaw);
    
    // 距離が0の場合は中心に
    if (dist < 0.1) {
      return {
        x: radius,
        y: radius,
        dist: 0,
        outOfRange: false,
      };
    }
    
    // 範囲内に収める
    let normalizedDist = dist / range;
    if (normalizedDist > 1) normalizedDist = 1;
    
    // レーダー座標（中心が0,0、前方が上）
    const radarX = (rotatedX / dist) * normalizedDist * radius;
    const radarY = (rotatedZ / dist) * normalizedDist * radius;
    
    return {
      x: radius + radarX,
      y: radius + radarY,
      dist,
      outOfRange: dist > range,
    };
  }
  
  /**
   * ドットを追加
   */
  function addDot(x, y, className, color = null, outOfRange = false) {
    if (dotCount >= maxDots) return;
    dotCount++;
    
    const dot = document.createElement('div');
    dot.className = `radar-dot ${className}`;
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    if (color) {
      dot.style.background = color;
      dot.style.color = color;
    }
    if (outOfRange) {
      dot.style.opacity = '0.5';
    }
    dotsContainer.appendChild(dot);
  }
  
  // ライバルを表示（最優先）
  if (rival && rival.isAlive) {
    const pos = worldToRadar(rival.x, rival.z);
    addDot(pos.x, pos.y, 'radar-dot-rival', null, pos.outOfRange);
  }
  
  // 敵を表示
  for (const enemy of enemies) {
    if (!enemy.isAlive) continue;
    if (rival && enemy === rival) continue; // ライバルは別表示済み
    
    const pos = worldToRadar(enemy.x, enemy.z);
    addDot(pos.x, pos.y, 'radar-dot-enemy', null, pos.outOfRange);
  }
  
  // マスクを表示
  for (const mask of droppedMasks) {
    if (mask.collected) continue;
    
    const pos = worldToRadar(mask.x, mask.z);
    const color = `#${mask.color.toString(16).padStart(6, '0')}`;
    addDot(pos.x, pos.y, 'radar-dot-mask', color, pos.outOfRange);
  }
  
  // 装備を表示（オプション）
  for (const equip of equipments) {
    if (equip.collected) continue;
    
    const pos = worldToRadar(equip.x, equip.z);
    const color = `#${equip.color.toString(16).padStart(6, '0')}`;
    addDot(pos.x, pos.y, 'radar-dot-equipment', color, pos.outOfRange);
  }
  
  // 範囲表示を更新
  if (rangeEl) {
    rangeEl.textContent = `${range}m`;
  }
}

// ============================================================
// 敵ラベル（3D空間上のUI）
// ============================================================

/** 敵ラベル用の要素プール */
const enemyLabelPool = [];
let activeEnemyLabels = 0;

/**
 * 敵ラベルを更新（3D座標をスクリーン座標に変換して表示）
 * @param {Array} enemies 敵リスト
 * @param {THREE.Camera} camera カメラ
 * @param {Object} playerPos プレイヤー位置
 * @param {Object} rival ライバル（存在すれば）
 */
export function updateEnemyLabels(enemies, camera, playerPos, rival = null) {
  const container = document.getElementById('enemyLabels');
  if (!container) return;
  
  // 画面サイズ
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // ラベル表示の最大距離
  const MAX_LABEL_DISTANCE = 150;
  
  // 表示対象の敵をリストアップ
  const visibleEnemies = [];
  
  // ライバルを先に追加（優先表示）
  if (rival && rival.isAlive) {
    const dx = rival.x - playerPos.x;
    const dz = rival.z - playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < MAX_LABEL_DISTANCE) {
      visibleEnemies.push({ enemy: rival, dist, isRival: true });
    }
  }
  
  // 通常の敵
  for (const enemy of enemies) {
    if (!enemy.isAlive) continue;
    if (rival && enemy === rival) continue;
    
    const dx = enemy.x - playerPos.x;
    const dz = enemy.z - playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < MAX_LABEL_DISTANCE) {
      visibleEnemies.push({ enemy, dist, isRival: false });
    }
  }
  
  // 距離順にソート（近い順）
  visibleEnemies.sort((a, b) => a.dist - b.dist);
  
  // 最大表示数
  const MAX_LABELS = 10;
  const toShow = visibleEnemies.slice(0, MAX_LABELS);
  
  // プールから要素を確保または作成
  while (enemyLabelPool.length < toShow.length) {
    const label = document.createElement('div');
    label.className = 'enemy-label';
    label.innerHTML = `
      <div class="enemy-label-name"></div>
      <div class="enemy-label-hp-bar"><div class="enemy-label-hp-fill"></div></div>
      <div class="enemy-label-masks"></div>
      <div class="enemy-label-distance"></div>
      <div class="enemy-label-speed"></div>
    `;
    label.style.display = 'none';
    container.appendChild(label);
    enemyLabelPool.push(label);
  }
  
  // 全ラベルを非表示にリセット
  for (let i = 0; i < enemyLabelPool.length; i++) {
    enemyLabelPool[i].style.display = 'none';
  }
  
  // 表示する敵のラベルを更新
  for (let i = 0; i < toShow.length; i++) {
    const { enemy, dist, isRival } = toShow[i];
    const label = enemyLabelPool[i];
    
    // 3D座標をスクリーン座標に変換
    const pos3D = { x: enemy.x, y: enemy.y + 4, z: enemy.z };
    const screenPos = worldToScreen(pos3D, camera, width, height);
    
    // 画面外または背後なら非表示
    if (!screenPos.visible) {
      continue;
    }
    
    // 位置を設定
    label.style.left = `${screenPos.x}px`;
    label.style.top = `${screenPos.y}px`;
    label.style.display = 'flex';
    
    // 距離に応じて透明度を調整
    const opacity = Math.max(0.3, 1 - dist / MAX_LABEL_DISTANCE);
    label.style.opacity = opacity.toString();
    
    // 名前
    const nameEl = label.querySelector('.enemy-label-name');
    const enemyName = enemy.masks[0]?.nameJa || '敵';
    nameEl.textContent = isRival ? `★ ${enemyName} ★` : enemyName;
    nameEl.style.color = isRival ? '#ff4444' : `#${(enemy.masks[0]?.color ?? 0xffffff).toString(16).padStart(6, '0')}`;
    
    // HP
    const hpFill = label.querySelector('.enemy-label-hp-fill');
    const hpRatio = enemy.hp / enemy.maxHp;
    hpFill.style.width = `${hpRatio * 100}%`;
    hpFill.className = 'enemy-label-hp-fill';
    if (hpRatio <= 0.25) {
      hpFill.classList.add('hp-low');
    } else if (hpRatio <= 0.5) {
      hpFill.classList.add('hp-mid');
    }
    
    // マスク
    const masksEl = label.querySelector('.enemy-label-masks');
    masksEl.innerHTML = '';
    for (let m = 0; m < Math.min(enemy.masks.length, 8); m++) {
      const maskDot = document.createElement('div');
      maskDot.className = 'enemy-label-mask';
      const maskColor = `#${enemy.masks[m].color.toString(16).padStart(6, '0')}`;
      maskDot.style.background = maskColor;
      maskDot.style.color = maskColor;
      masksEl.appendChild(maskDot);
    }
    if (enemy.masks.length > 8) {
      const more = document.createElement('span');
      more.style.cssText = 'font-size:8px;color:#fff;margin-left:2px;';
      more.textContent = `+${enemy.masks.length - 8}`;
      masksEl.appendChild(more);
    }
    
    // 距離
    const distEl = label.querySelector('.enemy-label-distance');
    distEl.textContent = `${Math.round(dist)}m`;
    
    // 速度
    const speedEl = label.querySelector('.enemy-label-speed');
    if (enemy.speed >= 14) {
      speedEl.textContent = '超高速';
      speedEl.style.color = '#ff4444';
    } else if (enemy.speed >= 11) {
      speedEl.textContent = '高速';
      speedEl.style.color = '#ff8844';
    } else if (enemy.speed <= 5) {
      speedEl.textContent = '低速';
      speedEl.style.color = '#88ff88';
    } else {
      speedEl.textContent = '';
    }
  }
  
  activeEnemyLabels = toShow.length;
}

/**
 * 3Dワールド座標をスクリーン座標に変換
 */
function worldToScreen(pos, camera, width, height) {
  // THREE.jsのVector3を使わずに計算
  const vec = [pos.x, pos.y, pos.z, 1];
  
  // カメラのビュー・プロジェクション行列を適用
  const viewProjection = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
  const m = viewProjection.elements;
  
  // 行列×ベクトル
  const x = m[0] * vec[0] + m[4] * vec[1] + m[8] * vec[2] + m[12] * vec[3];
  const y = m[1] * vec[0] + m[5] * vec[1] + m[9] * vec[2] + m[13] * vec[3];
  const w = m[3] * vec[0] + m[7] * vec[1] + m[11] * vec[2] + m[15] * vec[3];
  
  // 背後にある場合
  if (w <= 0) {
    return { x: 0, y: 0, visible: false };
  }
  
  // NDCに変換
  const ndcX = x / w;
  const ndcY = y / w;
  
  // 画面外チェック
  if (ndcX < -1.2 || ndcX > 1.2 || ndcY < -1.2 || ndcY > 1.2) {
    return { x: 0, y: 0, visible: false };
  }
  
  // スクリーン座標に変換
  const screenX = (ndcX + 1) * 0.5 * width;
  const screenY = (1 - ndcY) * 0.5 * height;
  
  return { x: screenX, y: screenY, visible: true };
}
