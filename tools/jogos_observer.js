/*!
 * jogos_observer.js — non-invasive runtime observer for the Jogos H5 SDK
 * ---------------------------------------------------------------------------
 * It records FACTS only; it never fakes, retries or re-orders a call.
 *
 * It must run BEFORE every other script on the page, because the checks depend
 * on hooking `window.JOGOS_SDK`, `Storage.prototype` and `IDBFactory.prototype`
 * before the game or the SDK touches them.
 *
 * Two ways to use it:
 *   1. Automated (recommended) — tools/jogos_test.py injects it with Playwright
 *      `addInitScript`, drives blur/focus/visibility loss and prints a report.
 *   2. Manual — put it FIRST inside <head> and add data-ui="1" for an on-screen badge:
 *      <script src="/tools/jogos_observer.js" data-ui="1"></script>
 *
 * What is observed:
 *   - JOGOS_SDK.init / game.loadingStart / game.loadingEnd / game.pause / game.continuePlay
 *   - localStorage.* and IndexedDB opens, with the timestamp relative to a successful init
 *   - the engine's own pause state, when it can be read from JS
 *
 * Optional contract for custom engines (not required for Cocos / Unity / Phaser):
 *   window.__JOGOS_GAME__ = { isPaused: false };   // flip it from your game loop
 */
(function (global) {
  'use strict';

  if (global.__JOGOS_OBSERVER__) return;

  var doc = global.document;
  var perf = global.performance;
  var T0 = perf && perf.now ? perf.now() : Date.now();
  var LIMIT = 600;

  var calls = [];    // observed SDK calls, in call order
  var storage = [];  // localStorage / IndexedDB accesses, in call order

  var flags = {
    sdkDetected: false,
    initCalled: false,
    initSettled: false,
    initOk: false,
    initError: null,
    systemInfoKeys: null
  };

  function now() {
    var t = perf && perf.now ? perf.now() : Date.now();
    return Math.round(t - T0);
  }

  function push(list, item) {
    if (list.length < LIMIT) list.push(item);
  }

  /**
   * Distinguish three sources:
   *   sdk    - the Jogos SDK caching its own state (allowed before init)
   *   engine - the engine boot process (Cocos writes its own 'storage' key, Unity mounts IDBFS)
   *   game   - business code, which must not touch saves before init resolves
   */
  function callerOrigin() {
    var s = '';
    try { s = String(new Error().stack || ''); } catch (e) { s = ''; }
    if (/jogos-sdk/i.test(s)) return 'sdk';
    if (/(cocos-js|cocos2d|engine\.js|unityloader|unity\.framework|\.wasm|emscripten|three\.module|three\.min|phaser\.min|pixi)/i.test(s)) {
      return 'engine';
    }
    return 'game';
  }

  // ------------------------------------------------------------- storage hooks

  function recordStorage(api, key) {
    var name = key === undefined || key === null ? null : String(key);
    push(storage, {
      at: now(),
      api: api,
      key: name,
      beforeInit: !flags.initOk,
      // Emscripten/Unity mount the whole IDBFS volume before the game calls init.
      idbfs: api.indexOf('indexedDB') === 0 && !!name && /^\/?idbfs/i.test(name),
      origin: callerOrigin()
    });
  }

  try {
    var SP = global.Storage && global.Storage.prototype;
    if (SP) {
      ['getItem', 'setItem', 'removeItem', 'clear', 'key'].forEach(function (method) {
        var orig = SP[method];
        if (typeof orig !== 'function') return;
        SP[method] = function () {
          var isLocal = false;
          try { isLocal = (this === global.localStorage); } catch (e) { isLocal = false; }
          if (isLocal) recordStorage('localStorage.' + method, arguments[0]);
          return orig.apply(this, arguments);
        };
      });
    }
  } catch (e) { /* hooks are best effort; a failure must never break the page */ }

  try {
    var IDBF = global.IDBFactory && global.IDBFactory.prototype;
    if (IDBF) {
      ['open', 'deleteDatabase'].forEach(function (method) {
        var orig = IDBF[method];
        if (typeof orig !== 'function') return;
        IDBF[method] = function (name) {
          recordStorage('indexedDB.' + method, name);
          return orig.apply(this, arguments);
        };
      });
    }
  } catch (e) { /* noop */ }

  // ---------------------------------------------------------------- SDK hooks

  function noteCall(name) {
    if (name === 'init') flags.initCalled = true;
    push(calls, { at: now(), name: name });
  }

  function settle(ok, err, value) {
    flags.initSettled = true;
    flags.initOk = !!ok;
    flags.initError = ok ? null : String((err && err.message) || err || 'unknown error');
    flags.systemInfoKeys = ok && value && typeof value === 'object'
      ? Object.keys(value).slice(0, 40)
      : null;
  }

  function wrap(owner, name, label, onSettled) {
    if (!owner) return;
    var orig = owner[name];
    if (typeof orig !== 'function' || orig.__jogosObserved) return;

    var wrapped = function () {
      noteCall(label);
      var out;
      try {
        out = orig.apply(this, arguments);
      } catch (err) {
        if (name === 'init') settle(false, err);
        throw err;
      }
      if (out && typeof out.then === 'function') {
        return out.then(function (value) {
          if (name === 'init') {
            settle(true, null, value);
            // Some SDK builds create `game` only after init; patch again from this microtask so
            // the very next loadingStart() / pause() call is already observed.
            if (onSettled) onSettled();
          }
          return value;
        }, function (err) {
          if (name === 'init') settle(false, err);
          throw err;
        });
      }
      if (name === 'init') {
        settle(true, null, out);
        if (onSettled) onSettled();
      }
      return out;
    };
    wrapped.__jogosObserved = true;
    try { owner[name] = wrapped; } catch (e) { /* frozen object: polling fallback still runs */ }
  }

  function patchSdk(api) {
    if (!api || typeof api !== 'object') return;
    flags.sdkDetected = true;
    wrap(api, 'init', 'init', function () { patchSdk(api); });
    trapGameProperty(api);
  }

  var GAME_METHODS = {
    loadingStart: 'game.loadingStart',
    loadingEnd: 'game.loadingEnd',
    pause: 'game.pause',
    continuePlay: 'game.continuePlay'
  };

  function isPatched(game) {
    if (!game) return false;
    for (var name in GAME_METHODS) {
      if (!Object.prototype.hasOwnProperty.call(GAME_METHODS, name)) continue;
      var fn = game[name];
      if (typeof fn !== 'function' || !fn.__jogosObserved) return false;
    }
    return true;
  }

  /** Wrap the game object in place. Some SDK builds freeze it, so this can be a no-op. */
  function patchGame(game) {
    if (!game || typeof game !== 'object') return;
    for (var name in GAME_METHODS) {
      if (Object.prototype.hasOwnProperty.call(GAME_METHODS, name)) {
        wrap(game, name, GAME_METHODS[name]);
      }
    }
  }

  var shadowCache = { raw: null, obj: null };

  /**
   * Some SDK builds define game methods as non-writable, non-configurable properties, which
   * makes both in-place patching and Proxy traps illegal. A shallow shadow object keeps every
   * property and method, but routes the four observed methods through a recorder.
   */
  function shadowGame(game) {
    if (shadowCache.raw === game) return shadowCache.obj;

    var proto = Object.getPrototypeOf(game);
    var obj = Object.create(proto && proto !== Object.prototype ? proto : null);

    Object.keys(game).forEach(function (key) {
      obj[key] = game[key];
    });

    for (var name in GAME_METHODS) {
      if (!Object.prototype.hasOwnProperty.call(GAME_METHODS, name)) continue;
      var orig = game[name];
      if (typeof orig !== 'function') continue;
      obj[name] = (function (method, label, fn) {
        return function () {
          noteCall(label);
          return fn.apply(game, arguments);
        };
      })(name, GAME_METHODS[name], orig);
    }

    shadowCache = { raw: game, obj: obj };
    return obj;
  }

  var trappedApi = null;

  /**
   * Many SDK builds attach `game` only after init resolves, and some freeze the game object.
   * Intercept the property so the first call after it appears is already observed.
   */
  function trapGameProperty(api) {
    if (trappedApi === api) return true;
    try {
      var desc = Object.getOwnPropertyDescriptor(api, 'game');
      if (desc && desc.configurable === false) return false;

      var stored = api.game;
      Object.defineProperty(api, 'game', {
        configurable: true,
        enumerable: true,
        get: function () {
          var raw = desc && typeof desc.get === 'function' ? desc.get.call(api) : stored;
          if (!raw) return raw;
          patchGame(raw);
          return isPatched(raw) ? raw : shadowGame(raw);
        },
        set: function (value) {
          stored = value;
          patchGame(value);
        }
      });

      trappedApi = api;
      patchGame(stored);
      return true;
    } catch (e) {
      return false;
    }
  }

  var existingSdk;
  try { existingSdk = global.JOGOS_SDK; } catch (e) { existingSdk = undefined; }

  try {
    Object.defineProperty(global, 'JOGOS_SDK', {
      configurable: true,
      enumerable: true,
      get: function () { return existingSdk; },
      set: function (value) {
        existingSdk = value;
        patchSdk(value);
        trapGameProperty(value);
      }
    });
    if (existingSdk) {
      patchSdk(existingSdk);
      trapGameProperty(existingSdk);
    }
  } catch (e) { /* locked global */ }

  // Fallback for builds that attach `game` lazily or lock the global as a non-configurable value.
  var poll = setInterval(function () {
    var api = global.JOGOS_SDK;
    if (!api || typeof api !== 'object') return;
    patchSdk(api);
    var game = api.game; // reading triggers the trap above
    if (game && (shadowCache.raw || isPatched(game))) clearInterval(poll);
  }, 50);
  setTimeout(function () { clearInterval(poll); }, 15000);

  // ------------------------------------------------------------ engine probing

  function probe() {
    var out = { engine: 'unknown', paused: null, source: '' };
    function set(engine, paused, source) {
      out.engine = engine;
      out.paused = paused;
      out.source = source;
      return out;
    }

    // 1) Explicit contract, recommended for custom engines and three.js
    try {
      var g = global.__JOGOS_GAME__;
      if (g && typeof g.isPaused === 'boolean') return set('custom', g.isPaused, '__JOGOS_GAME__.isPaused');
    } catch (e) { /* noop */ }

    // 2) The reference bridge from this repository
    try {
      if (global.JogosBridge && typeof global.JogosBridge.isPaused === 'boolean') {
        return set('jogos-bridge', global.JogosBridge.isPaused, 'JogosBridge.isPaused');
      }
    } catch (e) { /* noop */ }

    // 3) Cocos Creator 2.x / 3.x — game.pause() and director.pause() are independent signals
    try {
      var cc = global.cc;
      if (cc && (cc.director || cc.game)) {
        var directorPaused = null;
        if (cc.director) {
          var d = cc.director;
          directorPaused = typeof d.isPaused === 'function' ? d.isPaused() : d.isPaused;
        }
        var gamePaused = null;
        if (cc.game) {
          var g2 = cc.game;
          if (typeof g2.isPaused === 'function') gamePaused = !!g2.isPaused();
          else if (typeof g2.isPaused === 'boolean') gamePaused = g2.isPaused;
          else if (typeof g2._paused === 'boolean') gamePaused = g2._paused;
        }
        var paused = (directorPaused === true || gamePaused === true)
          ? true
          : (directorPaused === false || gamePaused === false ? false : null);
        return set('cocos', paused, gamePaused === null ? 'cc.director.isPaused' : 'cc.game / cc.director');
      }
    } catch (e) { /* noop */ }

    // 4) Phaser 3
    try {
      var pg = global.game;
      if (pg && pg.loop && typeof pg.loop.running === 'boolean') {
        return set('phaser', !pg.loop.running, 'game.loop.running');
      }
    } catch (e) { /* noop */ }

    // 5) Unity WebGL: Time.timeScale is not exposed to JS
    try {
      if (global.unityInstance || global.JogosUnityInstance || global.createUnityInstance) {
        return set('unity', null, 'Unity does not expose pause state to JS');
      }
    } catch (e) { /* noop */ }

    return out;
  }

  // -------------------------------------------------------------------- public

  var api = {
    version: '1.0.0',
    now: now,
    probe: probe,
    snapshot: function () {
      return {
        url: String((global.location && global.location.href) || ''),
        at: now(),
        flags: {
          sdkDetected: flags.sdkDetected,
          initCalled: flags.initCalled,
          initSettled: flags.initSettled,
          initOk: flags.initOk,
          initError: flags.initError,
          systemInfoKeys: flags.systemInfoKeys
        },
        calls: calls.slice(),
        storage: storage.slice(),
        engine: probe(),
        sdkShape: (function () {
          var api = global.JOGOS_SDK;
          if (!api || typeof api !== 'object') return null;
          var game = null;
          try { game = api.game; } catch (e) { game = null; }
          var mode = shadowCache.raw ? 'shadow' : (isPatched(game) ? 'patched' : 'none');
          return {
            keys: Object.keys(api).slice(0, 20),
            gameType: game ? typeof game : 'undefined',
            gameKeys: game ? Object.keys(game).slice(0, 20) : [],
            observeMode: mode
          };
        })()
      };
    }
  };

  global.__JOGOS_OBSERVER__ = api;

  // ------------------------------------------------------- optional dev badge

  function mountBadge() {
    function boot() {
      if (!doc.body) return;
      var el = doc.createElement('div');
      el.style.cssText = [
        'position:fixed', 'right:10px', 'bottom:10px', 'z-index:2147483647',
        'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
        'color:#dbe7ff', 'background:rgba(8,12,22,.92)',
        'border:1px solid rgba(120,170,255,.35)', 'border-radius:8px',
        'padding:6px 9px', 'pointer-events:none', 'white-space:pre', 'text-align:left'
      ].join(';');
      doc.body.appendChild(el);

      var timer = setInterval(function () {
        var s = api.snapshot();
        var f = s.flags;
        var bad = 0;
        for (var i = 0; i < s.storage.length; i++) {
          if (s.storage[i].beforeInit && s.storage[i].origin !== 'sdk' && !s.storage[i].idbfs) bad++;
        }
        var lines = [
          'Jogos observer',
          (f.initOk ? 'PASS' : f.initSettled ? 'FAIL' : 'WAIT') + '  init',
          (bad ? 'WARN' : 'PASS') + '  storage before init: ' + bad,
          'INFO  engine=' + s.engine.engine + ' paused=' + s.engine.paused
        ];
        el.textContent = lines.join('\n');
      }, 500);

      global.addEventListener('beforeunload', function () { clearInterval(timer); });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  var self = doc.currentScript;
  if (self && self.getAttribute && self.getAttribute('data-ui') === '1') mountBadge();
})(typeof window !== 'undefined' ? window : globalThis);
