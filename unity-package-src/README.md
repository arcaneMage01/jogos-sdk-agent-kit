# Unity 接入工程（JogosSDK.unitypackage 源码维护用）

这个工程只做一件事：**把官方 `JogosSDK.unitypackage` 解进来，作为可读、可改、可重新导出的源码基线**。
发布流程仍然是：改完 → 菜单导出 `.unitypackage` → 给业务工程导入。**不要直接把这个工程当游戏工程发布**。

- Unity 版本：**2021.3.45f2**
- 已导入：`Assets/_JogosSDK/`（SDK v1.1.0）+ `Assets/JogosOptimizer/`（构建优化编辑器工具）
- 原始包：`D:\Downloads\JogosSDK.unitypackage`（外部文件，不在仓库内）

## 目录

```
unity-package-src/
├── Assets/
│   ├── _JogosSDK/
│   │   ├── JogosSDK/Scripts/JogosSDK.cs        # 入口（MonoBehaviour 单例）
│   │   ├── JogosSDK/Scripts/Modules/*.cs        # User/Game/Ad/Banner/Data/Payment/Friend
│   │   ├── JogosSDK/Scripts/Utils/*.cs          # Banner、暂停窗、Tips、AdPreview
│   │   ├── JogosSDK/Scripts/InputCheck.cs       # PC/移动输入类型探测
│   │   ├── JogosSDK/Resources/*.prefab          # LostFocusWin / JogosTipsWin / JogosBanner
│   │   ├── Plugins/jogos-sdk.unity.jslib        # DllImport("__Internal") 的 JS 胶水
│   │   └── Demo/                                # 官方 Demo 场景与示例脚本
│   └── JogosOptimizer/Editor/                   # Window/Jogos Optimizer：纹理/模型/音频/构建优化
├── Packages/
└── ProjectSettings/
```

## C# API 速查（`JogosGames.Engine.SDK`）

初始化与全局：

```csharp
JogosSDK.Init(() => { /* 初始化完成 */ });
JogosSDK.SystemInfo;          // 平台信息（编辑器下是空对象）
JogosSDK.IsInitialized;
JogosSDK.IsRunInMobile;       // 由 InputCheck 探测，可手动设置 JogosSDK.MouseOrTouch
```

| 模块 | 常用方法 |
|---|---|
| `JogosSDK.Game` | `HappyTime()` `GameplayPause()` `GameplayContinue()` `ShareGame(ShareInfo, Action<bool>)` `CommitAchievementData(name, progress, hidden, Action<bool>)` `OpenAchievementsDialog(Action<bool>)` `CommitRankingData(name, json, Action<bool>)` `OpenRankingDialog(name, Action<bool>)` `ExchangePrize(cdkey, ok, fail)` |
| `JogosSDK.Ad` | `RequestAd(JogosAdType, Action started, Action<string> error, Action finished)` `GetRewardAdCount(Action<int>)` `HasAdblock(Action<bool>)` |
| `JogosSDK.Banner` | `RegisterBanner(JogosBanner)` `UnregisterBanner` `RefreshBanners(bool update)` `HideAll()` `ShowAll()` |
| `JogosSDK.User` | `GetUser(Action<UserInfo>)` `GetUserToken(Action<string>)` `GetPublicKey(Action<string>)` |
| `JogosSDK.Data` | `SynchronizeToCloud()` |
| `JogosSDK.Goods` | `BuyOut` `BuyGoods` `GetOrderInfo` `GetOrderList` `SubscribeOrderPaid(..., autoDeliver: true)` `DeliverGoods` `OpenPaymentDialog(level, ...)` `GetUserGameItems` `AddGameItem` `SubtractGameItem` `SubscribeGameItemChange` |
| `JogosSDK.Friend` | `CheckIsMyFriends` `SendFirendRequset`（官方拼写）`OpenChatDialog` `OpenInviteDialog` |

## 关键事实（接入前必读）

1. **编辑器下 init 是同步成功**：`JogosSDK.Init` 在 `Application.isEditor` 分支直接置 `IsInitialized=true` 并回调，
   `SystemInfo = new SystemInfo()`（字段全默认）。所以业务代码在编辑器里必须能容忍空 `SystemInfo`。
2. **暂停/恢复由 SDK 自己处理**：`JogosSettings.pauseGameLostFocus` 为真时，
   `OnApplicationFocus(false)` → `Time.timeScale=0` + `AudioListener.volume=0` + 显示 `LostFocusWin`；
   恢复时还原并调用 `Game.GameplayContinue()` / `Banner.RefreshBanners(true)`。
   **不要自己在别的脚本里再暂停一次**，会与 SDK 抢 `timeScale`。
3. **`loadingStart` / `loadingEnd` 已提供，但不再强制**（V1.2.0）：
   - jslib：`JogosSDK_LoadingStart` / `JogosSDK_LoadingEnd`，内部等待 `JogosSDK_Init` 的 Promise，
     避免在 init 完成前调用抛 `460`
   - C#：`JogosSDK.LoadingStart()` / `JogosSDK.LoadingEnd()`（仅 WebGL 生效，其它平台为空实现）

   推荐节奏（不强制）：

   ```csharp
   JogosSDK.Init(() => {
       // ... 首包 + 首个场景加载 ...
       JogosSDK.LoadingEnd();     // 玩家可操作时
   });
   JogosSDK.LoadingStart();       // init 之后立刻调用，内部会等 init 完成
   ```
4. **jslib 加载器规则**：`location.host` 匹配 `/\.jogos\w*\.com$/` 时走
   `//www<host>/sdk/jogos-sdk-v1.js`，否则 `https://sdk.jogosfans.com/jogos-sdk-v1.js`。
5. **`Init` 在非 Editor、非 WebGL 平台直接 return**（不会回调），所以真机/Standalone 下不要等它。

## 修改与导出

1. 在 Unity 中改 `Assets/_JogosSDK/`
2. 保持 `Assets/_JogosSDK/JogosSDK/version.txt` 递增（当前 `V1.2.0 #Add loadingStart/loadingEnd`）
3. 导出：`Assets` 右键 → Export Package → 只勾 `_JogosSDK`（`JogosOptimizer` 视需要）
4. 业务工程重新导入 `.unitypackage`

## 待办（Unity 阶段）

- [ ] 修正 WebGL 模板：`block-unity-net.js`、加载页、性能 HUD
- [ ] 产出一个可发布的最小 WebGL 示例（`examples/unity-webgl/`）
- [ ] 编写 `.agents/skills/jogos-unity-integration/SKILL.md`
