/**
 * サウンドシステム
 * 
 * Web Audio APIを使用した効果音生成
 * 将来的にはサウンドファイルに差し替え可能
 */

/** オーディオコンテキスト */
let audioContext = null;

/** マスターボリューム（0.0〜1.0） */
let masterVolume = 0.3;

/** サウンド有効フラグ */
let soundEnabled = true;

/**
 * オーディオコンテキストを初期化
 */
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  // サスペンド状態なら再開
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * サウンドシステムを初期化（ユーザーインタラクション後に呼び出す）
 */
export function initSound() {
  getAudioContext();
}

/**
 * サウンドの有効/無効を切り替え
 */
export function setSoundEnabled(enabled) {
  soundEnabled = enabled;
}

/**
 * マスターボリュームを設定
 */
export function setMasterVolume(volume) {
  masterVolume = Math.max(0, Math.min(1, volume));
}

/**
 * 基本的なビープ音を再生
 */
function playTone(frequency, duration, type = 'sine', volume = 1.0, attack = 0.01, decay = 0.1) {
  if (!soundEnabled) return;
  
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    
    const now = ctx.currentTime;
    const vol = volume * masterVolume;
    
    // エンベロープ（ADSR簡易版）
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(vol, now + attack);
    gainNode.gain.linearRampToValueAtTime(vol * 0.7, now + attack + decay);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch (e) {
    console.warn('[Sound] 再生エラー:', e);
  }
}

/**
 * 複数音を連続再生
 */
function playSequence(notes, baseVolume = 1.0) {
  if (!soundEnabled) return;
  
  try {
    const ctx = getAudioContext();
    let time = ctx.currentTime;
    
    for (const note of notes) {
      const { freq, dur, type = 'sine', vol = 1.0 } = note;
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = type;
      oscillator.frequency.value = freq;
      
      const volume = vol * baseVolume * masterVolume;
      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(volume, time + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, time + dur);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(time);
      oscillator.stop(time + dur);
      
      time += dur * 0.8; // 少し重ねる
    }
  } catch (e) {
    console.warn('[Sound] シーケンス再生エラー:', e);
  }
}

/**
 * ノイズを再生
 */
function playNoise(duration, volume = 1.0) {
  if (!soundEnabled) return;
  
  try {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    const vol = volume * masterVolume;
    
    gainNode.gain.setValueAtTime(vol, now);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);
    
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    source.start(now);
  } catch (e) {
    console.warn('[Sound] ノイズ再生エラー:', e);
  }
}

// ============================================================
// 効果音定義
// ============================================================

/**
 * アイテム（食べ物）取得
 */
export function playSoundItemPickup() {
  playSequence([
    { freq: 880, dur: 0.08, type: 'sine' },
    { freq: 1100, dur: 0.1, type: 'sine' },
  ], 0.5);
}

/**
 * 装備取得
 */
export function playSoundEquipmentPickup() {
  playSequence([
    { freq: 440, dur: 0.1, type: 'triangle' },
    { freq: 660, dur: 0.1, type: 'triangle' },
    { freq: 880, dur: 0.15, type: 'triangle' },
  ], 0.6);
}

/**
 * マスク取得
 */
export function playSoundMaskPickup() {
  playSequence([
    { freq: 523, dur: 0.1, type: 'sine' },
    { freq: 659, dur: 0.1, type: 'sine' },
    { freq: 784, dur: 0.1, type: 'sine' },
    { freq: 1047, dur: 0.15, type: 'sine' },
  ], 0.5);
}

/**
 * マスク合成
 */
export function playSoundMaskSynth() {
  playSequence([
    { freq: 440, dur: 0.08, type: 'sine' },
    { freq: 880, dur: 0.08, type: 'sine' },
    { freq: 1320, dur: 0.15, type: 'sine' },
  ], 0.6);
}

/**
 * プレイヤー攻撃
 */
export function playSoundAttack() {
  playTone(220, 0.1, 'sawtooth', 0.4, 0.01, 0.02);
  playNoise(0.08, 0.2);
}

/**
 * 被ダメージ
 */
export function playSoundDamage() {
  playTone(150, 0.15, 'sawtooth', 0.5, 0.01, 0.05);
  playNoise(0.1, 0.3);
}

/**
 * 敵撃破
 */
export function playSoundEnemyDefeat() {
  playSequence([
    { freq: 330, dur: 0.08, type: 'square', vol: 0.4 },
    { freq: 220, dur: 0.1, type: 'square', vol: 0.3 },
    { freq: 110, dur: 0.15, type: 'square', vol: 0.2 },
  ], 0.5);
  playNoise(0.15, 0.2);
}

/**
 * 成長選択表示
 */
export function playSoundGrowth() {
  playSequence([
    { freq: 523, dur: 0.15, type: 'sine' },
    { freq: 659, dur: 0.15, type: 'sine' },
    { freq: 784, dur: 0.2, type: 'sine' },
  ], 0.5);
}

/**
 * 成長完了
 */
export function playSoundGrowthComplete() {
  playSequence([
    { freq: 784, dur: 0.1, type: 'triangle' },
    { freq: 988, dur: 0.1, type: 'triangle' },
    { freq: 1175, dur: 0.15, type: 'triangle' },
    { freq: 1568, dur: 0.2, type: 'triangle' },
  ], 0.6);
}

/**
 * ライバル出現
 */
export function playSoundRivalAppear() {
  playSequence([
    { freq: 220, dur: 0.2, type: 'sawtooth', vol: 0.6 },
    { freq: 165, dur: 0.3, type: 'sawtooth', vol: 0.5 },
    { freq: 110, dur: 0.4, type: 'sawtooth', vol: 0.4 },
  ], 0.7);
}

/**
 * 敗北
 */
export function playSoundDefeat() {
  playSequence([
    { freq: 440, dur: 0.3, type: 'sine', vol: 0.5 },
    { freq: 392, dur: 0.3, type: 'sine', vol: 0.4 },
    { freq: 349, dur: 0.3, type: 'sine', vol: 0.3 },
    { freq: 330, dur: 0.5, type: 'sine', vol: 0.2 },
  ], 0.6);
}

/**
 * 転生
 */
export function playSoundReincarnate() {
  playSequence([
    { freq: 262, dur: 0.15, type: 'sine' },
    { freq: 330, dur: 0.15, type: 'sine' },
    { freq: 392, dur: 0.15, type: 'sine' },
    { freq: 523, dur: 0.15, type: 'sine' },
    { freq: 659, dur: 0.15, type: 'sine' },
    { freq: 784, dur: 0.2, type: 'sine' },
  ], 0.5);
}

/**
 * 境界警告
 */
export function playSoundBoundaryWarning() {
  playTone(440, 0.15, 'square', 0.3, 0.01, 0.05);
}

/**
 * マスクドロップ（プレイヤーが落とす）
 */
export function playSoundMaskDrop() {
  playSequence([
    { freq: 660, dur: 0.1, type: 'sine', vol: 0.5 },
    { freq: 440, dur: 0.1, type: 'sine', vol: 0.4 },
    { freq: 330, dur: 0.15, type: 'sine', vol: 0.3 },
  ], 0.5);
}

/**
 * 敵がマスクを拾った
 */
export function playSoundEnemyPickupMask() {
  playSequence([
    { freq: 330, dur: 0.1, type: 'square', vol: 0.3 },
    { freq: 440, dur: 0.12, type: 'square', vol: 0.4 },
  ], 0.4);
}
