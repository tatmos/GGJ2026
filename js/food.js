import * as THREE from 'three';

export const collectRadius = 2.5;
export const energyPerFood = 25;
/** アイテムから出る光の高さ（Y方向の長さ）。建物で隠れるよう depthTest: true で描画 */
const beamHeight = 70;

const foods = [];
const foodGeo = new THREE.SphereGeometry(0.4, 12, 12);
const foodMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24 });

export function getFoods() {
  return foods;
}

export function addFood(scene, x, z) {
  const mesh = new THREE.Mesh(foodGeo, foodMat.clone());
  mesh.position.set(x, 0.6, z);
  mesh.castShadow = true;
  scene.add(mesh);
  const beamGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0)
  ]);
  const beamMat = new THREE.LineBasicMaterial({
    color: 0xffdd44,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
    depthWrite: false
  });
  const beam = new THREE.Line(beamGeo, beamMat);
  beam.scale.y = beamHeight;
  beam.position.set(x, 0, z);
  beam.visible = false;
  scene.add(beam);
  foods.push({ mesh, beam, x, z, collected: false });
}

export function updateFoodHeights(getHeightAt) {
  foods.forEach((f) => {
    if (f.collected) return;
    const h = getHeightAt(f.x, f.z);
    const y = h + 0.5;
    f.mesh.position.y = y;
    if (f.beam) {
      f.beam.position.set(f.x, h, f.z);
      f.beam.visible = true;
    }
  });
}
