---
name: jogos-cocos-integration
description: Integrate the Jogos SDK into Cocos Creator 2.x / 3.x games. Use when adding platform ads, cloud save, banner nodes, the pause overlay, or working with JogosSDK.ts / jogos-sdk.esm.ts / JogosBridge.ts, or when building web-mobile for upload. For vanilla H5 use jogos-h5-integration.
---

# Cocos Creator integration

Cocos uses the platform-provided TypeScript wrapper. **Do not** write raw `JOGOS_SDK.init` calls.
Read `jogos-sdk-core` first for the shared contract.

## 1. Copy the wrapper

Copy these files from `examples/cocos-demo/assets/scripts/jogos/` into your project's `assets/scripts/jogos/`:

| File | Purpose |
|---|---|
| `jogos-sdk.esm.ts` | Loads `jogos-sdk-v1.js` dynamically + full type definitions (with CDN fallback) |
| `JogosSDK.ts` | Singleton wrapper: init dedupe, loading, pause/resume, pause overlay, banner node math, toast |
| `JogosBridge.ts` | Thin facade: boot / loadingEnd / rewarded / interstitial / banner / ranking / save (same shape as the H5 bridge) |
| `view/JogosBannerUI.ts` | Banner component attached to a node |
| `PreOrderMgr.ts` | Order subscription / reconciliation / delivery |
| `OrderMgr.ts` | Order management (only a .meta exists in this project; add it if needed) |

Banner prefab: `examples/cocos-demo/assets/resources/prefab/BannerUI.prefab`.

## 2. Wire the first scene

```ts
import { JogosBridge } from './jogos/JogosBridge';

async onLoad() {
  const ok = await JogosBridge.boot();   // init + loadingStart, must be first
  if (!ok) return;                       // null while in-flight, false when init fails

  // ... load first bundle + first scene ...

  await JogosBridge.loadingEnd();        // recommended (not mandatory): once playable
  // enter the main menu / start the game
}
```

The `init` order is a hard requirement; loading reports are recommended and never required.
If you call `loadingEnd`, do not put it in `start()`; call it when the loading screen is gone and
the player can act.

## 3. Ads

Prefer `JogosBridge` (callbacks are wrapped into a promise that resolves true only on `onfinished`):

```ts
const ok = await JogosBridge.showRewarded();
if (ok) { /* grant reward */ }

JogosBridge.showInterstitial();   // only on level end / death / load
```

Calling `JogosSDK.requestAd` directly is also fine:

```ts
JogosSDK.requestAd('rewarded', {
  onstarted: () => {},
  onfinished: () => { /* grant only here */ },
  onerror: (err) => { /* no reward */ },
});
```

The wrapper already handles:

- `onstarted` → `onBlur()` (pause + overlay)
- `onfinished` → `onFocus()` (resume)
- `onerror` → resume + toast (`error` may be a string or `{code,message}`)

So **do not** call `pause/continuePlay` again in game code, otherwise you pause twice.

Interstitial only on level end / death; requesting again within 60 s makes the platform return 500.

## 4. Banner

> **Never** call the H5 `banner.requestBanner` inside Cocos. A web-layer ad does not follow the
> Cocos canvas, so the engine must re-sync position whenever the resolution changes — the component
> already does this.

1. Drag `BannerUI.prefab` into the scene, place it where it covers no controls, and set its size.
2. The component waits for init in `onEnable`, then calls `requestBannerWithNode(node)`.
3. Window resize automatically calls `refreshBanner(true)`.
4. `onDisable` automatically calls `clearBanner`.

Notes:

- **Once `JogosBannerUI` is attached, do not call `requestBannerWithNode` manually.** Two requests
  within 60 s raise `Each requestBanner call must ≤ 60 seconds.`
- Position math uses `node.getBoundingBoxToWorld()` + `canvas.getBoundingClientRect()` and
  **already multiplies DPR — do not multiply again**.
- The 60 s local throttle only exists in release builds; no throttle in dev builds is expected.
- On a `developer.jogos*` hostname the node's placeholder image is shown to help with positioning.

## 5. Engine-side notes

- `JogosSDK.onBlur()` calls `cc.game.pause()`; it is skipped in `CC_DEV` so debugging is not frozen.
- **Blur before `loadingEnd` is ignored**, so a lost focus during loading cannot freeze the whole game
  after `cc.game.pause()`.
- The pause overlay is appended to the first existing container among
  `GameDiv / Cocos3dGameContainer / Cocos2dGameContainer / layaContainer / egret-player`,
  falling back to the canvas parent; the container is temporarily set to `position: relative`.
- Cocos 2.x: `jogos-sdk.esm.ts` and `JogosSDK.ts` APIs work the same, but the `_uiProps` branch in
  `requestBannerWithNode` is 3.x-only; 2.x uses `getBoundingBoxToWorld`.
- Never call `cc.game.pause()` in `onLoad` to emulate pause; the platform only recognizes `JogosSDK.pause()`.

## 6. Build and upload

1. Build → **Web Mobile** → `build/web-mobile/`
2. Zip the whole directory (including `index.html`, `cocos-js/`, `assets/`, `src/`)
3. Developer console → Upload game → after the first upload use the QA preview environment to verify real ads
4. First bundle ≤50MB (PC) / ≤25MB (mobile); use remote assets / subpackages when exceeding

## 7. Self-check

```bash
python tools/serve.py --root examples/cocos-demo/build   # build output directory
python tools/jogos_test.py examples/cocos-demo/build/web-desktop
```

- [ ] `init` resolves and no save access happens before it
- [ ] Preview/build logs show `loadingStart` and `loadingEnd` once each
- [ ] Switching windows pauses the game and shows the overlay; switching back resumes
- [ ] `cc.director.isPaused()` is true while the window is blurred (the platform `pause()` does not stop the game loop by itself)
- [ ] Game state is correct around ads, no duplicated dialogs
- [ ] Banner follows window changes and covers no buttons
- [ ] Saves survive a restart
- [ ] Console has no `Uncaught` and no `460`

## Reference implementations

- Full project: `examples/cocos-demo/` (Cocos Creator 3.8.7)
- Entry script: `examples/cocos-demo/assets/scripts/JogosSDKDemo.ts`
- Official docs: <https://docs.jogos.com/guide/sdk/introduction.html>
