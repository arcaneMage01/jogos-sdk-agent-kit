# Acceptance checklist

Walk through every item before submitting. Each row states how to test and the expected result.

## 1. Loading lifecycle

> Automated: `python tools/jogos_test.py <build-dir>` covers 1.1 (init resolved), the "no save access
> before init" rule and the `loadingStart` / `loadingEnd` order. Items 1.2 and 1.3 still need eyes.

| # | Action | Expected |
|---|---|---|
| 1.1 | Open the game and check the console/SDK log | `init` appears and succeeds; if loading reports are used, `loadingStart` → `loadingEnd` in the right order |
| 1.2 | Watch the loading process | Visible feedback; no long white screen |
| 1.3 | If `loadingEnd` is reported, interact immediately after | Input responds; not "looks playable but clicks do nothing" |
| 1.4 | Refresh the page 3 times | No duplicate init, no 460 |

## 2. Pause / resume

> Automated: `tools/jogos_test.py` verifies 2.1 and 2.2 (blur → `pause`, focus → `continuePlay`,
> plus the engine's own pause state where it is readable from JS). Items 2.3 and 2.4 are manual.

| # | Action | Expected |
|---|---|---|
| 2.1 | Switch to another tab | Game freezes + pause overlay appears (or the engine's own pause) |
| 2.2 | Switch back | Resumes with no time/animation jump |
| 2.3 | Open and close the in-game menu | `pause` / `continuePlay` appear as a pair |
| 2.4 | Background the tab during loading and return | No freeze (blur before `loadingEnd` is ignored) |

## 3. Rewarded ads

| # | Action | Expected |
|---|---|---|
| 3.1 | Click "watch ad for reward" | Game pauses, audio mutes, UI locks |
| 3.2 | Watch to completion | Reward granted once, with a confirmation |
| 3.3 | Close early / no fill | No reward, game restores, friendly message |
| 3.4 | Click the button 5 times quickly | Only one request, no duplicate dialogs |
| 3.5 | Reach the daily cap | Button hidden/greyed with an explanation |
| 3.6 | Accidentally close the ad | No duplicate ad, no duplicate messages |

## 4. Interstitial ads

| # | Action | Expected |
|---|---|---|
| 4.1 | Complete a level | Plays once after the level ends (not at start) |
| 4.2 | Complete another level within 60 s | Does not play; the game continues normally |
| 4.3 | During combat / on button clicks | Never triggers |
| 4.4 | No fill | Restores seamlessly, no stutter |

## 5. Banner

> Unity uses the `JogosBanner` prefab/component; Cocos uses `JogosBannerUI` + `BannerUI.prefab`.
> Only other engines use the H5 `banner.requestBanner`.

| # | Action | Expected |
|---|---|---|
| 5.1 | Enter a screen with a banner | Ad appears inside the container at the standard size |
| 5.2 | Resize the window | Banner follows without drifting or distorting |
| 5.3 | Mobile (or emulation) | Does not cover buttons/joystick/critical UI |
| 5.4 | Switch screens | Old banner cleared; never more than 2 |
| 5.5 | Enter/leave the screen repeatedly | No 500 errors (the 60s throttle works) |

## 6. Saves

> Unity: the key should be `PlayerPrefs`; other keys need developer-console configuration.
> H5 / Cocos: every storage read/write must happen after `init` succeeds.

| # | Action | Expected |
|---|---|---|
| 6.1 | Play, then refresh | Progress preserved |
| 6.2 | Close the tab and reopen | Progress preserved |
| 6.3 | Inspect localStorage in the console | Stable key, game prefix, reasonable size |
| 6.4 | Guest → login | Local progress migrates to the account |
| 6.5 | Save rapidly several times | No duplicate syncs, no errors |

## 7. User / ranking / achievements / payment (if integrated)

| # | Action | Expected |
|---|---|---|
| 7.1 | Start while signed out | Playable; login only prompts for features that require it |
| 7.2 | Submit a score | The score is visible on the leaderboard |
| 7.3 | Open achievements | Correct achievement state |
| 7.4 | Buy an item | Reward granted + `deliverGoods` succeeds; re-entering does not regrant |
| 7.5 | Purchase callback lost after a network drop | Startup reconciles with `getOrderList` and re-delivers |

## 8. Compatibility and performance

| # | Action | Expected |
|---|---|---|
| 8.1 | Run once in Chrome and Edge | No white screen, no `Uncaught` |
| 8.2 | Real device or emulation | Touch works; long press does not select, no context menu, no page scroll |
| 8.3 | First bundle size | PC ≤50MB / mobile ≤25MB |
| 8.4 | Console | No 404, no 460/500, no leftover debug code (`?mock=1`, `debugger`) |
| 8.5 | Network panel | No third-party ad/promotion requests |

## 9. Automated checks

```bash
python tools/verify_integration.py <build-dir>   # static scan of the build output
python tools/jogos_test.py <build-dir>           # runtime test with an injected observer
```

Everything must be `[PASS]`; `[WARN]` items need manual review.

- `[SKIP]` on the loading rows is fine — loading reports are recommended, not mandatory.
- `[INFO]` rows (engine storage, screenshot comparison) are informational only.
- **Unity WebGL does not expose `Time.timeScale` to JS.** For Unity the pause state row is a WARN;
  confirm on screen that the game stops and audio is muted.
- For your own engine, expose `window.__JOGOS_GAME__ = { isPaused: false }` from the game loop to
  turn that WARN into a real PASS/FAIL.

## 10. Submission form

- [ ] "How the game saves progress" selects **use the JogosSDK data module**
- [ ] Leaderboard names/fields match the console configuration
- [ ] Achievement names match the console configuration
- [ ] Buy-out: trial/full version numbers match
- [ ] English support is present
