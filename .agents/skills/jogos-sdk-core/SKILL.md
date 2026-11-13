---
name: jogos-sdk-core
description: Core integration contract for the Jogos platform SDK (HTML5 build, jogos-sdk-v1.js). Read this first for any work involving Jogos / JOGOS_SDK / jogos-sdk-v1.js / platform ads / rewarded video / interstitial / banner / cloud save / leaderboard / achievements / IAP / CDK, or when debugging error 460, ad rate limits (500) or save-sync issues. Applies to H5, Cocos, three.js, Phaser, Construct and PlayCanvas; Unity uses the Unity-specific docs in examples/unity-demo.
---

# Jogos SDK Core Contract (Web / HTML5)

This skill covers **protocol and semantics only** and is engine-agnostic. Pair it with the engine skill:

| Engine | Skill |
|---|---|
| Vanilla H5 / Canvas / Phaser / Construct | `jogos-h5-integration` |
| Cocos Creator 2.x / 3.x | `jogos-cocos-integration` |
| three.js / PlayCanvas / Babylon | `jogos-threejs-integration` |
| Unity WebGL | `examples/unity-demo/README.md` + `DEMO.md` |

## 0. Choose the implementation path

- **H5 / three.js / other Web engines** → load `jogos-sdk-v1.js`, or use the repo's
  `shared/jogos-bridge.js` (lifecycle, pause, ad throttling and save are already wrapped).
- **Cocos Creator** → prefer the platform-provided `JogosSDK.ts` + `jogos-sdk.esm.ts`
  (see `examples/cocos-demo/assets/scripts/jogos/`).
- Do not reinvent the wrapper. Reuse first, then trim.

## 1. Load the SDK

```html
<script src="https://www.jogos.com/sdk/jogos-sdk-v1.js"></script>
```

- On an embedded Jogos domain (`*.jogos*.com`), the official Cocos wrapper loads
  `//www<host>/sdk/jogos-sdk-v1.js`; everything else falls back to
  `https://sdk.jogosfans.com/jogos-sdk-v1.js`.
- Both are acceptable. **Never hard-code an internal URL that may 404.**
- On `localhost` the SDK simulates ads by itself; no extra mock is needed. Use `?mock=1`
  only when the script cannot be loaded at all, and **never treat mock results as acceptance evidence**.

## 2. Startup flow (loading reports are recommended, not mandatory)

```js
const info = await window.JOGOS_SDK.init();  // must await completion first
await window.JOGOS_SDK.game.loadingStart();  // recommended: after init
// ... load first bundle + first scene ...
await window.JOGOS_SDK.game.loadingEnd();    // recommended: when the player can act
```

- Calling anything before `init` throws
  `460 Can only be called after the successful call of the JOGOS_SDK.init method`.
- Call `init` exactly once. Duplicate calls hit the platform again, so cache the promise / use a singleton.
- **`loadingStart` / `loadingEnd` are no longer mandatory**: skipping them does not fail integration.
  If you do report them, keep the order "init → `loadingStart` → first bundle/scene loaded → `loadingEnd`".
- If you call `loadingEnd`, call it once the player can start playing. `Start` of the first playable
  scene, a scene-load-finished callback, or any equivalent game-ready point is fine; no exact-frame
  requirement, but do not report before the game is actually playable.
- **Unity WebGL**: report `loadingStart` from the page before the Unity loader runs. Insert
  `<script src="jogos-boot.js"></script>` into the integrator's own `index.html` (custom Unity template,
  preprocessor, or post-build step — their choice). `examples/unity-demo/Assets/WebGLTemplates/Jogos/`
  is only a reference example, not a requirement. C# does not execute until wasm/data download,
  wasm compile and engine boot finish, so `StartLoad.Start()` cannot measure the real loading time.
  Report `loadingEnd` once the game is playable.
- Paid (buy-out) games: `init` must complete in the **first startup scene** and you must await the callback,
  otherwise piracy detection does not work.

## 3. Modules

| Module | Purpose | Key APIs |
|---|---|---|
| `game` | loading/pause/happy time/ranking/achievements/share/invite | `loadingStart` `loadingEnd` `pause` `continuePlay` `happytime` `commitRankingData` `openRankingDialog` `commitAchievementsData` `openAchievementsDialog` `exchangePrizes` `share` |
| `user` | Signed-in user | `getUser` `getUserToken` `getPublicKey` |
| `ad` | Video ads | `requestAd('rewarded'\|'midgame', callbacks)` `getRewardAdCount` `hasAdblock` |
| `banner` | Banners | `requestBanner(id, style)` `clearBanner(id)` `clearAllBanners` |
| `payment` | IAP / buy-out | `buyGoods` `buyOut` `getOrderDetail` `getOrderList` `deliverGoods` `subscribeOrderPaid` |
| `gameItem` | Items | `getUserGameItems` `addGameItem` `subtractGameItem` `openBuyGameItemsDialog` `subscribeGameItemChange` |
| `data` | Cloud save | The SDK mirrors localStorage / idbfs automatically; manual entry point is `game.synchronizeToCloud` |

Full signatures and types: `references/api.md`.

## 4. Ad semantics (where integrations break)

```js
const cb = {
  onstarted:  () => {},        // may be skipped
  onfinished: () => {},        // the only signal you may grant a reward on
  onerror:    (e) => {},       // do NOT grant; e may be {code,message} or a string
};
window.JOGOS_SDK.ad.requestAd('rewarded', cb);  // rewarded
window.JOGOS_SDK.ad.requestAd('midgame', cb);   // interstitial
```

Hard rules:

1. **Grant rewards only in `onfinished`**; never in `onerror`. The platform audits
   "ad closed but reward granted".
2. Do not assume `onstarted` always fires first; a direct `onfinished` path exists.
3. Pause the game and mute audio during ads, and block input until `onfinished` / `onerror`.
   The Cocos/Unity SDK does this for you; **on H5 you must implement it yourself**.
4. Only one ad request may be in flight. Use an in-flight lock, otherwise double clicks cause
   platform errors.
5. Interstitial minimum gap is usually 60 s; too frequent calls throw
   `500 At least a ${time} second interval is required to display new advertisements`.
6. Rewarded ads are typically capped at 50 per user per day; exceeding it throws
   `500 You can only watch up to ${max} rewarded ads per day`. Use `getRewardAdCount()` to hide the button early.
7. Placement: interstitial only on **level end / death / map load**; never on navigation buttons,
   during combat, or on the buy-out page.
8. Ad blockers: let the player keep playing, only gently limit premium features, and label the
   restricted spot with "Unavailable while an ad blocker is active". Do not show full-screen popups.

## 5. Banner rules

> Unity uses the `JogosBanner` prefab/component; Cocos uses `JogosBannerUI` + `BannerUI.prefab`.
> **Only engines other than these two** use the H5 DOM approach below.
> Reason: a web-layer banner does not follow the engine canvas, so position/size must be
> re-synced by the engine whenever the viewport changes.

```js
await window.JOGOS_SDK.banner.requestBanner('banner-container'); // id must equal the DOM container id
await window.JOGOS_SDK.banner.clearBanner('banner-container');
await window.JOGOS_SDK.banner.clearAllBanners();
```

- The container must have an explicit width/height. Only 5 standard sizes are allowed:
  728×90 / 300×250 / 320×50 / 468×60 / 320×100.
- At most 2 banners at the same time. Re-requesting the same id counts as a refresh;
  **a second request within 60 s throws 500**.
- The banner must not cover UI/buttons, and the hosting screen should stay visible for at least 20 s.
- Local testing does not show real ads; verify in the developer console QA preview environment.

## 6. Save rules

- Use **stable, game-prefixed** localStorage keys (e.g. `mygame.save.v1`).
  The SDK mirrors any key without the `JOGOS` prefix to the cloud, **you do not write sync logic**.
- **Unity (IndexedDB)**: the SDK syncs `/idbfs/{hash}` and `/idbfs/{hash}/PlayerPrefs` by default.
  **The key should be `PlayerPrefs`** because only that key is synced automatically. Any other
  IndexedDB key/database must be configured in the developer console (database name / table / cache key),
  otherwise the save is silently not synced.
- **H5 / Cocos (localStorage)**: use it normally, but **read/write only after `init` succeeds**.
  Reading before init returns empty/guest data, which looks like a progress rollback.
- Do not build your own upload queue, and do not call `synchronizeToCloud()` frequently
  (1/minute limit; the SDK also debounces 1 s). Call it manually only when saves do not use
  localStorage or when you need a forced checkpoint.
- Saves have a size limit. If the console warns about approaching the limit, trim your keys.
- Guests can save too; after login the SDK migrates local saves to the account and rolls back when
  logging out.
- In the submission form, "how the game saves progress" must select the Jogos SDK data module,
  otherwise cloud save is disabled.

## 7. Time / device / language

- Calibrate every event countdown with `systemInfo.serverTime` instead of raw `Date.now()`:

```js
const offset = systemInfo.serverTime - Date.now();
const now = () => Date.now() + offset;
```

- Use `deviceType` (`desktop` / `tablet` / `mobile`) to switch control hints, `language` for
  localization, and `bannerIntervalTime` / `midgameIntervalTime` to pace ads.

## 8. Common error codes

| Error | Meaning | Handling |
|---|---|---|
| `460 Can only be called after ... init` | Called before init finished | Await init before any call |
| `401 Unauthorized` | User not signed in / frozen | Catch it, continue as guest, never hard-block |
| `500 At least a N second interval ...` | Ad rate limit | Add local cooldown, ignore this request |
| `500 You can only watch up to N rewarded ads per day` | Daily cap | Hide the button, tell the player to come back tomorrow |
| `500 At most two banners ...` | Too many banners | At most 2 at once |
| `500 The time for each call to method requestBanner cannot exceed ...` | Banner refresh too fast | Wait 60 s before refreshing |

## 9. Acceptance

```bash
python tools/verify_integration.py <build-dir>   # static scan
python tools/jogos_test.py <build-dir>           # runtime: init / storage order / pause
```

`jogos_test.py` injects `tools/jogos_observer.js` before every page script, so it needs no game
code changes. It must pass:

1. `init` resolves, and **no localStorage / IndexedDB access happened before it** (engine boot
   writes such as Cocos `storage` or Unity `/idbfs` are reported separately as INFO/WARN)
2. `loadingStart` after init and `loadingEnd` after that — optional, `[SKIP]` is acceptable
3. window blur calls `pause()` **and the game really stops**, focus calls `continuePlay()`

If the engine's pause state cannot be read from JS (Unity WebGL), the row is a WARN and needs a
manual check. Custom engines can expose `window.__JOGOS_GAME__ = { isPaused: false }` to make it a
hard PASS/FAIL.

Then walk through `docs/acceptance.md` manually: loading overlay → playable → pause/resume → ads →
save round-trip → no `Uncaught`.

## References

- `references/api.md` — full API, types, callback semantics
- `references/pitfalls.md` — 33-item checklist
- `../../../docs/main-flow.md` — main flow: ads / banner / ranking / cloud save / IAP dedupe
- `../../../docs/quickstart.md` — per-engine integration path
- `../../../examples/` — four runnable projects (H5 / Cocos / three.js / Unity)
