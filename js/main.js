import * as THREE from 'three';
import { createScene } from './scene.js';
import { createProximityUpdater } from './proximity.js';
import {
  getHeightAt,
  createProceduralCity,
  tryLoadPLATEAU,
  addDebugCollisionBoxes,
  removeDebugCollisionBoxes,
  addDebugBoundingBox,
  getDebugBoundingBoxMesh,
  getCityBounds
} from './city.js';
import {
  getFoods,
  addFood,
  updateFoodHeights,
  loadFoodSpawnsFromJson,
  collectRadius,
  energyPerFood
} from './food.js';
import {
  getEquipments,
  updateEquipmentHeights,
  updateEquipmentAnimation,
  loadEquipmentSpawnsFromJson,
  collectEquipment,
  equipmentCollectRadius
} from './equipment.js';
import {
  createInventory,
  canAddItem,
  addItem,
  isBag,
  getEffectMultipliers,
  getItemsForDisplay,
  getBagsForDisplay,
  getInventorySummary
} from './inventory.js';
import {
  tickBuffQueue,
  addBuffToQueue,
  getSpeedMultiplierFromBuff,
  getRecoveryCooldownScaleFromBuff,
  getActiveBuffsForDisplay,
  getBuffQueueForDisplay
} from './buffs.js';
import {
  keys,
  resolveCollisions,
  baseSpeed,
  turnSpeed,
  energyCostPerSec,
  energyRecoveryPerSec,
  verticalSpeed,
  minHeight,
  maxHeight,
  hoverGraceTimeSec,
  recoveryCooldownSec,
  autoDescendSpeed,
  checkBoundaryAndAdjustYaw
} from './player.js';
import {
  updateLoadProgress,
  hideLoading,
  updateEnergyBar,
  updateDirectionMeter,
  updateSpeedMeter,
  updateAltitudeMeter,
  updatePosMeter,
  updateStatusPanel,
  updateSurvivalDisplay,
  updateBoundaryWarning,
  updateMaskList,
  updateBuffQueue,
  updateMaskSensor,
  updateEnemyGuide,
  updateRadar,
  updateEnemyLabels,
  updateBossPanel,
  showItemPopup,
  showEquipmentPopup,
  updateEquipmentUI,
  addCombatLog,
  showGrowthDialog,
  hideGrowthDialog,
  showDefeatDialog,
  showRivalWarning
} from './ui.js';
import {
  ENEMY_CONFIG,
  spawnEnemy,
  getEnemies,
  getAliveEnemies,
  updateEnemies,
  cleanupDeadEnemies
} from './enemy.js';
import {
  playerAttack,
  enemyAttacks,
  updateDamageNumbers,
  COMBAT_CONFIG
} from './combat.js';
import {
  getDroppedMasks,
  updateDroppedMasks,
  collectMask,
  cleanupCollectedMasks,
  dropMask,
  dropMasksFromEnemy,
  createMaskInventory,
  addMaskToInventory,
  getMaskEffects,
  getMasksForDisplay,
  MASK_COLLECT_RADIUS
} from './mask.js';
import {
  initSound,
  playSoundItemPickup,
  playSoundEquipmentPickup,
  playSoundMaskPickup,
  playSoundMaskSynth,
  playSoundAttack,
  playSoundDamage,
  playSoundEnemyDefeat,
  playSoundGrowth,
  playSoundGrowthComplete,
  playSoundRivalAppear,
  playSoundDefeat,
  playSoundReincarnate,
  playSoundMaskDrop,
  playSoundEnemyPickupMask,
  playSoundAttackHit,
  playSoundCriticalHit,
  startAfterburner,
  stopAfterburner,
  startRetroThrust,
  stopRetroThrust
} from './sound.js';
import {
  updateParticles,
  spawnItemPickupEffect,
  spawnEquipmentPickupEffect,
  spawnMaskPickupEffect,
  spawnAttackHitEffect,
  spawnEnemyDefeatEffect,
  spawnDamageEffect,
  spawnLevelUpEffect
} from './particles.js';

const { scene, camera, renderer, ground, checkerTexProximity, cityRoot } = createScene();
document.body.appendChild(renderer.domElement);

const proximity = createProximityUpdater(camera, cityRoot, ground, checkerTexProximity);

// ミニマップ用カメラ（上から見下ろす）
const minimapCamera = new THREE.OrthographicCamera(-80, 80, 80, -80, 1, 500);
minimapCamera.position.set(0, 200, 0);
minimapCamera.lookAt(0, 0, 0);
minimapCamera.up.set(0, 0, -1); // 北が上になるように

// ミニマップ用レンダーターゲット
const minimapSize = 150;
const minimapRenderTarget = new THREE.WebGLRenderTarget(minimapSize, minimapSize);

// ミニマップCanvas
const minimapCanvas = document.getElementById('radarMinimap');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

// 戦闘時PiP用カメラ（俯瞰）
const pipCamera = new THREE.OrthographicCamera(-30, 30, 30, -30, 1, 300);
pipCamera.position.set(0, 100, 0);
pipCamera.lookAt(0, 0, 0);
pipCamera.up.set(0, 0, -1);

// 戦闘時PiP用レンダーターゲット
const pipSize = 180;
const pipRenderTarget = new THREE.WebGLRenderTarget(pipSize, pipSize);

// 戦闘時PiP Canvas
const combatPipEl = document.getElementById('combatPip');
const combatPipCanvas = document.getElementById('combatPipCanvas');
const pipCtx = combatPipCanvas ? combatPipCanvas.getContext('2d') : null;

// 戦闘状態追跡
let combatActive = false;
let combatTarget = null;
let combatFadeTimer = 0;
const COMBAT_FADE_DURATION = 2.0; // 戦闘終了後にフェードアウトするまでの秒数

// マスクドロップ位置追跡（Combat View用）
let maskDropPosition = null;
let maskDropTimer = 0;
const MASK_DROP_VIEW_DURATION = 3.0; // マスクドロップ表示時間

// バックミラー用カメラ（後方確認）
const rearMirrorCamera = new THREE.PerspectiveCamera(60, 2, 1, 500);
const rearMirrorWidth = 240;
const rearMirrorHeight = 120;
const rearMirrorRenderTarget = new THREE.WebGLRenderTarget(rearMirrorWidth, rearMirrorHeight);

const rearMirrorEl = document.getElementById('rearMirror');
const rearMirrorCanvas = document.getElementById('rearMirrorCanvas');
const rearMirrorCtx = rearMirrorCanvas ? rearMirrorCanvas.getContext('2d') : null;

// バックミラー状態
let rearMirrorActive = false;
let rearMirrorTarget = null;
let rearMirrorTimer = 0;
const REAR_MIRROR_DURATION = 2.0; // バックミラー表示時間

/**
 * ミニマップを描画
 */
function renderMinimap() {
  if (!minimapCtx) return;
  
  // カメラをプレイヤーの位置に移動
  minimapCamera.position.x = camera.position.x;
  minimapCamera.position.z = camera.position.z;
  minimapCamera.lookAt(camera.position.x, 0, camera.position.z);
  
  // プレイヤーの向きに合わせてカメラのup方向を設定
  // yawが0のとき北（-Z）が前方、レーダーでは前方が上になるように
  minimapCamera.up.set(Math.sin(yaw), 0, -Math.cos(yaw));
  
  // 霧を一時的に無効化
  const originalFog = scene.fog;
  scene.fog = null;
  
  // レンダーターゲットに描画
  renderer.setRenderTarget(minimapRenderTarget);
  renderer.render(scene, minimapCamera);
  renderer.setRenderTarget(null);
  
  // 霧を復元
  scene.fog = originalFog;
  
  // Canvas 2Dに転送
  const width = minimapSize;
  const height = minimapSize;
  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(minimapRenderTarget, 0, 0, width, height, pixels);
  
  // ImageDataを作成（WebGLは下から上に読むので反転）
  const imageData = minimapCtx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      imageData.data[dstIdx] = pixels[srcIdx];
      imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
      imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
      imageData.data[dstIdx + 3] = 180; // 半透明
    }
  }
  
  // 円形にマスク
  minimapCtx.clearRect(0, 0, width, height);
  minimapCtx.save();
  minimapCtx.beginPath();
  minimapCtx.arc(width / 2, height / 2, width / 2, 0, Math.PI * 2);
  minimapCtx.clip();
  minimapCtx.putImageData(imageData, 0, 0);
  minimapCtx.restore();
}

/**
 * 戦闘時PiPを描画
 * @param {object} target 戦闘対象の敵オブジェクト
 */
function renderCombatPip(target) {
  if (!pipCtx || !combatPipEl || !target) return;
  
  let centerX, centerZ;
  let cameraHeight = 80;
  
  // マスクドロップの場合
  if (target.targetType === 'mask_drop') {
    centerX = target.x;
    centerZ = target.z;
    cameraHeight = 50; // マスクは少し低めから見る
  }
  // 敵同士の戦闘の場合
  else if (target.targetType === 'enemy' && target.targetPos) {
    centerX = (target.x + target.targetPos.x) / 2;
    centerZ = (target.z + target.targetPos.z) / 2;
  } else {
    // プレイヤーと敵の戦闘の場合
    centerX = (camera.position.x + target.x) / 2;
    centerZ = (camera.position.z + target.z) / 2;
  }
  
  // カメラを中間点の上に配置
  pipCamera.position.set(centerX, cameraHeight, centerZ);
  pipCamera.lookAt(centerX, 0, centerZ);
  
  // 上が北になるように
  pipCamera.up.set(0, 0, -1);
  
  // 霧を一時的に無効化
  const originalFog = scene.fog;
  scene.fog = null;
  
  // レンダーターゲットに描画
  renderer.setRenderTarget(pipRenderTarget);
  renderer.render(scene, pipCamera);
  renderer.setRenderTarget(null);
  
  // 霧を復元
  scene.fog = originalFog;
  
  // Canvas 2Dに転送
  const width = pipSize;
  const height = pipSize;
  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(pipRenderTarget, 0, 0, width, height, pixels);
  
  // ImageDataを作成（WebGLは下から上に読むので反転）
  const imageData = pipCtx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      imageData.data[dstIdx] = pixels[srcIdx];
      imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
      imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
      imageData.data[dstIdx + 3] = 255;
    }
  }
  
  pipCtx.putImageData(imageData, 0, 0);
}

/**
 * 戦闘PiPの表示/非表示を更新
 */
function updateCombatPip(dt, inCombat, target) {
  if (inCombat && target) {
    combatActive = true;
    combatTarget = target;
    combatFadeTimer = COMBAT_FADE_DURATION;
    if (combatPipEl) combatPipEl.classList.remove('hidden');
  } else if (combatActive) {
    combatFadeTimer -= dt;
    if (combatFadeTimer <= 0) {
      combatActive = false;
      combatTarget = null;
      if (combatPipEl) combatPipEl.classList.add('hidden');
    }
  }
  
  // 戦闘中またはフェード中はPiPを描画
  if (combatActive && combatTarget) {
    renderCombatPip(combatTarget);
  }
}

/**
 * マスクドロップ時にCombat Viewに位置を表示
 */
function showMaskDropInPip(x, y, z) {
  maskDropPosition = { x, y, z };
  maskDropTimer = MASK_DROP_VIEW_DURATION;
}

/**
 * 敵がカメラの視界外（後方）にいるかチェック
 */
function isEnemyBehindCamera(enemy) {
  // カメラの前方ベクトル
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  forward.y = 0;
  forward.normalize();
  
  // 敵への方向ベクトル
  const toEnemy = new THREE.Vector3(
    enemy.x - camera.position.x,
    0,
    enemy.z - camera.position.z
  ).normalize();
  
  // 前方ベクトルと敵への方向の内積
  const dot = forward.dot(toEnemy);
  
  // dot < 0 なら後方（視野外）
  // dot < 0.3 なら視界の端より外（約72度以上横）
  return dot < 0.3;
}

/**
 * バックミラーを描画
 */
function renderRearMirror(target) {
  if (!rearMirrorCtx || !rearMirrorEl || !target) return;
  
  // カメラを敵の方向に向ける
  rearMirrorCamera.position.copy(camera.position);
  rearMirrorCamera.lookAt(target.x, target.y + 1.5, target.z);
  
  // 霧を一時的に無効化
  const originalFog = scene.fog;
  scene.fog = null;
  
  // レンダーターゲットに描画
  renderer.setRenderTarget(rearMirrorRenderTarget);
  renderer.render(scene, rearMirrorCamera);
  renderer.setRenderTarget(null);
  
  // 霧を復元
  scene.fog = originalFog;
  
  // Canvas 2Dに転送
  const width = rearMirrorWidth;
  const height = rearMirrorHeight;
  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(rearMirrorRenderTarget, 0, 0, width, height, pixels);
  
  // ImageDataを作成（WebGLは下から上に読むので反転）
  const imageData = rearMirrorCtx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      imageData.data[dstIdx] = pixels[srcIdx];
      imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
      imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
      imageData.data[dstIdx + 3] = 255;
    }
  }
  
  rearMirrorCtx.putImageData(imageData, 0, 0);
}

/**
 * 画面外からの攻撃時にバックミラーを表示
 */
function showRearMirror(enemy) {
  if (isEnemyBehindCamera(enemy)) {
    rearMirrorActive = true;
    rearMirrorTarget = enemy;
    rearMirrorTimer = REAR_MIRROR_DURATION;
    if (rearMirrorEl) rearMirrorEl.classList.remove('hidden');
  }
}

/**
 * バックミラーの更新
 */
function updateRearMirror(dt) {
  if (rearMirrorActive) {
    rearMirrorTimer -= dt;
    
    if (rearMirrorTimer <= 0 || !rearMirrorTarget) {
      rearMirrorActive = false;
      rearMirrorTarget = null;
      if (rearMirrorEl) rearMirrorEl.classList.add('hidden');
    } else {
      // バックミラーを描画
      renderRearMirror(rearMirrorTarget);
    }
  }
}

function onUpdateFoodHeights() {
  updateFoodHeights(getHeightAt);
}

// ローディング完了時にポーズ解除
const onLoadingComplete = () => {
  hideLoading();
  gameState.paused = false;
};

tryLoadPLATEAU(scene, cityRoot, {
  updateLoadProgress,
  hideLoading: onLoadingComplete,
  camera,
  updateFoodHeights: onUpdateFoodHeights
});

// 食べ物の配置: JSONがあればそこから、なければランダム配置
(async () => {
  const count = await loadFoodSpawnsFromJson(scene);
  if (count === 0) {
    console.log('[Food] JSONが見つからないため、ランダム配置を使用');
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 200;
      addFood(scene, x, z);
    }
  }
  onUpdateFoodHeights();
})();

// 装備の配置: JSONから読み込み
(async () => {
  const count = await loadEquipmentSpawnsFromJson(scene);
  console.log(`[Equipment] ${count} 件の装備を配置`);
  // 高さ更新
  updateEquipmentHeights(getHeightAt);
})();

// transform.json の対応点を表示（デバッグ用）
(async () => {
  try {
    const response = await fetch('data/transform.json');
    if (!response.ok) return;
    const data = await response.json();
    const points = data.reference_points || [];
    console.log('[Debug] transform.json 対応点:', points);

    for (const p of points) {
      // 赤いビーム（光の筋）
      const beamGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 1, 0)
      ]);
      const beamMat = new THREE.LineBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.9,
        depthTest: true,
        depthWrite: false
      });
      const beam = new THREE.Line(beamGeo, beamMat);
      beam.scale.y = 150;
      beam.position.set(p.gameX, 0, p.gameZ);
      scene.add(beam);

      // 名前ラベル（スプライト）
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.name, 256, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = '32px monospace';
      ctx.fillText(`(${p.gameX}, ${p.gameZ})`, 256, 90);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(40, 10, 1);
      sprite.position.set(p.gameX, 80, p.gameZ);
      scene.add(sprite);

      console.log(`[Debug] 対応点マーカー: ${p.name} @ (${p.gameX}, ${p.gameZ})`);
    }
  } catch (e) {
    console.warn('[Debug] transform.json の読み込みエラー:', e);
  }
})();

let yaw = 0;
/** 実際の移動方向（ドリフト用）。グリップが低いとyawに追従しにくい */
let velocityYaw = 0;
/** カメラのロール（傾き）。旋回時に傾く */
let cameraRoll = 0;
/** カメラのピッチ（上下傾き）。上昇/下降時に傾く */
let cameraPitch = 0;
let speedMultiplier = 1;
let energy = 100;
/** 加速・減速直後の回復待ち（秒）。この間は回復しない */
let recoveryCooldown = 0;
/** 加速・減速していない状態が続いた秒数。hoverGraceTimeSec を超えると自動下降開始 */
let hoverGraceElapsed = 0;
const clock = new THREE.Clock();
let frameCount = 0;
const foods = getFoods();

/** UI用仮状態（生存時間・転生・ステータス・所持・マスク・バフ・敵は後で実データに差し替え） */
const gameState = {
  /** 生存時間（秒）。毎フレーム dt を加算。転生時に 0 にリセット。5分／15分トリガーの基準。 */
  survivalSec: 0,
  reincarnation: 0,
  /** ゲームポーズ状態（ダイアログ表示中、ローディング中など） */
  paused: true, // 初期状態はポーズ（ローディング完了まで）
  /** 時間倍速（デバッグ用） */
  timeScale: 2,
  attack: 10,
  defense: 5,
  evasion: 5,
  pickupRange: 5,
  grip: 1,
  absorb: 1,
  search: 5,
  /** 装備インベントリ（createInventory()で初期化） */
  equipmentInventory: createInventory(),
  /** マスクインベントリ */
  maskInventory: createMaskInventory(),
  /** UI互換用（後で削除予定） */
  inventory: [],
  inventoryMaxSlots: 5,
  masks: [],
  /** 敵スポーン用タイマー */
  enemySpawnTimer: 0,
  /** 次の敵スポーンまでの時間（秒） */
  nextEnemySpawnSec: 15, // 最初は15秒後
  /** 現在消費中バフ 1 つ（とった順に 1 つずつ消費）。null のときはキュー先頭を次に取り出す */
  activeBuff: null,
  /** 待機中のバフキュー。各要素は { typeId, durationMax } */
  buffQueue: [],
  enemies: [],
  searchRange: 50,
  bossHp: null,
  bossHpMax: 100,
  bossMaskCount: 0,
  /** ホバー猶予時間（秒）。成長で延長可能。未設定時は player.js の hoverGraceTimeSec を使用 */
  hoverGraceTimeSec: undefined,
  /** 成長選択フラグ（trueの時、次のアイテム取得でダイアログ表示） */
  growthPending: false,
  /** 最後に成長選択が発生した5分単位の回数 */
  lastGrowthMilestone: 0,
  /** ゲームがポーズ中か */
  paused: false,
  /** 敗北中か */
  isDefeated: false,
  /** ライバル出現用タイマー */
  rivalSpawnTimer: 0,
  /** 現在のライバル（いない場合はnull） */
  rival: null
};

/** ライバル出現間隔（秒） */
const RIVAL_SPAWN_INTERVAL_SEC = 15 * 60; // 15分

/** 初期パラメータ値（輪廻転生時のリセット用） */
const INITIAL_PARAMS = {
  attack: 10,
  defense: 5,
  evasion: 5,
  pickupRange: 5,
  grip: 1,
  absorb: 1,
  search: 5
};

/**
 * 敗北処理（輪廻転生ダイアログを表示）
 */
function handleDefeat() {
  if (gameState.isDefeated) return;
  gameState.isDefeated = true;
  gameState.paused = true;
  playSoundDefeat();
  
  // 全マスクを引き継ぐ
  const maskCountToKeep = gameState.maskInventory.masks.length;
  
  showDefeatDialog(
    gameState.survivalSec,
    gameState.reincarnation,
    maskCountToKeep,
    () => reincarnate(maskCountToKeep)
  );
}

/**
 * 輪廻転生処理
 * @param {number} maskCountToKeep 引き継ぐマスク数
 */
function reincarnate(maskCountToKeep) {
  playSoundReincarnate();
  
  // 転生回数を増やす
  gameState.reincarnation++;
  
  // マスクを全て引き継ぎ（転生の特典）
  // マスクインベントリはそのまま保持
  gameState.masks = getMasksForDisplay(gameState.maskInventory);
  
  addCombatLog(`${gameState.maskInventory.masks.length}個のマスクを引き継いで転生！`, 'mask');
  
  // パラメータをリセット
  Object.assign(gameState, INITIAL_PARAMS);
  
  // 装備・バッグをリセット
  gameState.equipmentInventory = createInventory();
  
  // バフをリセット
  gameState.activeBuff = null;
  gameState.buffQueue = [];
  
  // 生存時間・成長マイルストーンをリセット
  gameState.survivalSec = 0;
  gameState.lastGrowthMilestone = 0;
  gameState.growthPending = false;
  
  // ライバルタイマーをリセット
  gameState.rivalSpawnTimer = 0;
  gameState.rival = null;
  gameState.bossHp = null;
  
  // 敵スポーンタイマーをリセット
  gameState.enemySpawnTimer = 0;
  gameState.nextEnemySpawnSec = 15;
  
  // エネルギーを回復
  energy = 100;
  
  // カメラを初期位置に戻す
  camera.position.set(0, 80, 0);
  yaw = 0;
  velocityYaw = 0;
  cameraRoll = 0;
  cameraPitch = 0;
  
  // 状態をリセット
  gameState.isDefeated = false;
  gameState.paused = false;
  
  addCombatLog(`転生回数 ${gameState.reincarnation} で再開！`, 'mask');
  
  // 3Dタイトル表示
  show3DTitle();
}

/**
 * 3D空間にタイトルを表示（輪廻転生時）
 */
let titleMesh = null;
function show3DTitle() {
  // 既存のタイトルがあれば削除
  if (titleMesh) {
    scene.remove(titleMesh);
    if (titleMesh.material.map) titleMesh.material.map.dispose();
    titleMesh.material.dispose();
    titleMesh.geometry.dispose();
    titleMesh = null;
  }
  
  // キャンバスでテキストを描画
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 1024;
  canvas.height = 256;
  
  // 透明背景
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // テキスト描画
  ctx.font = 'bold 120px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // グロー効果
  ctx.shadowColor = 'rgba(136, 204, 255, 0.8)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('3D街中ラン', canvas.width / 2, canvas.height / 2);
  
  // もう一度描画して発光を強める
  ctx.shadowBlur = 15;
  ctx.fillText('3D街中ラン', canvas.width / 2, canvas.height / 2);
  
  // テクスチャ作成
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  // メッシュ作成（カメラの前方に配置）
  const geometry = new THREE.PlaneGeometry(40, 10);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  
  titleMesh = new THREE.Mesh(geometry, material);
  titleMesh.renderOrder = 999; // 最前面
  scene.add(titleMesh);
  
  // フェードイン・フェードアウトアニメーション
  let elapsed = 0;
  const fadeInDuration = 0.8;
  const holdDuration = 1.5;
  const fadeOutDuration = 1.0;
  const totalDuration = fadeInDuration + holdDuration + fadeOutDuration;
  
  function animateTitle() {
    if (!titleMesh) return;
    
    elapsed += 1 / 60; // 約60FPS想定
    
    // カメラの前方に配置
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    titleMesh.position.copy(camera.position).add(forward.multiplyScalar(25));
    titleMesh.position.y += 3; // 少し上に
    titleMesh.quaternion.copy(camera.quaternion);
    
    // 不透明度アニメーション
    if (elapsed < fadeInDuration) {
      // フェードイン
      titleMesh.material.opacity = elapsed / fadeInDuration;
    } else if (elapsed < fadeInDuration + holdDuration) {
      // ホールド
      titleMesh.material.opacity = 1;
    } else if (elapsed < totalDuration) {
      // フェードアウト
      const fadeProgress = (elapsed - fadeInDuration - holdDuration) / fadeOutDuration;
      titleMesh.material.opacity = 1 - fadeProgress;
    } else {
      // 終了
      scene.remove(titleMesh);
      if (titleMesh.material.map) titleMesh.material.map.dispose();
      titleMesh.material.dispose();
      titleMesh.geometry.dispose();
      titleMesh = null;
      return;
    }
    
    requestAnimationFrame(animateTitle);
  }
  
  animateTitle();
}

const debugFpsEl = document.getElementById('debugFps');
const debugMenuEl = document.getElementById('debugMenu');
const debugProximityCheckbox = document.getElementById('debugProximityCheckbox');
const debugCheckerCheckbox = document.getElementById('debugCheckerCheckbox');
const debugCheckerStateEl = document.getElementById('debugCheckerState');
const debugWorldCheckerCheckbox = document.getElementById('debugWorldCheckerCheckbox');

function updateDebugCheckerStateLabel() {
  if (!debugCheckerStateEl) return;
  const on = proximity.getUseCheckerTexture();
  const world = proximity.getUseWorldSpaceChecker();
  const mode = on ? (world ? '座標' : 'UV') : 'OFF';
  debugCheckerStateEl.textContent = '市松: ' + mode;
  debugCheckerStateEl.style.display = debugMenuEl?.classList.contains('visible') ? 'inline' : 'none';
}

// デバッグメニューの表示状態
let debugMenuVisible = false;
const debugBtn = document.getElementById('debugBtn');

if (debugBtn) {
  debugBtn.addEventListener('click', () => {
    debugMenuVisible = !debugMenuVisible;
    const bboxMesh = getDebugBoundingBoxMesh();
    if (bboxMesh) bboxMesh.visible = debugMenuVisible;
    if (debugMenuVisible) addDebugCollisionBoxes(scene);
    else removeDebugCollisionBoxes(scene);
    if (debugFpsEl) debugFpsEl.style.display = debugMenuVisible ? 'inline' : 'none';
    if (debugMenuEl) debugMenuEl.classList.toggle('visible', debugMenuVisible);
    if (!debugMenuVisible && debugFpsEl) debugFpsEl.textContent = '';
    if (debugMenuVisible) updateDebugCheckerStateLabel();
    debugBtn.classList.toggle('active', debugMenuVisible);
  });
}

// クレジットダイアログ制御
const creditsBtn = document.getElementById('creditsBtn');
const creditsDialog = document.getElementById('creditsDialog');
const creditsCloseBtn = document.getElementById('creditsCloseBtn');

if (creditsBtn && creditsDialog) {
  creditsBtn.addEventListener('click', () => {
    gameState.paused = true;
    creditsDialog.showModal();
  });
}
if (creditsCloseBtn && creditsDialog) {
  creditsCloseBtn.addEventListener('click', () => {
    creditsDialog.close();
    gameState.paused = false;
  });
}
// ダイアログ外クリックで閉じる
if (creditsDialog) {
  creditsDialog.addEventListener('click', (e) => {
    if (e.target === creditsDialog) {
      creditsDialog.close();
      gameState.paused = false;
    }
  });
  // ESCキーで閉じた場合もポーズ解除
  creditsDialog.addEventListener('close', () => {
    gameState.paused = false;
  });
}

if (debugProximityCheckbox) {
  debugProximityCheckbox.addEventListener('change', (e) => {
    proximity.setProximityEnabled(e.target.checked);
  });
}
if (debugCheckerCheckbox) {
  debugCheckerCheckbox.addEventListener('change', (e) => {
    const checked = e.target.checked;
    proximity.setUseCheckerTexture(checked);
    updateDebugCheckerStateLabel();
    console.log('[Debug] 近接時の市松模様:', checked ? 'ON' : 'OFF');
  });
}
if (debugWorldCheckerCheckbox) {
  debugWorldCheckerCheckbox.addEventListener('change', (e) => {
    const checked = e.target.checked;
    proximity.setUseWorldSpaceChecker(checked);
    updateDebugCheckerStateLabel();
    console.log('[Debug] 市松の基準:', checked ? 'ワールド座標' : 'UV');
  });
}

// ============================================================
// 俯瞰カメラモード（マッピング用）
// ============================================================
let birdEyeMode = false;
let birdEyeHeight = 300;
let birdEyeX = 0;
let birdEyeZ = 0;
const birdEyeMoveSpeed = 100;
const birdEyeZoomSpeed = 50;
/** 登録済みの対応点リスト */
const referencePoints = [];
/** クリック位置のゲーム座標（十字線の中心） */
let birdEyeClickX = 0;
let birdEyeClickZ = 0;

const birdEyeCheckbox = document.getElementById('birdEyeCheckbox');
const birdEyeControls = document.getElementById('birdEyeControls');
const birdEyeCrosshair = document.getElementById('birdEyeCrosshair');
const birdEyeCoordEl = document.getElementById('birdEyeCoord');
const refPointLatInput = document.getElementById('refPointLat');
const refPointLngInput = document.getElementById('refPointLng');
const refPointNameInput = document.getElementById('refPointName');
const addRefPointBtn = document.getElementById('addRefPointBtn');
const exportRefPointsBtn = document.getElementById('exportRefPointsBtn');
const refPointListEl = document.getElementById('refPointList');

function updateBirdEyeCoordDisplay() {
  if (birdEyeCoordEl) {
    birdEyeCoordEl.textContent = `X: ${birdEyeClickX.toFixed(1)}, Z: ${birdEyeClickZ.toFixed(1)}`;
  }
}

function updateRefPointListDisplay() {
  if (!refPointListEl) return;
  if (referencePoints.length === 0) {
    refPointListEl.innerHTML = '<div style="color:#888;">対応点なし</div>';
    return;
  }
  refPointListEl.innerHTML = referencePoints.map((p, i) =>
    `<div style="margin-bottom:2px;">${i + 1}. ${p.name} (${p.lat}, ${p.lng}) → (${p.gameX}, ${p.gameZ})</div>`
  ).join('');
}

function setBirdEyeMode(on) {
  birdEyeMode = on;
  if (birdEyeControls) birdEyeControls.style.display = on ? 'block' : 'none';
  if (birdEyeCrosshair) birdEyeCrosshair.style.display = on ? 'block' : 'none';
  if (birdEyeCoordEl) birdEyeCoordEl.style.display = on ? 'block' : 'none';
  if (on) {
    // 現在のカメラ位置を俯瞰の中心に
    birdEyeX = camera.position.x;
    birdEyeZ = camera.position.z;
    birdEyeClickX = birdEyeX;
    birdEyeClickZ = birdEyeZ;
    updateBirdEyeCoordDisplay();
    updateRefPointListDisplay();
  }
}

if (birdEyeCheckbox) {
  birdEyeCheckbox.addEventListener('change', (e) => {
    setBirdEyeMode(e.target.checked);
  });
}

// 時間倍速の設定
const timeScaleSelect = document.getElementById('timeScaleSelect');
const timeScaleInfoEl = document.getElementById('timeScaleInfo');
if (timeScaleSelect) {
  timeScaleSelect.addEventListener('change', (e) => {
    gameState.timeScale = parseFloat(e.target.value) || 1;
    console.log(`[Debug] 時間倍速: ${gameState.timeScale}x`);
  });
}

// Pause/Resumeボタン
const pauseResumeBtn = document.getElementById('pauseResumeBtn');
if (pauseResumeBtn) {
  pauseResumeBtn.addEventListener('click', () => {
    gameState.paused = !gameState.paused;
    pauseResumeBtn.textContent = gameState.paused ? 'Resume' : 'Pause';
    console.log(`[Debug] ゲーム${gameState.paused ? 'ポーズ' : '再開'}`);
  });
}

if (addRefPointBtn) {
  addRefPointBtn.addEventListener('click', () => {
    const lat = parseFloat(refPointLatInput?.value);
    const lng = parseFloat(refPointLngInput?.value);
    const name = refPointNameInput?.value?.trim() || `Point ${referencePoints.length + 1}`;
    if (isNaN(lat) || isNaN(lng)) {
      alert('緯度・経度を入力してください');
      return;
    }
    referencePoints.push({
      name,
      lat,
      lng,
      gameX: Math.round(birdEyeClickX * 100) / 100,
      gameZ: Math.round(birdEyeClickZ * 100) / 100
    });
    console.log('[RefPoint] 登録:', referencePoints[referencePoints.length - 1]);
    updateRefPointListDisplay();
    // 入力欄をクリア
    if (refPointLatInput) refPointLatInput.value = '';
    if (refPointLngInput) refPointLngInput.value = '';
    if (refPointNameInput) refPointNameInput.value = '';
  });
}

if (exportRefPointsBtn) {
  exportRefPointsBtn.addEventListener('click', () => {
    if (referencePoints.length === 0) {
      alert('対応点がありません');
      return;
    }
    const json = JSON.stringify(referencePoints, null, 2);
    console.log('[RefPoints] JSON:\n' + json);
    // クリップボードにコピー
    navigator.clipboard.writeText(json).then(() => {
      alert('対応点JSONをクリップボードにコピーしました（コンソールにも出力）');
    }).catch(() => {
      alert('クリップボードへのコピーに失敗しました。コンソールを確認してください');
    });
  });
}

// 俯瞰モード時のクリックで座標取得
renderer.domElement.addEventListener('click', (e) => {
  if (!birdEyeMode) return;
  // 画面中心の座標を使用（十字線の位置）
  // クリック位置ではなく、カメラ直下の座標を使う
  birdEyeClickX = birdEyeX;
  birdEyeClickZ = birdEyeZ;
  updateBirdEyeCoordDisplay();
});

// ============================================================
// モバイル用タッチコントロール
// ============================================================

/** タッチ入力の状態 */
const touchInput = {
  turn: 0,    // -1（左）〜 1（右）
  speed: 0,   // -1（減速）〜 1（加速）
};

/** 左ジョイスティック（旋回） */
const joystickLeft = document.getElementById('joystickLeft');
const joystickLeftStick = document.getElementById('joystickLeftStick');
let leftTouchId = null;
let leftCenterX = 0;
let leftCenterY = 0;

/** 右ジョイスティック（速度） */
const joystickRight = document.getElementById('joystickRight');
const joystickRightStick = document.getElementById('joystickRightStick');
let rightTouchId = null;
let rightCenterX = 0;
let rightCenterY = 0;

const JOYSTICK_RADIUS = 35; // スティックの移動範囲

function handleJoystickStart(e, isLeft) {
  e.preventDefault();
  initSound();
  
  for (const touch of e.changedTouches) {
    if (isLeft && leftTouchId === null) {
      leftTouchId = touch.identifier;
      const rect = joystickLeft.querySelector('.joystick-base').getBoundingClientRect();
      leftCenterX = rect.left + rect.width / 2;
      leftCenterY = rect.top + rect.height / 2;
      updateJoystick(touch, isLeft);
    } else if (!isLeft && rightTouchId === null) {
      rightTouchId = touch.identifier;
      const rect = joystickRight.querySelector('.joystick-base').getBoundingClientRect();
      rightCenterX = rect.left + rect.width / 2;
      rightCenterY = rect.top + rect.height / 2;
      updateJoystick(touch, isLeft);
    }
  }
}

function handleJoystickMove(e, isLeft) {
  e.preventDefault();
  
  for (const touch of e.changedTouches) {
    if (isLeft && touch.identifier === leftTouchId) {
      updateJoystick(touch, true);
    } else if (!isLeft && touch.identifier === rightTouchId) {
      updateJoystick(touch, false);
    }
  }
}

function handleJoystickEnd(e, isLeft) {
  for (const touch of e.changedTouches) {
    if (isLeft && touch.identifier === leftTouchId) {
      leftTouchId = null;
      touchInput.turn = 0;
      if (joystickLeftStick) joystickLeftStick.style.transform = 'translate(0, 0)';
    } else if (!isLeft && touch.identifier === rightTouchId) {
      rightTouchId = null;
      touchInput.speed = 0;
      if (joystickRightStick) joystickRightStick.style.transform = 'translate(0, 0)';
      stopAfterburner();
      stopRetroThrust();
    }
  }
}

function updateJoystick(touch, isLeft) {
  const centerX = isLeft ? leftCenterX : rightCenterX;
  const centerY = isLeft ? leftCenterY : rightCenterY;
  
  let dx = touch.clientX - centerX;
  let dy = touch.clientY - centerY;
  
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > JOYSTICK_RADIUS) {
    dx = (dx / dist) * JOYSTICK_RADIUS;
    dy = (dy / dist) * JOYSTICK_RADIUS;
  }
  
  const stick = isLeft ? joystickLeftStick : joystickRightStick;
  if (stick) {
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  
  if (isLeft) {
    // 左ジョイスティック: 左右で旋回
    touchInput.turn = dx / JOYSTICK_RADIUS;
  } else {
    // 右ジョイスティック: 上下で速度
    touchInput.speed = -dy / JOYSTICK_RADIUS; // 上がプラス
    
    // 速度に応じてエンジン音を制御
    if (touchInput.speed > 0.3) {
      startAfterburner();
      stopRetroThrust();
    } else if (touchInput.speed < -0.3) {
      stopAfterburner();
      startRetroThrust();
    } else {
      stopAfterburner();
      stopRetroThrust();
    }
  }
}

// ジョイスティックイベントを登録
if (joystickLeft) {
  joystickLeft.addEventListener('touchstart', (e) => handleJoystickStart(e, true), { passive: false });
  joystickLeft.addEventListener('touchmove', (e) => handleJoystickMove(e, true), { passive: false });
  joystickLeft.addEventListener('touchend', (e) => handleJoystickEnd(e, true));
  joystickLeft.addEventListener('touchcancel', (e) => handleJoystickEnd(e, true));
}

if (joystickRight) {
  joystickRight.addEventListener('touchstart', (e) => handleJoystickStart(e, false), { passive: false });
  joystickRight.addEventListener('touchmove', (e) => handleJoystickMove(e, false), { passive: false });
  joystickRight.addEventListener('touchend', (e) => handleJoystickEnd(e, false));
  joystickRight.addEventListener('touchcancel', (e) => handleJoystickEnd(e, false));
}

// ============================================================
// キーボード入力
// ============================================================

// 宙返り（Wダブルタップ）関連
let lastWKeyReleaseTime = 0; // Wキーを離した時刻
const DOUBLE_TAP_THRESHOLD = 300; // ダブルタップ判定の閾値（ミリ秒）
let isDoingFlip = false;
let flipProgress = 0;
let flipYawStart = 0;
const FLIP_DURATION = 0.6; // 宙返りにかかる時間（秒）
let wKeyWasReleased = true; // Wキーが一度離されたかどうか

// バレルロール回避（Sダブルタップ）関連
let lastSKeyReleaseTime = 0; // Sキーを離した時刻
let isDoingBarrelRoll = false;
let barrelRollProgress = 0;
let barrelRollDirection = 1; // 1: 右回転, -1: 左回転
const BARREL_ROLL_DURATION = 0.5; // バレルロールにかかる時間（秒）
let sKeyWasReleased = true; // Sキーが一度離されたかどうか

// 回避状態（宙返り・バレルロール中は敵の攻撃を回避）
function isEvading() {
  return isDoingFlip || isDoingBarrelRoll;
}

document.addEventListener('keydown', (e) => {
  // 最初のキー入力でサウンド初期化
  initSound();
  
  // 俯瞰モード時は矢印キーで移動、+/-でズーム
  if (birdEyeMode) {
    const moveAmount = birdEyeMoveSpeed * 0.1;
    if (e.key === 'ArrowUp') { birdEyeZ -= moveAmount; e.preventDefault(); }
    if (e.key === 'ArrowDown') { birdEyeZ += moveAmount; e.preventDefault(); }
    if (e.key === 'ArrowLeft') { birdEyeX -= moveAmount; e.preventDefault(); }
    if (e.key === 'ArrowRight') { birdEyeX += moveAmount; e.preventDefault(); }
    if (e.key === '+' || e.key === '=') { birdEyeHeight = Math.max(50, birdEyeHeight - birdEyeZoomSpeed); e.preventDefault(); }
    if (e.key === '-' || e.key === '_') { birdEyeHeight = Math.min(800, birdEyeHeight + birdEyeZoomSpeed); e.preventDefault(); }
    // 十字線の座標も更新
    birdEyeClickX = birdEyeX;
    birdEyeClickZ = birdEyeZ;
    updateBirdEyeCoordDisplay();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === 'w') {
    // 長押しでない場合のみダブルタップを検出（キーが一度離されている必要がある）
    if (wKeyWasReleased && !keys.w) {
      const now = performance.now();
      // ダブルタップ検出（前回離してから短時間で再度押した）
      if (now - lastWKeyReleaseTime < DOUBLE_TAP_THRESHOLD && !isDoingFlip && energy >= 20) {
        // 宙返り開始
        isDoingFlip = true;
        flipProgress = 0;
        flipYawStart = yaw;
        energy -= 20; // 宙返りにエネルギー消費
        addCombatLog('宙返り！', 'heal');
      }
    }
    wKeyWasReleased = false;
    
    if (!keys.w) startAfterburner(); // 押下開始時にサウンド開始
    keys.w = true;
  }
  if (k === 'a') keys.a = true;
  if (k === 's') {
    // バレルロール回避（ダブルタップ検出）
    if (sKeyWasReleased && !keys.s) {
      const now = performance.now();
      if (now - lastSKeyReleaseTime < DOUBLE_TAP_THRESHOLD && !isDoingBarrelRoll && !isDoingFlip && energy >= 15) {
        // バレルロール開始
        isDoingBarrelRoll = true;
        barrelRollProgress = 0;
        barrelRollDirection = Math.random() > 0.5 ? 1 : -1; // ランダムに左右
        energy -= 15; // バレルロールにエネルギー消費
        addCombatLog('回避行動！', 'heal');
      }
    }
    sKeyWasReleased = false;
    
    if (!keys.s) startRetroThrust(); // 押下開始時にサウンド開始
    keys.s = true;
  }
  if (k === 'd') keys.d = true;
  if (k === 'q') keys.q = true;
  if (k === 'e') keys.e = true;
  if (['w', 'a', 's', 'd', 'q', 'e'].includes(k)) e.preventDefault();
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w') {
    keys.w = false;
    stopAfterburner(); // キーリリース時にサウンド停止
    // ダブルタップ用に離した時刻を記録
    lastWKeyReleaseTime = performance.now();
    wKeyWasReleased = true;
  }
  if (k === 'a') keys.a = false;
  if (k === 's') {
    keys.s = false;
    stopRetroThrust(); // キーリリース時にサウンド停止
    // ダブルタップ用に離した時刻を記録
    lastSKeyReleaseTime = performance.now();
    sKeyWasReleased = true;
  }
  if (k === 'd') keys.d = false;
  if (k === 'q') keys.q = false;
  if (k === 'e') keys.e = false;
});

function animate() {
  requestAnimationFrame(animate);
  frameCount++;
  const dt = Math.min(clock.getDelta(), 0.1);

  // 俯瞰カメラモード
  if (birdEyeMode) {
    camera.position.set(birdEyeX, birdEyeHeight, birdEyeZ);
    camera.rotation.order = 'YXZ';
    camera.rotation.x = -Math.PI / 2; // 真下を向く
    camera.rotation.y = 0;
    camera.rotation.z = 0;
    proximity.updateProximityMaterials();
    renderer.render(scene, camera);
    return;
  }
  
  // ポーズ中は描画のみ
  if (gameState.paused) {
    renderer.render(scene, camera);
    return;
  }

  tickBuffQueue(gameState, dt);
  const effectiveRecoveryCooldownSec = recoveryCooldownSec * getRecoveryCooldownScaleFromBuff(gameState.activeBuff);
  const buffSpeedMultiplier = getSpeedMultiplierFromBuff(gameState.activeBuff);

  if (debugMenuVisible && debugFpsEl) {
    debugFpsEl.textContent = Math.round(1 / dt) + ' FPS';
    
    // 時間倍速の情報表示
    if (timeScaleInfoEl && gameState.timeScale > 1) {
      const realSec = gameState.survivalSec / gameState.timeScale;
      timeScaleInfoEl.textContent = `実時間: ${Math.floor(realSec / 60)}:${String(Math.floor(realSec % 60)).padStart(2, '0')}`;
    } else if (timeScaleInfoEl) {
      timeScaleInfoEl.textContent = '';
    }
  }

  // キーボード入力での旋回
  if (keys.a) yaw += turnSpeed * dt;
  if (keys.d) yaw -= turnSpeed * dt;
  
  // タッチ入力での旋回
  if (touchInput.turn !== 0) {
    yaw -= touchInput.turn * turnSpeed * dt;
  }

  // 敵へのソフトロックオンは無効化（酔いの原因になるため）
  // カメラは完全にプレイヤー操作のみで動く

  // カメラロール（傾き）の計算
  const maxRoll = Math.PI / 8; // 最大22.5度傾く
  const rollSpeed = 4.0; // 傾く速さ
  let targetRoll = 0;
  if (keys.a) targetRoll = maxRoll;  // 左旋回で右に傾く
  if (keys.d) targetRoll = -maxRoll; // 右旋回で左に傾く
  
  // ドリフト時（視点と移動方向の差）でも少し傾く
  let yawDiffForRoll = yaw - velocityYaw;
  while (yawDiffForRoll > Math.PI) yawDiffForRoll -= 2 * Math.PI;
  while (yawDiffForRoll < -Math.PI) yawDiffForRoll += 2 * Math.PI;
  targetRoll += yawDiffForRoll * 0.3; // ドリフト量に応じて追加で傾く
  targetRoll = Math.max(-maxRoll * 1.5, Math.min(maxRoll * 1.5, targetRoll));
  
  // スムーズに傾く・戻る
  cameraRoll += (targetRoll - cameraRoll) * rollSpeed * dt;

  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = cameraPitch;
  camera.rotation.z = cameraRoll;

  // 装備効果を取得（移動処理で使用）
  const equipEffects = getEffectMultipliers(gameState.equipmentInventory);
  
  // グリップによる移動方向の補間（ドリフト感）
  // グリップが高いほど早くyawに追従、低いほどドリフトする
  const effectiveGrip = gameState.grip * equipEffects.speed; // 装備効果も考慮
  const gripLerpFactor = Math.min(1, effectiveGrip * 3 * dt); // グリップ1で約0.3/frame
  
  // 角度差を -π 〜 π の範囲で計算
  let yawDiff = yaw - velocityYaw;
  while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
  while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
  
  // 移動方向をyawに向かって補間
  velocityYaw += yawDiff * gripLerpFactor;
  
  // 移動方向ベクトルを計算（カメラの向きではなくvelocityYawを使用）
  const forward = new THREE.Vector3(
    -Math.sin(velocityYaw),
    0,
    -Math.cos(velocityYaw)
  );

  speedMultiplier = 1;
  
  // キーボード入力での加速/減速
  const isAccelerating = keys.w || touchInput.speed > 0.3;
  const isDecelerating = keys.s || touchInput.speed < -0.3;
  
  if (isAccelerating && energy > 0) {
    // タッチの場合は入力量に応じて加速度を調整
    const accelAmount = keys.w ? 1 : Math.abs(touchInput.speed);
    speedMultiplier = 1 + 0.6 * accelAmount;
    energy = Math.max(0, energy - energyCostPerSec * dt * accelAmount);
    recoveryCooldown = effectiveRecoveryCooldownSec;
    hoverGraceElapsed = 0;
    // エネルギーが尽きたらサウンド停止
    if (energy <= 0) stopAfterburner();
  } else if (isAccelerating && energy <= 0) {
    // エネルギー切れでサウンド停止
    stopAfterburner();
  }
  if (isDecelerating && energy > 0) {
    // タッチの場合は入力量に応じて減速度を調整
    const decelAmount = keys.s ? 1 : Math.abs(touchInput.speed);
    speedMultiplier = 1 - 0.5 * decelAmount;
    energy = Math.max(0, energy - energyCostPerSec * dt * decelAmount);
    recoveryCooldown = effectiveRecoveryCooldownSec;
    hoverGraceElapsed = 0;
    // エネルギーが尽きたらサウンド停止
    if (energy <= 0) stopRetroThrust();
  } else if (isDecelerating && energy <= 0) {
    // エネルギー切れでサウンド停止
    stopRetroThrust();
  }
  // 回復クールダウン（装備効果で短縮）
  const effectiveRecoveryCooldownReduction = 1 / equipEffects.recoveryCooldown; // 値が低いほど早く回復
  recoveryCooldown = Math.max(0, recoveryCooldown - dt * effectiveRecoveryCooldownReduction);
  
  // エネルギー回復（装備効果で増加）
  const isUsingEnergy = isAccelerating || isDecelerating;
  if (!isUsingEnergy && recoveryCooldown <= 0) {
    const effectiveEnergyRegen = energyRecoveryPerSec * equipEffects.energyRegen;
    energy = Math.min(100, energy + effectiveEnergyRegen * dt);
  }
  speedMultiplier *= buffSpeedMultiplier;
  
  // 装備効果を移動速度に適用（地上速度 + 全体速度）
  const equipSpeedMult = equipEffects.speed * equipEffects.groundSpeed;

  const move = forward.multiplyScalar(baseSpeed * speedMultiplier * equipSpeedMult * dt);
  camera.position.add(move);

  // 境界チェック: 街モデルのバウンディングボックス外に出たら自動で街の中心を向く
  const cityBounds = getCityBounds();
  const boundaryResult = checkBoundaryAndAdjustYaw(
    camera.position.x,
    camera.position.z,
    yaw,
    dt,
    cityBounds
  );
  yaw = boundaryResult.yaw;
  updateBoundaryWarning(boundaryResult.outsideBoundary);

  // 上昇/下降（装備効果を適用）
  const effectiveVerticalSpeed = verticalSpeed * equipEffects.verticalSpeed * equipEffects.speed;
  let verticalInput = 0;
  // キーボード入力
  if (keys.w && energy > 0) { camera.position.y += effectiveVerticalSpeed * dt; verticalInput = 1; }
  if (keys.s) { camera.position.y -= effectiveVerticalSpeed * dt; verticalInput = -1; }
  if (keys.q) { camera.position.y += effectiveVerticalSpeed * dt; verticalInput = 1; }
  if (keys.e) { camera.position.y -= effectiveVerticalSpeed * dt; verticalInput = -1; }
  // タッチ入力での上昇/下降
  if (touchInput.speed > 0.3 && energy > 0) {
    camera.position.y += effectiveVerticalSpeed * dt * touchInput.speed;
    verticalInput = touchInput.speed;
  }
  if (touchInput.speed < -0.3) {
    camera.position.y -= effectiveVerticalSpeed * dt * Math.abs(touchInput.speed);
    verticalInput = touchInput.speed;
  }
  
  // カメラピッチ（上下傾き）の計算
  const maxPitch = Math.PI / 12; // 最大15度傾く
  const pitchSpeed = 3.0;
  const targetPitch = -verticalInput * maxPitch; // 上昇で下向き、下降で上向き
  
  // 宙返りアニメーション
  if (isDoingFlip) {
    flipProgress += dt / FLIP_DURATION;
    if (flipProgress >= 1) {
      // 宙返り完了
      flipProgress = 1;
      isDoingFlip = false;
      yaw = flipYawStart + Math.PI; // 180度ターン
      cameraPitch = 0;
    } else {
      // 宙返り中のピッチ（前転）
      // イーズイン・イーズアウトで滑らかに
      const eased = flipProgress < 0.5
        ? 2 * flipProgress * flipProgress
        : 1 - Math.pow(-2 * flipProgress + 2, 2) / 2;
      cameraPitch = Math.PI * 2 * eased; // 360度回転
      
      // yawも徐々に変化
      yaw = flipYawStart + Math.PI * eased;
    }
  } else {
    cameraPitch += (targetPitch - cameraPitch) * pitchSpeed * dt;
  }
  
  // バレルロール回避アニメーション
  if (isDoingBarrelRoll) {
    barrelRollProgress += dt / BARREL_ROLL_DURATION;
    if (barrelRollProgress >= 1) {
      // バレルロール完了
      barrelRollProgress = 1;
      isDoingBarrelRoll = false;
      cameraRoll = 0;
    } else {
      // バレルロール中のロール（横回転）
      const eased = barrelRollProgress < 0.5
        ? 2 * barrelRollProgress * barrelRollProgress
        : 1 - Math.pow(-2 * barrelRollProgress + 2, 2) / 2;
      cameraRoll = Math.PI * 2 * eased * barrelRollDirection; // 360度横回転
    }
  }
  const hoverGrace = gameState.hoverGraceTimeSec ?? hoverGraceTimeSec;
  const isTouchIdle = Math.abs(touchInput.speed) < 0.3;
  if (!keys.w && !keys.s && !keys.q && !keys.e && isTouchIdle) {
    hoverGraceElapsed += dt;
    if (hoverGraceElapsed >= hoverGrace && camera.position.y > minHeight) {
      camera.position.y -= autoDescendSpeed * dt;
      if (camera.position.y < minHeight) camera.position.y = minHeight;
    }
  } else {
    hoverGraceElapsed = 0;
  }

  resolveCollisions(camera);

  // 実効取得範囲 = 基本範囲 × 装備効果 × (1 + gameState.pickupRange * 0.1)
  const effectiveCollectRadius = collectRadius * equipEffects.pickupRange * (1 + gameState.pickupRange * 0.1);
  
  // 吸引範囲（取得範囲の3倍まで吸引）
  const magnetRange = effectiveCollectRadius * 3 * equipEffects.magnetism;
  const magnetStrength = 15 * equipEffects.magnetism; // 吸引速度

  foods.forEach((f) => {
    if (f.collected) return;
    const dx = camera.position.x - f.x;
    const dz = camera.position.z - f.z;
    const distSq = dx * dx + dz * dz;
    
    // 吸引効果（磁石装備がある場合）
    if (equipEffects.magnetism > 1 && distSq < magnetRange * magnetRange && distSq > effectiveCollectRadius * effectiveCollectRadius) {
      const dist = Math.sqrt(distSq);
      const pullX = (dx / dist) * magnetStrength * dt;
      const pullZ = (dz / dist) * magnetStrength * dt;
      f.x += pullX;
      f.z += pullZ;
      f.mesh.position.x = f.x;
      f.mesh.position.z = f.z;
      if (f.beam) {
        f.beam.position.x = f.x;
        f.beam.position.z = f.z;
      }
    }
    
    if (distSq < effectiveCollectRadius * effectiveCollectRadius) {
      f.collected = true;
      f.mesh.visible = false;
      if (f.beam) f.beam.visible = false;
      const instant = addBuffToQueue(gameState, f.typeId, {
        shopName: f.name,
        shopNameJa: f.nameJa,
        cuisine: f.cuisine
      }, {
        buffDuration: equipEffects.buffDuration,
        foodBuffBoost: equipEffects.foodBuffBoost
      });
      if (instant && instant.effect === 'energy') {
        energy = Math.min(100, energy + (instant.value ?? energyPerFood));
      }
      // お店の名前と料理ジャンルを表示
      showItemPopup(f.name, f.nameJa, f.cuisine, f.typeId);
      playSoundItemPickup();
      spawnItemPickupEffect(scene, f.x, f.y, f.z, f.color ?? 0xffff00);
      
      // 成長選択フラグが立っていたらダイアログを表示
      if (gameState.growthPending && !gameState.paused) {
        gameState.growthPending = false;
        gameState.paused = true;
        
        // 選択肢数は運（回避力）に応じて3〜5
        const baseOptions = 3;
        const bonusChance = Math.min(0.5, gameState.evasion * 0.05); // 回避10で50%
        let optionCount = baseOptions;
        if (Math.random() < bonusChance) optionCount++;
        if (Math.random() < bonusChance * 0.5) optionCount++;
        
        const PARAM_NAMES_JA = {
          attack: '攻撃力',
          defense: '防御力',
          evasion: '回避力',
          pickupRange: '取得範囲',
          grip: 'グリップ',
          absorb: '吸収力',
          search: '索敵'
        };
        
        playSoundGrowth();
        showGrowthDialog(optionCount, (paramId, value) => {
          // パラメータを成長させる
          if (gameState[paramId] !== undefined) {
            gameState[paramId] += value;
            const nameJa = PARAM_NAMES_JA[paramId] || paramId;
            addCombatLog(`${nameJa} が +${value} 上昇！`, 'attack');
            playSoundGrowthComplete();
            spawnLevelUpEffect(scene, camera.position.x, camera.position.y, camera.position.z);
          }
          gameState.paused = false;
        });
      }
    }
  });

  // 装備のアニメーション更新
  updateEquipmentAnimation(dt);

  // 装備の取得判定
  // 装備の実効取得範囲も同様に計算
  const effectiveEquipmentRadius = equipmentCollectRadius * equipEffects.pickupRange * (1 + gameState.pickupRange * 0.1);
  const equipMagnetRange = effectiveEquipmentRadius * 3 * equipEffects.magnetism;
  
  const equipments = getEquipments();
  equipments.forEach((e) => {
    if (e.collected) return;
    const dx = camera.position.x - e.x;
    const dz = camera.position.z - e.z;
    const distSq = dx * dx + dz * dz;
    
    // 装備の吸引効果
    if (equipEffects.magnetism > 1 && distSq < equipMagnetRange * equipMagnetRange && distSq > effectiveEquipmentRadius * effectiveEquipmentRadius) {
      const dist = Math.sqrt(distSq);
      const pullX = (dx / dist) * magnetStrength * dt;
      const pullZ = (dz / dist) * magnetStrength * dt;
      e.x += pullX;
      e.z += pullZ;
      e.mesh.position.x = e.x;
      e.mesh.position.z = e.z;
      if (e.beam) {
        e.beam.position.x = e.x;
        e.beam.position.z = e.z;
      }
    }
    
    if (distSq < effectiveEquipmentRadius * effectiveEquipmentRadius) {
      // インベントリに空きがあるか確認
      if (canAddItem(gameState.equipmentInventory)) {
        // 装備を回収
        collectEquipment(e, scene);
        // インベントリに追加
        addItem(gameState.equipmentInventory, {
          itemCategory: e.itemCategory,
          typeId: e.typeId,
          name: e.name,
          nameJa: e.nameJa,
          effect: e.effect,
          value: e.value,
          color: e.color,
          icon: e.icon,
          shopName: e.shopName,
          shopNameJa: e.shopNameJa
        });
        // 取得ポップアップ表示
        showEquipmentPopup(e);
        playSoundEquipmentPickup();
        spawnEquipmentPickupEffect(scene, e.x, e.y, e.z, e.color);
        console.log(`[Equipment] 取得: ${e.icon} ${e.nameJa} (${e.effect}: ${e.value > 0 ? '+' : ''}${(e.value * 100).toFixed(0)}%)`);
      } else {
        // スロットが満杯の場合（後で交換UIを追加予定）
        // 現在は何もしない
      }
    }
  });

  // 時間倍速を適用したdt（ゲーム内時間用）
  const gameDt = dt * gameState.timeScale;
  
  gameState.survivalSec += gameDt;

  // === 成長選択トリガー（5分ごと） ===
  const GROWTH_INTERVAL_SEC = 5 * 60; // 5分
  const currentMilestone = Math.floor(gameState.survivalSec / GROWTH_INTERVAL_SEC);
  if (currentMilestone > gameState.lastGrowthMilestone) {
    gameState.lastGrowthMilestone = currentMilestone;
    gameState.growthPending = true;
    addCombatLog('成長の時が来た！アイテムを取得しよう', 'mask');
  }

  // === ライバル出現（15分ごと）（時間倍速適用） ===
  gameState.rivalSpawnTimer += gameDt;
  if (gameState.rivalSpawnTimer >= RIVAL_SPAWN_INTERVAL_SEC && gameState.rival === null) {
    gameState.rivalSpawnTimer = 0;
    
    // ライバルをスポーン（プレイヤーから離れた位置に）
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 30;
    const spawnX = camera.position.x + Math.cos(angle) * distance;
    const spawnZ = camera.position.z + Math.sin(angle) * distance;
    
    // ライバルの強さはプレイヤーのベース能力を基準に
    const rivalStrength = 5; // 通常の敵よりかなり強い
    const rival = spawnEnemy(scene, spawnX, spawnZ, rivalStrength);
    rival.isRival = true;
    rival.hp = 200; // ライバルはHPがかなり高い
    rival.maxHp = 200;
    rival.attack = 15; // 攻撃力も高め
    rival.speed = 14; // 速度も速い
    gameState.rival = rival;
    
    // ボスUIに反映
    gameState.bossHp = rival.hp;
    gameState.bossHpMax = rival.maxHp;
    gameState.bossMaskCount = rival.masks.length;
    
    showRivalWarning();
    playSoundRivalAppear();
    addCombatLog('⚠ ライバルが出現した！', 'damage');
    
    // ライバル出現をCombat Viewに表示
    showMaskDropInPip(rival.x, rival.y, rival.z);
    showRearMirror(rival);
  }
  
  // ライバルのHP更新
  if (gameState.rival) {
    if (!gameState.rival.isAlive) {
      addCombatLog('ライバルを撃破！', 'defeat');
      gameState.rival = null;
      gameState.bossHp = null;
    } else {
      gameState.bossHp = gameState.rival.hp;
      gameState.bossMaskCount = gameState.rival.masks.length;
    }
  }

  // === 敵システム ===
  
  // 敵スポーン（時間倍速適用）
  gameState.enemySpawnTimer += gameDt;
  if (gameState.enemySpawnTimer >= gameState.nextEnemySpawnSec) {
    gameState.enemySpawnTimer = 0;
    gameState.nextEnemySpawnSec = ENEMY_CONFIG.spawnIntervalSec;
    
    // プレイヤーから離れた位置にスポーン
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 50 + Math.random() * 50;
    const spawnX = camera.position.x + Math.cos(spawnAngle) * spawnDist;
    const spawnZ = camera.position.z + Math.sin(spawnAngle) * spawnDist;
    
    // 強さ係数（0.7〜1.3）
    const strength = 0.7 + Math.random() * 0.6;
    const newEnemy = spawnEnemy(scene, spawnX, spawnZ, strength);
    if (newEnemy) {
      const enemyName = newEnemy.masks[0]?.nameJa || '敵';
      
      // 方向情報を計算
      const dx = spawnX - camera.position.x;
      const dz = spawnZ - camera.position.z;
      const dist = Math.round(Math.sqrt(dx * dx + dz * dz));
      
      // プレイヤーの向きからの相対角度を計算（時計方向）
      const absoluteAngle = Math.atan2(dx, -dz); // 北が0、東が90度
      let relativeAngle = absoluteAngle - yaw;
      while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
      while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;
      
      // 時計方向に変換（12時が前方）
      let clockHour = Math.round((relativeAngle / Math.PI) * 6 + 12) % 12;
      if (clockHour === 0) clockHour = 12;
      
      // 方位を計算
      const compassDirs = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
      const compassIndex = Math.round((absoluteAngle + Math.PI) / (Math.PI / 4)) % 8;
      const compass = compassDirs[compassIndex];
      
      // 速度判定（基本速度8、バフで上昇）
      let speedInfo = '';
      if (newEnemy.speed >= 14) {
        speedInfo = ' 【超高速】';
      } else if (newEnemy.speed >= 11) {
        speedInfo = ' 【高速】';
      } else if (newEnemy.speed <= 5) {
        speedInfo = ' 【低速】';
      }
      
      addCombatLog(`${enemyName} が現れた！ ${clockHour}時方向 ${compass} ${dist}m${speedInfo}`, 'damage');
      
      // 敵出現をCombat Viewとバックミラーに表示
      showMaskDropInPip(newEnemy.x, newEnemy.y, newEnemy.z);
      showRearMirror(newEnemy);
    }
  }
  
  // 敵の接近チェック（30m以内で通知）と離脱チェック（50m以上で通知）
  const APPROACH_DISTANCE = 30;
  const DISENGAGE_DISTANCE = 50;
  const REAR_WARNING_DISTANCE = 20; // 後方警告距離
  for (const enemy of getAliveEnemies()) {
    const dx = enemy.x - camera.position.x;
    const dz = enemy.z - camera.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const enemyName = enemy.masks[0]?.nameJa || '敵';
    
    // 時計方向を計算（共通で使用）
    const absoluteAngle = Math.atan2(dx, -dz);
    let relativeAngle = absoluteAngle - yaw;
    while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
    while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;
    let clockHour = Math.round((relativeAngle / Math.PI) * 6 + 12) % 12;
    if (clockHour === 0) clockHour = 12;
    
    // 接近通知
    if (!enemy.approachNotified && dist < APPROACH_DISTANCE) {
      enemy.approachNotified = true;
      enemy.rearWarningGiven = false; // 後方警告フラグをリセット
      
      // 速度判定（基本速度8、バフで上昇）
      let speedInfo = '';
      if (enemy.speed >= 14) {
        speedInfo = ' 【超高速】';
      } else if (enemy.speed >= 11) {
        speedInfo = ' 【高速】';
      } else if (enemy.speed <= 5) {
        speedInfo = ' 【低速】';
      }
      
      // マスク数によるバフ表示
      let buffInfo = '';
      if (enemy.masks.length >= 5) {
        buffInfo = ' ★強化×' + enemy.masks.length;
      } else if (enemy.masks.length >= 3) {
        buffInfo = ' ☆強化';
      }
      
      addCombatLog(`${enemyName} が接近中！ ${clockHour}時方向 ${Math.round(dist)}m${speedInfo}${buffInfo}`, 'damage');
    }
    
    // 後方警告（5時〜7時方向、20m以内）
    const isRear = (clockHour >= 5 && clockHour <= 7);
    const isSide = (clockHour >= 3 && clockHour <= 4) || (clockHour >= 8 && clockHour <= 9);
    
    if (dist < REAR_WARNING_DISTANCE && enemy.approachNotified && !enemy.rearWarningGiven) {
      if (isRear) {
        enemy.rearWarningGiven = true;
        const rearWarnings = [
          `警告！後ろに気をつけろ！ ${enemyName}が${clockHour}時方向！`,
          `背後から${enemyName}！ 回避行動を！`,
          `${enemyName}が後方に！ ${Math.round(dist)}m！`,
          `後方警戒！ ${enemyName}接近中！`,
        ];
        addCombatLog(rearWarnings[Math.floor(Math.random() * rearWarnings.length)], 'damage');
      } else if (isSide) {
        enemy.rearWarningGiven = true;
        const sideWarnings = [
          `回り込まれた！ ${enemyName}が${clockHour}時方向！`,
          `側面に${enemyName}！ 注意！`,
          `${enemyName}に側面を取られた！`,
          `警告！${clockHour}時方向から${enemyName}！`,
        ];
        addCombatLog(sideWarnings[Math.floor(Math.random() * sideWarnings.length)], 'damage');
      }
    }
    
    // 前方に戻ったら警告フラグをリセット（11時〜1時方向）
    const isFront = (clockHour >= 11 || clockHour <= 1);
    if (isFront && enemy.rearWarningGiven) {
      enemy.rearWarningGiven = false;
    }
    
    // 離脱通知（管制塔風）
    if (enemy.approachNotified && dist > DISENGAGE_DISTANCE) {
      enemy.approachNotified = false;
      enemy.rearWarningGiven = false;
      
      // 管制塔風メッセージ
      const disengageMessages = [
        `管制塔より通達。${enemyName}が離脱、距離${Math.round(dist)}m`,
        `${enemyName}との距離が開いた。現在${Math.round(dist)}m`,
        `脅威排除確認。${enemyName}は${Math.round(dist)}m地点`,
        `良好、${enemyName}から離脱した`,
        `管制塔了解。敵機${enemyName}、追跡範囲外へ`,
      ];
      const msg = disengageMessages[Math.floor(Math.random() * disengageMessages.length)];
      addCombatLog(msg, 'heal');
    }
  }
  
  // 敵の更新（ドロップマスクを渡して敵が拾えるように）
  const droppedMasksForEnemy = getDroppedMasks().filter(m => !m.collected);
  const { pickedUpMasks: enemyPickedMasks, enemyBattleResults } = updateEnemies(dt, camera.position, getHeightAt, droppedMasksForEnemy, scene, collectMask);
  
  // 敵がマスクを拾ったらログ表示
  for (const { enemy, mask } of enemyPickedMasks) {
    const enemyName = enemy.masks[0]?.nameJa || '敵';
    addCombatLog(`${enemyName} が ${mask.nameJa} を奪った！`, 'mask');
    playSoundEnemyPickupMask();
  }
  
  // 敵同士の戦闘結果を処理
  for (const result of enemyBattleResults) {
    const attackerName = result.attacker.masks[0]?.nameJa || '敵';
    const targetName = result.target.masks[0]?.nameJa || '敵';
    
    if (result.killed) {
      // 敵が敵を倒した
      addCombatLog(`${attackerName} が ${targetName} を倒した！`, 'defeat');
      // 倒された敵のマスクをドロップ
      dropMasksFromEnemy(scene, result.target);
      showMaskDropInPip(result.target.x, result.target.y, result.target.z);
    }
  }
  
  // プレイヤーの自動攻撃（装備効果 + マスク効果）
  const maskEffects = getMaskEffects(gameState.maskInventory);
  const playerStats = {
    baseAttack: gameState.attack,
    attackMult: (maskEffects.attack ?? 0) + (equipEffects.attack - 1), // 装備効果を加算
    defenseMult: (maskEffects.defense ?? 0) + (equipEffects.defense - 1), // 装備効果を加算
  };
  const attackResult = playerAttack(dt, camera.position, playerStats, getAliveEnemies(), scene);
  if (attackResult.attacked && attackResult.target) {
    // ダメージに応じたサウンド
    if (attackResult.damage >= 15) {
      playSoundCriticalHit(); // 大ダメージ
    } else if (attackResult.damage >= 8) {
      playSoundAttackHit(); // 良いヒット
    } else {
      playSoundAttack(); // 通常攻撃
    }
    spawnAttackHitEffect(scene, attackResult.target.x, attackResult.target.y + 1.5, attackResult.target.z);
    const target = attackResult.target;
    const targetName = target.masks[0]?.nameJa || '敵';
    
    // 戦闘開始ログ
    if (!target.inCombat) {
      target.inCombat = true;
      const battleCries = [
        `${targetName} と交戦開始！`,
        `${targetName} に戦いを挑む！`,
        `${targetName} とのバトル開始！`,
      ];
      addCombatLog(battleCries[Math.floor(Math.random() * battleCries.length)], 'attack');
    }
    
    // ヒットカウント
    target.hitCount++;
    
    if (target.isAlive) {
      // 連続ヒット実況
      if (target.hitCount === 3) {
        addCombatLog('連続ヒット！攻撃が冴えている！', 'attack');
      } else if (target.hitCount === 5) {
        addCombatLog('怒涛の5連撃！', 'attack');
      } else if (target.hitCount === 10) {
        addCombatLog('驚異の10連撃！！', 'attack');
      } else if (attackResult.damage >= 15) {
        // 大ダメージ実況
        const bigHits = ['会心の一撃！', 'クリティカル！', '強烈な一撃！'];
        addCombatLog(bigHits[Math.floor(Math.random() * bigHits.length)], 'attack');
      } else {
        addCombatLog(`${targetName} に ${attackResult.damage} ダメージ！`, 'attack');
      }
      
      // HP状況実況
      const hpRatio = target.hp / target.maxHp;
      if (hpRatio < 0.5 && !target.halfHpNotified) {
        target.halfHpNotified = true;
        addCombatLog(`${targetName} を追い詰めている！`, 'attack');
      } else if (hpRatio < 0.2 && !target.lowHpNotified) {
        target.lowHpNotified = true;
        addCombatLog(`あと一撃で倒せる！`, 'attack');
      }
    }
  }
  
  // 敵の攻撃
  const enemyAttackResult = enemyAttacks(dt, camera.position, getAliveEnemies(), playerStats);
  const enemyDamage = enemyAttackResult.totalDamage;
  
  // 回避中は敵の攻撃を無効化
  if (enemyDamage > 0 && isEvading()) {
    // 回避成功
    if (enemyAttackResult.attackers.length > 0) {
      addCombatLog('回避成功！敵の攻撃をかわした！', 'heal');
    }
  } else if (enemyDamage > 0) {
    const previousEnergy = energy;
    energy = Math.max(0, energy - enemyDamage);
    
    // 実況風ダメージログ
    const damageMessages = [
      `敵の攻撃がヒット！ ${enemyDamage} ダメージ！`,
      `痛恨の一撃！ ${enemyDamage} ダメージ！`,
      `敵の攻撃を受けた！ ${enemyDamage} ダメージ！`,
    ];
    addCombatLog(damageMessages[Math.floor(Math.random() * damageMessages.length)], 'damage');
    
    // 画面外から攻撃してきた敵がいればバックミラーを表示
    for (const attacker of enemyAttackResult.attackers) {
      showRearMirror(attacker);
    }
    
    // エネルギー状況の実況
    if (energy < 30 && previousEnergy >= 30) {
      addCombatLog('エネルギーが危険水域！回復を急げ！', 'damage');
    } else if (energy < 15 && previousEnergy >= 15) {
      addCombatLog('危機的状況！このままでは...！', 'damage');
    }
    
    playSoundDamage();
    spawnDamageEffect(scene, camera.position.x, camera.position.y, camera.position.z);
    
    // 大ダメージ判定（一撃で25%以上のダメージ）→ マスクを1つ落とす
    const damagePercent = enemyDamage / 100;
    if (damagePercent >= 0.25 && gameState.maskInventory.masks.length > 0) {
      // ランダムにマスクを1つ選んでドロップ
      const maskIndex = Math.floor(Math.random() * gameState.maskInventory.masks.length);
      const droppedMaskData = gameState.maskInventory.masks[maskIndex];
      
      // インベントリから削除
      gameState.maskInventory.masks.splice(maskIndex, 1);
      gameState.masks = getMasksForDisplay(gameState.maskInventory);
      
      // フィールドにドロップ
      dropMask(scene, camera.position.x, camera.position.y, camera.position.z, {
        type: droppedMaskData.type,
        color: droppedMaskData.color,
        effect: droppedMaskData.effect,
        value: droppedMaskData.value,
        nameJa: droppedMaskData.nameJa
      });
      
      addCombatLog(`大ダメージ！${droppedMaskData.nameJa} を落とした！`, 'damage');
      playSoundMaskDrop();
    }
    
    // 敗北判定
    if (energy <= 0) {
      handleDefeat();
      return; // このフレームの処理を中断
    }
  }
  
  // ダメージ表示更新
  updateDamageNumbers(dt, scene);
  
  // 死亡した敵のマスクをドロップ
  const deadEnemies = cleanupDeadEnemies(scene);
  for (const enemy of deadEnemies) {
    const enemyName = enemy.masks[0]?.nameJa || '敵';
    const maskCount = enemy.masks.length;
    
    // 撃破実況
    const defeatMessages = [
      `${enemyName} を撃破！`,
      `${enemyName} を倒した！`,
      `${enemyName} を討伐！`,
    ];
    addCombatLog(defeatMessages[Math.floor(Math.random() * defeatMessages.length)], 'defeat');
    
    // マスクドロップ実況
    if (maskCount > 1) {
      addCombatLog(`${maskCount}個のマスクがドロップ！`, 'mask');
    }
    
    playSoundEnemyDefeat();
    const enemyColor = enemy.masks[0]?.color ?? 0xff4444;
    spawnEnemyDefeatEffect(scene, enemy.x, enemy.y + 1.5, enemy.z, enemyColor);
    dropMasksFromEnemy(scene, enemy);
    showMaskDropInPip(enemy.x, enemy.y, enemy.z);
  }
  
  // マスクのアニメーション（プレイヤー位置を渡して点滅速度を調整）
  updateDroppedMasks(dt, camera.position);
  
  // パーティクルの更新
  updateParticles(dt, scene);
  
  // マスクの回収
  // マスクの実効取得範囲
  const effectiveMaskRadius = MASK_COLLECT_RADIUS * equipEffects.pickupRange * (1 + gameState.pickupRange * 0.1);
  const maskMagnetRange = effectiveMaskRadius * 3 * equipEffects.magnetism;
  
  const droppedMasks = getDroppedMasks();
  for (const mask of droppedMasks) {
    if (mask.collected) continue;
    const dx = camera.position.x - mask.x;
    const dz = camera.position.z - mask.z;
    const distSq = dx * dx + dz * dz;
    
    // マスクの吸引効果
    if (equipEffects.magnetism > 1 && distSq < maskMagnetRange * maskMagnetRange && distSq > effectiveMaskRadius * effectiveMaskRadius) {
      const dist = Math.sqrt(distSq);
      const pullX = (dx / dist) * magnetStrength * dt;
      const pullZ = (dz / dist) * magnetStrength * dt;
      mask.x += pullX;
      mask.z += pullZ;
      if (mask.mesh) {
        mask.mesh.position.x = mask.x;
        mask.mesh.position.z = mask.z;
      }
      if (mask.beam) {
        mask.beam.position.x = mask.x;
        mask.beam.position.z = mask.z;
      }
    }
    
    if (distSq < effectiveMaskRadius * effectiveMaskRadius) {
      collectMask(scene, mask);
      const result = addMaskToInventory(gameState.maskInventory, mask, gameState.absorb);
      // ログ表示 & 効果音 & パーティクル
      const maskColor = mask.color ?? 0xffffff;
      if (result.isNew) {
        addCombatLog(`${mask.nameJa} を入手！`, 'mask');
        playSoundMaskPickup();
      } else {
        addCombatLog(`${mask.nameJa} Lv${result.mask.level} に合成！`, 'mask');
        playSoundMaskSynth();
      }
      spawnMaskPickupEffect(scene, mask.x, mask.y, mask.z, maskColor);
      // UI用のmasksを更新
      gameState.masks = getMasksForDisplay(gameState.maskInventory);
    }
  }
  cleanupCollectedMasks();
  
  // 敵ガイド用のenemiesを更新
  gameState.enemies = getAliveEnemies().map(e => ({
    x: e.x,
    y: e.y,
    z: e.z,
    hp: e.hp,
    maxHp: e.maxHp,
    maskCount: e.masks.length,
  }));

  updateEnergyBar(energy);
  updatePosMeter(camera);
  updateAltitudeMeter(camera, minHeight, maxHeight);
  updateSpeedMeter(speedMultiplier);
  updateDirectionMeter(yaw);
  updateStatusPanel({
    survivalSec: gameState.survivalSec,
    reincarnation: gameState.reincarnation,
    attack: gameState.attack,
    defense: gameState.defense,
    evasion: gameState.evasion,
    pickupRange: gameState.pickupRange,
    grip: gameState.grip,
    absorb: gameState.absorb,
    search: gameState.search
  });
  updateSurvivalDisplay(gameState.survivalSec);
  // 装備UIの更新
  updateEquipmentUI(
    getInventorySummary(gameState.equipmentInventory),
    getItemsForDisplay(gameState.equipmentInventory),
    getBagsForDisplay(gameState.equipmentInventory)
  );
  updateMaskList(gameState.masks);
  updateBuffQueue(getActiveBuffsForDisplay(gameState), getBuffQueueForDisplay(gameState));
  
  // マスクセンサー（ドロップされたマスクへの誘導）
  const droppedMasksForSensor = getDroppedMasks().filter(m => !m.collected);
  updateMaskSensor(droppedMasksForSensor, camera.position, yaw);
  
  // 実効索敵範囲 = 基本範囲(30) + search × 5 × 装備効果(detection)
  const baseSearchRange = 30;
  const effectiveSearchRange = (baseSearchRange + gameState.search * 5) * equipEffects.detection;
  updateEnemyGuide(gameState.enemies, camera.position, yaw, effectiveSearchRange);
  
  // 円形レーダーを更新
  updateRadar(
    camera.position,
    yaw,
    getAliveEnemies(),
    droppedMasksForSensor,
    [], // foods（オプション）
    getEquipments().filter(e => !e.collected),
    gameState.rival
  );
  
  // 敵ラベル（3D空間上のUI）を更新
  updateEnemyLabels(
    getAliveEnemies(),
    camera,
    camera.position,
    gameState.rival
  );
  
  if (gameState.bossHp != null) {
    updateBossPanel(gameState.bossHp, gameState.bossHpMax, gameState.bossMaskCount);
  } else {
    updateBossPanel(0, gameState.bossHpMax, 0);
  }
  proximity.updateProximityMaterials();
  
  // ミニマップ描画（パフォーマンスのため5フレームに1回）
  if (frameCount % 5 === 0) {
    renderMinimap();
  }
  
  // 戦闘時PiP更新（プレイヤーが攻撃中、被攻撃中、または敵同士の戦闘を表示）
  // プレイヤーとの戦闘中の敵を探す
  let nearestCombatEnemy = null;
  let nearestDist = Infinity;
  let pipTarget = null;
  
  const aliveEnemies = getAliveEnemies();
  
  // プレイヤーとの戦闘をチェック
  for (const enemy of aliveEnemies) {
    if (enemy.inCombat || enemy.attackCooldown < enemy.attackCooldownMax * 0.5) {
      const dx = enemy.x - camera.position.x;
      const dz = enemy.z - camera.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist && dist < 30) {
        nearestDist = dist;
        nearestCombatEnemy = enemy;
        pipTarget = enemy;
      }
    }
  }
  
  // 敵同士の戦闘をチェック（プレイヤーとの戦闘がない場合）
  if (!nearestCombatEnemy) {
    let closestEnemyBattle = null;
    let closestBattleDist = Infinity;
    
    for (const enemy of aliveEnemies) {
      // 敵が他の敵をターゲットにしている場合
      if (enemy.targetType === 'enemy' && enemy.targetPos) {
        const battleCenterX = (enemy.x + enemy.targetPos.x) / 2;
        const battleCenterZ = (enemy.z + enemy.targetPos.z) / 2;
        const dx = battleCenterX - camera.position.x;
        const dz = battleCenterZ - camera.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < closestBattleDist && dist < 80) {
          closestBattleDist = dist;
          closestEnemyBattle = enemy;
        }
      }
    }
    
    if (closestEnemyBattle) {
      pipTarget = closestEnemyBattle;
    }
  }
  
  // マスクドロップ位置の表示更新
  if (maskDropTimer > 0) {
    maskDropTimer -= dt;
    if (maskDropTimer <= 0) {
      maskDropPosition = null;
    }
  }
  
  // マスクドロップがあり、戦闘がない場合はマスクドロップ位置を表示
  if (!pipTarget && maskDropPosition) {
    // マスクドロップ用の擬似ターゲットを作成
    const maskTarget = {
      x: maskDropPosition.x,
      y: maskDropPosition.y,
      z: maskDropPosition.z,
      targetType: 'mask_drop',
      targetPos: null
    };
    updateCombatPip(dt, true, maskTarget);
  } else {
    const isInCombat = pipTarget != null;
    updateCombatPip(dt, isInCombat, pipTarget);
  }
  
  // バックミラー更新（画面外からの攻撃時）
  updateRearMirror(dt);
  
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
