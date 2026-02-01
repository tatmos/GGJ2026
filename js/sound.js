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

/**
 * フィルター付きノイズを再生（より心地よい音）
 * @param {number} duration 持続時間
 * @param {number} volume 音量
 * @param {string} filterType フィルタータイプ ('lowpass', 'highpass', 'bandpass')
 * @param {number} filterFreq フィルター周波数
 * @param {number} attack アタック時間
 * @param {number} release リリース時間
 */
function playFilteredNoise(duration, volume, filterType = 'lowpass', filterFreq = 1000, attack = 0.01, release = null) {
  if (!soundEnabled) return;
  
  try {
    const ctx = getAudioContext();
    const bufferSize = Math.floor(ctx.sampleRate * (duration + 0.5));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // フィルター
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = 1;
    
    // ゲイン（エンベロープ）
    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    const vol = volume * masterVolume;
    const rel = release ?? duration * 0.8;
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(vol, now + attack);
    gainNode.gain.setValueAtTime(vol, now + duration - rel);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);
    
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    source.start(now);
    source.stop(now + duration + 0.1);
  } catch (e) {
    console.warn('[Sound] フィルターノイズ再生エラー:', e);
  }
}

/**
 * ノイズ + トーンの合成音（爆発的な音）
 */
function playImpactNoise(baseFreq, duration, volume, sweepDown = true) {
  if (!soundEnabled) return;
  
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const vol = volume * masterVolume;
    
    // ノイズ成分
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = baseFreq * 2;
    noiseFilter.Q.value = 0.5;
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    // トーン成分（周波数スイープ）
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq, now);
    if (sweepDown) {
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, now + duration);
    } else {
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + duration * 0.5);
    }
    
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(vol * 0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    
    noiseSource.start(now);
    noiseSource.stop(now + duration);
    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {
    console.warn('[Sound] インパクトノイズ再生エラー:', e);
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
 * プレイヤー攻撃（ノイズ主体の心地よいヒット音）
 */
export function playSoundAttack() {
  // 高周波ノイズの「シュッ」という音
  playFilteredNoise(0.08, 0.4, 'highpass', 2000, 0.005, 0.06);
  playTone(440, 0.05, 'square', 0.2, 0.005, 0.02);
}

/**
 * 攻撃ヒット（良い攻撃をしたとき）
 */
export function playSoundAttackHit() {
  // 心地よいノイズ + 高音
  playImpactNoise(600, 0.12, 0.5, false);
  playFilteredNoise(0.1, 0.3, 'bandpass', 3000, 0.01, 0.08);
}

/**
 * クリティカルヒット（大ダメージ時）
 */
export function playSoundCriticalHit() {
  // 派手なインパクト音
  playImpactNoise(800, 0.15, 0.6, false);
  playFilteredNoise(0.12, 0.4, 'highpass', 2500, 0.01, 0.1);
  playTone(880, 0.08, 'square', 0.3, 0.005, 0.03);
}

/**
 * 被ダメージ（ノイズ主体）
 */
export function playSoundDamage() {
  // ザラついたノイズ
  playFilteredNoise(0.15, 0.5, 'bandpass', 400, 0.01, 0.12);
  playTone(120, 0.12, 'sawtooth', 0.4, 0.01, 0.05);
}

/**
 * 敵撃破（爽快なノイズ爆発）
 */
export function playSoundEnemyDefeat() {
  // 爆発的なノイズ
  playImpactNoise(200, 0.25, 0.6, true);
  // 上昇する「キラーン」感
  playFilteredNoise(0.2, 0.35, 'highpass', 1500, 0.02, 0.15);
  // 低音の「ドーン」
  playFilteredNoise(0.3, 0.3, 'lowpass', 300, 0.01, 0.25);
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
 * タイプライター音（1文字ごと）
 */
export function playSoundTypewriter() {
  if (!soundEnabled) return;
  
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // ランダムな周波数でカチカチ音
    const freq = 800 + Math.random() * 400;
    
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    
    const gain = ctx.createGain();
    const vol = masterVolume * 0.08;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.03);
  } catch (e) {
    // ignore
  }
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

// ============================================================
// エンジン音システム（持続音）
// ============================================================

/** アフターバーナー用オシレーター */
let afterburnerOsc = null;
let afterburnerGain = null;
let afterburnerNoiseNode = null;

/** 逆噴射用オシレーター */
let retroOsc = null;
let retroGain = null;

/**
 * アフターバーナー音を開始（W押下時）- ノイズ主体のジェット音
 */
export function startAfterburner() {
  if (!soundEnabled || afterburnerOsc) return;
  
  try {
    const ctx = getAudioContext();
    
    // メインノイズ生成（ジェット音の主成分）
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    afterburnerNoiseNode = ctx.createBufferSource();
    afterburnerNoiseNode.buffer = noiseBuffer;
    afterburnerNoiseNode.loop = true;
    
    // 低域フィルター（ゴォォという低音ノイズ）
    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.value = 400;
    lowFilter.Q.value = 0.5;
    
    // 高域フィルター（シャーという高音ノイズ）
    const highFilter = ctx.createBiquadFilter();
    highFilter.type = 'highpass';
    highFilter.frequency.value = 2000;
    highFilter.Q.value = 0.3;
    
    // LFOでフィルター周波数を揺らす（うねり感）
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 100;
    lfo.connect(lfoGain);
    lfoGain.connect(lowFilter.frequency);
    lfo.start();
    
    // 低域ゲイン
    const lowGain = ctx.createGain();
    lowGain.gain.value = masterVolume * 0.4;
    
    // 高域ゲイン
    const highGain = ctx.createGain();
    highGain.gain.value = masterVolume * 0.2;
    
    // マスターゲイン（フェードイン）
    afterburnerGain = ctx.createGain();
    afterburnerGain.gain.setValueAtTime(0, ctx.currentTime);
    afterburnerGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.08);
    
    // 低音ノイズの2つ目のソース
    const noiseBuffer2 = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output2 = noiseBuffer2.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output2[i] = Math.random() * 2 - 1;
    }
    afterburnerOsc = ctx.createBufferSource();
    afterburnerOsc.buffer = noiseBuffer2;
    afterburnerOsc.loop = true;
    
    // 接続（低域パス）
    afterburnerNoiseNode.connect(lowFilter);
    lowFilter.connect(lowGain);
    lowGain.connect(afterburnerGain);
    
    // 接続（高域パス）
    afterburnerOsc.connect(highFilter);
    highFilter.connect(highGain);
    highGain.connect(afterburnerGain);
    
    afterburnerGain.connect(ctx.destination);
    
    afterburnerNoiseNode.start();
    afterburnerOsc.start();
    
    // 停止用に保持
    afterburnerOsc._lfo = lfo;
    afterburnerOsc._lowFilter = lowFilter;
    afterburnerOsc._highFilter = highFilter;
  } catch (e) {
    console.warn('Afterburner sound error:', e);
  }
}

/**
 * アフターバーナー音を停止
 */
export function stopAfterburner() {
  if (!afterburnerOsc) return;
  
  try {
    const ctx = getAudioContext();
    afterburnerGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    
    const osc = afterburnerOsc;
    const noise = afterburnerNoiseNode;
    const lfo = osc._lfo;
    
    setTimeout(() => {
      try {
        osc.stop();
        lfo.stop();
        noise.stop();
      } catch (e) {}
    }, 200);
    
    afterburnerOsc = null;
    afterburnerNoiseNode = null;
    afterburnerGain = null;
  } catch (e) {
    console.warn('Afterburner stop error:', e);
  }
}

/**
 * 逆噴射音を開始（S押下時）- ノイズ主体の減速音
 */
export function startRetroThrust() {
  if (!soundEnabled || retroOsc) return;
  
  try {
    const ctx = getAudioContext();
    
    // ノイズ生成（プシューという音）
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    retroOsc = ctx.createBufferSource();
    retroOsc.buffer = noiseBuffer;
    retroOsc.loop = true;
    
    // バンドパスフィルター（シューという音域を強調）
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 0.8;
    
    // LFOでフィルター周波数を揺らす（パルス感）
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 8;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    
    // 高域フィルター（追加のシュワシュワ感）
    const highFilter = ctx.createBiquadFilter();
    highFilter.type = 'highpass';
    highFilter.frequency.value = 3000;
    
    // ゲイン
    retroGain = ctx.createGain();
    retroGain.gain.setValueAtTime(0, ctx.currentTime);
    retroGain.gain.linearRampToValueAtTime(masterVolume * 0.3, ctx.currentTime + 0.05);
    
    // 高域用ゲイン
    const highGain = ctx.createGain();
    highGain.gain.value = masterVolume * 0.15;
    
    // 接続
    retroOsc.connect(filter);
    filter.connect(retroGain);
    
    // 高域ブランチ
    const noiseBuffer2 = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output2 = noiseBuffer2.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output2[i] = Math.random() * 2 - 1;
    }
    const highNoise = ctx.createBufferSource();
    highNoise.buffer = noiseBuffer2;
    highNoise.loop = true;
    highNoise.connect(highFilter);
    highFilter.connect(highGain);
    highGain.connect(retroGain);
    highNoise.start();
    
    retroGain.connect(ctx.destination);
    retroOsc.start();
    
    retroOsc._lfo = lfo;
    retroOsc._filter = filter;
    retroOsc._highNoise = highNoise;
  } catch (e) {
    console.warn('Retro thrust sound error:', e);
  }
}

/**
 * 逆噴射音を停止
 */
export function stopRetroThrust() {
  if (!retroOsc) return;
  
  try {
    const ctx = getAudioContext();
    retroGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
    
    const osc = retroOsc;
    const lfo = osc._lfo;
    const highNoise = osc._highNoise;
    
    setTimeout(() => {
      try {
        osc.stop();
        lfo.stop();
        if (highNoise) highNoise.stop();
      } catch (e) {}
    }, 150);
    
    retroOsc = null;
    retroGain = null;
  } catch (e) {
    console.warn('Retro thrust stop error:', e);
  }
}
