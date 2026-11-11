---
name: jogos-h5-integration
description: Integrate the Jogos SDK into vanilla H5 / Canvas / Phaser / Construct / GDevelop games (anything that is neither Unity nor Cocos). Use when the task involves loading jogos-sdk-v1.js from index.html, adding platform ads / cloud save / banners to an HTML5 game, or debugging H5 loading and pause behavior. Cocos uses jogos-cocos-integration; three.js uses jogos-threejs-integration.
---

# Integrate Jogos SDK into H5 games

Read `jogos-sdk-core` first (lifecycle, ad semantics, save rules). This file only covers H5 specifics.

## Recommended: use the shared bridge

`shared/jogos-bridge.js` already handles: dynamic SDK loading, singleton init, lifecycle,
blur/focus pause, ad in-flight lock and throttling, banner containers, localStorage saves and
`?mock=1` offline mode.

```html
<script src="shared/jogos-bridge.js"></script>
<script src="./game.js"></script>
```

```js
// game.js
(async () => {
  const info = await JogosBridge.boot({ debug: true, savePrefix: 'mygame.' });
  if (!info) return;                    // boot already falls back to mock

  await loadMyAssets();                 // your own assets
  await JogosBridge.loadingEnd();       // after the game is truly playable

  JogosBridge.showBanner(document.getElementById('banner-slot'));
  startGame();
})();
```

Freeze game logic with `JogosBridge.isPaused` (the bridge sets it on blur and during ads):

```js
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
  if (!JogosBridge.isPaused) update(dt);
  render();
}
```

If your engine has its own clock (`scene.pause()` in Phaser, pause events in Construct), hook it with callbacks:

```js
JogosBridge.onPause(() => game.pause());
JogosBridge.onResume(() => game.resume());
```

Some browsers **do not dispatch `window.blur` when switching tabs**, so blur/focus alone is not enough:
also listen to `document.visibilitychange` (pause on hidden, resume on visible).
`shared/jogos-bridge.js` already includes this fallback.

## Manual integration without the bridge

You must implement init / pause-resume / ads yourself (loading reports are optional; if used, follow the recommended order):

```js
// 1. Load (inside body, before your game script)
// <script src="https://www.jogos.com/sdk/jogos-sdk-v1.js"></script>

// 2. Init singleton
let inited;
function ready() { return inited || (inited = window.JOGOS_SDK.init()); }

// 3. Recommended (not mandatory): loadingStart after init, loadingEnd when playable
await ready();
await JOGOS_SDK.game.loadingStart();
await loadAssets();
await JOGOS_SDK.game.loadingEnd();

// 4. Pause/resume (always paired)
let paused = false;
window.addEventListener('blur', () => {
  if (paused || !gameReady) return;
  paused = true; JOGOS_SDK.game.pause(); game.pause(); muteAll(); showPauseOverlay();
});
window.addEventListener('focus', () => {
  if (!paused) return;
  paused = false; JOGOS_SDK.game.continuePlay(); game.resume(); unmuteAll(); hidePauseOverlay();
});

// 5. Rewarded ad
function showRewarded() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (done) return; done = true; unmuteAll(); JOGOS_SDK.game.continuePlay(); resolve(ok); };
    muteAll(); JOGOS_SDK.game.pause();
    JOGOS_SDK.ad.requestAd('rewarded', {
      onfinished: () => finish(true),
      onerror: () => finish(false),
    });
  });
}
```

## Required in index.html

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; overscroll-behavior: none; }
  body { -webkit-user-select: none; user-select: none; }
  canvas { display: block; touch-action: none; }
</style>
```

```js
window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
```

## Saves

```js
JogosBridge.save('progress', { level: 3, coins: 120 });
const p = JogosBridge.load('progress', { level: 1, coins: 0 });
```

- Store only essential progress; keep a fixed, game-prefixed key.
- Do not build an upload queue; the SDK hooks `localStorage`.
- Call `JogosBridge.syncToCloud()` only for forced checkpoints (≤1 per minute).

## Banner

> Applies only to vanilla H5 / three.js / Phaser / Construct — **not Cocos, not Unity**.
> Cocos uses `JogosBannerUI` + `BannerUI.prefab`; Unity uses the `JogosBanner` prefab/component.

```html
<div id="banner-slot" style="width:300px;height:250px"></div>
```

```js
JogosBridge.showBanner(document.getElementById('banner-slot'));
// when leaving the screen / hiding it
JogosBridge.hideBanner();
```

- Allowed sizes: 728×90 / 300×250 / 320×50 / 468×60 / 320×100.
- A web-layer banner does not follow the canvas; **re-sync the position after resize / orientation change**.
  `JogosBridge.showBanner` recomputes from the container's `getBoundingClientRect` and applies a 60 s throttle.
- Desktop may use a sidebar; mobile usually hides it or switches to 320×50 to avoid covering controls.

## Self-check

```bash
python tools/serve.py                       # start the server
# open http://127.0.0.1:8080/examples/h5-canvas/
# offline / no CDN: .../examples/h5-canvas/?mock=1

python tools/jogos_test.py examples/h5-canvas --root .   # automated runtime gates
```

- [ ] `init` resolves and no localStorage access happens before it
- [ ] After reload, `loadingStart` / `loadingEnd` each appear once
- [ ] Switching tabs shows the overlay and freezes the game; switching back resumes
- [ ] Rewards are granted only after the rewarded ad finishes; cancel/failure grants nothing
- [ ] Repeated ad clicks do not stack dialogs
- [ ] The banner appears at the container position and covers no buttons
- [ ] Saves survive a reload
- [ ] Console has no `Uncaught`

## Reference implementations

- Playable example: `examples/h5-canvas/` (`index.html` + `game.js`)
- Bridge: `shared/jogos-bridge.js`
- Official minimal demo (API button page): see "Official HTML5 Demo" in `docs/quickstart.md`
