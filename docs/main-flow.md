# 主流程接入指南

> 官方文档：<https://docs.jogos.com/guide/sdk/introduction.html>
>
> 本文只覆盖 **95% 接入方真正会用到的四件事**：广告（激励/插屏）、Banner、排行榜、云存档。
> 内购有单独的防丢单章节；其余能力属于次要接入，见文末。

## 0. 主流程一览

| 能力              | 必接          | 引擎差异                                    | 章节                             |
| --------------- | ----------- | --------------------------------------- | ------------------------------ |
| `init`          | ✅ 硬约束       | 无                                       | 先读 [quickstart](quickstart.md) |
| 激励 / 插屏广告       | 变现必接        | 无（Cocos/Unity 封装已处理暂停静音）                | [1](#1-广告激励--插屏)               |
| Banner          | 有 banner 才接 | **Unity / Cocos 用各自组件，不要用 H5 API**      | [2](#2-banner分引擎)              |
| 排行榜             | 有榜单才接       | 无                                       | [3](#3-排行榜)                    |
| 云存档             | 有进度才接       | **Unity 用 IndexedDB + PlayerPrefs key** | [4](#4-云存档)                    |
| 内购              | 有付费才接       | 无，但要防丢单                                 | [5](#5-内购防丢单)                  |
| 用户/好友/道具/成就/CDK | 极少用         | 无                                       | [6](#6-次要能力)                   |

`loadingStart` / `loadingEnd` 是推荐上报，不强制；接入时按 `init → loadingStart → 首包/首场景 → loadingEnd`。

***

## 1. 广告（激励 / 插屏）

```js
const callbacks = {
  onstarted:  () => {},          // 可能被跳过，不要依赖
  onfinished: () => {},          // 唯一可发奖的信号
  onerror:    (e) => {},         // 不发奖
};
JOGOS_SDK.ad.requestAd('rewarded', callbacks);  // 激励
JOGOS_SDK.ad.requestAd('midgame', callbacks);   // 插屏
```

- **只在 `onfinished` 发奖**，`onerror` 不发。
- 插屏只在关卡结束/死亡/地图加载时播，禁止按钮点击、战斗、关卡开始。
- 本地也做冷却（`systemInfo.midgameIntervalTime`），否则会撞 `500 At least N second interval`。
- 同一时刻只允许一个广告请求：加 in-flight 锁 + 按钮禁用。
- 激励广告要有替代方案（金币购买）与冷却；`ad.getRewardAdCount()` 为 0 时隐藏按钮。
- 广告期间必须暂停 + 静音 + 锁交互。Cocos/Unity 封装会处理暂停静音；
  **纯 H5 需要自己处理**（`shared/jogos-bridge.js` 已内置）。
- 广告拦截：允许玩家继续玩，只限制增值功能，不要全屏弹窗惩罚。

***

## 2. Banner（分引擎）

> **Web 层 banner 不跟随引擎画布变换。** 屏幕尺寸/方向变化时，必须由引擎侧把新的位置和尺寸同步给页面，
> 否则广告会错位、被拉伸或挡 UI。所以 **Unity / Cocos 默认不要直接调 H5 的 `banner.requestBanner`**，
> 用下面各自的原生组件；只有这两种引擎之外的项目才走 H5 方式。

### 2.1 Unity：`JogosBanner` 组件 / 预制体

- 用 `Assets/_JogosSDK/JogosSDK/Resources/JogosBanner.prefab`，或给 UI 节点挂 `JogosBanner`。
- 组件在 `Awake` 里自动 `JogosSDK.Banner.RegisterBanner(this)`，`OnDestroy` 自动注销。
- `Size` 只支持 5 种：728×90 / 300×250 / 320×50 / 468×60 / 320×100；
  `Position` 直接改内部 `Banner` 节点的 `anchoredPosition`。
- 窗口尺寸变化时由 `JogosSDK.Banner.RefreshBanners()` 统一重算位置，**不要自己再请求一次**。
- 编辑器下显示占位文案，WebGL 下背景自动透明，实机才出真实广告。

```csharp
// 只需要挂组件 + 设置尺寸，不要手写 requestBanner
var banner = GetComponent<JogosBanner>();
banner.Size = JogosBanner.BannerSize.Mobile_320x50;
```

### 2.2 Cocos：`JogosBannerUI` + `BannerUI.prefab`

- 用 `examples/cocos-demo/assets/resources/prefab/BannerUI.prefab`，或给节点挂 `JogosBannerUI`。
- 组件在 `onEnable` 等 SDK init 完成后自动 `requestBannerWithNode(node)`。
- 窗口 `resize` 自动 `refreshBanner(true)`；`onDisable` 自动 `clearBanner`。
- 内部已完成 `getBoundingBoxToWorld` + `canvas.getBoundingClientRect` + DPR 换算，
  **不要自己再乘 DPR**，也不要再额外调用 `banner.requestBanner`。
- 构建版有 60 秒本地频控。

### 2.3 其他引擎（H5 / three.js / Phaser / Construct）

只能用 H5 接口：先准备有明确宽高的 DOM 容器，再请求：

```html
<div id="banner-slot" style="width:300px;height:250px"></div>
```

```js
await JOGOS_SDK.banner.requestBanner('banner-slot');
```

**必须自己做尺寸同步**（这是 H5 方式最大的坑）：

- 窗口 resize / 横竖屏切换 / 画布布局变化后，重新计算容器位置并再次同步；
- 同 id 60 秒内重复请求会被平台拒绝，所以刷新要节流；
- 容器不能 `display:none`，也不能被父元素裁剪；
- 同时最多 2 个 banner，切界面要 `clearBanner`。

`shared/jogos-bridge.js` 的 `showBanner(el)` 已经按容器 `getBoundingClientRect` 计算位置，
并做了 60s 频控与最多 2 个的约束，可直接用。

***

## 3. 排行榜

```js
await JOGOS_SDK.game.commitRankingData('HighScore', { "number": 1200 });
await JOGOS_SDK.game.openRankingDialog('HighScore');
```

- 榜单名与字段必须和开发者后台配置**完全一致**，否则不生效。
- 值只能是 number / string / Date，且只支持单精度数值, 第二个参数key为数据类型，值为实际要传的参数。
- 在关卡结束/破纪录时提交，避免高频请求。
- 成就同理：`commitAchievementsData(name, progress, hidden)`，`name` 必须与后台一致。

***

## 4. 云存档

存档后端按引擎区分，**选错或 key 写错都会导致"看起来存了、实际没同步"**。

### 4.1 Unity（推荐 IndexedDB）

- SDK 默认自动同步 `/idbfs/{hash}` 与 `/idbfs/{hash}/PlayerPrefs`，多数情况无需额外配置。
- **key 最好就是 `PlayerPrefs`**：系统只会自动同步这个 key。
- 如果你把存档写到其它 IndexedDB key/库表，**必须在开发者后台针对性配置**
  （数据库名 / 表名 / 缓存 Key），否则同步会缺失。
- 结论：Unity 项目优先用 `PlayerPrefs` 存进度，少折腾自定义存储。

```csharp
PlayerPrefs.SetInt("level", 3);
PlayerPrefs.Save();   // 不需要自己调 synchronizeToCloud
```

### 4.2 localStorage（H5 / Cocos / three.js）

- 正常用 `localStorage` 即可，SDK 会自动镜像非 `JOGOS` 前缀的 key。
- **唯一硬约束：必须等 `JogosSDK.init` 成功之后再访问 storage**。
  init 之前读存档会读到空数据或游客数据，造成"回档"。
- key 要稳定且带游戏前缀（如 `mygame.save.v1`），不要带时间戳/随机数。
- 体积有上限，只存必要进度；接近上限时控制台会 warning。
- 不要自己写上传队列，也不要高频 `synchronizeToCloud()`（≤1 次/分钟）。

```js
// ✅ 正确顺序
const info = await JogosSDK.init();
const save = JSON.parse(localStorage.getItem('mygame.save.v1') || '{}');

// ❌ 错误：init 之前就读
```

***

## 5. 内购（防丢单）

单机内购没有服务端兜底，客户端回调可能丢失，必须自己做预订单管理。
参考实现：[examples/cocos-demo/assets/scripts/jogos/PreOrderMgr.ts](../examples/cocos-demo/assets/scripts/jogos/PreOrderMgr.ts)。

核心做法：

1. **下单先落本地预订单**：`buyGoods` 返回订单号后立刻写入本地（`jogosPreOrders`），
   再等待支付结果；同一商品 20 秒内不允许重复下单。
2. **启动时对账**：`init` 后读本地预订单，并用 `getOrderList('success')` 拉取成功订单补发。
3. **轮询兜底**：每 5 秒对未完成的预订单调 `getOrderDetail(orderNo)`，
   防止 `subscribeOrderPaid` 通知丢失。
4. **业务发货成功后再确认**：只有业务发奖成功（`handler(order)` 返回 true），
   才调用 `deliverGoods(orderNo)` 并删除本地预订单；失败保留，下轮继续补。
5. `subscribeOrderPaid` 只作为"尽快发货"的快路径，不能当作唯一依据。
6. 发货后建议再触发一次云存档同步，避免道具到账但存档没更新。

***

## 6. 次要能力

以下能力接入频率极低，不在主流程里展开，需要时直接看官方文档与 SDK 接口：

| 能力           | 入口                                                                   |
| ------------ | -------------------------------------------------------------------- |
| 用户信息 / Token | `JogosSDK.user.getUser/getUserToken/getPublicKey`                    |
| 好友 / 邀请 / 聊天 | `game.isMyFriends/sendFriendRequest/openChatDialog/openInviteDialog` |
| 道具           | `gameItem.getUserGameItems/addGameItem/subtractGameItem/...`         |
| 成就           | `game.commitAchievementsData/openAchievementsDialog`                 |
| CDK          | `game.exchangePrizes`                                                |
| 分享           | `game.share`                                                         |
| 买断制          | `payment.buyOut`                                                     |

- 接口签名与回调：`.agents/skills/jogos-sdk-core/references/api.md`
- 官方文档：<https://docs.jogos.com/guide/sdk/introduction.html>
- Unity 参考场景：`Assets/_JogosSDK/Demo/JogosSDKDemo.unity`（不在 Build Settings）
- Cocos 参考工程：`examples/cocos-demo/`
