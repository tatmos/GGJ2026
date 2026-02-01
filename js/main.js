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
  getDebugBoundingBoxMesh
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
  autoDescendSpeed
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
  updateInventory,
  updateMaskList,
  updateBuffQueue,
  updateEnemyGuide,
  updateBossPanel,
  showItemPopup
} from './ui.js';

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
  inventory: [],
  inventoryMaxSlots: 5,
  masks: [],
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
  hoverGraceTimeSec: undefined
};

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

  tickBuffQueue(gameState, dt);
  const effectiveRecoveryCooldownSec = recoveryCooldownSec * getRecoveryCooldownScaleFromBuff(gameState.activeBuff);
  const buffSpeedMultiplier = getSpeedMultiplierFromBuff(gameState.activeBuff);

  if (document.getElementById('debugCheckbox')?.checked && debugFpsEl) {
    debugFpsEl.textContent = Math.round(1 / dt) + ' FPS';
  }

  if (keys.a) yaw += turnSpeed * dt;
  if (keys.d) yaw -= turnSpeed * dt;

  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = 0;
  camera.rotation.z = 0;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() > 0.0001) forward.normalize();

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
  recoveryCooldown = Math.max(0, recoveryCooldown - dt);
  if (!keys.w && !keys.s && recoveryCooldown <= 0) {
    energy = Math.min(100, energy + energyRecoveryPerSec * dt);
  }
  speedMultiplier *= buffSpeedMultiplier;

  const move = forward.multiplyScalar(baseSpeed * speedMultiplier * dt);
  camera.position.add(move);

  if (keys.w && energy > 0) camera.position.y += verticalSpeed * dt;
  if (keys.s) camera.position.y -= verticalSpeed * dt;
  if (keys.q) camera.position.y += verticalSpeed * dt;
  if (keys.e) camera.position.y -= verticalSpeed * dt;
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

  foods.forEach((f) => {
    if (f.collected) return;
    const dx = camera.position.x - f.x;
    const dz = camera.position.z - f.z;
    if (dx * dx + dz * dz < collectRadius * collectRadius) {
      f.collected = true;
      f.mesh.visible = false;
      if (f.beam) f.beam.visible = false;
      const instant = addBuffToQueue(gameState, f.typeId);
      if (instant && instant.effect === 'energy') {
        energy = Math.min(100, energy + (instant.value ?? energyPerFood));
      }
      // お店の名前と料理ジャンルを表示
      showItemPopup(f.name, f.nameJa, f.cuisine, f.typeId);
    }
  });

  gameState.survivalSec += dt;

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
  updateInventory(gameState.inventory, gameState.inventoryMaxSlots);
  updateMaskList(gameState.masks);
  updateBuffQueue(getActiveBuffsForDisplay(gameState), getBuffQueueForDisplay(gameState));
  updateEnemyGuide(gameState.enemies, camera.position, yaw, gameState.searchRange);
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
