# Pitfall checklist (agent edition)

Full symptom / cause / fix write-ups live in [`../../../docs/pitfalls.md`](../../../docs/pitfalls.md).
This file only lists items **you must check when changing code**.

## Lifecycle

- [ ] Every SDK call happens after `await init()` (otherwise error 460)
- [ ] `init` is a cached singleton promise, never called concurrently
- [ ] (Optional) If loading reports are used: `loadingStart` after `init`, `loadingEnd` once the
      first bundle + first scene are loaded
- [ ] (Optional) `loadingEnd` is called once the player can act; `Start` of the first playable scene is fine
- [ ] Buy-out games: run game logic only after init completes in the first scene

## Ads

- [ ] Only `onfinished` is treated as success; `onerror` never grants a reward
- [ ] Code does not assume `onstarted` always arrives first
- [ ] Requests use an in-flight lock and the button is disabled
- [ ] Ad playback pauses the game, mutes audio and blocks input; everything restores afterwards
- [ ] Interstitial only on level end / death / load; local cooldown >= `midgameIntervalTime`
- [ ] Rewarded ads have a coin-purchase alternative and a cooldown; the button hides when
      `getRewardAdCount() === 0`
- [ ] No third-party ad SDK is integrated

## Banner

- [ ] The DOM container has explicit width/height and one of the 5 standard sizes
- [ ] Unity / Cocos do **not** call the H5 `banner.requestBanner` directly; they use their own
      component/prefab
- [ ] Only other engines use the H5 banner, and they re-sync position after resize
- [ ] At most 2 banners; the same id is not requested twice within 60 s
- [ ] It does not cover buttons / joystick / UI; verified on a real mobile device
- [ ] Banners are cleared when leaving the screen

## Saves

- [ ] Keys are stable and game-prefixed (`mygame.save.v1`)
- [ ] Unity save key is `PlayerPrefs`, or other keys are configured in the developer console
- [ ] All localStorage reads/writes happen after `init` succeeds
- [ ] No custom cloud-sync queue and no frequent `synchronizeToCloud`
- [ ] Unit/local testing confirms saves survive a reload
- [ ] Guest mode is playable; a `getUser` failure never blocks startup

## Time / compatibility

- [ ] Event countdowns are calibrated with `serverTime`
- [ ] `user-select:none`, `contextmenu` and `wheel` are handled
- [ ] Debug over HTTP (`tools/serve.py`), never `file://`
- [ ] Pause/resume are paired; blur before `loadingEnd` is ignored
- [ ] Tab switching is covered by `document.visibilitychange`; do not assume `window.blur/focus` always fires
- [ ] Local ad behavior is not used as acceptance evidence (ads are also disabled in QA preview)

## Before submission

- [ ] `python tools/verify_integration.py <build-dir>` passes
- [ ] Console has no `Uncaught` and no leftover debug code
- [ ] First bundle PC ≤50MB / mobile ≤25MB; total PC ≤500MB / mobile ≤250MB
- [ ] Playable in English (top-3 rejection reason)
