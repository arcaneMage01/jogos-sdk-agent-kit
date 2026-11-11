# IAA 可玩示例（Unity）

面向 **99% 的 IAA（广告变现）接入方**：只保留 init + 加载流程 + 可玩画面 + 主流程能力，
不放用户模块、内购、好友这些干扰项。

## 场景

| 场景 | 内容 |
|---|---|
| `Assets/Demo/IAA/Scenes/Loading.unity` | `StartLoad` 负责 SDK 初始化与加载上报，居中显示 `Loading...` |
| `Assets/Demo/IAA/Scenes/Game.unity` | Camera + EventSystem + `CoinRush`，30 秒一局的金币收集小游戏 |

Build Settings 只包含这两个场景，顺序 `Loading → Game`。

`Game.unity` 的 UI 由 [CoinRushGame.cs](Assets/Demo/IAA/Scripts/CoinRushGame.cs) 在运行时创建：

- 右上角 **Watch Ad +100**：常驻激励视频按钮，只在 `finished` 时加金币
- 结算面板：**Watch Ad +15s** 复活、**Play Again** 重开
- 底部 `JogosBanner`（320×50），用平台组件而不是 H5 接口
- 金币余额写 `PlayerPrefs`，下次启动自动恢复（云存档同步的就是这个 key）

## 主流程代码

[StartLoad.cs](Assets/Demo/IAA/Scripts/StartLoad.cs)：

```csharp
private void Start()
{
    JogosSDK.Init(() =>               // 1. 硬约束：必须最先完成
    {
        JogosSDK.LoadingStart();      // 2. 推荐上报（非强制），内部等 init 完成
        SceneManager.sceneLoaded += OnFirstSceneLoaded;
        SceneManager.LoadScene(nextScene);
    });
}

private void OnFirstSceneLoaded(Scene scene, LoadSceneMode mode)
{
    SceneManager.sceneLoaded -= OnFirstSceneLoaded;
    JogosSDK.LoadingEnd();            // 3. 场景就绪 = 可玩信号
}
```

- `init` 必须成功后才能调用其它 SDK 接口，否则抛 `460`。
- `loadingStart` / `loadingEnd` 已**不再强制**；接入时按上面的节奏即可。
- `loadingEnd` 要放在"玩家真正可以操作"的时刻，不要用首帧渲染。
- 编辑器下 `JogosSDK.Init` 会同步回调，`SystemInfo` 是空对象，业务代码要能容忍。

## 重建场景

改了 UI 或想重生成场景：

- 菜单：`Jogos/Demo/Rebuild IAA Scenes`
- 命令行：

```bash
"D:/Program Files/Unity/Hub/Editor/2021.3.35f1/Editor/Unity.exe" \
  -batchmode -quit -projectPath <本工程> \
  -executeMethod JogosDemo.IAA.EditorTools.IaaDemoSceneBuilder.Build
```

## 广告接入（IAA 核心）

右上角常驻激励视频：

```csharp
private void OnWatchAdClicked()
{
    if (JogosSDK.Ad.AdRequestInProgress) return;

    JogosSDK.Ad.RequestAd(
        JogosAdType.Rewarded,
        null,                                   // started
        error => { /* 无填充/被拦截：不发奖 */ },
        () => { AddCoins(100); }                // finished 才发奖
    );
}
```

结算复活用同一个接口，只是回调里改游戏状态：

```csharp
JogosSDK.Ad.RequestAd(JogosAdType.Rewarded, null,
    error => { /* 隐藏复活按钮 */ },
    () => { /* 继续 15 秒 */ });
```

插屏只在关卡结束时：

```csharp
JogosSDK.Ad.RequestAd(JogosAdType.Midgame, null, null, null);
```

- 插屏只在关卡结束/死亡/加载时；不要放在按钮点击或战斗中。
- 广告期间 SDK 会自动暂停与静音（`AdModule` 内部处理），业务不要再暂停一次。
- 激励广告要有替代方案（金币购买）和冷却；`GetRewardAdCount` 到 0 时隐藏按钮。
- Banner 用场景里的 `JogosBanner` 组件 / `Resources/JogosBanner.prefab`，不要遮挡操作区。

## Banner

Unity 不要用 H5 的 `banner.requestBanner`（Web 层广告不跟随画布，分辨率变化会错位）。
用平台组件：

1. 把 `Assets/_JogosSDK/JogosSDK/Resources/JogosBanner.prefab` 拖进场景，
   放到不遮挡操作区的位置；
2. 在 Inspector 选尺寸（728×90 / 300×250 / 320×50 / 468×60 / 320×100）；
3. 组件 `Awake` 自动注册、`OnDestroy` 自动注销，窗口变化由
   `JogosSDK.Banner.RefreshBanners()` 统一重算位置。

Demo 里是运行时 `Instantiate` 这个 prefab，再设置 `Size` 与锚点：

```csharp
var banner = Instantiate(Resources.Load<GameObject>("JogosBanner"), canvas).GetComponent<JogosBanner>();
banner.Size = JogosBanner.BannerSize.Mobile_320x50;
```

## 云存档

Unity 走 IndexedDB，SDK 默认自动同步 `/idbfs/{hash}` 与 `/idbfs/{hash}/PlayerPrefs`。

```csharp
PlayerPrefs.SetInt("coins", coins);
PlayerPrefs.Save();       // Demo 每次加金币都会写
```

- **key 最好就是 `PlayerPrefs`**：系统只会自动同步这个 key。
- 其它 IndexedDB key/库表必须在开发者后台配置数据库名/表名/缓存 Key，否则同步缺失。
- 不要自己调 `synchronizeToCloud`（除非有特殊检查点需求，且 ≤1 次/分钟）。

## 内购（防丢单）

单机内购回调可能丢，必须做本地预订单 + 对账，参考
`examples/cocos-demo/assets/scripts/jogos/PreOrderMgr.ts`：

1. `buyGoods` 返回订单号后立刻写入本地预订单；
2. `init` 后 `getOrderList('success')` 对账补发；
3. 每 5 秒轮询 `getOrderDetail` 兜底；
4. 业务发货成功后再 `deliverGoods` 并删除预订单；
5. `subscribeOrderPaid` 只作快路径，不能当唯一依据。

## 次要模块（不放进主 Demo）

用户、内购、好友、成就等模块对 IAA 接入方通常用不到，需要时直接看：

- 官方文档：<https://docs.jogos.com/guide/sdk/introduction.html>
- 仓库接口速查：
  - `.agents/skills/jogos-sdk-core/references/api.md`
  - `docs/requirements.md`（广告规范）
  - `docs/acceptance.md`（提审验收）

| 模块 | C# 入口 |
|---|---|
| 用户信息 / Token | `JogosSDK.User.GetUser/GetUserToken/GetPublicKey` |
| 内购 / 买断 / 发货 | `JogosSDK.Goods.*` |
| 道具 | `JogosSDK.Goods.GetUserGameItems/AddGameItem/...` |
| 好友 / 邀请 / 聊天 | `JogosSDK.Friend.*` |
| 云存档 | `JogosSDK.Data.SynchronizeToCloud()` |
| 排行榜 / 成就 / CDK / 分享 | `JogosSDK.Game.*` |
| 暂停测试 | `JogosSDK.Pause()/Resume()` |
