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
