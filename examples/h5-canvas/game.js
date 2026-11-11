/**
 * Coin Rush — Jogos H5 接入示例。
 *
 * 刻意做小，只展示接入方真正要写的几段：
 *   boot -> loadingStart -> 加载资源 -> loadingEnd
 *   关卡结束 -> 提交排行榜 -> 插屏广告
 *   看广告复活 -> 只在 onfinished 发奖
 *   banner 用一个固定尺寸的 DOM 容器
 *
 * SDK 相关代码集中在 main / endRound / revive / banner 四处，其余都是游戏本身。
 */
(function () {
  'use strict';

  var B = window.JogosBridge;
  var $ = function (id) { return document.getElementById(id); };

  var canvas = $('game');
  var ctx = canvas.getContext('2d');
  var loadingEl = $('loading');
  var barEl = $('bar').firstElementChild;
  var tipEl = $('loading-tip');
  var overlayEl = $('overlay');
  var reviveBtn = $('btn-revive');
  var againBtn = $('btn-again');
  var coinsEl = $('coins');
  var adBtn = $('btn-ad');

  var W = canvas.width;
  var H = canvas.height;

  var ROUND_SECONDS = 30;
  var REVIVE_SECONDS = 15;

  var game = {
    running: false,
    score: 0,
    timeLeft: ROUND_SECONDS,
    coins: [],
    spawnTimer: 0,
    basketX: W / 2,
    basketW: 150,
    keys: { left: false, right: false },
    revived: false
  };

  var best = 0;
  var coins = 0;
  var adBusy = false;

  // ---------------------------------------------------------------- 启动

  async function main() {
    // 1. init + loadingStart（bridge 内部完成），任何其它 SDK 调用都在之后
    var info = await B.boot({ debug: true, savePrefix: 'coinrush.' });
    if (!info) {
      tipEl.textContent = 'SDK 初始化失败，请查看控制台';
      return;
    }

    // 2. 模拟资源加载
    await fakeLoad();

    // 3. 首包 + 可玩场景就绪，通知可玩
    await B.loadingEnd();

    best = B.load('best', 0) || 0;
    coins = B.load('coins', 0) || 0;
    coinsEl.textContent = coins;

    // banner：固定 320x50 容器，位置稳定，避免 resize 时错位
    B.showBanner($('banner-slot')).catch(function () {});

    loadingEl.classList.add('hide');
    setTimeout(function () { loadingEl.remove(); }, 350);

    bindInput();
    startRound();
    requestAnimationFrame(loop);
  }

  function fakeLoad() {
    return new Promise(function (resolve) {
      var p = 0;
      var timer = setInterval(function () {
        p = Math.min(1, p + 0.05 + Math.random() * 0.05);
        barEl.style.width = (p * 100).toFixed(1) + '%';
        tipEl.textContent = '加载中 ' + Math.round(p * 100) + '%';
        if (p >= 1) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  }

  // ---------------------------------------------------------------- 关卡

  function startRound() {
    game.running = true;
    game.revived = false;
    game.score = 0;
    game.timeLeft = ROUND_SECONDS;
    game.coins = [];
    game.spawnTimer = 0;
    overlayEl.classList.remove('show');
    reviveBtn.hidden = false;
    $('time').textContent = ROUND_SECONDS;
  }

  function endRound() {
    if (!game.running) return;
    game.running = false;
    game.timeLeft = 0;

    if (game.score > best) {
      best = game.score;
      B.save('best', best);
    }

    // 排行榜：榜单名与数据类型要和开发者后台一致
    B.commitRankingData('HighScore', { number: game.score }).catch(function () {});

    // 插屏只放在关卡结束
    B.showInterstitial();

    $('final').textContent = game.score;
    overlayEl.classList.add('show');
  }

  async function revive() {
    reviveBtn.disabled = true;
    try {
      var ok = await B.showRewarded();
      if (!ok) {
        reviveBtn.hidden = true;
        return;
      }
      game.revived = true;
      game.running = true;
      game.timeLeft = REVIVE_SECONDS;
      overlayEl.classList.remove('show');
      $('time').textContent = REVIVE_SECONDS;
    } finally {
      reviveBtn.disabled = false;
    }
  }

  // 右上角常驻：看一次激励视频换金币（只有 onfinished 才发奖）
  async function watchAd() {
    if (adBusy) return;
    adBusy = true;
    adBtn.disabled = true;
    try {
      var ok = await B.showRewarded();
      if (ok) addCoins(100);
    } catch (e) {
      // 已有广告在播 / 被频控，忽略即可
    } finally {
      adBusy = false;
      adBtn.disabled = false;
    }
  }

  function addCoins(n) {
    coins += n;
    coinsEl.textContent = coins;
    B.save('coins', coins);
  }

  // ---------------------------------------------------------------- 输入

  function bindInput() {
    function pointer(e) {
      var rect = canvas.getBoundingClientRect();
      var x = (e.clientX - rect.left) * (W / rect.width);
      game.basketX = Math.max(game.basketW / 2, Math.min(W - game.basketW / 2, x));
    }
    canvas.addEventListener('pointermove', function (e) {
      if (e.buttons || e.pointerType === 'touch') pointer(e);
    });
    canvas.addEventListener('pointerdown', pointer);

    window.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'a') game.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') game.keys.right = true;
    });
    window.addEventListener('keyup', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'a') game.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') game.keys.right = false;
    });

    reviveBtn.addEventListener('click', revive);
    againBtn.addEventListener('click', startRound);
    adBtn.addEventListener('click', watchAd);
  }

  // ---------------------------------------------------------------- 循环

  var lastTs = 0;

  function loop(ts) {
    requestAnimationFrame(loop);
    var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;

    // 暂停期间（失焦 / 广告）只渲染，不推进逻辑
    if (!B.isPaused && game.running) update(dt);
    draw();
  }

  function update(dt) {
    var speed = 620;
    if (game.keys.left) game.basketX -= speed * dt;
    if (game.keys.right) game.basketX += speed * dt;
    game.basketX = Math.max(game.basketW / 2, Math.min(W - game.basketW / 2, game.basketX));

    game.timeLeft -= dt;
    $('time').textContent = Math.max(0, Math.ceil(game.timeLeft));
    if (game.timeLeft <= 0) {
      endRound();
      return;
    }

    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      game.spawnTimer = 0.42;
      game.coins.push({
        x: 40 + Math.random() * (W - 80),
        y: -20,
        r: 13,
        vy: 170 + Math.random() * 150,
        spin: Math.random() * Math.PI
      });
    }

    var basketTop = H - 90;
    for (var i = game.coins.length - 1; i >= 0; i--) {
      var c = game.coins[i];
      c.y += c.vy * dt;
      c.spin += dt * 4;
      var inX = Math.abs(c.x - game.basketX) < game.basketW / 2 + c.r * 0.4;
      var inY = c.y + c.r > basketTop && c.y - c.r < basketTop + 54;
      if (inX && inY) {
        game.coins.splice(i, 1);
        game.score += 10;
        addCoins(10);
      } else if (c.y - c.r > H) {
        game.coins.splice(i, 1);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(120,170,255,.10)';
    ctx.lineWidth = 1;
    for (var x = 0; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (var y = 0; y < H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    for (var i = 0; i < game.coins.length; i++) {
      var c = game.coins[i];
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(Math.max(0.15, Math.abs(Math.cos(c.spin))), 1);
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd166';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#c98f1a';
      ctx.stroke();
      ctx.restore();
    }

    var bx = game.basketX - game.basketW / 2;
    var by = H - 90;
    var grad = ctx.createLinearGradient(0, by, 0, by + 54);
    grad.addColorStop(0, '#6ce0ff');
    grad.addColorStop(1, '#2b5cd8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, game.basketW, 54, 14);
    else ctx.rect(bx, by, game.basketW, 54);
    ctx.fill();
  }

  main().catch(function (e) {
    tipEl.textContent = '启动失败：' + e.message;
    console.error(e);
  });
})();
