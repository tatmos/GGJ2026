/**
 * インベントリ（装備スロット）管理モジュール
 * 
 * 装備と宝石は同じスロットを共有。
 * バッグは別枠（無制限）で、装備スロットを拡張する。
 */

/** 初期スロット数 */
export const BASE_SLOT_COUNT = 5;

/** バッグ1つあたりのスロット増加量 */
export const SLOTS_PER_BAG = 2;

/**
 * インベントリを初期化
 * @returns {Object} インベントリ状態
 */
export function createInventory() {
  return {
    baseSlots: BASE_SLOT_COUNT,
    bags: [],      // バッグの配列（別枠・無制限）
    items: []      // 装備アイテムの配列（宝石・装備）
  };
}

/**
 * 現在の最大スロット数を取得
 * @param {Object} inventory
 * @returns {number}
 */
export function getMaxSlots(inventory) {
  const bagBonus = inventory.bags.length * SLOTS_PER_BAG;
  return inventory.baseSlots + bagBonus;
}

/**
 * バッグの数を取得
 * @param {Object} inventory
 * @returns {number}
 */
export function getBagCount(inventory) {
  return inventory.bags.length;
}

/**
 * 空きスロット数を取得
 * @param {Object} inventory
 * @returns {number}
 */
export function getEmptySlots(inventory) {
  return getMaxSlots(inventory) - inventory.items.length;
}

/**
 * アイテムを追加できるかチェック
 * @param {Object} inventory
 * @returns {boolean}
 */
export function canAddItem(inventory) {
  return getEmptySlots(inventory) > 0;
}

/**
 * アイテムを追加
 * @param {Object} inventory
 * @param {Object} item 装備アイテム
 * @returns {boolean} 追加成功したかどうか
 */
export function addItem(inventory, item) {
  // バッグの場合は別枠（無制限）に追加
  if (item.typeId === 'bag' || item.effect === 'slotExpand') {
    inventory.bags.push({
      ...item,
      addedAt: Date.now()
    });
    return true;
  }
  
  // 通常の装備・宝石はスロットをチェック
  if (!canAddItem(inventory)) {
    return false;
  }
  
  inventory.items.push({
    ...item,
    addedAt: Date.now()
  });
  
  return true;
}

/**
 * バッグかどうかを判定
 * @param {Object} item
 * @returns {boolean}
 */
export function isBag(item) {
  return item.typeId === 'bag' || item.effect === 'slotExpand';
}

/**
 * アイテムを削除
 * @param {Object} inventory
 * @param {number} index アイテムのインデックス
 * @returns {Object|null} 削除されたアイテム
 */
export function removeItem(inventory, index) {
  if (index < 0 || index >= inventory.items.length) {
    return null;
  }
  
  const [removed] = inventory.items.splice(index, 1);
  return removed;
}

/**
 * バッグを削除
 * @param {Object} inventory
 * @param {number} index バッグのインデックス
 * @returns {Object|null} 削除されたバッグ
 */
export function removeBag(inventory, index) {
  if (index < 0 || index >= inventory.bags.length) {
    return null;
  }
  
  const [removed] = inventory.bags.splice(index, 1);
  
  // スロット数が減った結果、アイテムがあふれる場合は最後のアイテムから削除
  while (inventory.items.length > getMaxSlots(inventory)) {
    inventory.items.pop();
  }
  
  return removed;
}

/**
 * 効果の合計値を計算
 * @param {Object} inventory
 * @param {string} effectType 効果タイプ
 * @returns {number} 合計値（パーセント効果は小数、slotExpandは整数）
 */
export function getTotalEffect(inventory, effectType) {
  let total = 0;
  for (const item of inventory.items) {
    if (item.effect === effectType) {
      total += item.value;
    }
    // allStatsは全ての効果に少量加算
    if (item.effect === 'allStats' && effectType !== 'slotExpand') {
      total += item.value;
    }
  }
  return total;
}

/**
 * 全効果の乗数を計算して返す
 * @param {Object} inventory
 * @returns {Object} 効果名 -> 乗数 のマップ
 */
export function getEffectMultipliers(inventory) {
  const effects = {
    attack: 1.0,
    defense: 1.0,
    speed: 1.0,
    verticalSpeed: 1.0,
    groundSpeed: 1.0,
    pickupRange: 1.0,
    magnetism: 1.0,
    detection: 1.0,
    buffDuration: 1.0,
    recoveryCooldown: 1.0,
    energyRegen: 1.0,
    foodBuffBoost: 1.0
  };
  
  for (const key of Object.keys(effects)) {
    const bonus = getTotalEffect(inventory, key);
    if (key === 'recoveryCooldown') {
      // recoveryCooldownは減少効果なので1から引く
      effects[key] = Math.max(0.1, 1.0 + bonus); // bonusは負の値
    } else {
      effects[key] = 1.0 + bonus;
    }
  }
  
  return effects;
}

/**
 * UI表示用のアイテムリストを取得
 * @param {Object} inventory
 * @returns {Array}
 */
export function getItemsForDisplay(inventory) {
  return inventory.items.map((item, index) => ({
    index,
    ...item
  }));
}

/**
 * UI表示用のバッグリストを取得
 * @param {Object} inventory
 * @returns {Array}
 */
export function getBagsForDisplay(inventory) {
  return inventory.bags.map((bag, index) => ({
    index,
    ...bag
  }));
}

/**
 * インベントリ状態のサマリーを取得
 * @param {Object} inventory
 * @returns {Object}
 */
export function getInventorySummary(inventory) {
  return {
    used: inventory.items.length,
    max: getMaxSlots(inventory),
    empty: getEmptySlots(inventory),
    bagCount: inventory.bags.length
  };
}
