import * as THREE from 'three';

/** この距離未満で完全に半透明＋ワイヤーフレーム */
const PROXIMITY_THRESHOLD_NEAR = 5;
/** 段階的表示時、この距離以上は通常表示（この距離未満から段階的に変化） */
const PROXIMITY_THRESHOLD_FAR = 12;
/** 座標ベース市松の1マスサイズ（メートル） */
const WORLD_CHECKER_CELL_SIZE = 1.0;

const _box3 = new THREE.Box3();
const _closestPoint = new THREE.Vector3();

const worldCheckerVertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const worldCheckerFragmentShader = `
  uniform float u_cellSize;
  uniform float u_opacity;
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  varying vec3 vWorldPosition;
  void main() {
    float cx = floor(vWorldPosition.x / u_cellSize);
    float cz = floor(vWorldPosition.z / u_cellSize);
    float c = mod(cx + cz, 2.0);
    vec3 color = mix(u_color1, u_color2, c);
    gl_FragColor = vec4(color, u_opacity);
  }
`;

export function createProximityUpdater(camera, cityRoot, ground, checkerTex) {
  let useGradual = true;
  let proximityEnabled = true;
  /** 近接時の市松模様（オフだと単色で軽い・Debug用にオフ時は色で判別しやすく） */
  let useCheckerTexture = true;
  /** 市松の付け方: false=UVベース, true=ワールド座標ベース（UVが無くても市松が出る） */
  let useWorldSpaceChecker = true;

  const proximityMat = new THREE.MeshBasicMaterial({
    map: checkerTex,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  /** 座標ベース市松（近接・1mマス） */
  const proximityMatWorld = new THREE.ShaderMaterial({
    vertexShader: worldCheckerVertexShader,
    fragmentShader: worldCheckerFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      u_cellSize: { value: WORLD_CHECKER_CELL_SIZE },
      u_opacity: { value: 0.35 },
      u_color1: { value: new THREE.Color(0x9ca4b4) },
      u_color2: { value: new THREE.Color(0xb4bcc8) }
    }
  });
  const wireframeLineMat = new THREE.LineBasicMaterial({ color: 0x333333, depthTest: true });
  /** 市松なし：単色半透明（Debugで区別しやすいよう青みの色） */
  const proximityMatSolid = new THREE.MeshBasicMaterial({
    color: 0x6688cc,
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
  const midMatWorld = new THREE.ShaderMaterial({
    vertexShader: worldCheckerVertexShader,
    fragmentShader: worldCheckerFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      u_cellSize: { value: WORLD_CHECKER_CELL_SIZE },
      u_opacity: { value: 0.6 },
      u_color1: { value: new THREE.Color(0x9ca4b4) },
      u_color2: { value: new THREE.Color(0xb4bcc8) }
    }
  });
  const midMatSolid = new THREE.MeshBasicMaterial({
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

  function restoreAllToOriginal() {
    const restore = (mesh) => {
      if (!mesh.isMesh || !mesh.geometry) return;
      if (mesh.userData.originalMaterial) mesh.material = mesh.userData.originalMaterial;
      if (mesh.userData.wireframeLine) mesh.userData.wireframeLine.visible = false;
    };
    cityRoot.traverse((c) => { if (c.isMesh) restore(c); });
    restore(ground);
  }

  function updateProximityMaterials() {
    if (!proximityEnabled) return;

    const nearMat = useCheckerTexture
      ? (useWorldSpaceChecker ? proximityMatWorld : proximityMat)
      : proximityMatSolid;
    const middleMat = useCheckerTexture
      ? (useWorldSpaceChecker ? midMatWorld : midMat)
      : midMatSolid;
    const isProximityMat = (m) =>
      m === proximityMat || m === proximityMatSolid || m === proximityMatWorld ||
      m === midMat || m === midMatSolid || m === midMatWorld;

    const processMesh = (mesh) => {
      if (!mesh.isMesh || !mesh.geometry) return;
      if (!mesh.userData.originalMaterial && !isProximityMat(mesh.material))
        mesh.userData.originalMaterial = mesh.material;

      const dist = distanceFromCameraToMesh(camera, mesh);

      if (useGradual) {
        if (dist >= PROXIMITY_THRESHOLD_FAR) {
          if (mesh.userData.originalMaterial) mesh.material = mesh.userData.originalMaterial;
          if (mesh.userData.wireframeLine) mesh.userData.wireframeLine.visible = false;
        } else if (dist >= PROXIMITY_THRESHOLD_NEAR) {
          mesh.material = middleMat;
          if (mesh.userData.wireframeLine) mesh.userData.wireframeLine.visible = false;
        } else {
          mesh.material = nearMat;
          if (!mesh.userData.wireframeLine) {
            const edges = new THREE.EdgesGeometry(mesh.geometry);
            mesh.userData.wireframeLine = new THREE.LineSegments(edges, wireframeLineMat);
            mesh.add(mesh.userData.wireframeLine);
          }
          mesh.userData.wireframeLine.visible = true;
        }
      } else {
        if (dist < PROXIMITY_THRESHOLD_NEAR) {
          mesh.material = nearMat;
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

  function setProximityEnabled(value) {
    const was = proximityEnabled;
    proximityEnabled = !!value;
    if (was && !proximityEnabled) restoreAllToOriginal();
  }

  function getProximityEnabled() {
    return proximityEnabled;
  }

  function setUseCheckerTexture(value) {
    useCheckerTexture = !!value;
  }

  function getUseCheckerTexture() {
    return useCheckerTexture;
  }

  function setUseWorldSpaceChecker(value) {
    useWorldSpaceChecker = !!value;
  }

  function getUseWorldSpaceChecker() {
    return useWorldSpaceChecker;
  }

  return {
    updateProximityMaterials,
    setUseGradual,
    getUseGradual,
    setProximityEnabled,
    getProximityEnabled,
    setUseCheckerTexture,
    getUseCheckerTexture,
    setUseWorldSpaceChecker,
    getUseWorldSpaceChecker
  };
}
