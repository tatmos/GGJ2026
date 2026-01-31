import * as THREE from 'three';

/** この距離未満で完全に半透明＋ワイヤーフレーム */
const PROXIMITY_THRESHOLD_NEAR = 5;
/** 段階的表示時、この距離以上は通常表示（この距離未満から段階的に変化） */
const PROXIMITY_THRESHOLD_FAR = 12;

const _box3 = new THREE.Box3();
const _closestPoint = new THREE.Vector3();

export function createProximityUpdater(camera, cityRoot, ground, checkerTex) {
  let useGradual = false;

  const proximityMat = new THREE.MeshBasicMaterial({
    map: checkerTex,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  /** 段階的表示の中間：やや半透明・市松・ワイヤーフレームなし */
  const midMat = new THREE.MeshBasicMaterial({
    map: checkerTex,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const wireframeLineMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85
  });

  function distanceFromCameraToMesh(cam, mesh) {
    mesh.updateMatrixWorld(true);
    _box3.setFromObject(mesh);
    _box3.clampPoint(cam.position, _closestPoint);
    return cam.position.distanceTo(_closestPoint);
  }

  function updateProximityMaterials() {
    const processMesh = (mesh) => {
      if (!mesh.isMesh || !mesh.geometry) return;
      if (!mesh.userData.originalMaterial && mesh.material !== proximityMat && mesh.material !== midMat)
        mesh.userData.originalMaterial = mesh.material;

      const dist = distanceFromCameraToMesh(camera, mesh);

      if (useGradual) {
        if (dist >= PROXIMITY_THRESHOLD_FAR) {
          if (mesh.userData.originalMaterial) mesh.material = mesh.userData.originalMaterial;
          if (mesh.userData.wireframeLine) mesh.userData.wireframeLine.visible = false;
        } else if (dist >= PROXIMITY_THRESHOLD_NEAR) {
          mesh.material = midMat;
          if (mesh.userData.wireframeLine) mesh.userData.wireframeLine.visible = false;
        } else {
          mesh.material = proximityMat;
          if (!mesh.userData.wireframeLine) {
            const edges = new THREE.EdgesGeometry(mesh.geometry);
            mesh.userData.wireframeLine = new THREE.LineSegments(edges, wireframeLineMat);
            mesh.add(mesh.userData.wireframeLine);
          }
          mesh.userData.wireframeLine.visible = true;
        }
      } else {
        if (dist < PROXIMITY_THRESHOLD_NEAR) {
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
      }
    };
    cityRoot.traverse((c) => { if (c.isMesh) processMesh(c); });
    processMesh(ground);
  }

  function setUseGradual(value) {
    useGradual = !!value;
  }

  function getUseGradual() {
    return useGradual;
  }

  return { updateProximityMaterials, setUseGradual, getUseGradual };
}
