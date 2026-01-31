import * as THREE from 'three';

const PROXIMITY_THRESHOLD = 5;
const LARGE_MESH_SIZE = 20;

const _box3 = new THREE.Box3();
const _closestPoint = new THREE.Vector3();
const _center = new THREE.Vector3();

export function createProximityUpdater(camera, cityRoot, ground, checkerTex) {
  let displayMode = 'closest';

  const proximityMat = new THREE.MeshBasicMaterial({
    map: checkerTex,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const wireframeLineMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85
  });

  function distanceFromCameraToMesh(cam, mesh, useCenter) {
    mesh.updateMatrixWorld(true);
    _box3.setFromObject(mesh);
    if (useCenter) {
      _box3.getCenter(_center);
      return cam.position.distanceTo(_center);
    }
    _box3.clampPoint(cam.position, _closestPoint);
    return cam.position.distanceTo(_closestPoint);
  }

  function getMeshSize(mesh) {
    mesh.updateMatrixWorld(true);
    _box3.setFromObject(mesh);
    const size = new THREE.Vector3();
    _box3.getSize(size);
    return Math.max(size.x, size.y, size.z);
  }

  function updateProximityMaterials() {
    if (displayMode === 'off') {
      const restore = (mesh) => {
        if (!mesh.isMesh || !mesh.geometry) return;
        if (mesh.userData.originalMaterial) mesh.material = mesh.userData.originalMaterial;
        if (mesh.userData.wireframeLine) mesh.userData.wireframeLine.visible = false;
      };
      cityRoot.traverse((c) => { if (c.isMesh) restore(c); });
      restore(ground);
      return;
    }

    const processMesh = (mesh) => {
      if (!mesh.isMesh || !mesh.geometry) return;
      if (!mesh.userData.originalMaterial && mesh.material !== proximityMat)
        mesh.userData.originalMaterial = mesh.material;

      const useCenter = displayMode === 'center' && getMeshSize(mesh) > LARGE_MESH_SIZE;
      const dist = distanceFromCameraToMesh(camera, mesh, useCenter);

      if (dist < PROXIMITY_THRESHOLD) {
        mesh.material = proximityMat;
        if (!mesh.userData.wireframeLine) {
          const edges = new THREE.EdgesGeometry(mesh.geometry);
          mesh.userData.wireframeLine = new THREE.LineSegments(edges, wireframeLineMat);
          mesh.add(mesh.userData.wireframeLine);
        }
        mesh.userData.wireframeLine.visible = true;
      } else {
        if (mesh.userData.originalMaterial) mesh.material = mesh.userData.originalMaterial;
        if (mesh.userData.wireframeLine) mesh.userData.wireframeLine.visible = false;
      }
    };
    cityRoot.traverse((c) => { if (c.isMesh) processMesh(c); });
    processMesh(ground);
  }

  function setDisplayMode(mode) {
    displayMode = mode;
  }

  function getDisplayMode() {
    return displayMode;
  }

  return { updateProximityMaterials, setDisplayMode, getDisplayMode };
}
