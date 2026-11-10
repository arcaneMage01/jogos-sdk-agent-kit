# IAA 最小接入示例（Unity）

面向 **99% 的 IAA（广告变现）接入方**：只保留 init + 加载流程 + 可玩画面，
不放用户模块、内购、好友这些干扰项。

## 场景

| 场景 | 内容 |
|---|---|
| `Assets/Demo/IAA/Scenes/Loading.unity` | 只有一个 `StartLoad` 物体，负责 SDK 初始化与加载上报 |
| `Assets/Demo/IAA/Scenes/Game.unity` | 深色背景 + 居中 Label `Playing...`（呼吸动画） |

Build Settings 只包含这两个场景，顺序 `Loading → Game`。

## 主流程代码

[StartLoad.cs](Assets/Demo/IAA/Scripts/StartLoad.cs)：

```csharp
private void Start()
{
    JogosSDK.LoadingStart();          // 1. 推荐上报（非强制），内部等 init 完成

    JogosSDK.Init(() =>               // 2. 硬约束：必须最先完成
    {
        JogosSDK.LoadingEnd();        // 3. 推荐上报：首包 + 首场景就绪
        SceneManager.LoadScene("Game");
    });
}
```

- `init` 必须成功后才能调用其它 SDK 接口，否则抛 `460`。
- `loadingStart` / `loadingEnd` 已**不再强制**；接入时按上面的节奏即可。
- 真实项目里 `loadingEnd` 应放在"玩家真正可以操作"的时刻（例如主菜单出现、首关可操作），
  不要用首帧渲染。
- 编辑器下 `JogosSDK.Init` 会同步回调，`SystemInfo` 是空对象，业务代码要能容忍。

## 重建场景

改了 UI 或想重生成场景：

- 菜单：`Jogos/Demo/Rebuild IAA Scenes`
- 命令行：

```bash
"D:/Program Files/Unity/Hub/Editor/2021.3.45f2-x86_64/Editor/Unity.exe" \
  -batchmode -quit -projectPath <本工程> \
  -executeMethod JogosDemo.IAA.EditorTools.IaaDemoSceneBuilder.Build
```

## 广告接入（IAA 核心）

激励视频（只在 `finished` 发奖）：

```csharp
JogosSDK.Ad.RequestAd(
    JogosAdType.Rewarded,          // 插屏用 JogosAdType.Midgame
    () => { /* started */ },
    err => { /* 无填充/被拦截：不发奖 */ },
    () => { /* finished：发奖 */ }
);
```

- 插屏只在关卡结束/死亡/加载时；不要放在按钮点击或战斗中。
- 广告期间 SDK 会自动暂停与静音（`AdModule` 内部处理），业务不要再暂停一次。
- 激励广告要有替代方案（金币购买）和冷却；`GetRewardAdCount` 到 0 时隐藏按钮。
- Banner 用场景里的 `JogosBanner` 组件 / `Resources/JogosBanner.prefab`，不要遮挡操作区。

## 次要模块（不放进主 Demo）

这些模块对 IAA 接入方通常用不到，需要时直接看官方参考场景：

`Assets/_JogosSDK/Demo/JogosSDKDemo.unity`（不在 Build Settings 里，仅供查阅）

| 模块 | C# 入口 | 场景脚本 |
|---|---|---|
| 用户信息 / Token | `JogosSDK.User.GetUser/GetUserToken/GetPublicKey` | `JogosDemoUser.cs` |
| 内购 / 买断 / 发货 | `JogosSDK.Goods.*` | `JogosDemoGoods.cs`、`JogosDemoGoods2.cs` |
| 道具 | `JogosSDK.Goods.GetUserGameItems/AddGameItem/...` | `JogosDemoGoods*.cs` |
| 好友 / 邀请 / 聊天 | `JogosSDK.Friend.*` | `JogosDemoFriend.cs` |
| 云存档 | `JogosSDK.Data.SynchronizeToCloud()` | `JogosDemoData.cs` |
| 排行榜 / 成就 / CDK / 分享 | `JogosSDK.Game.*` | `JogosDemoGame.cs`、`JogosDemoGame2.cs`、`JogosDemoGame3.cs` |
| 暂停测试 | `JogosSDK.Pause()/Resume()` | `JogosDemoPauseTest.cs` |

更完整的接口说明见仓库：

- `.agents/skills/jogos-sdk-core/references/api.md`
- `docs/requirements.md`（广告规范）
- `docs/acceptance.md`（提审验收）
