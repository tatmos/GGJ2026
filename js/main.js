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
  collectRadius,
  energyPerFood
} from './food.js';
import {
  keys,
  resolveCollisions,
  baseSpeed,
  turnSpeed,
  energyCostPerSec,
  verticalSpeed,
  minHeight,
  maxHeight
} from './player.js';
import {
  updateLoadProgress,
  hideLoading,
  updateEnergyBar,
  updateDirectionMeter,
  updateSpeedMeter,
  updateAltitudeMeter,
  updatePosMeter
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

for (let i = 0; i < 60; i++) {
  const x = (Math.random() - 0.5) * 200;
  const z = (Math.random() - 0.5) * 200;
  addFood(scene, x, z);
}

let yaw = 0;
let speedMultiplier = 1;
let energy = 100;
const clock = new THREE.Clock();
const foods = getFoods();

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

document.addEventListener('keydown', (e) => {
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
  }
  if (keys.s && energy > 0) {
    speedMultiplier = 0.5;
    energy = Math.max(0, energy - energyCostPerSec * dt);
  }

  const move = forward.multiplyScalar(baseSpeed * speedMultiplier * dt);
  camera.position.add(move);

  if (keys.q) camera.position.y += verticalSpeed * dt;
  if (keys.e) camera.position.y -= verticalSpeed * dt;
  resolveCollisions(camera);

  foods.forEach((f) => {
    if (f.collected) return;
    const dx = camera.position.x - f.x;
    const dz = camera.position.z - f.z;
    if (dx * dx + dz * dz < collectRadius * collectRadius) {
      f.collected = true;
      f.mesh.visible = false;
      if (f.beam) f.beam.visible = false;
      energy = Math.min(100, energy + energyPerFood);
    }
  });

  updateEnergyBar(energy);
  updatePosMeter(camera);
  updateAltitudeMeter(camera, minHeight, maxHeight);
  updateSpeedMeter(speedMultiplier);
  updateDirectionMeter(yaw);
  proximity.updateProximityMaterials();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
