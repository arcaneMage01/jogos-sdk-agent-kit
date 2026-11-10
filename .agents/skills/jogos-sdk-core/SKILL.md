---
name: jogos-sdk-core
description: Jogos 平台 SDK（HTML5 版 jogos-sdk-v1.js）的通用接入契约。凡是涉及 Jogos / JOGOS_SDK / jogos-sdk-v1.js / 平台广告 / 激励视频 / 插屏 / banner / 云存档 / 排行榜 / 成就 / 内购 / CDK 接入、或排查 460、500 广告频控、存档不同步问题时，先读本技能。适用于 H5、Cocos、three.js、Phaser、Construct、PlayCanvas 等所有 Web 引擎；Unity 专属 SDK 走 jogos-unity 技能。
---

# Jogos SDK 通用接入契约（Web / HTML5）

本技能只讲**协议与语义**，与引擎无关。具体引擎请配合：

| 引擎 | 技能 |
|---|---|
| 原生 H5 / Canvas / Phaser / Construct | `jogos-h5-integration` |
| Cocos Creator 2.x / 3.x | `jogos-cocos-integration` |
| three.js / PlayCanvas / Babylon | `jogos-threejs-integration` |
| Unity WebGL | 下一阶段 |

## 0. 先选实现方式

- **H5 / three.js / 其它 Web 引擎** → 引入 `jogos-sdk-v1.js`，或直接用仓库的
  `shared/jogos-bridge.js`（已封装好生命周期、暂停、广告频控、存档）。
- **Cocos Creator** → 优先用平台提供的 `JogosSDK.ts` + `jogos-sdk.esm.ts`
  （见 `examples/cocos-demo/assets/scripts/jogos/`）。
- 不要自己重新发明封装；先复用，再裁剪。

## 1. 加载 SDK

```html
<script src="https://www.jogos.com/sdk/jogos-sdk-v1.js"></script>
```

- 已经在内嵌域名（`*.jogos*.com`）时，官方 Cocos 封装使用
  `//www<host>/sdk/jogos-sdk-v1.js`，其余环境回退 `https://sdk.jogosfans.com/jogos-sdk-v1.js`。
- 两种写法都可接受；**不要硬编码一个会 404 的内网地址**。
- 本地 `localhost` 下 SDK 会自己模拟广告，不需要额外 mock。只有脚本完全加载不到时
  才用 `?mock=1` 做离线兜底，**mock 结果不能作为验收依据**。

## 2. 启动流程（loading 上报是推荐项，不是强制项）

```js
const info = await window.JOGOS_SDK.init();  // 必须先 await 完成
await window.JOGOS_SDK.game.loadingStart();  // 推荐：init 之后通知开始加载
// ... 首包 + 首场景加载 ...
await window.JOGOS_SDK.game.loadingEnd();    // 推荐：玩家可操作时
```

- `init` 之前调用任何接口 → 抛 `460 Can only be called after the successful call of the JOGOS_SDK.init method`。
- `init` 只调用一次。重复调用会重复请求平台，务必自己缓存 Promise / 单例。
- **`loadingStart` / `loadingEnd` 已不再强制**：不接入不会导致接入失败；
  接入时才是"init 后 `loadingStart`，首包+首场景加载完 `loadingEnd`"。
- 如果接入 `loadingEnd`，必须是"玩家可操作"的信号；首帧渲染、场景 `Start`、模型加载完成都偏早。
- 买断制游戏：必须在**第一个启动场景**完成 init 并等待回调，否则盗版检测失效。

## 3. 能力模块

| 模块 | 用途 | 关键接口 |
|---|---|---|
| `game` | 加载/暂停/欢乐时光/排行/成就/分享/邀请 | `loadingStart` `loadingEnd` `pause` `continuePlay` `happytime` `commitRankingData` `openRankingDialog` `commitAchievementsData` `openAchievementsDialog` `exchangePrizes` `share` |
| `user` | 登录用户 | `getUser` `getUserToken` `getPublicKey` |
| `ad` | 视频广告 | `requestAd('rewarded'\|'midgame', callbacks)` `getRewardAdCount` `hasAdblock` |
| `banner` | 横幅 | `requestBanner(id, style)` `clearBanner(id)` `clearAllBanners` |
| `payment` | 内购/买断 | `buyGoods` `buyOut` `getOrderDetail` `getOrderList` `deliverGoods` `subscribeOrderPaid` |
| `gameItem` | 道具 | `getUserGameItems` `addGameItem` `subtractGameItem` `openBuyGameItemsDialog` `subscribeGameItemChange` |
| `data` | 云存档 | 由 SDK 自动镜像 localStorage / idbfs，手动入口是 `game.synchronizeToCloud` |

完整签名与类型：`references/api.md`。

## 4. 广告语义（最容易出事）

```js
const cb = {
  onstarted:  () => {},        // 可能被跳过
  onfinished: () => {},        // 唯一可发奖的信号
  onerror:    (e) => {},       // 不发奖；e 可能是 {code,message} 或字符串
};
window.JOGOS_SDK.ad.requestAd('rewarded', cb);  // 激励
window.JOGOS_SDK.ad.requestAd('midgame', cb);   // 插屏
```

硬规则：

1. **只在 `onfinished` 发奖**；`onerror` 不发。平台会检查"广告关闭了但奖励发了"。
2. 不要假设 `onstarted` 一定先到；存在直接 `onfinished` 的路径。
3. 广告期间必须**暂停游戏 + 静音**，并屏蔽交互直到 `onfinished`/`onerror`。
   Cocos/Unity 专属 SDK 会代劳；**H5 必须自己实现**。
4. 同一时刻只能有一个广告请求：用 in-flight 锁，否则重复点击会触发平台报错。
5. 插屏最低间隔一般 60 秒，频繁调用抛
   `500 At least a ${time} second interval is required to display new advertisements`。
6. 激励广告一般每用户每天上限 50 次，超限抛
   `500 You can only watch up to ${max} rewarded ads per day`；用 `getRewardAdCount()` 提前隐藏按钮。
7. 播放入口：插屏只在**关卡结束/死亡/地图加载**；禁止在导航按钮、战斗、买断购买页触发。
8. 广告拦截：允许玩家继续玩，只能温和限制增值功能，并在受限处标注
   "因使用广告拦截器，此功能暂不可用"；不要全屏弹窗。

## 5. Banner 规则

```js
await window.JOGOS_SDK.banner.requestBanner('banner-container'); // id 必须等于 DOM 容器 id
await window.JOGOS_SDK.banner.clearBanner('banner-container');
await window.JOGOS_SDK.banner.clearAllBanners();
```

- 容器必须有明确宽高，标准尺寸只有 5 种：
  728×90 / 300×250 / 320×50 / 468×60 / 320×100。
- 同时最多 2 个 banner；同一 id 再次请求视为刷新，**60 秒内重复请求会抛 500**。
- 位置不能遮挡任何 UI/按钮，且所在界面平均停留 ≥ 20 秒。
- 本地测试不展示真实广告，只能去开发者后台 QA 预览环境看效果。

## 6. 存档规则

- 使用**稳定、带游戏前缀**的 localStorage key（例如 `mygame.save.v1`）。
  SDK 会自动把非 `JOGOS` 前缀的 key 镜像到云端，**不需要你写同步逻辑**。
- 不要自己维护上传队列，也不要高频调用 `synchronizeToCloud()`（限 1 次/分钟，
  SDK 内部还有 1 秒去抖）。只有"存档不走 localStorage"或"需要强制检查点"时才手动调。
- 存档有体积上限；控制台出现接近上限的 warning 时必须精简 key。
- 游客也能存；用户登录后 SDK 会把本地存档迁移到账号下，退出再回退游客数据。
- 提审时"游戏保存进度的方式"表单必须选择使用 Jogos SDK 数据模块，否则云存档被禁用。

## 7. 时间 / 设备 / 语言

- 所有活动倒计时用 `systemInfo.serverTime` 校准，不要直接用 `Date.now()`：

```js
const offset = systemInfo.serverTime - Date.now();
const now = () => Date.now() + offset;
```

- 用 `deviceType`（`desktop` / `tablet` / `mobile`）切换操作提示；
  用 `language` 切本地化；用 `bannerIntervalTime` / `midgameIntervalTime` 控制广告节奏。

## 8. 常见错误码

| 错误 | 含义 | 处理 |
|---|---|---|
| `460 Can only be called after ... init` | init 未完成就调接口 | 所有调用前置 await init |
| `401 未授权` | 用户未登录/被冻结 | 捕获后继续游客流程，不要卡死 |
| `500 At least a N second interval ...` | 广告频控 | 本地也做冷却，忽略该次请求 |
| `500 You can only watch up to N rewarded ads per day` | 每日上限 | 隐藏按钮，提示明天再来 |
| `500 At most two banners ...` | banner 超量 | 同时最多 2 个 |
| `500 The time for each call to method requestBanner cannot exceed ...` | banner 刷太快 | 60s 后再刷新 |

## 9. 验收

```bash
python tools/verify_integration.py <构建目录>
```

再按 `docs/acceptance.md` 人工过一遍：加载遮罩 → 可玩 → 暂停/恢复 → 广告 → 存档往返 → 无 `Uncaught`。

## 参考

- `references/api.md` — 全量接口、类型、回调语义
- `references/pitfalls.md` — 踩坑速查（27 条）
- `../../../docs/quickstart.md` — 分引擎接入路线
- `../../../examples/` — 三个可运行工程
