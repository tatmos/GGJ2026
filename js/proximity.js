import * as THREE from 'three';

/** この距離未満で完全に半透明＋ワイヤーフレーム */
const PROXIMITY_THRESHOLD_NEAR = 5;
/** 段階的表示時、この距離以上は通常表示（シェーダーで15〜30mの間は市松がフェードアウト） */
const PROXIMITY_THRESHOLD_FAR = 30;
/** 市松の距離フェード：この距離以下で不透明、この距離〜FADE_FARで薄くなる */
const PROXIMITY_FADE_NEAR = 15;
/** 市松の距離フェード：この距離以上で元のモデル色（THRESHOLD_FAR と揃える） */
const PROXIMITY_FADE_FAR = 30;
/** 座標ベース市松の1マスサイズ（メートル） */
const WORLD_CHECKER_CELL_SIZE = 1.0;
/** 市松がフェードアウトした先（元マテリアル相当）の表示色（RGB 0〜1） */
const FAR_GRAY_COLOR = new THREE.Vector3(0.45, 0.45, 0.48);
/** シェーダー陰影用：シーンの太陽位置（scene.js の DirectionalLight と揃える） */
const LIGHT_POSITION = new THREE.Vector3(50, 100, 50);
/** 環境光の強さ（0〜1）。陰影の暗い部分 */
const SHADER_AMBIENT = 0.4;
/** 拡散光の強さ（0〜1）。陰影の明るい部分。ambient + diffuse ≦ 1 程度に */
const SHADER_DIFFUSE = 0.6;

const _box3 = new THREE.Box3();
const _closestPoint = new THREE.Vector3();

const worldCheckerVertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vec3 n = normalMatrix * normal;
    float len = length(n);
    vNormal = len < 0.001 ? vec3(0.0, 1.0, 0.0) : normalize(n);
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

/** 市松：XZは市松、Y方向だけ色相が1mごとに変化。カメラ距離15〜30mで市松→グレーにフェード。半透明なし（常に不透明） */
const worldCheckerFragmentShader = `
  precision highp float;
  uniform float u_cellSize;
  uniform float u_opacity;
  uniform float u_baseHue;
  uniform float u_saturation;
  uniform float u_value;
  uniform float u_hueStep;
  uniform vec3 u_cameraPosition;
  uniform float u_proximityFadeNear;
  uniform float u_proximityFadeFar;
  uniform vec3 u_farGrayColor;
  uniform vec3 u_lightPosition;
  uniform float u_ambient;
  uniform float u_diffuse;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
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
    vec3 checkerColor = mix(color1, color2, c);
    float dist = distance(vWorldPosition, u_cameraPosition);
    float fade = 1.0 - smoothstep(u_proximityFadeNear, u_proximityFadeFar, dist);
    vec3 color = mix(u_farGrayColor, checkerColor, fade);
    float alpha = 1.0;
    vec3 n = length(vNormal) < 0.01 ? vec3(0.0, 1.0, 0.0) : normalize(vNormal);
    vec3 toLight = u_lightPosition - vWorldPosition;
    float toLightLen = length(toLight);
    vec3 lightDir = toLightLen < 0.001 ? vec3(0.0, 1.0, 0.0) : normalize(toLight);
    float ndl = max(0.0, dot(n, lightDir));
    float shade = u_ambient + u_diffuse * ndl;
    color *= shade;
    gl_FragColor = vec4(color, alpha);
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
    transparent: false,
    opacity: 1,
    depthWrite: true,
    side: THREE.DoubleSide
  });
  /** 座標ベース市松（1mマス・XZは市松、Y方向だけ色相が1mごとに変化）。距離15〜30mでフェード。半透明なし */
  const proximityMatWorld = new THREE.ShaderMaterial({
    vertexShader: worldCheckerVertexShader,
    fragmentShader: worldCheckerFragmentShader,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -1.0,
    uniforms: {
      u_cellSize: { value: WORLD_CHECKER_CELL_SIZE },
      u_opacity: { value: 0.52 },
      u_baseHue: { value: 0.55 },
      u_saturation: { value: 0.12 },
      u_value: { value: 0.56 },
      u_hueStep: { value: WORLD_CHECKER_HUE_STEP },
      u_cameraPosition: { value: new THREE.Vector3() },
      u_proximityFadeNear: { value: PROXIMITY_FADE_NEAR },
      u_proximityFadeFar: { value: PROXIMITY_FADE_FAR },
      u_farGrayColor: { value: FAR_GRAY_COLOR.clone() },
      u_lightPosition: { value: LIGHT_POSITION.clone() },
      u_ambient: { value: SHADER_AMBIENT },
      u_diffuse: { value: SHADER_DIFFUSE }
    }
  });
  /** ワイヤーは深度書き込みしない。半透明の面が深度テストで落ちて描画されないのを防ぐ */
  const wireframeLineMat = new THREE.LineBasicMaterial({ color: 0x333333, depthTest: true, depthWrite: false });
  /** 市松なし：単色（Debugで区別しやすいよう青みの色）。半透明なし */
  const proximityMatSolid = new THREE.MeshBasicMaterial({
    color: 0x6688cc,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    side: THREE.DoubleSide
  });
  /** 段階的表示の中間：市松・ワイヤーフレームなし。半透明なし */
  const midMat = new THREE.MeshBasicMaterial({
    map: checkerTex,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    side: THREE.DoubleSide
  });
  const midMatWorld = new THREE.ShaderMaterial({
    vertexShader: worldCheckerVertexShader,
    fragmentShader: worldCheckerFragmentShader,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -1.0,
    uniforms: {
      u_cellSize: { value: WORLD_CHECKER_CELL_SIZE },
      u_opacity: { value: 0.78 },
      u_baseHue: { value: 0.55 },
      u_saturation: { value: 0.12 },
      u_value: { value: 0.56 },
      u_hueStep: { value: WORLD_CHECKER_HUE_STEP },
      u_cameraPosition: { value: new THREE.Vector3() },
      u_proximityFadeNear: { value: PROXIMITY_FADE_NEAR },
      u_proximityFadeFar: { value: PROXIMITY_FADE_FAR },
      u_farGrayColor: { value: FAR_GRAY_COLOR.clone() },
      u_lightPosition: { value: LIGHT_POSITION.clone() },
      u_ambient: { value: SHADER_AMBIENT },
      u_diffuse: { value: SHADER_DIFFUSE }
    }
  });
  const midMatSolid = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: false,
    opacity: 1,
    side: THREE.DoubleSide
  });
  /** 26m以下用：市松のみ・不透明（メッシュ全体が26m以下のとき用・シェーダーで距離フェードも適用） */
  const proximityMatWorldOpaque = new THREE.ShaderMaterial({
    vertexShader: worldCheckerVertexShader,
    fragmentShader: worldCheckerFragmentShader,
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      u_cellSize: { value: WORLD_CHECKER_CELL_SIZE },
      u_opacity: { value: 1.0 },
      u_baseHue: { value: 0.55 },
      u_saturation: { value: 0.12 },
      u_value: { value: 0.56 },
      u_hueStep: { value: WORLD_CHECKER_HUE_STEP },
      u_cameraPosition: { value: new THREE.Vector3() },
      u_proximityFadeNear: { value: PROXIMITY_FADE_NEAR },
      u_proximityFadeFar: { value: PROXIMITY_FADE_FAR },
      u_farGrayColor: { value: FAR_GRAY_COLOR.clone() },
      u_lightPosition: { value: LIGHT_POSITION.clone() },
      u_ambient: { value: SHADER_AMBIENT },
      u_diffuse: { value: SHADER_DIFFUSE }
    }
  });
  const midMatWorldOpaque = new THREE.ShaderMaterial({
    vertexShader: worldCheckerVertexShader,
    fragmentShader: worldCheckerFragmentShader,
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      u_cellSize: { value: WORLD_CHECKER_CELL_SIZE },
      u_opacity: { value: 1.0 },
      u_baseHue: { value: 0.55 },
      u_saturation: { value: 0.12 },
      u_value: { value: 0.56 },
      u_hueStep: { value: WORLD_CHECKER_HUE_STEP },
      u_cameraPosition: { value: new THREE.Vector3() },
      u_proximityFadeNear: { value: PROXIMITY_FADE_NEAR },
      u_proximityFadeFar: { value: PROXIMITY_FADE_FAR },
      u_farGrayColor: { value: FAR_GRAY_COLOR.clone() },
      u_lightPosition: { value: LIGHT_POSITION.clone() },
      u_ambient: { value: SHADER_AMBIENT },
      u_diffuse: { value: SHADER_DIFFUSE }
    }
  });
  /** UVベース市松・不透明（26m以下用・useWorldSpaceChecker=false のとき） */
  const proximityMatOpaque = new THREE.MeshBasicMaterial({
    map: checkerTex,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    side: THREE.DoubleSide
  });
  const midMatOpaque = new THREE.MeshBasicMaterial({
    map: checkerTex,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    side: THREE.DoubleSide
  });

  function distanceFromCameraToMesh(cam, mesh) {
    mesh.updateMatrixWorld(true);
    _box3.setFromObject(mesh);
    _box3.clampPoint(cam.position, _closestPoint);
    return cam.position.distanceTo(_closestPoint);
  }

  /** メッシュのワールドAABBがカメラより下に収まっているか（半透明にしない対象） */
  function isMeshBelowCamera(mesh, cam) {
    mesh.updateMatrixWorld(true);
    _box3.setFromObject(mesh);
    return _box3.max.y <= cam.position.y;
  }

  function restoreAllToOriginal() {
    const restore = (mesh) => {
      if (!mesh.isMesh || !mesh.geometry) return;
      if (mesh.userData.originalMaterial) mesh.material = mesh.userData.originalMaterial;
      if (mesh.userData.wireframeLine) mesh.userData.wireframeLine.visible = false;
    };
    cityRoot.traverse((c) => { if (c.isMesh) restore(c); });
  }

  function updateProximityMaterials() {
    if (!proximityEnabled) return;

    const camPos = camera.position;
    proximityMatWorld.uniforms.u_cameraPosition.value.copy(camPos);
    midMatWorld.uniforms.u_cameraPosition.value.copy(camPos);
    proximityMatWorldOpaque.uniforms.u_cameraPosition.value.copy(camPos);
    midMatWorldOpaque.uniforms.u_cameraPosition.value.copy(camPos);

    const nearMat = useCheckerTexture
      ? (useWorldSpaceChecker ? proximityMatWorld : proximityMat)
      : proximityMatSolid;
    const middleMat = useCheckerTexture
      ? (useWorldSpaceChecker ? midMatWorld : midMat)
      : midMatSolid;
    const isProximityMat = (m) =>
      m === proximityMat || m === proximityMatSolid || m === proximityMatWorld ||
      m === midMat || m === midMatSolid || m === midMatWorld ||
      m === proximityMatWorldOpaque || m === midMatWorldOpaque ||
      m === proximityMatOpaque || m === midMatOpaque;

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
