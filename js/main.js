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

const { scene, camera, renderer, ground, checkerTexProximity, cityRoot } = createScene();
document.body.appendChild(renderer.domElement);

const proximity = createProximityUpdater(camera, cityRoot, ground, checkerTexProximity);

function onUpdateFoodHeights() {
  updateFoodHeights(getHeightAt);
}

tryLoadPLATEAU(scene, cityRoot, {
  updateLoadProgress,
  hideLoading,
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
const foods = getFoods();

/** UI用仮状態（生存時間・転生・ステータス・所持・マスク・バフ・敵は後で実データに差し替え） */
const gameState = {
  /** 生存時間（秒）。毎フレーム dt を加算。転生時に 0 にリセット。5分／15分トリガーの基準。 */
  survivalSec: 0,
  reincarnation: 0,
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
  nextEnemySpawnSec: 30, // 最初は30秒後
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
  
  // 引き継ぐマスク数 = 転生回数（次の転生で+1されるので現在値+1）
  const maskCountToKeep = Math.min(
    gameState.reincarnation + 1,
    gameState.maskInventory.masks.length
  );
  
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
  // 転生回数を増やす
  gameState.reincarnation++;
  
  // マスクを一部引き継ぎ（レベルが高い順に保持）
  const sortedMasks = [...gameState.maskInventory.masks].sort((a, b) => b.level - a.level);
  gameState.maskInventory.masks = sortedMasks.slice(0, maskCountToKeep);
  gameState.masks = getMasksForDisplay(gameState.maskInventory);
  
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
  gameState.nextEnemySpawnSec = 30;
  
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

document.getElementById('debugCheckbox').addEventListener('change', (e) => {
  const on = e.target.checked;
  const bboxMesh = getDebugBoundingBoxMesh();
  if (bboxMesh) bboxMesh.visible = on;
  if (on) addDebugCollisionBoxes(scene);
  else removeDebugCollisionBoxes(scene);
  if (debugFpsEl) debugFpsEl.style.display = on ? 'inline' : 'none';
  if (debugMenuEl) debugMenuEl.classList.toggle('visible', on);
  if (!on && debugFpsEl) debugFpsEl.textContent = '';
  if (on) updateDebugCheckerStateLabel();
});

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

document.addEventListener('keydown', (e) => {
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
  if (k === 'w') keys.w = true;
  if (k === 'a') keys.a = true;
  if (k === 's') keys.s = true;
  if (k === 'd') keys.d = true;
  if (k === 'q') keys.q = true;
  if (k === 'e') keys.e = true;
  if (['w', 'a', 's', 'd', 'q', 'e'].includes(k)) e.preventDefault();
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w') keys.w = false;
  if (k === 'a') keys.a = false;
  if (k === 's') keys.s = false;
  if (k === 'd') keys.d = false;
  if (k === 'q') keys.q = false;
  if (k === 'e') keys.e = false;
});

function animate() {
  requestAnimationFrame(animate);
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

  if (document.getElementById('debugCheckbox')?.checked && debugFpsEl) {
    debugFpsEl.textContent = Math.round(1 / dt) + ' FPS';
  }

  if (keys.a) yaw += turnSpeed * dt;
  if (keys.d) yaw -= turnSpeed * dt;

  // 近くの敵へのソフトロックオン（敵方向にカメラを引っ張る）
  const aliveEnemies = getAliveEnemies();
  if (aliveEnemies.length > 0) {
    // 最も近い敵を探す
    let closestEnemy = null;
    let closestDistSq = Infinity;
    const lockOnRange = 30; // ロックオン有効範囲
    
    for (const enemy of aliveEnemies) {
      const dx = enemy.mesh.position.x - camera.position.x;
      const dz = enemy.mesh.position.z - camera.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < closestDistSq && distSq < lockOnRange * lockOnRange) {
        closestDistSq = distSq;
        closestEnemy = enemy;
      }
    }
    
    if (closestEnemy) {
      // 敵への方向を計算
      const dx = closestEnemy.mesh.position.x - camera.position.x;
      const dz = closestEnemy.mesh.position.z - camera.position.z;
      const targetYaw = Math.atan2(-dx, -dz);
      
      // yawと目標の差を計算
      let yawToEnemy = targetYaw - yaw;
      while (yawToEnemy > Math.PI) yawToEnemy -= 2 * Math.PI;
      while (yawToEnemy < -Math.PI) yawToEnemy += 2 * Math.PI;
      
      // 距離が近いほど強くロックオン（最大で0.5の強さ）
      const dist = Math.sqrt(closestDistSq);
      const lockOnStrength = Math.max(0, 1 - dist / lockOnRange) * 0.5;
      
      // プレイヤーが旋回操作していない時だけロックオン
      if (!keys.a && !keys.d) {
        yaw += yawToEnemy * lockOnStrength * dt * 2;
      }
    }
  }

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
  if (keys.w && energy > 0) {
    speedMultiplier = 1.6;
    energy = Math.max(0, energy - energyCostPerSec * dt);
    recoveryCooldown = effectiveRecoveryCooldownSec;
    hoverGraceElapsed = 0;
  }
  if (keys.s && energy > 0) {
    speedMultiplier = 0.5;
    energy = Math.max(0, energy - energyCostPerSec * dt);
    recoveryCooldown = effectiveRecoveryCooldownSec;
    hoverGraceElapsed = 0;
  }
  // 回復クールダウン（装備効果で短縮）
  const effectiveRecoveryCooldownReduction = 1 / equipEffects.recoveryCooldown; // 値が低いほど早く回復
  recoveryCooldown = Math.max(0, recoveryCooldown - dt * effectiveRecoveryCooldownReduction);
  
  // エネルギー回復（装備効果で増加）
  if (!keys.w && !keys.s && recoveryCooldown <= 0) {
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
  if (keys.w && energy > 0) { camera.position.y += effectiveVerticalSpeed * dt; verticalInput = 1; }
  if (keys.s) { camera.position.y -= effectiveVerticalSpeed * dt; verticalInput = -1; }
  if (keys.q) { camera.position.y += effectiveVerticalSpeed * dt; verticalInput = 1; }
  if (keys.e) { camera.position.y -= effectiveVerticalSpeed * dt; verticalInput = -1; }
  
  // カメラピッチ（上下傾き）の計算
  const maxPitch = Math.PI / 12; // 最大15度傾く
  const pitchSpeed = 3.0;
  const targetPitch = -verticalInput * maxPitch; // 上昇で下向き、下降で上向き
  cameraPitch += (targetPitch - cameraPitch) * pitchSpeed * dt;
  const hoverGrace = gameState.hoverGraceTimeSec ?? hoverGraceTimeSec;
  if (!keys.w && !keys.s && !keys.q && !keys.e) {
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
        
        showGrowthDialog(optionCount, (paramId, value) => {
          // パラメータを成長させる
          if (gameState[paramId] !== undefined) {
            gameState[paramId] += value;
            const nameJa = PARAM_NAMES_JA[paramId] || paramId;
            addCombatLog(`${nameJa} が +${value} 上昇！`, 'attack');
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
        console.log(`[Equipment] 取得: ${e.icon} ${e.nameJa} (${e.effect}: ${e.value > 0 ? '+' : ''}${(e.value * 100).toFixed(0)}%)`);
      } else {
        // スロットが満杯の場合（後で交換UIを追加予定）
        // 現在は何もしない
      }
    }
  });

  gameState.survivalSec += dt;

  // === 成長選択トリガー（5分ごと） ===
  const GROWTH_INTERVAL_SEC = 5 * 60; // 5分
  const currentMilestone = Math.floor(gameState.survivalSec / GROWTH_INTERVAL_SEC);
  if (currentMilestone > gameState.lastGrowthMilestone) {
    gameState.lastGrowthMilestone = currentMilestone;
    gameState.growthPending = true;
    addCombatLog('成長の時が来た！アイテムを取得しよう', 'mask');
  }

  // === ライバル出現（15分ごと） ===
  gameState.rivalSpawnTimer += dt;
  if (gameState.rivalSpawnTimer >= RIVAL_SPAWN_INTERVAL_SEC && gameState.rival === null) {
    gameState.rivalSpawnTimer = 0;
    
    // ライバルをスポーン（プレイヤーから離れた位置に）
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 30;
    const spawnX = camera.position.x + Math.cos(angle) * distance;
    const spawnZ = camera.position.z + Math.sin(angle) * distance;
    
    // ライバルの強さはプレイヤーのベース能力を基準に
    const rivalStrength = 3; // 通常の敵より強い
    const rival = spawnEnemy(scene, spawnX, spawnZ, rivalStrength);
    rival.isRival = true;
    rival.hp = 100; // ライバルはHPが高い
    rival.maxHp = 100;
    gameState.rival = rival;
    
    // ボスUIに反映
    gameState.bossHp = rival.hp;
    gameState.bossHpMax = rival.maxHp;
    gameState.bossMaskCount = rival.masks.length;
    
    showRivalWarning();
    addCombatLog('⚠ ライバルが出現した！', 'damage');
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
  
  // 敵スポーン
  gameState.enemySpawnTimer += dt;
  if (gameState.enemySpawnTimer >= gameState.nextEnemySpawnSec) {
    gameState.enemySpawnTimer = 0;
    gameState.nextEnemySpawnSec = ENEMY_CONFIG.spawnIntervalSec;
    
    // プレイヤーから離れた位置にスポーン
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 50 + Math.random() * 50;
    const spawnX = camera.position.x + Math.cos(spawnAngle) * spawnDist;
    const spawnZ = camera.position.z + Math.sin(spawnAngle) * spawnDist;
    
    // 強さはプレイヤーより少し弱め（0.5〜0.9）
    const strength = 0.5 + Math.random() * 0.4;
    spawnEnemy(scene, spawnX, spawnZ, strength);
  }
  
  // 敵の更新（ドロップマスクを渡して敵が拾えるように）
  const droppedMasksForEnemy = getDroppedMasks().filter(m => !m.collected);
  const enemyPickedMasks = updateEnemies(dt, camera.position, getHeightAt, droppedMasksForEnemy, scene, collectMask);
  
  // 敵がマスクを拾ったらログ表示
  for (const { enemy, mask } of enemyPickedMasks) {
    const enemyName = enemy.masks[0]?.nameJa || '敵';
    addCombatLog(`${enemyName} が ${mask.nameJa} を奪った！`, 'mask');
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
    const targetName = attackResult.target.masks[0]?.nameJa || '敵';
    if (attackResult.target.isAlive) {
      addCombatLog(`${targetName} に ${attackResult.damage} ダメージ！`, 'attack');
    }
  }
  
  // 敵の攻撃
  const enemyDamage = enemyAttacks(dt, camera.position, getAliveEnemies(), playerStats);
  if (enemyDamage > 0) {
    const previousEnergy = energy;
    energy = Math.max(0, energy - enemyDamage);
    addCombatLog(`敵から攻撃を受けた！ ${enemyDamage} ダメージ`, 'damage');
    
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
    addCombatLog(`${enemyName} を倒した！`, 'defeat');
    dropMasksFromEnemy(scene, enemy);
  }
  
  // マスクのアニメーション
  updateDroppedMasks(dt);
  
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
      // ログ表示
      if (result.isNew) {
        addCombatLog(`${mask.nameJa} を入手！`, 'mask');
      } else {
        addCombatLog(`${mask.nameJa} Lv${result.mask.level} に合成！`, 'mask');
      }
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
  if (gameState.bossHp != null) {
    updateBossPanel(gameState.bossHp, gameState.bossHpMax, gameState.bossMaskCount);
  } else {
    updateBossPanel(0, gameState.bossHpMax, 0);
  }
  proximity.updateProximityMaterials();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
