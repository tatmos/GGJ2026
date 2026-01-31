import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PLATEAU_GLTF_PATH = 'gltf/city.glb';
const _raycaster = new THREE.Raycaster();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

const collisionBoxes = [];
const plateauCollisionMeshes = [];
let plateauLoaded = false;
let debugBoundingBoxMesh = null;
let debugCollisionMeshes = [];
let debugCollisionMat = null;

function raycastHeightAt(x, z, fromY = 600) {
  if (plateauCollisionMeshes.length === 0) return null;
  _rayOrigin.set(x, fromY, z);
  _rayDir.set(0, -1, 0);
  _raycaster.set(_rayOrigin, _rayDir);
  const hits = _raycaster.intersectObjects(plateauCollisionMeshes, true);
  if (hits.length === 0) return null;
  return hits[0].point.y;
}

export function getHeightAt(x, z) {
  let h = 0;
  for (let i = 0; i < collisionBoxes.length; i++) {
    const b = collisionBoxes[i];
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) h = Math.max(h, b.maxY);
  }
  if (plateauLoaded && plateauCollisionMeshes.length > 0) {
    const meshY = raycastHeightAt(x, z);
    if (meshY != null) h = Math.max(h, meshY);
  }
  return h;
}

export function createProceduralCity(scene, cityRoot, camera, updateFoodHeights) {
  collisionBoxes.length = 0;
  const blockSize = 8;
  const gridHalf = 25;
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
  const buildingMatDark = new THREE.MeshStandardMaterial({ color: 0x475569 });

  for (let gx = -gridHalf; gx <= gridHalf; gx++) {
    for (let gz = -gridHalf; gz <= gridHalf; gz++) {
      if (Math.random() < 0.3) continue;
      const wx = gx * blockSize + (Math.random() - 0.5) * blockSize * 0.5;
      const wz = gz * blockSize + (Math.random() - 0.5) * blockSize * 0.5;
      const w = 4 + Math.random() * 6;
      const d = 4 + Math.random() * 6;
      const h = 6 + Math.random() * 30;
      const box = new THREE.BoxGeometry(w, h, d);
      const mat = Math.random() > 0.5 ? buildingMat : buildingMatDark;
      const mesh = new THREE.Mesh(box, mat);
      mesh.position.set(wx, h / 2, wz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      cityRoot.add(mesh);
      collisionBoxes.push({
        minX: wx - w / 2, maxX: wx + w / 2,
        minY: 0, maxY: h,
        minZ: wz - d / 2, maxZ: wz + d / 2
      });
    }
  }
  const cx = (b) => (b.minX + b.maxX) / 2;
  const cz = (b) => (b.minZ + b.maxZ) / 2;
  let start = collisionBoxes[0];
  let bestD2 = Infinity;
  for (const b of collisionBoxes) {
    const dx = cx(b), dz = cz(b);
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) { bestD2 = d2; start = b; }
  }
  const startX = (start.minX + start.maxX) / 2;
  const startZ = (start.minZ + start.maxZ) / 2;
  camera.position.set(startX, Math.max(start.maxY + 1.6, 80), startZ);
  if (updateFoodHeights) updateFoodHeights();
}

export function addDebugCollisionBoxes(scene) {
  removeDebugCollisionBoxes(scene);
  if (!debugCollisionMat) debugCollisionMat = new THREE.LineBasicMaterial({ color: 0x00ff88, depthTest: false });
  collisionBoxes.forEach((b) => {
    const w = b.maxX - b.minX, h = b.maxY - b.minY, d = b.maxZ - b.minZ;
    const geo = new THREE.BoxGeometry(w, h, d);
    const edges = new THREE.EdgesGeometry(geo);
    const wire = new THREE.LineSegments(edges, debugCollisionMat);
    wire.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
    wire.name = 'debug_collision';
    scene.add(wire);
    debugCollisionMeshes.push(wire);
  });
}

export function removeDebugCollisionBoxes(scene) {
  debugCollisionMeshes.forEach((m) => {
    scene.remove(m);
    m.geometry?.dispose();
  });
  debugCollisionMeshes.length = 0;
}

export function addDebugBoundingBox(scene, box) {
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = box.getCenter(new THREE.Vector3());
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const edges = new THREE.EdgesGeometry(geo);
  const mat = new THREE.LineBasicMaterial({ color: 0xff0000, depthTest: false });
  const wire = new THREE.LineSegments(edges, mat);
  wire.position.copy(center);
  wire.name = 'debug_bbox';
  scene.add(wire);
  debugBoundingBoxMesh = wire;
  wire.visible = document.getElementById('debugCheckbox')?.checked ?? false;
}

export function getDebugBoundingBoxMesh() {
  return debugBoundingBoxMesh;
}

export function tryLoadPLATEAU(scene, cityRoot, callbacks) {
  const { updateLoadProgress, hideLoading, updateFoodHeights } = callbacks;
  const loader = new GLTFLoader();
  loader.load(
    PLATEAU_GLTF_PATH,
    (gltf) => {
      updateLoadProgress(50);
      const model = gltf.scene;
      plateauCollisionMeshes.length = 0;
      model.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          plateauCollisionMeshes.push(c);
        }
      });
      model.scale.setScalar(1);
      model.position.set(0, 0, 0);
      const GLB_NEEDS_X_ROTATION = false;
      if (GLB_NEEDS_X_ROTATION) model.rotation.x = -Math.PI / 2;
      cityRoot.add(model);
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      addDebugBoundingBox(scene, box);
      plateauLoaded = true;
      if (updateFoodHeights) updateFoodHeights();
      hideLoading();
    },
    (xhr) => {
      const loaded = xhr.loaded != null ? xhr.loaded : 0;
      const total = xhr.total != null ? xhr.total : 0;
      if (total > 0) updateLoadProgress((loaded / total) * 50);
    },
    () => {
      createProceduralCity(scene, cityRoot, callbacks.camera, callbacks.updateFoodHeights);
      hideLoading();
    }
  );
}
