/*!
 * jogos-bridge.js — 与引擎无关的 Jogos H5 SDK 接入层
 * ---------------------------------------------------------------------------
 * 适用：原生 H5 / Canvas / Phaser / Construct / three.js / PlayCanvas 等所有
 *       非 Unity、非 Cocos 专属 SDK 的 Web 游戏。
 *
 * 它替你处理了官方文档里没写清楚、但线上一定会踩的部分：
 *   1. 动态加载 jogos-sdk-v1.js（Jogos 域名走同源，本地走 CDN，多候选兜底）
 *   2. init 单例 + 重复调用保护（未 init 调任何接口会抛 460）
 *   3. loadingStart / loadingEnd 生命周期
 *   4. blur/focus -> pause/continuePlay + 暂停遮罩
 *   5. 激励/插屏广告的 in-flight 锁、频控、暂停与静音回调
 *   6. banner 容器创建/刷新/清理（含 60s 频控与 2 个上限）
 *   7. localStorage 存档封装（SDK 会自动镜像，无需手动 synchronizeToCloud）
 *   8. 联调用 mock 模式（?mock=1 或 script 加载失败时自动降级）
 *
 * 用法：
 *   <script src="../shared/jogos-bridge.js"></script>
 *   const info = await JogosBridge.boot({ engine: null, debug: true });
 *   // ... 加载你的资源 ...
 *   await JogosBridge.loadingEnd();
 *   await JogosBridge.showRewarded();            // -> boolean
 *   await JogosBridge.showInterstitial();
 *   await JogosBridge.showBanner(document.getElementById('banner-slot'));
 */
(function (global, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(global);
  else global.JogosBridge = factory(global);
})(typeof window !== 'undefined' ? window : globalThis, function (global) {
  'use strict';

  var VERSION = '1.0.0';

  var DEFAULT_SDK_CANDIDATES = [
    'https://sdk.jogosfans.com/jogos-sdk-v1.js',
    'https://www.jogos.com/sdk/jogos-sdk-v1.js'
  ];

  var cfg = {
    engine: null,            // Unity 传 'Unity'；Cocos/H5 留空即可
    sdkUrl: '',              // 手动指定 SDK 地址（离线内网部署时用）
    debug: false,
    autoPause: true,         // blur/focus 自动 pause/continuePlay
    pauseOverlay: true,      // 自动绘制 #jogos-pause-overlay
    pauseBeforeReady: false, // loading 期间的 blur 是否也上报 pause（默认忽略）
    savePrefix: 'jogos.',    // 存档 key 前缀，建议换成你自己的游戏前缀
    mock: false,             // 强制 mock（本地无网络联调）
    strict: false,           // true = SDK 加载失败直接抛错，不做降级
    interstitialGap: 60000,  // 本地插屏频控（平台侧还会再拦一次）
    bannerGap: 60000         // 本地 banner 刷新频控
  };

  var sdk = null;
  var systemInfo = null;
  var mode = 'idle';          // idle | live | mock
  var bootPromise = null;
  var loadingEnded = false;
  var hostPaused = false;
  var pausedByBridge = false;
  var pauseReason = '';
  var serverTimeOffset = 0;
  var adInFlight = null;
  var lastInterstitialAt = 0;
  var banners = {};           // id -> { el, lastAt }
  var listeners = { pause: [], resume: [] };
  var mockAds = [];

  // ---------------------------------------------------------------- utils

  function log() {
    if (!cfg.debug || typeof console === 'undefined') return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[JogosBridge]');
    console.log.apply(console, args);
  }

  function warn() {
    if (typeof console === 'undefined') return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[JogosBridge]');
    console.warn.apply(console, args);
  }

  function isJogosHost() {
    try {
      return /\.jogos\w*\.com$/.test(global.location.host);
    } catch (e) {
      return false;
    }
  }

  function sdkUrls() {
    if (cfg.sdkUrl) return [cfg.sdkUrl];
    var urls = [];
    if (isJogosHost()) {
      var m = global.location.host.match(/\.jogos\w*\.com$/);
      urls.push(global.location.protocol + '//www' + m[0] + '/sdk/jogos-sdk-v1.js');
    }
    for (var i = 0; i < DEFAULT_SDK_CANDIDATES.length; i++) {
      if (urls.indexOf(DEFAULT_SDK_CANDIDATES[i]) === -1) urls.push(DEFAULT_SDK_CANDIDATES[i]);
    }
    return urls;
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = global.document.createElement('script');
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('timeout: ' + url));
      }, 15000);
      s.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 't=' + Math.floor(Date.now() / 7200000);
      s.async = true;
      s.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      s.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error('load failed: ' + url));
      };
      global.document.head.appendChild(s);
    });
  }

  function loadSdk() {
    if (global.JOGOS_SDK) return Promise.resolve(global.JOGOS_SDK);
    var urls = sdkUrls();
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.reject(new Error('all jogos-sdk urls failed'));
      var url = urls[i++];
      log('loading sdk:', url);
      return loadScript(url).then(function () {
        if (!global.JOGOS_SDK) throw new Error('JOGOS_SDK missing after load: ' + url);
        return global.JOGOS_SDK;
      }).catch(function (err) {
        warn('sdk candidate failed:', url, err && err.message);
        return next();
      });
    }
    return next();
  }

  function emit(name) {
    var list = listeners[name] || [];
    for (var i = 0; i < list.length; i++) {
      try { list[i](); } catch (e) { warn('listener error', name, e); }
    }
  }

  // ------------------------------------------------------------ pause UI

  function ensureOverlay() {
    if (!cfg.pauseOverlay || !global.document || !global.document.body) return null;
    var el = global.document.getElementById('jogos-pause-overlay');
    if (el) return el;
    el = global.document.createElement('div');
    el.id = 'jogos-pause-overlay';
    el.style.cssText = [
      'position:fixed', 'inset:0', 'width:100%', 'height:100%',
      'background:rgba(0,0,0,.7)', 'display:none',
      'align-items:center', 'justify-content:center',
      'z-index:9999', 'cursor:pointer', 'user-select:none',
      'font:700 32px/1.2 system-ui,-apple-system,Segoe UI,sans-serif', 'color:#fff'
    ].join(';');
    el.textContent = 'pause...';
    el.addEventListener('click', function () {
      try { global.focus(); } catch (e) { /* ignore */ }
    });
    global.document.body.appendChild(el);
    return el;
  }

  function showOverlay() {
    var el = ensureOverlay();
    if (el) el.style.display = 'flex';
  }

  function hideOverlay() {
    if (!global.document) return;
    var el = global.document.getElementById('jogos-pause-overlay');
    if (el) el.style.display = 'none';
  }

  // --------------------------------------------------------- game states

  function callGame(method) {
    if (!sdk || !sdk.game || typeof sdk.game[method] !== 'function') return Promise.resolve();
    try {
      var ret = sdk.game[method]();
      return ret && typeof ret.then === 'function' ? ret.catch(function (e) {
        warn('game.' + method + ' failed', e);
      }) : Promise.resolve();
    } catch (e) {
      warn('game.' + method + ' threw', e);
      return Promise.resolve();
    }
  }

  function pauseGame(reason) {
    if (!loadingEnded && !cfg.pauseBeforeReady) return;
    if (hostPaused) return;
    hostPaused = true;
    pausedByBridge = true;
    pauseReason = reason || '';
    showOverlay();
    emit('pause');
    callGame('pause');
    log('paused', reason || '');
  }

  function resumeGame(reason) {
    if (!hostPaused) return;
    hostPaused = false;
    pausedByBridge = false;
    pauseReason = '';
    hideOverlay();
    emit('resume');
    callGame('continuePlay');
    log('resumed', reason || '');
  }

  // ------------------------------------------------------------- mock sdk

  function createMock() {
    function ok(v) { return Promise.resolve(v); }
    var mockInfo = {
      gameId: -1,
      hasGameGroup: false,
      deviceType: 'desktop',
      language: (global.navigator && global.navigator.language) || 'en',
      os: 'mock',
      browser: 'mock',
      serverTime: Date.now(),
      bannerIntervalTime: 60,
      midgameIntervalTime: 120,
      gamePrice: 0,
      deviceId: 'mock-device',
      invateArgs: null,
      isRealEnv: false
    };
    return {
      init: function () { return ok(mockInfo); },
      game: {
        loadingStart: function () { console.log('loadingStart'); return ok(); },
        loadingEnd: function () { console.log('loadingEnd'); return ok(); },
        pause: function () { return ok(); },
        continuePlay: function () { return ok(); },
        happytime: function () { return ok(); },
        synchronizeToCloud: function () { return ok(); },
        commitRankingData: function () { return ok(); },
        openRankingDialog: function () { return ok(); },
        commitAchievementsData: function () { return ok(); },
        openAchievementsDialog: function () { return ok(); },
        exchangePrizes: function () { return ok('mock-cdkey-id'); },
        share: function () { return ok(); },
        isMyFriends: function (ids) {
          var map = {};
          (ids || []).forEach(function (id) { map[id] = false; });
          return ok(map);
        },
        sendFriendRequest: function () { return ok(false); },
        openChatDialog: function () { return ok(false); },
        openInviteDialog: function () { return ok(); }
      },
      ad: {
        requestAd: function (type, cb) {
          cb = cb || {};
          mockAds.push(type);
          setTimeout(function () {
            if (cb.onstarted) cb.onstarted();
            setTimeout(function () { if (cb.onfinished) cb.onfinished(); }, 900);
          }, 50);
        },
        getRewardAdCount: function () { return ok(50); },
        hasAdblock: function () { return ok(false); }
      },
      banner: {
        requestBanner: function (id, style) {
          var host = global.document && global.document.getElementById(id);
          if (host) {
            host.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;'
              + 'justify-content:center;background:rgba(255,255,255,.08);border:1px dashed #6cc;'
              + 'color:#6cc;font:600 12px/1 system-ui;box-sizing:border-box">JOGOS BANNER (mock)</div>';
          }
          return ok();
        },
        clearBanner: function (id) {
          var host = global.document && global.document.getElementById(id);
          if (host) host.innerHTML = '';
          return ok();
        },
        clearAllBanners: function () {
          var nodes = global.document ? global.document.querySelectorAll('[data-jogos-banner]') : [];
          for (var i = 0; i < nodes.length; i++) nodes[i].innerHTML = '';
          return ok();
        }
      },
      user: {
        getUser: function () {
          return ok({ userId: 'mock-user', username: 'MockPlayer', profilePictureUrl: '', gameId: -1, isuser: false });
        },
        getUserToken: function () { return ok('mock-token'); },
        getPublicKey: function () { return ok(''); }
      },
      payment: {
        buyOut: function () { return ok('mock-order'); },
        buyGoods: function () { return ok('mock-order'); },
        getOrderDetail: function () { return ok({ orderNo: 'mock-order', status: 'success' }); },
        getOrderList: function () { return ok([]); },
        deliverGoods: function () { return ok(); },
        subscribeOrderPaid: function () { return ok(); }
      },
      gameItem: {
        openBuyGameItemsDialog: function () { return ok([]); },
        getUserGameItems: function () { return ok([]); },
        addGameItem: function () { return ok([]); },
        subtractGameItem: function () { return ok([]); },
        subscribeGameItemChange: function () { return ok(); }
      }
    };
  }

  // ------------------------------------------------------------- public

  var JogosBridge = {
    version: VERSION,

    get mode() { return mode; },
    get ready() { return !!systemInfo; },
    get systemInfo() { return systemInfo; },
    get sdk() { return sdk; },
    get isPaused() { return hostPaused; },
    config: cfg,

    /**
     * 启动：加载 SDK -> init -> loadingStart，并挂上 blur/focus。
     * @returns {Promise<Object|null>} systemInfo
     */
    boot: function (options) {
      if (bootPromise) return bootPromise;
      if (options) {
        for (var k in options) {
          if (Object.prototype.hasOwnProperty.call(options, k)) cfg[k] = options[k];
        }
      }
      if (cfg.debug && global.location) {
        var qs = global.location.search || '';
        if (/[?&]mock=1/.test(qs)) cfg.mock = true;
        if (/[?&]debug=1/.test(qs)) cfg.debug = true;
      }

      bootPromise = (function () {
        var chain = cfg.mock
          ? Promise.resolve(null)
          : loadSdk().catch(function (err) {
              if (cfg.strict) throw err;
              warn('SDK 加载失败，进入 mock 降级模式（仅本地联调可用）:', err && err.message);
              return null;
            });

        return chain.then(function (live) {
          sdk = live || createMock();
          mode = live ? 'live' : 'mock';
          if (!live) warn('当前为 mock 模式：广告/支付/存档都是本地模拟，不可用于线上验收');
          if (cfg.debug && mode === 'mock') {
            var b = global.document && global.document.body;
            if (b) {
              var tip = global.document.createElement('div');
              tip.textContent = 'JOGOS MOCK MODE';
              tip.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:10000;padding:4px 8px;'
                + 'background:#c30;color:#fff;font:700 11px/1.4 system-ui;border-radius:4px;pointer-events:none';
              b.appendChild(tip);
            }
          }
          var initPromise;
          try {
            initPromise = cfg.engine ? sdk.init(cfg.engine) : sdk.init();
          } catch (e) {
            return Promise.reject(e);
          }
          return initPromise.then(function (info) {
            systemInfo = info || {};
            serverTimeOffset = systemInfo.serverTime ? systemInfo.serverTime - Date.now() : 0;
            if (cfg.autoPause) {
              global.addEventListener('blur', function () { pauseGame('window:blur'); });
              global.addEventListener('focus', function () { resumeGame('window:focus'); });
            }
            return callGame('loadingStart').then(function () { return systemInfo; });
          });
        });
      })();

      return bootPromise;
    },

    /** 资源加载完成、真正可玩时调用（不要用“首帧渲染”这种偏早信号） */
    loadingEnd: function () {
      if (loadingEnded) return Promise.resolve();
      loadingEnded = true;      
      resumeGame('loadingEnd');
      return callGame('loadingEnd');
    },

    /** 游戏主动暂停（关卡结束/打开菜单） */
    pause: function () { pauseGame('api'); },

    /** 游戏主动恢复 */
    resume: function () { resumeGame('api'); },

    onPause: function (fn) { if (typeof fn === 'function') listeners.pause.push(fn); },
    onResume: function (fn) { if (typeof fn === 'function') listeners.resume.push(fn); },

    /** 服务器校准后的当前时间 */
    now: function () { return Date.now() + serverTimeOffset; },

    // ------------------------------------------------------------ ads

    /**
     * 激励视频。只在 onfinished 时发奖；onerror / 超时都返回 false。
     * @returns {Promise<boolean>}
     */
    showRewarded: function () {
      if (!sdk) return Promise.reject(new Error('call boot() first'));
      if (adInFlight) return Promise.reject(new Error('another ad is in flight'));
      return new Promise(function (resolve) {
        var settled = false;
        var timer = null;
        function finish(ok) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          adInFlight = null;
          resumeGame('ad:end');
          resolve(ok);
        }
        adInFlight = 'rewarded';
        // 广告期间必须静音/暂停：这里先暂停，失败也会 resume
        pauseGame('ad:rewarded');
        timer = setTimeout(function () { finish(false); }, 120000);
        var callbacks = {
          onstarted: function () { log('rewarded started'); },
          onfinished: function () { log('rewarded finished'); finish(true); },
          onerror: function (err) { warn('rewarded error', err); finish(false); }
        };
        try {
          sdk.ad.requestAd('rewarded', callbacks);
        } catch (e) {
          warn('rewarded threw', e);
          finish(false);
        }
      });
    },

    /**
     * 插屏。仅在关卡结束/玩家死亡等时机调用；本地 60s 频控。
     * @returns {Promise<boolean>} true = 播放结束，false = 出错/被频控
     */
    showInterstitial: function () {
      if (!sdk) return Promise.reject(new Error('call boot() first'));
      var now = Date.now();
      if (now - lastInterstitialAt < cfg.interstitialGap) {
        log('interstitial skipped by local gap');
        return Promise.resolve(false);
      }
      if (adInFlight) {
        log('interstitial skipped, ad in flight');
        return Promise.resolve(false);
      }
      return new Promise(function (resolve) {
        var settled = false;
        var timer = null;
        function finish(ok) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          adInFlight = null;
          lastInterstitialAt = Date.now();
          resumeGame('ad:end');
          resolve(ok);
        }
        adInFlight = 'midgame';
        pauseGame('ad:midgame');
        timer = setTimeout(function () { finish(false); }, 120000);
        try {
          sdk.ad.requestAd('midgame', {
            onstarted: function () { log('interstitial started'); },
            onfinished: function () { log('interstitial finished'); finish(true); },
            onerror: function (err) { log('interstitial no-fill/error', err); finish(false); }
          });
        } catch (e) {
          finish(false);
        }
      });
    },

    getRewardAdCount: function () { return sdk ? sdk.ad.getRewardAdCount() : Promise.resolve(0); },
    hasAdblock: function () { return sdk ? sdk.ad.hasAdblock() : Promise.resolve(false); },

    // ---------------------------------------------------------- banner

    /**
     * 在指定容器里请求 banner。容器必须有明确宽高（推荐 300x250 / 320x50 / 728x90）。
     * @param {HTMLElement|string} target
     * @param {Object} [options] { id, style, force }
     * @returns {Promise<string|null>} banner id
     */
    showBanner: function (target, options) {
      if (!sdk) return Promise.reject(new Error('call boot() first'));
      var el = typeof target === 'string' ? global.document.getElementById(target) : target;
      if (!el) {
        warn('showBanner: container not found');
        return Promise.resolve(null);
      }
      if (!el.id) el.id = 'jogos-banner-' + Math.random().toString(36).slice(2, 8);
      el.setAttribute('data-jogos-banner', '1');
      var id = (options && options.id) || el.id;
      var prev = banners[id];
      var now = Date.now();
      var isRefresh = !!(prev && prev.el === el);
      if (!isRefresh && !(options && options.force) && now - (prev ? prev.lastAt : 0) < cfg.bannerGap) {
        log('showBanner skipped by local gap');
        return Promise.resolve(id);
      }
      var count = 0;
      for (var k in banners) if (banners[k] && banners[k].el && banners[k].el !== el) count++;
      if (!isRefresh && count >= 2) {
        warn('showBanner: at most 2 banners can be displayed at the same time');
        return Promise.resolve(null);
      }
      banners[id] = { el: el, lastAt: now };
      if (isRefresh && options && options.style) {
        for (var s in options.style) el.style[s] = options.style[s];
      }
      var style = (options && options.style) || (function () {
        var r = el.getBoundingClientRect();
        return {
          width: (r.width || el.offsetWidth || 300) + 'px',
          height: (r.height || el.offsetHeight || 250) + 'px',
          left: r.left + 'px',
          top: r.top + 'px'
        };
      })();
      var p = sdk.banner.requestBanner(id, style);
      return p.then(function () { return id; }).catch(function (e) {
        warn('banner request failed', e);
        return null;
      });
    },

    hideBanner: function (id) {
      if (!sdk) return Promise.resolve();
      if (id) {
        delete banners[id];
        return sdk.banner.clearBanner(id).catch(function (e) { warn('clearBanner failed', e); });
      }
      banners = {};
      return sdk.banner.clearAllBanners().catch(function (e) { warn('clearAllBanners failed', e); });
    },

    // ------------------------------------------------------------ save

    save: function (key, value) {
      try {
        global.localStorage.setItem(cfg.savePrefix + key, JSON.stringify(value));
        return true;
      } catch (e) {
        warn('save failed', e);
        return false;
      }
    },

    load: function (key, fallback) {
      try {
        var raw = global.localStorage.getItem(cfg.savePrefix + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        warn('load failed', e);
        return fallback;
      }
    },

    /** 仅在存档不走 localStorage 时才需要手动同步；平台限 1 次/分钟 */
    syncToCloud: function () { return callGame('synchronizeToCloud'); },

    // ---------------------------------------------------------- social

    getUser: function () { return sdk ? sdk.user.getUser() : Promise.reject(new Error('boot first')); },
    getUserToken: function () { return sdk ? sdk.user.getUserToken() : Promise.reject(new Error('boot first')); },
    commitRankingData: function (name, data) { return sdk ? sdk.game.commitRankingData(name, data) : Promise.resolve(); },
    openRankingDialog: function (name) { return sdk ? sdk.game.openRankingDialog(name) : Promise.resolve(); },
    commitAchievement: function (name, progress, hidden) {
      return sdk ? sdk.game.commitAchievementsData(name, progress, !!hidden) : Promise.resolve();
    },
    openAchievements: function () { return sdk ? sdk.game.openAchievementsDialog() : Promise.resolve(); },
    happytime: function () { return sdk ? sdk.game.happytime() : Promise.resolve(); },
    share: function (data) { return sdk ? sdk.game.share(data) : Promise.resolve(); }
  };

  // 标签页切换时部分浏览器不派发 window blur/focus，只能靠 visibilitychange 兜底
  // 注意：监听 document，不要监听 window（合成事件不冒泡时 window 收不到）
  global.document.addEventListener('visibilitychange', function () {
    if (!loadingEnded) return;
    if (global.document.visibilityState === 'hidden') {
      pauseGame('visibility:hidden');
    } else if (hostPaused && (pauseReason === 'visibility:hidden' || pauseReason === 'window:blur')) {
      resumeGame('visibility:visible');
    }
  });

  return JogosBridge;
});
