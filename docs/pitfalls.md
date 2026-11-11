# Jogos SDK integration pitfalls

Format: **symptom → cause → fix**. Items marked 💥 are frequent submission/production incidents.

***

## 1. Lifecycle

> `loadingStart` / `loadingEnd` are **no longer mandatory**. Items 3–5 only apply if you choose to report
> loading. The recommended order is: `loadingStart` after `init`, `loadingEnd` once the first bundle +
> first scene are loaded.

### 1. 💥 `460 Can only be called after the successful call of the JOGOS_SDK.init method` right at startup

**Symptom**: the first SDK log is 460 and ads/saves are all broken.
**Cause**: `init()` is async, but `loadingStart`, `getUser` or `requestAd` run before it resolves.
**Fix**: put every SDK call after `await init()`; expose a single `ready` promise.

```js
const ready = JOGOS_SDK.init();
const startLoading = async () => { await ready; return JOGOS_SDK.game.loadingStart(); };
```

### 2. `init` called multiple times / returns `null`

**Symptom**: the platform receives multiple init calls, especially on refresh or scene re-entry.
**Cause**: every scene script calls init in `onLoad`.
**Fix**: singleton + cached promise, as in `examples/cocos-demo/assets/scripts/jogos/JogosSDK.ts`:

```ts
private _sdk; // non-null means in-flight or finished
async init() {
  if (this._cached) return this._cached;
  if (this._sdk) return null;      // in-flight, ignore duplicate calls
  this._sdk = await loadSdk();
  this._cached = await this._sdk.init();
  return this._cached;
}
```

### 3. Missing `loadingStart` / `loadingEnd` (optional, does not break integration)

**Symptom**: the console does not show loading duration.
**Cause**: only `init` was integrated.
**Fix**: loading reports are no longer mandatory. If you want them, call `loadingStart` after `init`
and `loadingEnd` once the first bundle + first scene are loaded.

### 4. 💥 `loadingEnd` called too early

**Symptom**: 1–2 seconds of black/white screen after entering the game; players think it froze.
**Cause**: using `createUnityInstance` completion, first frame or scene `Start` as the playable signal.
**Fix**: use "the game HUD is actually visible" or "player input is responsive"; late is safer than early.

### 5. `loadingEnd` called too late

**Symptom**: the player has played for tens of seconds but the reported load time is still long.
**Cause**: calling `loadingEnd` after the tutorial or at the first level start.
**Fix**: call it as soon as the main menu or first level is operable.

***

## 2. Ads

### 6. 💥 Relying on fixed `onstarted → onfinished` ordering

**Symptom**: rewards never arrive, or the ad is treated as finished the moment it opens.
**Cause**: the platform may **skip `onstarted` and go straight to `onfinished`**.
**Fix**: treat only `onfinished` as success; never require `onstarted` in your state machine.

### 7. 💥 Granting rewards in `onerror`

**Symptom**: players get free rewards on no-fill/blocked ads and the submission is rejected.
**Cause**: granting in the error branch "for a better experience".
**Fix**: never grant on `onerror`; show "ad unavailable, try again later" and offer a coin-purchase alternative.

### 8. 💥 Game does not pause or mute during ads (guaranteed on H5)

**Symptom**: game audio keeps playing and the character keeps moving during the ad; review rejects it.
**Cause**: the Cocos/Unity SDK pauses automatically, **the HTML5 build does not**.
**Fix**: pause and mute before requesting, restore after `onfinished`/`onerror`.
`shared/jogos-bridge.js` already does this.

### 9. Buttons stay clickable during ads, causing duplicate requests

**Symptom**: double-clicking "Watch Ad" throws `500` or opens two ads.
**Cause**: no in-flight lock.
**Fix**: set `adInFlight=true` and disable the button on request; release it in the callbacks.

### 10. 💥 Interstitial throws `500 At least a N second interval is required...`

**Symptom**: occasional errors when switching levels.
**Cause**: multiple interstitial requests within 60 seconds for the same player.
**Fix**: add a local cooldown (`systemInfo.midgameIntervalTime`) and skip while cooling down;
never request unconditionally on every death or scene switch.

### 11. Interstitial placed at the wrong time

**Symptom**: submission rejected for "ads interrupting gameplay".
**Cause**: showing an interstitial on button clicks, during combat or during menu navigation.
**Fix**: only on level transitions, player death or map loading. **Do not show at level start**
(it belongs at the end of the previous level).

### 12. Rewarded ads have no alternative and no cooldown

**Symptom**: rejected for "forcing players to watch ads".
**Cause**: rewards are ad-only and the button pops constantly.
**Fix**: provide a coin-purchase alternative, add a cooldown/daily limit, and show "try again later" on failure.

### 13. Daily rewarded cap not handled

**Symptom**: clicking the button does nothing.
**Cause**: the daily cap of 50 is exceeded; the SDK errors but the game shows nothing.
**Fix**: use `ad.getRewardAdCount()` at startup or key moments; hide/grey the button with an explanation at 0.

***

## 3. Banner

### 14. 💥 Banner does not show

**Symptom**: `requestBanner` resolves but no ad appears.
**Cause**: the container has no width/height (a `div` is 0 tall by default), is `display:none`, or is clipped by a parent.
**Fix**: give the container one of the standard fixed sizes (300×250 / 320×50 / 728×90 / 468×60 / 320×100).

### 15. More than 2 banners at once

**Symptom**: `500 At most two banners can be displayed at the same time`.
**Cause**: several screens each mount a banner without clearing on scene changes.
**Fix**: keep only 1–2 containers globally and call `clearBanner` when leaving a screen.

### 16. Same id requested twice within 60 seconds

**Symptom**: `500 The time for each call to method requestBanner cannot exceed ...`.
**Cause**: calling `requestBanner` every time a screen is shown.
**Fix**: request the same id only on first display / size change and reuse it afterwards; add a local 60s throttle.

### 17. Banner covers the controls

**Symptom**: review rejects it for "ad covering UI".
**Cause**: the container sits over the thumb area, joystick or buttons.
**Fix**: place it in empty space on a screen that stays visible ≥20 seconds; keep it out of the bottom
safe area on mobile and verify with a device screenshot.

### 18. Drawing a fake banner inside the canvas

**Symptom**: no real ad can be served; the integration is effectively missing.
**Cause**: assuming it is an in-game texture.
**Fix**: you must use a **DOM container** + `banner.requestBanner(id)`; engine nodes only define its position.

***

## 4. Save / cloud sync

### 19. 💥 Writing your own cloud sync alongside the SDK

**Symptom**: occasional rollbacks, duplicate syncs and platform-side data flapping.
**Cause**: the SDK already hooks `localStorage`, but the game also calls `synchronizeToCloud` or builds a queue.
**Fix**: use a stable localStorage key and let the SDK mirror it; keep a single source of truth.

### 20. Calling `synchronizeToCloud` frequently

**Symptom**: platform throttling; queued uploads.
**Cause**: calling on every save or every level.
**Fix**: ≤1 per minute; many projects do not need manual calls at all.

### 21. Unstable save keys

**Symptom**: every launch starts a new save.
**Cause**: keys contain timestamps, random numbers, or inconsistent `version` casing.
**Fix**: use a fixed format like `<game>.<slot>.v1`; migrate data on version upgrades instead of changing the key.

### 22. Save exceeds the size limit

**Symptom**: a console warning, then no more backups.
**Cause**: stuffing whole levels/replays/logs into localStorage.
**Fix**: store only essential progress; configure cache keys in the console to sync only specific keys.

### 23. Startup hard-depends on `getUser()`

**Symptom**: the game hangs on login for guests or network errors.
**Cause**: treating user info as mandatory.
**Fix**: fall back to the guest flow on failure; only ranking/IAP require login.

***

## 5. Time / compatibility / local debugging

### 24. Using local `Date.now()` for event countdowns

**Symptom**: changing the system clock farms event rewards.
**Cause**: no server-time calibration.
**Fix**: `offset = systemInfo.serverTime - Date.now()`, then always use `Date.now() + offset`.

### 25. Long-press selection / context menu / page scrolling on mobile

**Symptom**: long press opens a selection box, pinch zoom, or dragging scrolls the page away.
**Cause**: missing basic CSS and event interception.
**Fix**:

```css
body { -webkit-user-select: none; user-select: none; overscroll-behavior: none; }
```

```js
window.addEventListener('wheel', e => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());
```

### 26. Debugging over `file://` or a caching static server

**Symptom**: code changes do not appear after refresh; the SDK behaves unexpectedly.
**Cause**: browser cache / non-HTTP protocol.
**Fix**: use `python tools/serve.py` from this repo (it sends `Cache-Control: no-store`).

### 27. Verifying ads on localhost

**Symptom**: "ads" work locally but not in production, or the QA environment shows no ads at all.
**Cause**: localhost uses simulated ads; the QA preview environment **intentionally disables ads** before launch.
**Fix**: verify ad behavior only through the developer console QA tool or the real delivery path;
locally only verify the flow and callbacks.

### 28. Pause/resume not paired

**Symptom**: coming back from the background freezes the game or time stops.
**Cause**: `pause` on blur but no `continuePlay` on focus, or a blur during loading froze the engine.
**Fix**: pair calls behind a `hostPaused` flag; **ignore every blur before `loadingEnd`**.
Also, some browsers do not dispatch `window.blur/focus` when switching tabs, so use
`document.visibilitychange` as a fallback (hidden → pause, visible → resume); do not rely on blur/focus alone.

### 29. Buy-out game does not init in the first scene

**Symptom**: pirated copies remain playable, or the purchased version cannot be enabled.
**Cause**: initializing only in the second scene.
**Fix**: finish init and await the callback in the first startup scene before running any game logic;
keep the trial/full version numbers consistent.

### 30. Integrating third-party ad SDKs

**Symptom**: immediate rejection with no feedback.
**Cause**: trying to add extra ad revenue.
**Fix**: only Jogos SDK ads are allowed; remove all third-party ad SDKs and promotion links.

***

## 6. Banner and cloud save (engine differences)

### 31. 💥 Calling the H5 `banner.requestBanner` inside Unity / Cocos

**Symptom**: the banner drifts, stretches or covers UI after a resolution change, and refreshing the same
position throws 500.
**Cause**: a web-layer banner does not follow the engine canvas; the page does not know the in-game layout changed.
**Fix**:

- Unity uses the `JogosBanner` prefab/component (`Resources/JogosBanner.prefab`);
- Cocos uses `JogosBannerUI` + `BannerUI.prefab`;
- Only engines outside H5/Cocos/Unity (e.g. three.js, Phaser) use the H5 API and handle resize syncing themselves.

### 32. 💥 Unity cloud save uses a key other than `PlayerPrefs`

**Symptom**: the save exists locally but is lost on another device or after clearing the cache.
**Cause**: the SDK only auto-syncs `/idbfs/{hash}` and `/idbfs/{hash}/PlayerPrefs`; other IndexedDB keys
are not configured in the developer console, so nothing is synced.
**Fix**: prefer `PlayerPrefs` for Unity progress; if custom storage is required, configure the database
name / table name / cache key in the console.

### 33. 💥 Reading `localStorage` before `init`

**Symptom**: startup reads empty or guest data, then overwrites cloud progress — a rollback.
**Cause**: `init` has not yet restored cloud data into localStorage, so the read hits stale/empty local values.
**Fix**: perform every storage read/write after `init` succeeds; in the loading scene, wait for init before loading the save.
