# Unity integration project (source baseline for JogosSDK.unitypackage)

This project has two purposes:

1. **Import the official `JogosSDK.unitypackage`** as a readable, editable, re-exportable source baseline;
2. Provide a **playable IAA demo** (`Assets/Demo/IAA`) covering rewarded/interstitial/banner/ranking/cloud save.

- Unity version: **2021.3.35f1**
- Included: `Assets/_JogosSDK/` (SDK v1.2.0) + `Assets/JogosOptimizer/` (build optimization editor tools)
- Original package: `D:\Downloads\JogosSDK.unitypackage` (external, not in the repo)

Release flow stays the same: edit `Assets/_JogosSDK/` → export `.unitypackage` from the menu → import into the
game project. **Do not ship this project as the game project itself.**

## Layout

```
examples/unity-demo/
├── Assets/
│   ├── WebGLTemplates/Jogos/                    # Reference example: page-side init + loadingStart
│   │   ├── index.html                           # Unity default template + jogos-boot.js
│   │   └── TemplateData/jogos-boot.js           # SDK load, init, loadingStart, platform switch
│   ├── Demo/IAA/                                # Playable IAA example (main demo, see DEMO.md)
│   │   ├── Scenes/Loading.unity                 # StartLoad: init + load the gameplay scene
│   │   ├── Scenes/Game.unity                    # Camera + CoinRush (UI built at runtime)
│   │   ├── Scripts/StartLoad.cs                 # Lifecycle entry point
│   │   ├── Scripts/CoinRushGame.cs              # Mini-game + ads/ranking/save/banner + loadingEnd
│   │   └── Editor/IaaDemoSceneBuilder.cs        # One-click scene rebuild
│   ├── _JogosSDK/
│   │   ├── JogosSDK/Scripts/JogosSDK.cs        # Entry (MonoBehaviour singleton)
│   │   ├── JogosSDK/Scripts/Modules/*.cs        # User/Game/Ad/Banner/Data/Payment/Friend
│   │   ├── JogosSDK/Scripts/Utils/*.cs          # Banner, pause window, tips, ad preview, JogosGamePlayable
│   │   ├── JogosSDK/Scripts/InputCheck.cs       # PC/mobile input type detection
│   │   ├── JogosSDK/Resources/*.prefab          # LostFocusWin / JogosTipsWin / JogosBanner
│   │   └── Plugins/jogos-sdk.unity.jslib        # JS glue for DllImport("__Internal")
│   └── JogosOptimizer/Editor/                   # Window/Jogos Optimizer: texture/model/audio/build optimization
├── Packages/
└── ProjectSettings/
```

## Main demo (IAA)

Entry scene `Assets/Demo/IAA/Scenes/Loading.unity`:

`Assets/WebGLTemplates/Jogos/TemplateData/jogos-boot.js` → `init` + `loadingStart` **before Unity boots**
→ `StartLoad` waits for init and loads the `Game` scene → `CoinRushGame` reports `loadingEnd`
when the game becomes playable.

`loadingStart` is page-side on purpose: Unity does not run C# until the wasm/data bundle is downloaded,
compiled and the first scene is booted. Calling it from `StartLoad.Start()` would miss the largest part
of the player-perceived loading time.

The `WebGLTemplates/Jogos` folder is a **reference example**, not a required template. Integrators only
need to insert `<script src="jogos-boot.js"></script>` into their own `index.html` before the Unity
loader runs; a custom template, a preprocessor, or a post-build step are all valid ways to do it.

`Game.unity` is a playable 30-second coin-collection mini-game:

- Tap a coin for +10; the top-right **Watch Ad +100** button is a permanent rewarded entry
- Round-over panel: **Watch Ad +15s** revive, **Play Again**, plus leaderboard submit and interstitial
- Bottom `JogosBanner` component (320×50)
- Coin balance is stored in `PlayerPrefs` (the only key Unity cloud save syncs automatically)

The scene contains only Camera + EventSystem + `CoinRush`; all UI is created at runtime inside
`CoinRushGame`, so the SDK integration lines are easy to read.

- Details and ad snippets: [DEMO.md](DEMO.md)
- Rebuild scenes: menu `Jogos/Demo/Rebuild IAA Scenes`

## C# API quick reference (`JogosGames.Engine.SDK`)

Initialization and globals:

```csharp
JogosSDK.Init(() => { /* initialization finished */ });
JogosSDK.SystemInfo;          // platform info (an empty object in the editor)
JogosSDK.IsInitialized;
JogosSDK.IsRunInMobile;       // detected by InputCheck; JogosSDK.MouseOrTouch can override it
```

| Module | Common methods |
|---|---|
| `JogosSDK.Game` | `HappyTime()` `GameplayPause()` `GameplayContinue()` `ShareGame(ShareInfo, Action<bool>)` `CommitAchievementData(name, progress, hidden, Action<bool>)` `OpenAchievementsDialog(Action<bool>)` `CommitRankingData(name, json, Action<bool>)` `OpenRankingDialog(name, Action<bool>)` `ExchangePrize(cdkey, ok, fail)` |
| `JogosSDK.Ad` | `RequestAd(JogosAdType, Action started, Action<string> error, Action finished)` `GetRewardAdCount(Action<int>)` `HasAdblock(Action<bool>)` |
| `JogosSDK.Banner` | `RegisterBanner(JogosBanner)` `UnregisterBanner` `RefreshBanners(bool update)` `HideAll()` `ShowAll()` |
| `JogosSDK.User` | `GetUser(Action<UserInfo>)` `GetUserToken(Action<string>)` `GetPublicKey(Action<string>)` |
| `JogosSDK.Data` | `SynchronizeToCloud()` |
| `JogosSDK.Goods` | `BuyOut` `BuyGoods` `GetOrderInfo` `GetOrderList` `SubscribeOrderPaid(..., autoDeliver: true)` `DeliverGoods` `OpenPaymentDialog(level, ...)` `GetUserGameItems` `AddGameItem` `SubtractGameItem` `SubscribeGameItemChange` |
| `JogosSDK.Friend` | `CheckIsMyFriends` `SendFirendRequset` (official spelling) `OpenChatDialog` `OpenInviteDialog` |

## Key facts (read before integrating)

1. **Init is synchronous in the editor**: in `Application.isEditor`, `JogosSDK.Init` sets
   `IsInitialized=true`, invokes the callback, and assigns `SystemInfo = new SystemInfo()` (all defaults).
   Game code must tolerate an empty `SystemInfo` in the editor.
2. **The SDK handles pause/resume itself**: when `JogosSettings.pauseGameLostFocus` is true,
   `OnApplicationFocus(false)` → `Time.timeScale=0` + `AudioListener.volume=0` + shows `LostFocusWin`;
   on resume it restores both and calls `Game.GameplayContinue()` / `Banner.RefreshBanners(true)`.
   **Do not pause again in your own scripts**, or you will fight the SDK over `timeScale`.
   The demo timer uses `Time.deltaTime`, so it freezes automatically during ads / focus loss.
3. **`loadingStart` is page-side, `loadingEnd` is game-side** (V1.3.0):
   - insert `<script src="jogos-boot.js"></script>` into your own `index.html` before the Unity
     loader starts; the script calls `init` + `loadingStart`, so the reported duration includes
     wasm/data download, wasm compile and engine boot;
   - `Assets/WebGLTemplates/Jogos/` is a reference example only — integrators keep their own
     template and inject the script however they prefer (template, preprocessor, post-build);
   - `JogosSDK_Init` reuses `window.JOGOS_SDK_INIT_PROMISE`, so the later C# `JogosSDK.Init` does
     **not** initialize the platform twice;
   - C# does not call `LoadingStart()`; the jslib keeps `init → loadingStart → loadingEnd` ordered
     internally, so a late `LoadingEnd` still produces a valid report;
   - `JogosSDK.LoadingEnd()` just needs one call when the player can start playing; `Start`, after the
     first playable scene loads, or any equivalent game-ready point is fine. The demo calls it from
     `CoinRushGame.Start()`, or you can attach the one-line `JogosGamePlayable` component to the scene.
     Duplicate calls are ignored.

   Recommended order (not mandatory):

   ```text
   page boot: load SDK -> init -> loadingStart
   C#:        start load -> game is playable -> loadingEnd
   ```

   Platform switch for multi-SDK builds:

   ```js
   window.JOGOS_ENABLED = false;  // set before jogos-boot.js
   // or append ?jogos=0 / ?platform=crazygames
   ```

   When disabled, the page does not load the Jogos SDK, the jslib uses a no-op stub, and C# skips
   the focus-loss pause logic. Other platform SDKs can therefore drive the same build.

   > Page-side `init` relies on the current SDK no longer requiring Unity's `Module/FS/IDBFS`
   > arguments. If you ship an older SDK version, verify cloud save first; otherwise keep `init`
   > in C# and use the page boot script only for the platform switch.
4. **jslib loader rules**: when `location.host` matches `/\.jogos\w*\.com$/`, it loads
   `//www<host>/sdk/jogos-sdk-v1.js`; otherwise `https://sdk.jogosfans.com/jogos-sdk-v1.js`.
5. **`Init` returns immediately on non-Editor, non-WebGL platforms** (no callback), so device/Standalone
   builds must not wait for it.

## Editing and exporting

1. Edit `Assets/_JogosSDK/` in Unity
2. Keep incrementing `Assets/_JogosSDK/JogosSDK/version.txt` (currently `V1.3.1 #Add JogosGamePlayable ...`)
3. Export: right-click `Assets` → Export Package → select only `_JogosSDK` (`JogosOptimizer` as needed)
4. Re-import the `.unitypackage` into the game project

## TODO (Unity phase)

- [x] Reference WebGL template example: page-side `init` + `loadingStart` + platform switch
      (`Assets/WebGLTemplates/Jogos/`); integrators may inject `jogos-boot.js` into any template instead
- [ ] Loading page / performance HUD polish, `block-unity-net.js`
- [ ] Produce a publishable minimal WebGL example (`examples/unity-webgl/`)
- [ ] Write `.agents/skills/jogos-unity-integration/SKILL.md`
