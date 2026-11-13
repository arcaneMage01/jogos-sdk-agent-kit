/*!
 * Jogos page boot for Unity WebGL.
 *
 * Why this file exists:
 *   Unity does not run any C# code until the engine has downloaded the wasm/data
 *   bundle, compiled it and booted the first scene. Calling loadingStart from
 *   StartLoad.Start() therefore misses the largest part of the real loading time.
 *
 * This file is portable: copy it anywhere served with index.html and reference it from the
 * integrator's own template. The WebGLTemplates/Jogos folder is only a reference example.
 *
 * This script runs before the Unity loader and:
 *   1. decides whether Jogos is enabled (window switch / URL switch / host);
 *   2. loads jogos-sdk-v1.js early and calls init('Unity') in parallel with Unity;
 *   3. calls game.loadingStart() as soon as init resolves.
 *
 * loadingEnd is intentionally NOT reported here: only the game knows when it is
 * actually playable.
 *
 * Switch usage:
 *   window.JOGOS_ENABLED = false;   // set before this script (same page)
 *   ?jogos=0                        // force disable
 *   ?jogos=1                        // force enable on a non-Jogos host
 *   ?platform=crazygames            // any value other than "jogos" disables
 */
(function () {
  'use strict';

  function queryValue(name) {
    var match = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search || '');
    return match ? decodeURIComponent(match[1]) : null;
  }

  function isLocalHost() {
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  }

  function resolveEnabled() {
    // An explicit page-level switch always wins.
    if (typeof window.JOGOS_ENABLED === 'boolean') {
      return window.JOGOS_ENABLED;
    }

    var platform = queryValue('platform');
    if (platform) {
      return platform.toLowerCase() === 'jogos';
    }

    var jogosParam = queryValue('jogos');
    if (jogosParam !== null) {
      return jogosParam !== '0';
    }

    // Host-based default: Jogos domains and local development use the SDK,
    // other platforms stay disabled unless they opt in with ?jogos=1.
    return /\.jogos\w*\.com$/.test(window.location.host) || isLocalHost();
  }

  function sdkUrl() {
    var match = window.location.host.match(/\.jogos\w*\.com$/);
    return match
      ? window.location.protocol + '//www' + match[0] + '/sdk/jogos-sdk-v1.js'
      : 'https://sdk.jogosfans.com/jogos-sdk-v1.js';
  }

  function loadSdk() {
    if (window.JOGOS_SDK) {
      return Promise.resolve();
    }

    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('jogos-sdk-v1.js load timeout'));
      }, 15000);

      script.src = sdkUrl();
      script.async = true;
      script.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      script.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error('jogos-sdk-v1.js load failed'));
      };
      document.head.appendChild(script);
    });
  }

  window.JOGOS_ENABLED = resolveEnabled();
  if (!window.JOGOS_ENABLED) {
    console.log('[Jogos] disabled on this page (window.JOGOS_ENABLED / ?jogos=0 / ?platform=)');
    return;
  }

  function whenBodyReady() {
    if (document.body) {
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }

  // Start the platform handshake in parallel with the Unity loader.
  // Never await this before createUnityInstance: an SDK failure must not block the game.
  window.JOGOS_SDK_INIT_PROMISE = loadSdk()
    .then(whenBodyReady)
    .then(function () {
      return window.JOGOS_SDK.init('Unity');
    })
    .catch(function (err) {
      console.warn('[Jogos] init failed, continuing without the SDK:', err);
      return {};
    });

  // loadingStart now covers Unity's wasm/data download, wasm compile and engine boot.
  window.JOGOS_SDK_LOADING_START_PROMISE = window.JOGOS_SDK_INIT_PROMISE
    .then(function () {
      if (!window.JOGOS_SDK || !window.JOGOS_SDK.game) {
        return null;
      }
      // A late loadingEnd may have won the race; never report loadingStart twice.
      if (window.JOGOS_SDK_LOADING_STARTED) {
        return null;
      }
      window.JOGOS_SDK_LOADING_STARTED = true;
      return window.JOGOS_SDK.game.loadingStart();
    })
    .catch(function (err) {
      console.warn('[Jogos] loadingStart failed:', err);
    });
})();
