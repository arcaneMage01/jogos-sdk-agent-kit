# Playable IAA example (Unity)

Aimed at the **99% of integrators who are IAA (ad-monetized)**: only init + the loading flow + a playable
scene + the main-flow capabilities. No user module, IAP or friends clutter.

## Scenes

| Scene | Content |
|---|---|
| `Assets/Demo/IAA/Scenes/Loading.unity` | `StartLoad` waits for SDK init and loads the gameplay scene; a centered `Loading...` label |
| `Assets/Demo/IAA/Scenes/Game.unity` | Camera + EventSystem + `CoinRush`, a 30-second coin-collection mini-game; reports `loadingEnd` once it is playable |

Build Settings contains only these two scenes, in the order `Loading → Game`.

`Game.unity` UI is created at runtime by [CoinRushGame.cs](Assets/Demo/IAA/Scripts/CoinRushGame.cs):

- Top-right **Watch Ad +100**: a permanent rewarded button that grants only on `finished`
- Round-over panel: **Watch Ad +15s** revive, **Play Again**
- Bottom `JogosBanner` (320×50), using the platform component instead of the H5 API
- Coin balance is written to `PlayerPrefs` and restored on the next launch (the key cloud save syncs)

## Main flow code

`Assets/WebGLTemplates/Jogos/TemplateData/jogos-boot.js` (reference copy). In a business project, put
`<script src="jogos-boot.js"></script>` in your own `index.html` before the Unity loader; the template
itself is not required.

```js
// Runs before the Unity loader. Never blocks createUnityInstance on the SDK.
window.JOGOS_ENABLED = resolveEnabled();  // window switch / ?jogos=0 / ?platform=
window.JOGOS_SDK_INIT_PROMISE = loadSdk().then(() => JOGOS_SDK.init('Unity'));
window.JOGOS_SDK_LOADING_START_PROMISE = window.JOGOS_SDK_INIT_PROMISE
  .then(() => JOGOS_SDK.game.loadingStart());
```

[StartLoad.cs](Assets/Demo/IAA/Scripts/StartLoad.cs):

```csharp
private void Start()
{
    JogosSDK.Init(() =>               // 1. Hard requirement: must complete first
    {
        // 2. loadingStart was already reported by the page boot script
        SceneManager.LoadScene(nextScene);
    });
}
```

[CoinRushGame.cs](Assets/Demo/IAA/Scripts/CoinRushGame.cs):

```csharp
private void Start()
{
    // ... build the playable UI / start the first round ...

    // The game is playable now; one call is enough.
    JogosSDK.LoadingEnd();
}
```

- The simplest alternative: attach the `JogosGamePlayable` component to the first playable scene.
  It contains only `JogosSDK.LoadingEnd();` and can be replaced by a manual call in game code.
- Other SDK APIs may only be called after `init` succeeds, otherwise they throw `500` / `460`.
- `loadingStart` / `loadingEnd` are **no longer mandatory**; use the order above if you report them.
- `loadingStart` must be page-side for Unity: C# only starts after wasm/data download, wasm compile and
  engine boot, which is the largest part of the real loading time.
- `loadingEnd` just needs to be called once when the player can start playing; `Start`, after the first
  playable scene loads, or any equivalent game-ready point is fine. The jslib keeps
  `init → loadingStart → loadingEnd` ordered even if the game reports out of order.
- In the editor `JogosSDK.Init` calls back synchronously and `SystemInfo` is an empty object; game code must tolerate that.

## Rebuilding scenes

After changing UI or to regenerate the scenes:

- Menu: `Jogos/Demo/Rebuild IAA Scenes`
- CLI:

```bash
"D:/Program Files/Unity/Hub/Editor/2021.3.35f1/Editor/Unity.exe" \
  -batchmode -quit -projectPath <project> \
  -executeMethod JogosDemo.IAA.EditorTools.IaaDemoSceneBuilder.Build
```

## Ad integration (IAA core)

Permanent top-right rewarded video:

```csharp
private void OnWatchAdClicked()
{
    if (JogosSDK.Ad.AdRequestInProgress) return;

    JogosSDK.Ad.RequestAd(
        JogosAdType.Rewarded,
        null,                                   // started
        error => { /* no fill/blocked: do not grant */ },
        () => { AddCoins(100); }                // grant only on finished
    );
}
```

Revive on the round-over panel uses the same API, only the callback changes game state:

```csharp
JogosSDK.Ad.RequestAd(JogosAdType.Rewarded, null,
    error => { /* hide the revive button */ },
    () => { /* continue for 15 seconds */ });
```

Interstitial only when a round ends:

```csharp
JogosSDK.Ad.RequestAd(JogosAdType.Midgame, null, null, null);
```

- Interstitial only on level end/death/load; never on button clicks or during combat.
- During ads the SDK pauses and mutes automatically (`AdModule` handles it); do not pause again in game code.
- Rewarded ads need an alternative (coin purchase) and a cooldown; hide the button when
  `GetRewardAdCount` reaches 0.
- Banner uses the scene's `JogosBanner` component / `Resources/JogosBanner.prefab`; never cover the play area.

## Banner

Do not use the H5 `banner.requestBanner` in Unity (a web-layer ad does not follow the canvas and drifts on
resolution changes). Use the platform component:

1. Drag `Assets/_JogosSDK/JogosSDK/Resources/JogosBanner.prefab` into the scene where it covers no controls;
2. Pick a size in the Inspector (728×90 / 300×250 / 320×50 / 468×60 / 320×100);
3. The component registers in `Awake`, unregisters in `OnDestroy`, and `JogosSDK.Banner.RefreshBanners()`
   recalculates the position when the viewport changes.

The demo instantiates the prefab at runtime and sets the size and anchors:

```csharp
var banner = Instantiate(Resources.Load<GameObject>("JogosBanner"), canvas).GetComponent<JogosBanner>();
banner.Size = JogosBanner.BannerSize.Mobile_320x50;
```

## Cloud save

Unity uses IndexedDB; by default the SDK syncs `/idbfs/{hash}` and `/idbfs/{hash}/PlayerPrefs`.

```csharp
PlayerPrefs.SetInt("coins", coins);
PlayerPrefs.Save();       // the demo writes on every coin change
```

- **The key should be `PlayerPrefs`**: only that key is synced automatically.
- Other IndexedDB keys/databases must be configured in the developer console (database name / table / cache key),
  otherwise sync silently fails.
- Do not call `synchronizeToCloud` yourself (only for special checkpoints, at most once per minute).

## IAP (dedupe)

Standalone IAP callbacks can be lost, so manage pre-orders and reconcile. See
`examples/cocos-demo/assets/scripts/jogos/PreOrderMgr.ts`:

1. Persist a local pre-order immediately after `buyGoods` returns an order number;
2. After `init`, reconcile with `getOrderList('success')` and re-deliver;
3. Poll `getOrderDetail` every 5 seconds as a fallback;
4. Call `deliverGoods` and delete the pre-order only after the game granted the item;
5. `subscribeOrderPaid` is only a fast path, never the sole source of truth.

## Secondary modules (not in the main demo)

Users, IAP, friends and achievements are rarely used by IAA integrators. When needed, see:

- Official docs: <https://docs.jogos.com/guide/sdk/introduction.html>
- Repository references:
  - `.agents/skills/jogos-sdk-core/references/api.md`
  - `docs/requirements.md` (ad rules)
  - `docs/acceptance.md` (pre-submission acceptance)

| Module | C# entry point |
|---|---|
| User info / token | `JogosSDK.User.GetUser/GetUserToken/GetPublicKey` |
| IAP / buy-out / delivery | `JogosSDK.Goods.*` |
| Items | `JogosSDK.Goods.GetUserGameItems/AddGameItem/...` |
| Friends / invite / chat | `JogosSDK.Friend.*` |
| Cloud save | `JogosSDK.Data.SynchronizeToCloud()` |
| Ranking / achievements / CDK / share | `JogosSDK.Game.*` |
| Pause test | `JogosSDK.Pause()/Resume()` |
