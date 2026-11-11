/**
 * Coin Orbit — three.js + Jogos SDK integration example.
 *
 * The integration is identical to the H5 example; only three engine-side details differ:
 *   1. Freeze the time step while paused (keep calling clock.getDelta every frame to avoid a jump on resume)
 *   2. pointerdown must short-circuit while paused or during ads, otherwise it leaks into the Raycaster
 *   3. Banner uses a fixed-size, fixed-position container so resize cannot misalign it
 */
import * as THREE from 'three';

const B = window.JogosBridge;
const $ = (id) => document.getElementById(id);

const canvas = $('scene');
const loadingEl = $('loading');
const barEl = $('bar').firstElementChild;
const tipEl = $('loading-tip');
const overlayEl = $('overlay');
const reviveBtn = $('btn-revive');
const againBtn = $('btn-again');
const coinsEl = $('coins');
const adBtn = $('btn-ad');

const ROUND_SECONDS = 30;
const REVIVE_SECONDS = 15;
const COIN_VALUE = 25;
const AD_REWARD = 100;

const state = {
  running: false,
  score: 0,
  coins: 0,
  timeLeft: ROUND_SECONDS,
  revived: false
};

let adBusy = false;

// ------------------------------------------------------------------ three

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05070f, 12, 30);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
camera.position.set(0, 6.2, 9.5);
camera.lookAt(0, 1, 0);

scene.add(new THREE.HemisphereLight(0x8fb8ff, 0x101828, 1.1));
const dir = new THREE.DirectionalLight(0xffffff, 2.2);
dir.position.set(4, 9, 6);
scene.add(dir);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(9, 64),
  new THREE.MeshStandardMaterial({ color: 0x111a30, roughness: 0.85, metalness: 0.15 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const grid = new THREE.GridHelper(18, 18, 0x2a3d66, 0x182642);
grid.position.y = 0.01;
scene.add(grid);

const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 40);
const coinMat = new THREE.MeshStandardMaterial({
  color: 0xffc93c, metalness: 0.9, roughness: 0.25, emissive: 0x3a2500
});
const coins = [];

for (let i = 0; i < 9; i++) {
  const mesh = new THREE.Mesh(coinGeo, coinMat);
  const angle = (i / 9) * Math.PI * 2;
  const radius = 2.4 + (i % 3) * 1.15;
  mesh.position.set(Math.cos(angle) * radius, 1.1 + (i % 2) * 0.5, Math.sin(angle) * radius);
  mesh.rotation.z = Math.PI / 2;
  mesh.userData.baseY = mesh.position.y;
  mesh.userData.phase = Math.random() * Math.PI * 2;
  scene.add(mesh);
  coins.push(mesh);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function resize() {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ game

function startRound() {
  state.running = true;
  state.revived = false;
  state.score = 0;
  state.timeLeft = ROUND_SECONDS;
  for (const c of coins) c.visible = true;
  overlayEl.classList.remove('show');
  reviveBtn.hidden = false;
  $('time').textContent = ROUND_SECONDS;
}

function addCoins(n) {
  state.coins += n;
  coinsEl.textContent = state.coins;
  B.save('coins', state.coins);
}

function endRound() {
  if (!state.running) return;
  state.running = false;
  state.timeLeft = 0;

  // Ranking: leaderboard name and data type must match the developer console
  B.commitRankingData('HighScore', { number: state.score }).catch(() => {});

  // Interstitial only on round end
  B.showInterstitial();

  $('final').textContent = state.score;
  overlayEl.classList.add('show');
}

async function revive() {
  reviveBtn.disabled = true;
  try {
    const ok = await B.showRewarded();
    if (!ok) {
      reviveBtn.hidden = true;
      return;
    }
    state.revived = true;
    state.running = true;
    state.timeLeft = REVIVE_SECONDS;
    overlayEl.classList.remove('show');
    $('time').textContent = REVIVE_SECONDS;
  } finally {
    reviveBtn.disabled = false;
  }
}

canvas.addEventListener('pointerdown', (e) => {
  // Must short-circuit while paused / during ads, otherwise clicks leak into the coins
  if (!state.running || B.isPaused) return;

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(coins.filter((c) => c.visible), false);
  if (!hits.length) return;

  const coin = hits[0].object;
  coin.visible = false;
  state.score += COIN_VALUE;
  addCoins(COIN_VALUE);
  setTimeout(() => {
    if (state.running) coin.visible = true;
  }, 2000);
});

async function watchAd() {
  if (adBusy) return;
  adBusy = true;
  adBtn.disabled = true;
  try {
    // Grant only on onfinished
    const ok = await B.showRewarded();
    if (ok) addCoins(AD_REWARD);
  } catch (e) {
    // Another ad is playing or the request is throttled; ignore it
  } finally {
    adBusy = false;
    adBtn.disabled = false;
  }
}

reviveBtn.addEventListener('click', revive);
againBtn.addEventListener('click', startRound);
adBtn.addEventListener('click', watchAd);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  // Call getDelta every frame; while paused do not advance logic so resume does not jump
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!B.isPaused && state.running) {
    state.timeLeft -= dt;
    $('time').textContent = Math.max(0, Math.ceil(state.timeLeft));
    if (state.timeLeft <= 0) endRound();
  }

  const t = performance.now() / 1000;
  // Freeze the visual animation while paused too, otherwise it looks like "not paused"
  if (!B.isPaused) {
    for (const c of coins) {
      c.rotation.y += dt * 2.4;
      c.position.y = c.userData.baseY + Math.sin(t * 1.8 + c.userData.phase) * 0.18;
    }
  }
  renderer.render(scene, camera);
}

// ------------------------------------------------------------------ boot

async function main() {
  resize();

  const info = await B.boot({ debug: true, savePrefix: 'coinorbit.' });
  if (!info) {
    tipEl.textContent = 'SDK init failed, check the console';
    return;
  }

  state.coins = B.load('coins', 0) || 0;
  coinsEl.textContent = state.coins;

  // Simulate asset warm-up (replace with real GLTF / texture progress)
  let p = 0;
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      p = Math.min(1, p + 0.08 + Math.random() * 0.06);
      barEl.style.width = (p * 100).toFixed(1) + '%';
      tipEl.textContent = `Loading scene ${Math.round(p * 100)}%`;
      if (p >= 1) {
        clearInterval(timer);
        resolve();
      }
    }, 50);
  });

  renderer.render(scene, camera);
  await B.loadingEnd();

  B.showBanner($('banner-slot')).catch(() => {});

  loadingEl.classList.add('hide');
  setTimeout(() => loadingEl.remove(), 350);

  startRound();
  animate();
}

main().catch((e) => {
  tipEl.textContent = `Startup failed: ${e.message}`;
  console.error(e);
});
