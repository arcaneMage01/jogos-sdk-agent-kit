/**
 * Coin Rush — 原生 Canvas 的 Jogos H5 接入示例。
 *
 * 这个文件只关心“游戏怎么接 SDK”，游戏本身刻意做得很小：
 *   boot -> loadingStart -> 加载资源 -> loadingEnd -> 游戏中
 *   关卡结束 -> commitRankingData -> 插屏广告（自动频控）
 *   激励广告 -> 只在 onfinished 时发奖
 *   banner 用 DOM 容器，位置与游戏 UI 不重叠
 *
 * 你可以把它当成接入骨架直接改。
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
  var logEl = $('log');

  var W = canvas.width;
  var H = canvas.height;

  var game = {
    running: false,
    over: false,
    score: 0,
    timeLeft: 45,
    coins: [],
    spawnTimer: 0,
    basketX: W / 2,
    basketW: 150,
    keys: { left: false, right: false },
    round: 0
  };

  var best = 0;

  function log() {
    var msg = Array.prototype.join.call(arguments, ' ');
    console.log('[demo]', msg);
    if (!logEl) return;
    var time = new Date().toLocaleTimeString();
    logEl.textContent = '[' + time + '] ' + msg + '\n' + logEl.textContent;
    if (logEl.textContent.length > 6000) logEl.textContent = logEl.textContent.slice(0, 6000);
  }

  function setProgress(p) {
    barEl.style.width = Math.max(0, Math.min(100, p * 100)).toFixed(1) + '%';
  }

  // ------------------------------------------------------------ 启动

  async function main() {
    // 1) 加载 SDK + init + loadingStart。任何其它 SDK 调用都必须在这之后。
    var info = await B.boot({ debug: true, savePrefix: 'coinrush.' });

    if (!info) {
      tipEl.textContent = 'SDK 初始化失败（看控制台）';
      return;
    }

    $('mode-chip').textContent = 'MODE ' + (B.mode === 'live' ? 'LIVE' : 'MOCK');
    log('init ok:', JSON.stringify({
      gameId: info.gameId,
      deviceType: info.deviceType,
      language: info.language,
      serverTime: info.serverTime,
      bannerIntervalTime: info.bannerIntervalTime
    }));

    // 2) 加载你自己的资源（这里用假的进度）
    await fakeLoad();

    // 3) 真正可玩后再 loadingEnd
    await B.loadingEnd();
    log('loadingEnd');

    best = B.load('best', 0) || 0;
    $('best').textContent = best;

    loadingEl.classList.add('hide');
    setTimeout(function () { loadingEl.remove(); }, 400);

    bindInput();
    startRound();
    requestAnimationFrame(loop);
  }

  function fakeLoad() {
    return new Promise(function (resolve) {
      var p = 0;
      var timer = setInterval(function () {
        p = Math.min(1, p + 0.04 + Math.random() * 0.05);
        setProgress(p);
        tipEl.textContent = '加载资源 ' + Math.round(p * 100) + '%';
        if (p >= 1) {
          clearInterval(timer);
          resolve();
        }
      }, 60);
    });
  }

  // ------------------------------------------------------------ 关卡

  function startRound() {
    game.round += 1;
    game.running = true;
    game.over = false;
    game.score = 0;
    game.timeLeft = 45;
    game.coins = [];
    game.spawnTimer = 0;
    $('score').textContent = '0';
    $('time').textContent = '45';
    log('round ' + game.round + ' start');
  }

  function endRound() {
    if (!game.running) return;
    game.running = false;
    game.over = true;
    game.timeLeft = 0;
    var score = game.score;

    if (score > best) {
      best = score;
      B.save('best', best);
      $('best').textContent = best;
      B.commitAchievement('first_record', 1, false).catch(function () {});
    }

    // 排行榜名与数据类型必须和开发者后台配置一致；示例后台配置为 HighScore + number。
    B.commitRankingData('HighScore', { number: score }).catch(function (e) {
      log('commitRankingData failed: ' + (e && e.message ? e.message : e));
    });

    // 插屏只放在关卡结束，不要放在关卡开始或按钮点击上。
    B.showInterstitial().then(function (played) {
      log('interstitial played=' + played);
      draw();
    });
  }

  // ------------------------------------------------------------ 输入

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
      if (e.key === ' ') {
        e.preventDefault();
        if (game.over) startRound();
      }
    });
    window.addEventListener('keyup', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'a') game.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') game.keys.right = false;
    });
  }

  // ------------------------------------------------------------ 循环

  var lastTs = 0;

  function loop(ts) {
    requestAnimationFrame(loop);
    var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;

    // 暂停期间（JogosBridge 收到 blur / 广告）不推进游戏逻辑，只保留画面
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
        $('score').textContent = game.score;
      } else if (c.y - c.r > H) {
        game.coins.splice(i, 1);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(120,170,255,.12)';
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
      var sx = Math.cos(c.spin);
      ctx.scale(Math.max(0.15, Math.abs(sx)), 1);
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

    if (game.over) {
      ctx.fillStyle = 'rgba(6,10,20,.72)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '700 40px system-ui, sans-serif';
      ctx.fillText('Round Over', W / 2, H / 2 - 26);
      ctx.font = '600 22px system-ui, sans-serif';
      ctx.fillStyle = '#9fc0ff';
      ctx.fillText('得分 ' + game.score + ' · 点击画面或按空格再来一局', W / 2, H / 2 + 22);
    }
  }

  canvas.addEventListener('click', function () {
    if (game.over) startRound();
  });

  // ------------------------------------------------------------ 按钮

  $('btn-reward').addEventListener('click', async function () {
    var btn = this;
    btn.disabled = true;
    try {
      var ok = await B.showRewarded();
      if (ok) {
        game.timeLeft += 10;
        log('rewarded ok, +10s');
      } else {
        log('rewarded failed / no-fill');
      }
    } catch (e) {
      log('rewarded error: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  });

  $('btn-interstitial').addEventListener('click', async function () {
    var played = await B.showInterstitial();
    log('manual interstitial played=' + played + (played ? '' : '（60s 内只会播一次）'));
  });

  $('btn-banner').addEventListener('click', function () {
    B.showBanner($('banner-slot')).then(function (id) { log('banner id=' + id); });
  });

  $('btn-banner-clear').addEventListener('click', function () {
    B.hideBanner().then(function () { log('banner cleared'); });
  });

  $('btn-ranking').addEventListener('click', function () {
    B.openRankingDialog('HighScore').catch(function (e) { log('ranking error: ' + e.message); });
  });

  $('btn-achievement').addEventListener('click', function () {
    B.commitAchievement('first_record', 1, false)
      .then(function () { return B.openAchievements(); })
      .then(function () { log('achievements opened'); })
      .catch(function (e) { log('achievement error: ' + e.message); });
  });

  $('btn-cloud').addEventListener('click', function () {
    B.syncToCloud().then(function () { log('synchronizeToCloud ok'); })
      .catch(function (e) { log('sync error: ' + e.message); });
  });

  $('btn-user').addEventListener('click', function () {
    B.getUser().then(function (u) { log('user: ' + JSON.stringify(u)); })
      .catch(function (e) { log('user error: ' + e.message); });
  });

  main().catch(function (e) {
    tipEl.textContent = '启动失败：' + e.message;
    console.error(e);
  });
})();
