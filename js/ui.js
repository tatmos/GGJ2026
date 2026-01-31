export function updateLoadProgress(percent) {
  const pct = Math.min(100, Math.max(0, percent));
  const fill = document.getElementById('loadingProgressFill');
  const text = document.getElementById('loadingProgressPct');
  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = Math.round(pct) + '%';
}

export function hideLoading() {
  updateLoadProgress(100);
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.add('hidden');
}

export function updateEnergyBar(energy) {
  const el = document.getElementById('energyBar');
  if (!el) return;
  el.style.width = Math.max(0, energy) + '%';
  el.classList.remove('low', 'critical');
  if (energy < 25) el.classList.add('critical');
  else if (energy < 50) el.classList.add('low');
}

export function updateDirectionMeter(yaw) {
  const needle = document.getElementById('directionNeedle');
  if (!needle) return;
  const deg = -yaw * (180 / Math.PI);
  needle.style.transform = `rotate(${deg}deg)`;
}

const maxSpeed = 18 * 1.6;

export function updateSpeedMeter(speedMultiplier) {
  const speed = 18 * speedMultiplier;
  const el = document.getElementById('speedValue');
  const gauge = document.getElementById('speedGauge');
  if (el) el.textContent = Math.round(speed);
  if (gauge) gauge.style.width = Math.min(100, (speed / maxSpeed) * 100) + '%';
}

export function updateAltitudeMeter(camera, minHeight, maxHeight) {
  const alt = camera.position.y;
  const el = document.getElementById('altValue');
  const gauge = document.getElementById('altGauge');
  if (el) el.textContent = Math.round(alt);
  if (gauge) {
    const pct = Math.min(100, ((alt - minHeight) / (maxHeight - minHeight)) * 100);
    gauge.style.width = Math.max(0, pct) + '%';
  }
}

export function updatePosMeter(camera) {
  const elX = document.getElementById('posX');
  const elY = document.getElementById('posY');
  const elZ = document.getElementById('posZ');
  if (elX) elX.textContent = Math.round(camera.position.x);
  if (elY) elY.textContent = Math.round(camera.position.y);
  if (elZ) elZ.textContent = Math.round(camera.position.z);
}
