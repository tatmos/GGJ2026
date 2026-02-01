import * as THREE from 'three';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 200, 1200);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(50, 100, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 300;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 80, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const checkerSize = 32;
  const checkerCanvas = document.createElement('canvas');
  checkerCanvas.width = checkerSize * 2;
  checkerCanvas.height = checkerSize * 2;
  const ctx = checkerCanvas.getContext('2d');
  ctx.fillStyle = '#4a5568';
  ctx.fillRect(0, 0, checkerSize * 2, checkerSize * 2);
  ctx.fillStyle = '#5a6578';
  ctx.fillRect(0, 0, checkerSize, checkerSize);
  ctx.fillRect(checkerSize, checkerSize, checkerSize, checkerSize);
  const checkerTex = new THREE.CanvasTexture(checkerCanvas);
  checkerTex.wrapS = checkerTex.wrapT = THREE.RepeatWrapping;
  checkerTex.repeat.set(80, 80);

  /** 近接時用：市松を粗く・明るめの色で（地面用とは別キャンバス） */
  const proximityCheckerCanvas = document.createElement('canvas');
  proximityCheckerCanvas.width = checkerSize * 2;
  proximityCheckerCanvas.height = checkerSize * 2;
  const ctxProx = proximityCheckerCanvas.getContext('2d');
  ctxProx.fillStyle = '#9ca4b4';
  ctxProx.fillRect(0, 0, checkerSize * 2, checkerSize * 2);
  ctxProx.fillStyle = '#b4bcc8';
  ctxProx.fillRect(0, 0, checkerSize, checkerSize);
  ctxProx.fillRect(checkerSize, checkerSize, checkerSize, checkerSize);
  const checkerTexProximity = new THREE.CanvasTexture(proximityCheckerCanvas);
  checkerTexProximity.wrapS = checkerTexProximity.wrapT = THREE.RepeatWrapping;
  checkerTexProximity.repeat.set(4, 4);

  const groundGeo = new THREE.PlaneGeometry(2000, 2000);
  /** 床＝川・海想定。青系の水面風（市松テクスチャは使わない） */
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x1e40af,
    metalness: 0.1,
    roughness: 0.3
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const cityRoot = new THREE.Group();
  scene.add(cityRoot);

  return { scene, camera, renderer, ground, checkerTex, checkerTexProximity, cityRoot };
}
