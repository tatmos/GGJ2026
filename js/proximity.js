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
/** 色相の変化量（1mあたり、0〜1の色相一周） */
const WORLD_CHECKER_HUE_STEP = 0.06;

/** HSV→RGB（H,S,V は 0〜1） */
const hsv2rgbGLSL = `
  vec3 hsv2rgb(vec3 hsv) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);
    return hsv.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), hsv.y);
  }
`;

/** レインボー市松（X/Y/Z すべてで色相が1mごとに変化・別用途用にストック） */
const worldCheckerFragmentShaderRainbow = `
  uniform float u_cellSize;
  uniform float u_opacity;
  uniform float u_baseHue;
  uniform float u_saturation;
  uniform float u_value;
  uniform float u_hueStep;
  varying vec3 vWorldPosition;
  ${hsv2rgbGLSL}
  void main() {
    float cx = floor(vWorldPosition.x / u_cellSize);
    float cy = floor(vWorldPosition.y / u_cellSize);
    float cz = floor(vWorldPosition.z / u_cellSize);
    float c = mod(cx + cy + cz, 2.0);
    float hue = fract(u_baseHue + (cx + cy + cz) * u_hueStep);
    float hue2 = fract(hue + 0.5);
    vec3 color1 = hsv2rgb(vec3(hue, u_saturation, u_value));
    vec3 color2 = hsv2rgb(vec3(hue2, u_saturation, u_value));
    vec3 color = mix(color1, color2, c);
    gl_FragColor = vec4(color, u_opacity);
  }
`;

/** 市松：XZは市松、Y方向だけ色相が1mごとに変化 */
const worldCheckerFragmentShader = `
  uniform float u_cellSize;
  uniform float u_opacity;
  uniform float u_baseHue;
  uniform float u_saturation;
  uniform float u_value;
  uniform float u_hueStep;
  varying vec3 vWorldPosition;
  ${hsv2rgbGLSL}
  void main() {
    float cx = floor(vWorldPosition.x / u_cellSize);
    float cy = floor(vWorldPosition.y / u_cellSize);
    float cz = floor(vWorldPosition.z / u_cellSize);
    float c = mod(cx + cy + cz, 2.0);
    float hue = fract(u_baseHue + cy * u_hueStep);
    float hue2 = fract(hue + 0.5);
    vec3 color1 = hsv2rgb(vec3(hue, u_saturation, u_value));
    vec3 color2 = hsv2rgb(vec3(hue2, u_saturation, u_value));
    vec3 color = mix(color1, color2, c);
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
  /** 座標ベース市松（1mマス・XZは市松、Y方向だけ色相が1mごとに変化） */
  const proximityMatWorld = new THREE.ShaderMaterial({
    vertexShader: worldCheckerVertexShader,
    fragmentShader: worldCheckerFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      u_cellSize: { value: WORLD_CHECKER_CELL_SIZE },
      u_opacity: { value: 0.35 },
      u_baseHue: { value: 0.55 },
      u_saturation: { value: 0.12 },
      u_value: { value: 0.56 },
      u_hueStep: { value: WORLD_CHECKER_HUE_STEP }
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
      u_baseHue: { value: 0.55 },
      u_saturation: { value: 0.12 },
      u_value: { value: 0.56 },
      u_hueStep: { value: WORLD_CHECKER_HUE_STEP }
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
