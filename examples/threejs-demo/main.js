/**
 * Coin Orbit — three.js + Jogos SDK 接入示例。
 *
 * 关键点（和 H5 示例完全一致，换引擎不改协议）：
 *   boot() 必须在任何 SDK 调用前 await 完成
 *   loadingEnd() 在首帧可交互后调用
 *   广告期间暂停/静音：本示例用 B.isPaused 冻结时间步进
 *   关卡结束才请求插屏，激励广告只在 onfinished 发奖
 *   banner 用固定尺寸的 DOM 容器，不遮挡 3D 画面操作区
 */
import * as THREE from 'three';

const B = window.JogosBridge;
const $ = (id) => document.getElementById(id);

const canvas = $('scene');
const loadingEl = $('loading');
const barEl = $('bar').firstElementChild;
const tipEl = $('loading-tip');
const logEl = $('log');

const state = {
  running: false,
  score: 0,
  timeLeft: 40,
  round: 0
};

function log() {
  const msg = Array.prototype.join.call(arguments, ' ');
  console.log('[three-demo]', msg);
  if (!logEl) return;
  logEl.textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + logEl.textContent;
  if (logEl.textContent.length > 6000) logEl.textContent = logEl.textContent.slice(0, 6000);
}

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

// ------------------------------------------------------------------ 游戏

function startRound() {
  state.round += 1;
  state.running = true;
  state.score = 0;
  state.timeLeft = 40;
  for (const c of coins) c.visible = true;
  $('score').textContent = '0';
  $('time').textContent = '40';
  log(`round ${state.round} start`);
}

function endRound() {
  if (!state.running) return;
  state.running = false;
  state.timeLeft = 0;
  B.commitRankingData('HighScore', { number: state.score }).catch((e) => log(`ranking failed: ${e.message}`));
  B.commitAchievement('coin_collector', Math.min(state.score, 100), false).catch(() => {});
  // 插屏只允许在关卡结束这类时机播放
  B.showInterstitial().then((played) => log(`interstitial played=${played}`));
}

canvas.addEventListener('pointerdown', (e) => {
  if (!state.running || B.isPaused) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(coins.filter((c) => c.visible), false);
  if (hits.length) {
    const coin = hits[0].object;
    coin.visible = false;
    state.score += 25;
    $('score').textContent = state.score;
    // 2 秒后复活，保持场上始终有金币
    setTimeout(() => {
      if (state.running) coin.visible = true;
    }, 2000);
  }
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // 暂停（宿主失焦 / 广告播放）时不推进游戏时间，但照常渲染
  if (!B.isPaused && state.running) {
    state.timeLeft -= dt;
    $('time').textContent = Math.max(0, Math.ceil(state.timeLeft));
    if (state.timeLeft <= 0) endRound();
  }

  const t = performance.now() / 1000;
  for (const c of coins) {
    c.rotation.y += dt * 2.4;
    c.position.y = c.userData.baseY + Math.sin(t * 1.8 + c.userData.phase) * 0.18;
  }
  grid.position.y = 0.01;
  renderer.render(scene, camera);
}

// ------------------------------------------------------------------ 启动

async function main() {
  resize();

  const info = await B.boot({ debug: true, savePrefix: 'coinorbit.' });
  if (!info) {
    tipEl.textContent = 'SDK 初始化失败（见控制台）';
    return;
  }
  $('mode-chip').textContent = 'MODE ' + (B.mode === 'live' ? 'LIVE' : 'MOCK');
  log(`init ok gameId=${info.gameId} lang=${info.language} device=${info.deviceType}`);

  // 模拟资源预热（真实项目里换成 GLTF/贴图加载进度）
  let p = 0;
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      p = Math.min(1, p + 0.08 + Math.random() * 0.06);
      barEl.style.width = (p * 100).toFixed(1) + '%';
      tipEl.textContent = `加载场景 ${Math.round(p * 100)}%`;
      if (p >= 1) {
        clearInterval(timer);
        resolve();
      }
    }, 60);
  });

  // 首帧渲染完成 -> 才算“可玩”
  renderer.render(scene, camera);
  await B.loadingEnd();
  log('loadingEnd');

  loadingEl.classList.add('hide');
  setTimeout(() => loadingEl.remove(), 400);

  startRound();
  animate();
}

// ------------------------------------------------------------------ 按钮

$('btn-again').addEventListener('click', () => {
  if (state.running) return;
  startRound();
});

$('btn-reward').addEventListener('click', async function () {
  this.disabled = true;
  try {
    const ok = await B.showRewarded();
    if (ok) {
      state.score += 40;
      $('score').textContent = state.score;
      log('rewarded ok, +40');
    } else {
      log('rewarded failed / no-fill');
    }
  } finally {
    this.disabled = false;
  }
});

$('btn-banner').addEventListener('click', () => {
  B.showBanner($('banner-slot')).then((id) => log(`banner id=${id}`));
});

$('btn-banner-clear').addEventListener('click', () => {
  B.hideBanner().then(() => log('banner cleared'));
});

$('btn-ranking').addEventListener('click', () => {
  B.openRankingDialog('HighScore').catch((e) => log(`ranking error: ${e.message}`));
});

$('btn-achievement').addEventListener('click', () => {
  B.commitAchievement('coin_collector', 1, false)
    .then(() => B.openAchievements())
    .then(() => log('achievements opened'))
    .catch((e) => log(`achievement error: ${e.message}`));
});

main().catch((e) => {
  tipEl.textContent = `启动失败：${e.message}`;
  console.error(e);
});
