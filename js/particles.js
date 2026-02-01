/**
 * パーティクルシステム
 * 
 * 各種エフェクト用のパーティクルを管理
 */

import * as THREE from 'three';

/** アクティブなパーティクルシステム */
const activeParticles = [];

/**
 * パーティクルシステムを更新（毎フレーム呼び出し）
 */
export function updateParticles(dt, scene) {
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const ps = activeParticles[i];
    ps.age += dt;
    
    if (ps.age >= ps.lifetime) {
      // 寿命切れ、削除
      scene.remove(ps.object);
      ps.object.geometry.dispose();
      ps.object.material.dispose();
      activeParticles.splice(i, 1);
      continue;
    }
    
    // パーティクルの更新
    ps.update(dt, ps);
  }
}

/**
 * スプライトパーティクルを生成
 */
function createSpriteParticles(count, color, size = 0.3) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const lifetimes = new Float32Array(count);
  
  for (let i = 0; i < count; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    
    // ランダムな速度
    velocities[i * 3] = (Math.random() - 0.5) * 4;
    velocities[i * 3 + 1] = Math.random() * 3 + 1;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 4;
    
    lifetimes[i] = 0;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.userData = { velocities, lifetimes };
  
  const material = new THREE.PointsMaterial({
    color: color,
    size: size,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  
  return new THREE.Points(geometry, material);
}

/**
 * アイテム取得エフェクト
 */
export function spawnItemPickupEffect(scene, x, y, z, color = 0xffff00) {
  const count = 12;
  const particles = createSpriteParticles(count, color, 0.25);
  particles.position.set(x, y, z);
  scene.add(particles);
  
  const ps = {
    object: particles,
    age: 0,
    lifetime: 0.6,
    update: (dt, self) => {
      const positions = self.object.geometry.attributes.position.array;
      const velocities = self.object.geometry.userData.velocities;
      const progress = self.age / self.lifetime;
      
      for (let i = 0; i < count; i++) {
        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        
        // 重力
        velocities[i * 3 + 1] -= dt * 5;
      }
      
      self.object.geometry.attributes.position.needsUpdate = true;
      self.object.material.opacity = 1 - progress;
    }
  };
  
  activeParticles.push(ps);
}

/**
 * 攻撃ヒットエフェクト
 */
export function spawnAttackHitEffect(scene, x, y, z) {
  const count = 8;
  const particles = createSpriteParticles(count, 0xff4400, 0.3);
  particles.position.set(x, y, z);
  scene.add(particles);
  
  // 放射状に広がる
  const velocities = particles.geometry.userData.velocities;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    velocities[i * 3] = Math.cos(angle) * 3;
    velocities[i * 3 + 1] = 1 + Math.random();
    velocities[i * 3 + 2] = Math.sin(angle) * 3;
  }
  
  const ps = {
    object: particles,
    age: 0,
    lifetime: 0.4,
    update: (dt, self) => {
      const positions = self.object.geometry.attributes.position.array;
      const vels = self.object.geometry.userData.velocities;
      const progress = self.age / self.lifetime;
      
      for (let i = 0; i < count; i++) {
        positions[i * 3] += vels[i * 3] * dt;
        positions[i * 3 + 1] += vels[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vels[i * 3 + 2] * dt;
      }
      
      self.object.geometry.attributes.position.needsUpdate = true;
      self.object.material.opacity = 1 - progress;
      self.object.material.size = 0.3 * (1 - progress * 0.5);
    }
  };
  
  activeParticles.push(ps);
}

/**
 * 敵撃破エフェクト（爆発）
 */
export function spawnEnemyDefeatEffect(scene, x, y, z, color = 0xff4444) {
  const count = 20;
  const particles = createSpriteParticles(count, color, 0.4);
  particles.position.set(x, y, z);
  scene.add(particles);
  
  // 球状に広がる
  const velocities = particles.geometry.userData.velocities;
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 3 + Math.random() * 3;
    
    velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
    velocities[i * 3 + 1] = Math.cos(phi) * speed;
    velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
  }
  
  const ps = {
    object: particles,
    age: 0,
    lifetime: 0.8,
    update: (dt, self) => {
      const positions = self.object.geometry.attributes.position.array;
      const vels = self.object.geometry.userData.velocities;
      const progress = self.age / self.lifetime;
      
      for (let i = 0; i < count; i++) {
        positions[i * 3] += vels[i * 3] * dt;
        positions[i * 3 + 1] += vels[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vels[i * 3 + 2] * dt;
        
        // 減速
        vels[i * 3] *= 0.98;
        vels[i * 3 + 1] *= 0.98;
        vels[i * 3 + 2] *= 0.98;
      }
      
      self.object.geometry.attributes.position.needsUpdate = true;
      self.object.material.opacity = 1 - progress;
    }
  };
  
  activeParticles.push(ps);
}

/**
 * マスク取得エフェクト（キラキラ）
 */
export function spawnMaskPickupEffect(scene, x, y, z, color) {
  const count = 15;
  const particles = createSpriteParticles(count, color, 0.35);
  particles.position.set(x, y, z);
  scene.add(particles);
  
  // 上向きにスパイラル
  const velocities = particles.geometry.userData.velocities;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 4;
    velocities[i * 3] = Math.cos(angle) * 2;
    velocities[i * 3 + 1] = 3 + Math.random() * 2;
    velocities[i * 3 + 2] = Math.sin(angle) * 2;
  }
  
  const ps = {
    object: particles,
    age: 0,
    lifetime: 0.7,
    update: (dt, self) => {
      const positions = self.object.geometry.attributes.position.array;
      const vels = self.object.geometry.userData.velocities;
      const progress = self.age / self.lifetime;
      
      for (let i = 0; i < count; i++) {
        positions[i * 3] += vels[i * 3] * dt;
        positions[i * 3 + 1] += vels[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vels[i * 3 + 2] * dt;
        
        // スパイラル回転
        const angle = dt * 5;
        const vx = vels[i * 3];
        const vz = vels[i * 3 + 2];
        vels[i * 3] = vx * Math.cos(angle) - vz * Math.sin(angle);
        vels[i * 3 + 2] = vx * Math.sin(angle) + vz * Math.cos(angle);
      }
      
      self.object.geometry.attributes.position.needsUpdate = true;
      self.object.material.opacity = 1 - progress * progress;
    }
  };
  
  activeParticles.push(ps);
}

/**
 * 被ダメージエフェクト（赤いフラッシュ）
 */
export function spawnDamageEffect(scene, x, y, z) {
  const count = 6;
  const particles = createSpriteParticles(count, 0xff0000, 0.5);
  particles.position.set(x, y, z);
  scene.add(particles);
  
  const velocities = particles.geometry.userData.velocities;
  for (let i = 0; i < count; i++) {
    velocities[i * 3] = (Math.random() - 0.5) * 2;
    velocities[i * 3 + 1] = -1 - Math.random();
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;
  }
  
  const ps = {
    object: particles,
    age: 0,
    lifetime: 0.3,
    update: (dt, self) => {
      const positions = self.object.geometry.attributes.position.array;
      const vels = self.object.geometry.userData.velocities;
      const progress = self.age / self.lifetime;
      
      for (let i = 0; i < count; i++) {
        positions[i * 3] += vels[i * 3] * dt;
        positions[i * 3 + 1] += vels[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vels[i * 3 + 2] * dt;
      }
      
      self.object.geometry.attributes.position.needsUpdate = true;
      self.object.material.opacity = 1 - progress;
    }
  };
  
  activeParticles.push(ps);
}

/**
 * 成長完了エフェクト（レベルアップ風）
 */
export function spawnLevelUpEffect(scene, x, y, z) {
  const count = 25;
  const particles = createSpriteParticles(count, 0x88ffff, 0.3);
  particles.position.set(x, y, z);
  scene.add(particles);
  
  // リング状に上昇
  const velocities = particles.geometry.userData.velocities;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 2;
    velocities[i * 3] = Math.cos(angle) * radius;
    velocities[i * 3 + 1] = 4 + Math.random();
    velocities[i * 3 + 2] = Math.sin(angle) * radius;
  }
  
  const ps = {
    object: particles,
    age: 0,
    lifetime: 1.0,
    update: (dt, self) => {
      const positions = self.object.geometry.attributes.position.array;
      const vels = self.object.geometry.userData.velocities;
      const progress = self.age / self.lifetime;
      
      for (let i = 0; i < count; i++) {
        positions[i * 3] += vels[i * 3] * dt * (1 - progress);
        positions[i * 3 + 1] += vels[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vels[i * 3 + 2] * dt * (1 - progress);
        
        // 収束
        vels[i * 3] *= 0.95;
        vels[i * 3 + 2] *= 0.95;
      }
      
      self.object.geometry.attributes.position.needsUpdate = true;
      self.object.material.opacity = 1 - progress;
      self.object.material.size = 0.3 + progress * 0.2;
    }
  };
  
  activeParticles.push(ps);
}

/**
 * 装備取得エフェクト
 */
export function spawnEquipmentPickupEffect(scene, x, y, z, color) {
  const count = 10;
  const particles = createSpriteParticles(count, color, 0.3);
  particles.position.set(x, y, z);
  scene.add(particles);
  
  // 上向きに広がる
  const velocities = particles.geometry.userData.velocities;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    velocities[i * 3] = Math.cos(angle) * 1.5;
    velocities[i * 3 + 1] = 2 + Math.random() * 2;
    velocities[i * 3 + 2] = Math.sin(angle) * 1.5;
  }
  
  const ps = {
    object: particles,
    age: 0,
    lifetime: 0.5,
    update: (dt, self) => {
      const positions = self.object.geometry.attributes.position.array;
      const vels = self.object.geometry.userData.velocities;
      const progress = self.age / self.lifetime;
      
      for (let i = 0; i < count; i++) {
        positions[i * 3] += vels[i * 3] * dt;
        positions[i * 3 + 1] += vels[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vels[i * 3 + 2] * dt;
      }
      
      self.object.geometry.attributes.position.needsUpdate = true;
      self.object.material.opacity = 1 - progress;
    }
  };
  
  activeParticles.push(ps);
}
