# Jogos SDK API 参考（HTML5 / jogos-sdk-v1.js）

> 来源：官方文档 <https://docs.jogos.com/guide/sdk/introduction.html> + 平台 Cocos 封装
> `examples/cocos-demo/assets/scripts/jogos/jogos-sdk.esm.ts`。
> 未在此列出的接口不要调用——SDK 内部实现会变，没写进文档的都不是契约。

## 目录

- [init / systemInfo](#init--systeminfo)
- [game](#game)
- [user](#user)
- [ad](#ad)
- [banner](#banner)
- [payment](#payment)
- [gameItem](#gameitem)
- [data（云存档）](#data云存档)
- [通用错误](#通用错误)

---

## init / systemInfo

```ts
init(engine?: string, ...args: any[]): Promise<SystemInfo>
```

- `engine`：Unity 传 `'Unity'`；Cocos 与 H5 可以不传（平台封装内部不传）。
- 成功返回 `SystemInfo`；失败抛异常。
- 未 init 调用其它方法 → `460 Can only be called after the successful call of the JOGOS_SDK.init method`。
- 只允许调用一次；重复调用会重复请求平台。

```ts
interface SystemInfo {
  gameId: number;
  hasGameGroup?: boolean;
  deviceType: 'desktop' | 'tablet' | 'mobile' | 'pc' | 'mobile'; // 官方文档与 TS 定义不完全一致，两个值都做兼容
  language: string;
  os: string;
  browser: string;
  serverTime: number;            // 服务器时间戳，用于校准
  bannerIntervalTime: number;    // banner 刷新间隔（秒）
  midgameIntervalTime: number;   // 插屏最低间隔（秒）
  gamePrice?: number;            // 买断价格
  invateArgs?: any;              // 邀请参数（官方拼写就是 invate）
  deviceId?: string | number;
  isRealEnv?: boolean;
  isApp?: boolean;
  isLogin?: boolean;
  touch?: boolean;
}
```

`invateArgs` 注意拼写：官方字段就是 `invateArgs`，不是 `inviteArgs`。

---

## game

```ts
game.loadingStart(): Promise<void>    // 推荐（非强制）：init 之后调用
game.loadingEnd(): Promise<void>      // 推荐（非强制）：首包+首场景加载完、玩家可操作时
game.pause(): Promise<void>
game.continuePlay(): Promise<void>
game.happytime(): Promise<void>                        // 庆祝动画，平台限流 1/3 分钟
game.synchronizeToCloud(): Promise<void>               // 手动云同步，限 1 次/分钟
game.commitRankingData(name: string, data: {[k:string]: number|string|Date}): Promise<void>
game.openRankingDialog(name?: string): Promise<void>
game.commitAchievementsData(name: string, progress: number, hidden: boolean): Promise<void>
game.openAchievementsDialog(): Promise<void>
game.exchangePrizes(cdkey: string): Promise<string>    // 返回 cdkeyId
game.share(data: GameShareArgs): Promise<void>
game.isMyFriends(userIds: number[]): Promise<{[userId:number]: boolean}>
game.sendFriendRequest(userId: number): Promise<boolean>
game.openChatDialog(userId: number): Promise<boolean>
game.openInviteDialog(args: { inviteArgs: string; customData?: string; expireTime?: number }): Promise<void>
```

- `commitRankingData` 的 `name` 与 `data` 字段必须和开发者后台配置**完全一致**；
  值只能是 number / string / Date，且排行榜只支持单精度数值。
- 成就：非分步成就 `progress` 传任意达成值即可；分步成就 `progress` = 步骤 id。
- `openInviteDialog` 的参数名是 `inviteArgs`（这里是 invite，注意与 systemInfo 的 `invateArgs` 区分）。

```ts
interface GameShareArgs {
  userName: string;
  userRoleId: string;
  serverId: string;
  shareType: 'game' | 'achievement' | 'activity';
  gameName: string;
  shareImage: string;
  dynamicContent: string;
  targetPlatform: string;
}
```

---

## user

```ts
user.getUser(): Promise<UserInfo>
user.getUserToken(): Promise<string>   // JWT，有效期 1 小时，不要在客户端解密
user.getPublicKey(): Promise<string>   // 可用 https://www.jogos.com/publicKey.json 校验
```

```ts
interface UserInfo {
  userId: string;
  username: string;
  profilePictureUrl: string;
  gameId: number;
  isuser?: boolean;   // true=登录用户, false=游客
}
```

- 未登录时会**自动弹登录/注册框**；取消或失败抛 401。
- 不要在游戏启动时强制 `getUser()` 阻塞主流程——游客也要能玩。

---

## ad

```ts
ad.requestAd(type: 'rewarded' | 'midgame', callbacks: RequestAdCallbacks): void
ad.getRewardAdCount(): Promise<number>
ad.hasAdblock(): Promise<boolean>
```

```ts
interface RequestAdCallbacks {
  onstarted?(): void;
  onfinished?(): void;
  onerror?(error: { code: number; message: string } | string): void;
}
```

语义：

| 事件 | 激励（rewarded） | 插屏（midgame） |
|---|---|---|
| `onstarted` | 可能被跳过 | 可能被跳过 |
| `onfinished` | 看完 → **发奖** | 正常结束 |
| `onerror` | **不发奖**（无填充/被拦截/超限） | 视为已结束，恢复游戏 |
| 频控 | 每用户每天约 50 次 | 约 60 秒一次 |
| 必要性 | 可选增值，必须有金币购买等替代方案 | 只在关卡结束/死亡时 |

- 错误码：`400` 超出广告数量限制；`500` Promise/频控错误。
- 插屏 onerror 可能传入空字符串，需兼容。
- 广告期间：暂停游戏、静音、锁交互；结束必须恢复。

---

## banner

```ts
banner.requestBanner(id: string, style?: Partial<CSSStyleDeclaration>): Promise<void>
banner.clearBanner(id: string): Promise<void>
banner.clearAllBanners(): Promise<void>
```

- **Unity / Cocos 不要直接调这组接口**：分别用 `JogosBanner` 组件/预制体、
  `JogosBannerUI` + `BannerUI.prefab`。Web 层 banner 不跟随引擎画布，
  尺寸变化必须由引擎侧同步，否则错位/遮挡。
- 只有 H5 / three.js / Phaser 等引擎之外的场景才用上面这组接口，
  并且要自己在 resize 后重新同步位置。
- `id` 必须与页面 DOM 容器 id 相同。
- 标准尺寸：728×90、300×250、320×50、468×60、320×100。
- 同时最多 2 个；同 id 60 秒内重复请求会抛 500。
- 容器需要有非零宽高；`display:none` 的容器不会显示。

---

## payment

```ts
payment.buyGoods(goodsId: string): Promise<string>    // 返回订单号
payment.buyOut(): Promise<string>                     // 买断，返回订单号
payment.getOrderDetail(orderNo: string): Promise<PaymentOrder>
payment.getOrderList(status?, pageNo?, pageSize?): Promise<PaymentOrder[]>
payment.deliverGoods(orderNo: string): Promise<void>
payment.subscribeOrderPaid(cb: (order: PaymentOrder) => void): Promise<void>
```

```ts
type OrderStatus =
  | 'pending' | 'fail' | 'cancel' | 'expire' | 'success'
  | 'refunding' | 'refunded' | 'refund-fail' | 'delivered';

interface PaymentOrder {
  gameId: number;
  gameName: string;
  userId: number;
  orderNo: string;
  productId: string;      // 部分封装写作 goodsId
  productName: string;    // 部分封装写作 goodsName
  currency: string;
  country: string;
  discount: number;
  calorcoin: number;
  paid: number;
  channel: string;
  paymentType: string;
  paymentNo: string;
  deliverGoods: boolean;
  status: OrderStatus;
  createTime: string;
  refundNo?: string;
  refundDescription?: string;
  refundTime?: string;
  refundedTime?: string;
}
```

流程（单机游戏）：

```js
// 1. 初始化后订阅一次
await JOGOS_SDK.payment.subscribeOrderPaid(async (order) => {
  if (order.status !== 'success') return;
  grantItems(order);                       // 2. 发奖
  await JOGOS_SDK.payment.deliverGoods(order.orderNo); // 3. 必须通知平台已发货
});
// 4. 启动时用 getOrderList('success') 对账，补发漏掉的订单
```

- `subscribeOrderPaid` 不保证 100% 到达，必须用订单列表/详情对账。
- 未调用 `deliverGoods` 会导致订单状态异常、重复提示。

---

## gameItem

```ts
gameItem.openBuyGameItemsDialog(level: number): Promise<GameItem[]>
gameItem.getUserGameItems(): Promise<GameItem[]>
gameItem.addGameItem(id: string, amount: number): Promise<GameItem[]>
gameItem.subtractGameItem(id: string, amount: number): Promise<GameItem[]>
gameItem.subscribeGameItemChange(cb: (items: GameItem[]) => void): Promise<void>
```

```ts
interface GameItem { id: string; amount: number; difference?: number }
```

- 道具 ID 由后台创建，创建后不可修改；先录入道具单元，再建商城商品。
- 消耗类操作要用本地记录去重，避免重复发放/扣减。

---

## data（云存档）

没有独立的方法空间，能力体现在存储钩子上：

| 引擎 | 后端 | 说明 |
|---|---|---|
| Unity | IndexedDB `/idbfs/{hash}` 与 `/idbfs/{hash}/PlayerPrefs` | 默认自动同步；**key 最好就是 `PlayerPrefs`**，其它 key 需后台配置 |
| H5 / Cocos | `localStorage` | 未配置缓存 Key 时同步全部内容；**必须在 init 成功后读写** |

- Unity：系统只自动同步 `PlayerPrefs` 这个 key。若把存档写到其它 IndexedDB key/库表，
  必须在开发者后台填写数据库名 / 表名 / 缓存 Key，否则同步缺失。
- H5 / Cocos：`localStorage` 正常用即可，但 `init` 之前读会拿到空/游客数据，表现为回档。
- SDK 会 monkey-patch `Storage.prototype.setItem/removeItem/clear`，
  用 `@sdk/cache` 把非 `JOGOS` 前缀的 key 镜像到宿主。
- 写入去抖 1 秒；极端情况最长 30 秒。
- 手动触发只有 `game.synchronizeToCloud()`，限 1 次/分钟，不要高频调用。
- 有体积上限，接近上限时控制台会 warning；超限后不再备份。
- 提审表单必须选择"使用 JogosSDK 的数据模块"。

---

## 通用错误

```js
try {
  await JOGOS_SDK.user.getUser();
} catch (err) {
  // err 可能是字符串、Error、或 {code, message}
}
```

- 统一用 `String(err)` / `err.message || err` 兜底展示。
- 不要因为单个可选模块报错而中断游戏启动：广告、排行、支付都应可降级。
- 必接模块只有 `init` / `loadingStart` / `loadingEnd`。
