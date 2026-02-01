/**
 * 一時バフの種類定義（食べ物・薬など）。
 * duration: 持続時間（秒）。0 は即時効果（キューに乗せず即適用）。
 * effect: 'energy' | 'speedMultiplier' | 'recoveryCooldownScale' など
 */
export const BUFF_TYPES = {
  energy: {
    name: 'エネルギー',
    duration: 0,
    effect: 'energy',
    value: 25
  },
  speedUp: {
    name: '速度Up',
    duration: 30,
    effect: 'speedMultiplier',
    value: 1.2
  },
  recoveryCooldownShort: {
    name: '回復短縮',
    duration: 45,
    effect: 'recoveryCooldownScale',
    value: 0.5
  }
};

/**
 * 現在のアクティブバフから速度倍率を計算。ベースは 1。
 */
export function getSpeedMultiplierFromBuff(activeBuff) {
  if (!activeBuff || !BUFF_TYPES[activeBuff.typeId]) return 1;
  const def = BUFF_TYPES[activeBuff.typeId];
  if (def.effect !== 'speedMultiplier') return 1;
  return def.value ?? 1;
}

/**
 * 現在のアクティブバフから回復クールダウン倍率を計算。ベースは 1（変更なし）。
 */
export function getRecoveryCooldownScaleFromBuff(activeBuff) {
  if (!activeBuff || !BUFF_TYPES[activeBuff.typeId]) return 1;
  const def = BUFF_TYPES[activeBuff.typeId];
  if (def.effect !== 'recoveryCooldownScale') return 1;
  return def.value ?? 1;
}

/**
 * バフキューを 1 フレーム進める。activeBuff の残り時間を減らし、0 になったらキューから次を取り出す。
 * state: { activeBuff: { typeId, durationRemaining, durationMax, shopName?, shopNameJa?, cuisine? } | null, buffQueue: [...] }
 */
export function tickBuffQueue(state, dt) {
  if (!state.activeBuff) {
    if (state.buffQueue && state.buffQueue.length > 0) {
      const next = state.buffQueue.shift();
      const def = BUFF_TYPES[next.typeId];
      state.activeBuff = {
        typeId: next.typeId,
        durationRemaining: (def && def.duration) ?? 0,
        durationMax: (def && def.duration) ?? 0,
        shopName: next.shopName || '',
        shopNameJa: next.shopNameJa || '',
        cuisine: next.cuisine || ''
      };
    } else return;
  }
  state.activeBuff.durationRemaining -= dt;
  if (state.activeBuff.durationRemaining <= 0) {
    state.activeBuff = null;
    tickBuffQueue(state, 0);
  }
}

/**
 * 取得したアイテムをキューに追加（または即時効果なら何もしない）。
 * 即時効果の場合は呼び出し側でエネルギー等を加算すること。
 * state: { activeBuff, buffQueue }
 * @param {object} state ゲーム状態
 * @param {string} typeId バフタイプID
 * @param {object} [itemInfo] アイテム情報 { shopName, shopNameJa, cuisine }
 * @param {object} [multipliers] 装備効果 { buffDuration, foodBuffBoost }
 * @returns { 'energy', value } | null 即時効果なら { effect, value }、それ以外は null
 */
export function addBuffToQueue(state, typeId, itemInfo, multipliers) {
  const def = BUFF_TYPES[typeId];
  if (!def) return null;
  
  // 装備効果を適用
  const durationMult = multipliers?.buffDuration ?? 1;
  const valueMult = multipliers?.foodBuffBoost ?? 1;
  
  if (def.duration <= 0) {
    // 即時効果（エネルギー回復など）にも食事バフ強化を適用
    return { effect: def.effect, value: def.value * valueMult };
  }
  
  if (!state.buffQueue) state.buffQueue = [];
  const effectiveDuration = def.duration * durationMult;
  const item = {
    typeId,
    durationMax: effectiveDuration,
    shopName: itemInfo?.shopName || '',
    shopNameJa: itemInfo?.shopNameJa || '',
    cuisine: itemInfo?.cuisine || ''
  };
  if (!state.activeBuff) {
    state.activeBuff = {
      typeId,
      durationRemaining: effectiveDuration,
      durationMax: effectiveDuration,
      shopName: item.shopName,
      shopNameJa: item.shopNameJa,
      cuisine: item.cuisine
    };
  } else {
    state.buffQueue.push(item);
  }
  return null;
}

/** UI用: アクティブバフを [ { id, name, remainingSec, durationMax, shopName, shopNameJa, cuisine } ] 形式に */
export function getActiveBuffsForDisplay(state) {
  if (!state.activeBuff) return [];
  const def = BUFF_TYPES[state.activeBuff.typeId];
  return [{
    id: state.activeBuff.typeId,
    name: def ? def.name : state.activeBuff.typeId,
    remainingSec: state.activeBuff.durationRemaining,
    durationMax: state.activeBuff.durationMax || (def ? def.duration : 30),
    shopName: state.activeBuff.shopName || '',
    shopNameJa: state.activeBuff.shopNameJa || '',
    cuisine: state.activeBuff.cuisine || ''
  }];
}

/** UI用: キューを [ { id, name, shopName, shopNameJa, cuisine } ] 形式に */
export function getBuffQueueForDisplay(state) {
  if (!state.buffQueue || state.buffQueue.length === 0) return [];
  return state.buffQueue.map((b) => {
    const def = BUFF_TYPES[b.typeId];
    return {
      id: b.typeId,
      name: def ? def.name : b.typeId,
      shopName: b.shopName || '',
      shopNameJa: b.shopNameJa || '',
      cuisine: b.cuisine || ''
    };
  });
}
