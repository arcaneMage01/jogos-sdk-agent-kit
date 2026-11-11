# Platform requirements (read before submitting)

> Source: the official Requirements section. Violating any of these leads to rejection, usually without detailed feedback.

## 1. Bundle size and compatibility

| Item | PC | Mobile |
|---|---|---|
| Initial download | ≤ 50 MB | ≤ 25 MB |
| Total file size | ≤ 500 MB | ≤ 250 MB |
| File count | ≤ 5000 | ≤ 3000 |

- **Chrome / Edge** support is mandatory; poor Safari performance leads to blocking.
- Many users are on Chromebooks (4 GB RAM); stuttering on low-end devices leads to Chromium OS blocking.
- Desktop defaults to **landscape**; portrait games are allowed (letterbox or background fill).
- Mobile must support touch; desktop must support mouse and keyboard.
- Unity games are disabled on iOS by default (OOM issues); the platform opens them up gradually.

### Required mobile CSS

```css
body {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  overscroll-behavior: none;
}
```

### Common browser behavior fixes

```js
window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  // Handle mobile webview backgrounding (implement pause for your engine)
});
```

## 2. Advertising requirements

### General

- **Ads may only be requested through the Jogos SDK**; any third-party ad SDK or external promotion is forbidden.
- The game must be fully playable with an ad blocker enabled; never punish adblock users in any way.
- Ads must not block progress, trick clicks, or play repeatedly/in parallel.
- Ads must be meaningful: do not show them before the player has experienced reasonable content.

### Interstitial (midgame)

- Allowed: level transitions, player death, map loading.
- Forbidden: during combat/interaction, on navigation buttons (main menu, settings, shop), at level start.
- Pause the game and mute while playing; block UI interaction from request until completion.
- On no-fill (adError) resume the game seamlessly.
- The platform throttles automatically (≤1 per 2 minutes); too-frequent requests are ignored.

### Rewarded

- Must be an **optional value-add**, never forced.
- Must offer an alternative such as a coin purchase.
- The button must be fixed and obvious, with clear wording ("watch an ad for a reward"), never misleading.
- After the ad, show a "reward granted" message.
- Never require watching multiple ads for one reward; never show ad buttons during combat.
- Add cooldown and daily limits; when the cap is reached, clearly say "try again later".
- On ad blocker, return adError → no reward, show "Unavailable while an ad blocker is active"
  (no full-screen popup).

### Banner

- Only on UI that stays visible for ≥ 20 seconds on average.
- Must not cover any UI/button (at any mobile size).
- Must be clearly distinguishable from game content.
- Refresh interval must be > 60 seconds.
- Standard sizes: 728×90, 300×250, 320×50, 468×60, 320×100; at most 2 at once.

## 3. Technical integration requirements

Mandatory call:

```js
await JOGOS_SDK.init();
```

Recommended (not mandatory) loading reports: `loadingStart` right after `init`, `loadingEnd` once the
first bundle + playable scene are loaded.

```js
await JOGOS_SDK.game.loadingStart();
await JOGOS_SDK.game.loadingEnd();
```

- Buy-out games: finish init and await the callback in the **first startup scene** before running game logic.
- Cloud save: the submission form must select "use the JogosSDK data module".
- User system: if login is not required to play, a failed `getUser` must degrade to guest mode.

## 4. Content and quality

- **English support** is required (top-3 rejection reason).
- Original content; cloning, reskins and asset resale are forbidden.
- Bug- and crash-free gameplay; QA plays through basic features.
- Inappropriate themes/content are rejected outright.
- Rejected games may be resubmitted after improvements meet the requirements.

## 5. Release flow

1. Create the game in the developer console; fill in info/cover/video
2. Upload the build zip
3. Self-test in the QA preview environment (ads disabled)
4. Submit for review
5. Updates usually process within 24 hours and reach players after cache refresh

## 6. Common misconceptions

| Misconception | Reality |
|---|---|
| "Ads show locally, so they will in production" | localhost is simulated; the QA environment also disables ads before launch |
| "More ads means more revenue" | The SDK ignores overly frequent requests and it may cause rejection |
| "Add a third-party ad SDK for extra revenue" | Immediate rejection with no feedback |
| "Saves are handled by the platform" | Use a stable key and select the data module in the submission form |
| "`loadingEnd` can be called anywhere" | Too early causes a white screen; too late skews stats — both can be judged as a broken integration |
