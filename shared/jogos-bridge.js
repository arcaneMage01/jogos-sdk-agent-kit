/*!
 * jogos-bridge.js — engine-agnostic integration layer for the Jogos H5 SDK
 * ---------------------------------------------------------------------------
 * For vanilla H5 / Canvas / Phaser / Construct / three.js / PlayCanvas and any
 * other Web game that does not use the Unity or Cocos dedicated SDK.
 *
 * It covers the parts the official docs leave implicit but that always break in production:
 *   1. Dynamically loads jogos-sdk-v1.js (same-origin on Jogos domains, CDN elsewhere, multiple fallbacks)
 *   2. Singleton init + duplicate-call guard (calling anything before init throws 460)
 *   3. loadingStart / loadingEnd lifecycle
 *   4. blur/focus -> pause/continuePlay + pause overlay
 *   5. In-flight lock, throttling and pause/mute callbacks for rewarded/interstitial ads
 *   6. Banner container creation/refresh/cleanup (60s throttle, 2-banner limit)
 *   7. localStorage save helper (the SDK mirrors it automatically, no manual synchronizeToCloud)
 *   8. Mock mode for local development (?mock=1, or automatic fallback when the script fails to load)
 *
 * Usage:
 *   <script src="../shared/jogos-bridge.js"></script>
 *   const info = await JogosBridge.boot({ engine: null, debug: true });
 *   // ... load your assets ...
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
    engine: null,            // Unity passes 'Unity'; leave empty for Cocos/H5
    sdkUrl: '',              // Force an SDK URL (offline / intranet deployments)
    debug: false,
    autoPause: true,         // Auto pause/continuePlay on blur/focus
    pauseOverlay: true,      // Auto-render #jogos-pause-overlay
    pauseBeforeReady: false, // Report pause on blur during loading too (ignored by default)
    savePrefix: 'jogos.',    // Save key prefix; replace it with your game prefix
    mock: false,             // Force mock mode (offline local development)
    strict: false,           // true = throw when the SDK fails to load, no fallback
    interstitialGap: 60000,  // Local interstitial throttle (the platform throttles again)
    bannerGap: 60000         // Local banner refresh throttle
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
     * Boot: load SDK -> init -> loadingStart, and attach blur/focus listeners.
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
              warn('SDK failed to load, falling back to mock mode (local development only):', err && err.message);
              return null;
            });

        return chain.then(function (live) {
          sdk = live || createMock();
          mode = live ? 'live' : 'mock';
          if (!live) warn('Mock mode: ads/payment/save are simulated locally, never valid for production acceptance');
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

    /** Call when assets are loaded and the game is truly playable (not on first frame — that is too early) */
    loadingEnd: function () {
      if (loadingEnded) return Promise.resolve();
      loadingEnded = true;      
      resumeGame('loadingEnd');
      return callGame('loadingEnd');
    },

    /** Game-initiated pause (level end / menu open) */
    pause: function () { pauseGame('api'); },

    /** Game-initiated resume */
    resume: function () { resumeGame('api'); },

    onPause: function (fn) { if (typeof fn === 'function') listeners.pause.push(fn); },
    onResume: function (fn) { if (typeof fn === 'function') listeners.resume.push(fn); },

    /** Current time calibrated against the server clock */
    now: function () { return Date.now() + serverTimeOffset; },

    // ------------------------------------------------------------ ads

    /**
     * Rewarded video. Rewards only on onfinished; onerror / timeout resolve false.
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
        // Ads must pause and mute: pause first, and always resume on failure too
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
     * Interstitial. Only on level end / player death; 60s local throttle.
     * @returns {Promise<boolean>} true = finished, false = error / throttled
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
     * Request a banner inside the given container. The container needs an explicit size
     * (recommended: 300x250 / 320x50 / 728x90).
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

    /** Manual sync is only needed when saves do not use localStorage; platform limit is once per minute */
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

  // Some browsers do not dispatch window blur/focus when switching tabs, so visibilitychange is the fallback.
  // Note: listen on document, not window (window misses synthetic events that do not bubble).
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
