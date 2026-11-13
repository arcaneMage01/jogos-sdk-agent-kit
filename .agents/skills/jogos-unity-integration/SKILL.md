---
name: "jogos-unity-integration"
description: "Minimal Jogos SDK integration for Unity WebGL: page-side loadingStart, C# init/loadingEnd, rewarded and interstitial ads, PlayerPrefs cloud save, banner and ranking. Invoke when the user asks to integrate the Jogos SDK into a Unity WebGL game."
---

# Unity Jogos SDK Integration

只做最小接入：初始化、加载时序、广告、存档、Banner、排行榜。不要引入公司内部项目流程或框架专用代码。

## 1. 导入 SDK

- 将 `Assets/_JogosSDK` 导入项目（官方 unitypackage，或从 `examples/unity-demo/Assets/_JogosSDK` 复制）。
- 仅 WebGL 生效；Editor 下 `JogosSDK.Init` 同步回调，`SystemInfo` 是空对象，业务代码要容忍。
- 使用 SDK 的脚本需要 `using JogosGames.Engine.SDK;`。

## 2. 页面侧 loadingStart

Unity C# 执行前还要下载 wasm/data、编译、启动引擎，`loadingStart` 必须从页面侧发起。
在接入方**自己的** `index.html` 中、Unity loader 之前加入：

```html
<script src="jogos-boot.js"></script>
```

- `jogos-boot.js` 可从 `examples/unity-demo/Assets/WebGLTemplates/Jogos/TemplateData/jogos-boot.js` 复制。
- **不要强制替换接入方现有模板**；自定义模板、预处理器、打包后处理注入都可以。
- `examples/unity-demo/Assets/WebGLTemplates/Jogos/` 只是参考示例，不是必须使用的目录。
- 多平台开关：`window.JOGOS_ENABLED = false`，或 URL 参数 `?jogos=0` / `?platform=<other>`。

## 3. 初始化与加载时序

```csharp
using JogosGames.Engine.SDK;

JogosSDK.Init(() =>
{
    // loadingStart 已由页面侧上报，这里只等待 init 完成并加载首个可玩场景
});
```

- `Init` 必须先完成，其它 API 才能调用。
- `loadingEnd` 在“玩家可以开始玩”时调用一次即可，放在 `Start`、可玩场景加载完成或游戏准备好的位置都可以，不需要精确到某一帧：

```csharp
// 首个可玩场景准备好后调用一次
JogosSDK.LoadingEnd();
```

- 也可以直接在首个可玩场景上挂 `JogosGamePlayable` 组件（内部只有一行 `JogosSDK.LoadingEnd();`），或者手动调用；重复调用是幂等的，只会上报一次。

## 4. 主流程 API

### 激励广告

```csharp
JogosSDK.Ad.RequestAd(
    JogosAdType.Rewarded,
    () => { /* onStarted */ },
    error => { /* onFailed：不发奖 */ },
    () => { /* onFinished：才发奖 */ });
```

- 只在 `onFinished` 发奖，`onError` 不发奖。
- 一次只允许一个广告请求，请求期间禁用按钮。

### 插屏广告

```csharp
JogosSDK.Ad.RequestAd(JogosAdType.Midgame, null, null, null);
```

- 只在关卡结束、失败或加载时调用，不要在点击或战斗中使用。

### 存档

- 统一使用 `PlayerPrefs`，写完后调用 `PlayerPrefs.Save()`。
- 只有 `PlayerPrefs` 相关 key 会自动同步；不要频繁调用 `synchronizeToCloud`。

```csharp
PlayerPrefs.SetInt("coins", coins);
PlayerPrefs.Save();
```

### Banner

- 使用 `JogosBanner` 组件或 `Resources/JogosBanner.prefab`。
- Unity 不要调用 H5 的 `banner.requestBanner`，Web 层 banner 不会跟随 Canvas 尺寸变化。

### 排行榜

```csharp
JogosSDK.Game.CommitRankingData(rankName, "{\"number\":" + score + "}", success => { });
JogosSDK.Game.OpenRankingDialog(rankName, success => { });
```

- 榜单名和数据类型必须与开发者后台配置一致。

## 5. 验证

- `python tools/verify_integration.py <build-dir>`：静态接入检查。
- `python tools/jogos_test.py <build-dir>`：运行期检查 init、加载顺序、pause/resume。
- 浏览器控制台无 `Uncaught`；如果上报加载，确认 `loadingStart` → `loadingEnd` 顺序。
- 官方文档：<https://docs.jogos.com/guide/sdk/introduction.html>
- 可运行示例：`examples/unity-demo/`（其 `WebGLTemplates/Jogos/` 只是参考示例）。
