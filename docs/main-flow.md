# Main flow integration guide

> Official docs: <https://docs.jogos.com/guide/sdk/introduction.html>
>
> This guide only covers **the four things 95% of integrators actually use**: ads (rewarded/interstitial),
> banner, ranking and cloud save. IAP has its own dedupe section; everything else is secondary and listed at the end.

## 0. Overview

| Capability | Required | Engine differences | Section |
|---|---|---|---|
| `init` | ✅ hard requirement | None | Read [quickstart](quickstart.md) first |
| Rewarded / interstitial | Required for monetization | None (Cocos/Unity wrappers handle pause and mute) | [1](#1-ads-rewarded--interstitial) |
| Banner | Only if you show banners | **Unity / Cocos use their own component, not the H5 API** | [2](#2-banner-per-engine) |
| Ranking | Only if you have a leaderboard | None | [3](#3-ranking) |
| Cloud save | Only if you have progress | **Unity uses IndexedDB + the PlayerPrefs key** | [4](#4-cloud-save) |
| IAP | Only if you sell items | None, but dedupe is required | [5](#5-iap-dedupe) |
| User/friends/items/achievements/CDK | On demand | None | [6](#6-secondary-capabilities) |

`loadingStart` / `loadingEnd` are recommended reports, not mandatory; if used, follow
`init → loadingStart → playable scene → loadingEnd`.

***

## 1. Ads (rewarded / interstitial)

```js
const callbacks = {
  onstarted:  () => {},          // may be skipped; do not rely on it
  onfinished: () => {},          // the only signal you may grant a reward on
  onerror:    (e) => {},         // no reward
};
JOGOS_SDK.ad.requestAd('rewarded', callbacks);  // rewarded
JOGOS_SDK.ad.requestAd('midgame', callbacks);   // interstitial
```

- **Grant only on `onfinished`**, never on `onerror`.
- Interstitial only on level end / death / map load; never on button clicks, combat or level start.
- Add a local cooldown (`systemInfo.midgameIntervalTime`), otherwise you hit
  `500 At least N second interval`.
- Only one ad request at a time: use an in-flight lock and disable the button.
- Rewarded ads need an alternative (coin purchase) and a cooldown; hide the button when
  `ad.getRewardAdCount()` reaches 0.
- During ads you must pause, mute and block input. The Cocos/Unity wrappers handle pause and mute;
  **plain H5 must do it yourself** (`shared/jogos-bridge.js` already includes it).
- Ad blockers: let the player continue, only limit premium features; never punish with full-screen popups.

***

## 2. Banner (per engine)

> **A web-layer banner does not follow engine canvas transforms.** When the viewport size/orientation
> changes, the engine must push the new position and size to the page, otherwise the ad drifts, stretches
> or covers UI. So **Unity / Cocos should not call the H5 `banner.requestBanner` directly** — use their
> native components below. Only engines outside those two use the H5 approach.

### 2.1 Unity: `JogosBanner` component / prefab

- Use `Assets/_JogosSDK/JogosSDK/Resources/JogosBanner.prefab`, or attach `JogosBanner` to a UI node.
- The component registers itself in `Awake` (`JogosSDK.Banner.RegisterBanner(this)`) and unregisters in `OnDestroy`.
- `Size` supports exactly 5 values: 728×90 / 300×250 / 320×50 / 468×60 / 320×100;
  `Position` directly changes the inner `Banner` node's `anchoredPosition`.
- On viewport changes `JogosSDK.Banner.RefreshBanners()` recalculates the position; **do not request again yourself**.
- The editor shows a placeholder; in WebGL the background is transparent and real ads only appear on device.

```csharp
// Just attach the component and set the size; never call requestBanner by hand
var banner = GetComponent<JogosBanner>();
banner.Size = JogosBanner.BannerSize.Mobile_320x50;
```

### 2.2 Cocos: `JogosBannerUI` + `BannerUI.prefab`

- Use `examples/cocos-demo/assets/resources/prefab/BannerUI.prefab`, or attach `JogosBannerUI` to a node.
- In `onEnable` the component waits for SDK init and then calls `requestBannerWithNode(node)`.
- On window `resize` it calls `refreshBanner(true)`; on `onDisable` it calls `clearBanner`.
- It already converts `getBoundingBoxToWorld` + `canvas.getBoundingClientRect` + DPR;
  **do not multiply DPR again**, and do not call `banner.requestBanner` additionally.
- Release builds have a 60-second local throttle.

### 2.3 Other engines (H5 / three.js / Phaser / Construct)

Only the H5 API is available: prepare a DOM container with an explicit size, then request:

```html
<div id="banner-slot" style="width:300px;height:250px"></div>
```

```js
await JOGOS_SDK.banner.requestBanner('banner-slot');
```

**You must sync the size yourself** (the biggest H5 pitfall):

- After window resize / orientation change / canvas layout change, recompute the container position and re-sync;
- Requesting the same id within 60 seconds is rejected by the platform, so throttle refreshes;
- The container must not be `display:none` and must not be clipped by a parent;
- At most 2 banners at once; call `clearBanner` when leaving the screen.

`shared/jogos-bridge.js` `showBanner(el)` computes the position from the container's
`getBoundingClientRect` and enforces the 60s throttle and 2-banner limit, so you can use it directly.

***

## 3. Ranking

```js
await JOGOS_SDK.game.commitRankingData('HighScore', { "number": 1200 });
await JOGOS_SDK.game.openRankingDialog('HighScore');
```

- The leaderboard name and fields must match the developer console **exactly**, otherwise nothing happens.
- First argument: the leaderboard name configured in the developer console.
- Second argument: `{ dataType: value }`; the key is the configured data type and the value is the actual
  value. Values may only be number / string / Date, and only single precision is supported.
- Submit on level end / new record to avoid high-frequency requests.
- Achievements work the same way: `commitAchievementsData(name, progress, hidden)`; `name` must match the console.

***

## 4. Cloud save

The save backend differs per engine; **choosing the wrong one or a wrong key looks like it saved but never syncs**.

### 4.1 Unity (IndexedDB recommended)

- By default the SDK syncs `/idbfs/{hash}` and `/idbfs/{hash}/PlayerPrefs`; usually no extra config is needed.
- **The key should be `PlayerPrefs`**: only that key is synced automatically.
- If you write saves to other IndexedDB keys/databases, **you must configure them in the developer console**
  (database name / table name / cache key), otherwise sync silently fails.
- Conclusion: prefer `PlayerPrefs` for Unity progress and avoid custom storage.

```csharp
PlayerPrefs.SetInt("level", 3);
PlayerPrefs.Save();   // no need to call synchronizeToCloud yourself
```

### 4.2 localStorage (H5 / Cocos / three.js)

- Use `localStorage` normally; the SDK mirrors any key without the `JOGOS` prefix automatically.
- **The only hard rule: access storage only after `JogosSDK.init` succeeds.**
  Reading before init returns empty or guest data, which looks like a progress rollback.
- Keys must be stable and game-prefixed (e.g. `mygame.save.v1`); never include timestamps/random numbers.
- There is a size limit; store only essential progress. The console warns when approaching it.
- Do not build an upload queue and do not call `synchronizeToCloud()` frequently (≤1 per minute).

```js
// ✅ Correct order
const info = await JogosSDK.init();
const save = JSON.parse(localStorage.getItem('mygame.save.v1') || '{}');

// ❌ Wrong: reading before init
```

***

## 5. IAP dedupe

Standalone IAP has no server-side fallback and client callbacks can be lost, so you must manage pre-orders yourself.
Reference implementation:
[examples/cocos-demo/assets/scripts/jogos/PreOrderMgr.ts](../examples/cocos-demo/assets/scripts/jogos/PreOrderMgr.ts).

Core approach:

1. **Persist a local pre-order first**: after `buyGoods` returns an order number, write it locally
   (`jogosPreOrders`) immediately, then wait for the payment result; the same product may not be ordered
   twice within 20 seconds.
2. **Reconcile at startup**: after `init`, read local pre-orders and fetch successful orders with
   `getOrderList('success')` to re-deliver.
3. **Polling fallback**: after ordering, call `getOrderDetail(orderNo)` every 5 seconds for unfinished
   pre-orders, in case the `subscribeOrderPaid` notification is lost.
4. **Confirm only after the game grants the item**: call `deliverGoods(orderNo)` and delete the local
   pre-order only when the business handler succeeds (`handler(order)` returns true); keep it on failure
   and retry next round.
5. `subscribeOrderPaid` is only a fast path for early delivery; it cannot be the sole source of truth.
6. After delivering, trigger one cloud-save sync so the item and the save do not diverge.

***

## 6. Secondary capabilities

These are rarely integrated; use the official docs and the SDK APIs directly when needed:

| Capability | Entry point |
|---|---|
| User info / token | `JogosSDK.user.getUser/getUserToken/getPublicKey` |
| Friends / invite / chat | `game.isMyFriends/sendFriendRequest/openChatDialog/openInviteDialog` |
| Items | `gameItem.getUserGameItems/addGameItem/subtractGameItem/...` |
| Achievements | `game.commitAchievementsData/openAchievementsDialog` |
| CDK | `game.exchangePrizes` |
| Share | `game.share` |
| Buy-out | `payment.buyOut` |

- Signatures and callbacks: `.agents/skills/jogos-sdk-core/references/api.md`
- Official docs: <https://docs.jogos.com/guide/sdk/introduction.html>
- Unity reference project: `examples/unity-demo/` (main demo in `Assets/Demo/IAA`)
- Cocos reference project: `examples/cocos-demo/`
