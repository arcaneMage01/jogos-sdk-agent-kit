# Quickstart · Integrate the Jogos SDK in 30 minutes

Pick one of the paths below; the shared contract is identical. Read
[`../.agents/skills/jogos-sdk-core/SKILL.md`](../.agents/skills/jogos-sdk-core/SKILL.md) first.
The main flow (ads / banner / ranking / cloud save / IAP dedupe) is in [`main-flow.md`](main-flow.md).

---

## 0. Find your project type

| Your project | Follow |
|---|---|
| Vanilla JS / Canvas / Phaser / Construct / GDevelop | [A. H5](#a-h5-games) |
| three.js / PlayCanvas / Babylon.js | [B. three.js](#b-threejs--webgl-engines) |
| Cocos Creator 3.x / 2.x | [C. Cocos](#c-cocos-creator) |
| Unity | [D. Unity WebGL](#d-unity-webgl) |

---

## A. H5 games

### A1. Load the SDK

```html
<!-- Inside body, before your game script -->
<script src="https://www.jogos.com/sdk/jogos-sdk-v1.js"></script>
```

Or use the repo bridge (recommended: handles loading, pause, ads and saves):

```html
<script src="shared/jogos-bridge.js"></script>
```

### A2. Boot

```js
// Raw integration (loading reports are recommended, not mandatory)
const info = await window.JOGOS_SDK.init();
await window.JOGOS_SDK.game.loadingStart();   // recommended: after init
await loadAssets();
await window.JOGOS_SDK.game.loadingEnd();     // recommended: first bundle + first scene loaded
```

```js
// With the bridge
const info = await JogosBridge.boot({ debug: true, savePrefix: 'mygame.' });
await loadAssets();
await JogosBridge.loadingEnd();
```

### A3. Pause / resume

```js
JogosBridge.onPause(() => game.pause());
JogosBridge.onResume(() => game.resume());
// Or in your loop: if (!JogosBridge.isPaused) update(dt);
```

### A4. Ads

```js
const ok = await JogosBridge.showRewarded();   // grant only when true
await JogosBridge.showInterstitial();          // only on level end
```

### A5. Save + banner

```js
JogosBridge.save('progress', { level: 2 });
JogosBridge.showBanner(document.getElementById('banner-slot'));
```

Full runnable code: [`examples/h5-canvas/`](../examples/h5-canvas/).

---

## B. three.js / WebGL engines

Identical to A; only the render loop changes:

```js
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!JogosBridge.isPaused) update(dt);   // freeze the time step while paused
  renderer.render(scene, camera);
}
```

Notes:

- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`; do not force it to 1
- Short-circuit `pointerdown` during ads to avoid click-through
- `suspend()` the `AudioContext` during ads

Full example: [`examples/threejs-demo/`](../examples/threejs-demo/).

---

## C. Cocos Creator

1. Copy `examples/cocos-demo/assets/scripts/jogos/` into your project
2. First-scene script:

```ts
// boot() performs init + loadingStart internally
const ok = await JogosBridge.boot();
if (!ok) return;
await this.loadAssets();
await JogosBridge.loadingEnd();   // when the player can act
```

3. Ads: `await JogosBridge.showRewarded()` (true only on `onfinished`)
4. Banner: drop `BannerUI.prefab` into the scene and set its size
5. Build Web Mobile and upload the whole zip

Full project: [`examples/cocos-demo/`](../examples/cocos-demo/) (Cocos Creator 3.8.7).

---

## D. Unity WebGL

1. Open [`examples/unity-demo/`](../examples/unity-demo/) (Unity 2021.3) and press Play
2. Integration code lives in `Assets/Demo/IAA/Scripts/`:
   - `StartLoad.cs`: `JogosSDK.Init` → load the gameplay scene
   - `CoinRushGame.cs`: `LoadingEnd` once the game is playable + rewarded/interstitial/banner/ranking/PlayerPrefs save
3. Page-side loading report: add this line to **your own** `index.html`, before the Unity loader runs:

   ```html
   <script src="jogos-boot.js"></script>
   ```

   `jogos-boot.js` loads the SDK and calls `init` + `loadingStart` **before Unity boots**, so the reported
   loading time includes wasm/data download, wasm compile and engine boot. How you inject it is up to you:
   a custom Unity template, a preprocessor, or a post-build step.
   `examples/unity-demo/Assets/WebGLTemplates/Jogos/` is only a reference example; do not force integrators
   to replace their existing template with it.
4. Business project: also put `Init` in the first scene and **do not** handle focus-loss pause yourself (the SDK does it)
5. Banner uses the `JogosBanner` component / `Resources/JogosBanner.prefab`, never the H5 API
6. Multi-platform build: switch with `window.JOGOS_ENABLED = false` before the boot script, or append
   `?jogos=0` / `?platform=<other>` to the page URL. Disabled builds do not load the Jogos SDK and skip
   the Jogos focus-loss pause logic.

Details: [`examples/unity-demo/DEMO.md`](../examples/unity-demo/DEMO.md).

---

## E. Using the official HTML5_Demo

The official docs ship an API button page (`HTML5_Demo.zip`) that is useful for **verifying the APIs are reachable**,
but is not a good integration template: it only calls `init` and buttons, with no lifecycle or pause handling.

```bash
# Unzip, serve it over any HTTP server, and place sdk/jogos-sdk-v1.js in a sibling sdk/ directory
python tools/serve.py --root <unzipped-dir>
```

---

## F. Verification

```bash
python tools/verify_integration.py <build-dir>   # static scan
python tools/jogos_test.py <build-dir>           # runtime: init / storage order / pause
```

`jogos_test.py` injects an observer before every page script, drives blur/focus itself and exits
non-zero on FAIL. Run it against a build directory, or pass a URL with `--root` when the page loads
shared files from a parent directory.

Then walk through [`acceptance.md`](acceptance.md) manually.

---

## G. Deployment

- Developer console → Upload game → choose SDK version/orientation → QA preview
- Before submitting, make sure "how the game saves progress" selects **the Jogos SDK data module**
  (otherwise cloud save is disabled)
- Ads are intentionally disabled in the QA preview environment; this is expected
- Bundle limits: first bundle PC ≤50MB / mobile ≤25MB; total PC ≤500MB / mobile ≤250MB;
  file count ≤5000 / ≤3000
