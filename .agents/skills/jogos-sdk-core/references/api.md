# Jogos SDK API Reference (HTML5 / jogos-sdk-v1.js)

> Sources: official docs <https://docs.jogos.com/guide/sdk/introduction.html> and the platform
> Cocos wrapper `examples/cocos-demo/assets/scripts/jogos/jogos-sdk.esm.ts`.
> Do not call anything not listed here. Internal SDK details change; undocumented APIs are not contract.

## Contents

- [init / systemInfo](#init--systeminfo)
- [game](#game)
- [user](#user)
- [ad](#ad)
- [banner](#banner)
- [payment](#payment)
- [gameItem](#gameitem)
- [data (cloud save)](#data-cloud-save)
- [Common errors](#common-errors)

---

## init / systemInfo

```ts
init(engine?: string, ...args: any[]): Promise<SystemInfo>
```

- `engine`: pass `'Unity'` for Unity. Cocos and H5 usually omit it (the platform wrapper does not pass it).
- Resolves with `SystemInfo`; rejects on failure.
- Calling other methods before init throws
  `460 Can only be called after the successful call of the JOGOS_SDK.init method`.
- Call it only once; duplicate calls hit the platform again.

```ts
interface SystemInfo {
  gameId: number;
  hasGameGroup?: boolean;
  deviceType: 'desktop' | 'tablet' | 'mobile' | 'pc' | 'mobile'; // docs and TS types differ; accept both
  language: string;
  os: string;
  browser: string;
  serverTime: number;            // server timestamp, use it to calibrate
  bannerIntervalTime: number;    // banner refresh interval (seconds)
  midgameIntervalTime: number;   // interstitial minimum interval (seconds)
  gamePrice?: number;            // buy-out price
  invateArgs?: any;              // invite args (official spelling is "invate")
  deviceId?: string | number;
  isRealEnv?: boolean;
  isApp?: boolean;
  isLogin?: boolean;
  touch?: boolean;
}
```

Mind the spelling: the official field is `invateArgs`, **not** `inviteArgs`.

---

## game

```ts
game.loadingStart(): Promise<void>    // recommended (not mandatory): call after init
game.loadingEnd(): Promise<void>      // recommended (not mandatory): when the player can act
game.pause(): Promise<void>
game.continuePlay(): Promise<void>
game.happytime(): Promise<void>                        // celebration; platform limit 1 per 3 minutes
game.synchronizeToCloud(): Promise<void>               // manual cloud sync, 1 per minute
game.commitRankingData(name: string, data: { [dataType: string]: number|string|Date }): Promise<void>
game.openRankingDialog(name?: string): Promise<void>
game.commitAchievementsData(name: string, progress: number, hidden: boolean): Promise<void>
game.openAchievementsDialog(): Promise<void>
game.exchangePrizes(cdkey: string): Promise<string>    // returns cdkeyId
game.share(data: GameShareArgs): Promise<void>
game.isMyFriends(userIds: number[]): Promise<{[userId:number]: boolean}>
game.sendFriendRequest(userId: number): Promise<boolean>
game.openChatDialog(userId: number): Promise<boolean>
game.openInviteDialog(args: { inviteArgs: string; customData?: string; expireTime?: number }): Promise<void>
```

- `commitRankingData`: the first argument is the leaderboard name configured in the developer console;
  the second is `{ dataType: value }` where **the key is the configured data type**
  (e.g. `number`, `time`, or a custom key) and the value is the actual value:

  ```js
  await JOGOS_SDK.game.commitRankingData('HighScore', { "number": 1200 });
  ```

  Values may only be number / string / Date, and leaderboards support single-precision numbers only.
  Both the leaderboard name and the data type must match the console exactly.
- Achievements: for non-staged achievements pass any reached value as `progress`;
  for staged achievements `progress` is the stage id.
- `openInviteDialog` uses `inviteArgs` (note the difference from `systemInfo.invateArgs`).

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
user.getUserToken(): Promise<string>   // JWT, valid for 1 hour, do not decode on the client
user.getPublicKey(): Promise<string>   // verify with https://www.jogos.com/publicKey.json
```

```ts
interface UserInfo {
  userId: string;
  username: string;
  profilePictureUrl: string;
  gameId: number;
  isuser?: boolean;   // true = signed-in user, false = guest
}
```

- When not signed in, a **login/signup dialog opens automatically**; cancel or failure throws 401.
- Do not block the main flow with `getUser()` at startup — guests must be able to play.

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

Semantics:

| Event | Rewarded | Interstitial (midgame) |
|---|---|---|
| `onstarted` | may be skipped | may be skipped |
| `onfinished` | watched → **grant reward** | finished normally |
| `onerror` | **no reward** (no fill / blocked / capped) | treat as finished, resume the game |
| Rate limit | ~50 per user per day | ~once every 60 s |
| When required | optional value-add; always provide a coin-purchase alternative | only on level end / death |

- Error codes: `400` ad count limit exceeded; `500` promise / rate-limit errors.
- Interstitial `onerror` may pass an empty string; handle it.
- During an ad: pause the game, mute audio, block input; always restore afterwards.

---

## banner

```ts
banner.requestBanner(id: string, style?: Partial<CSSStyleDeclaration>): Promise<void>
banner.clearBanner(id: string): Promise<void>
banner.clearAllBanners(): Promise<void>
```

- **Unity / Cocos must not call these directly**: use the `JogosBanner` component/prefab and
  `JogosBannerUI` + `BannerUI.prefab` respectively. A web-layer banner does not follow the engine
  canvas, so size changes must be synced by the engine, otherwise it drifts or covers UI.
- Only engines other than Cocos/Unity (H5 / three.js / Phaser) use these APIs, and they must
  re-sync the position after every resize.
- `id` must equal the page DOM container id.
- Standard sizes: 728×90, 300×250, 320×50, 468×60, 320×100.
- At most 2 at once; requesting the same id twice within 60 s throws 500.
- The container must have non-zero width/height; `display:none` containers do not show.

---

## payment

```ts
payment.buyGoods(goodsId: string): Promise<string>    // returns order number
payment.buyOut(): Promise<string>                     // buy-out, returns order number
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
  productId: string;      // some wrappers call it goodsId
  productName: string;    // some wrappers call it goodsName
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

Flow (standalone games):

```js
// 1. Subscribe once after init
await JOGOS_SDK.payment.subscribeOrderPaid(async (order) => {
  if (order.status !== 'success') return;
  grantItems(order);                       // 2. Grant items
  await JOGOS_SDK.payment.deliverGoods(order.orderNo); // 3. Always tell the platform it was delivered
});
// 4. On startup, reconcile with getOrderList('success') and re-grant missed orders
```

- `subscribeOrderPaid` is not guaranteed to arrive; reconcile with order list/detail.
- If you skip `deliverGoods`, order status becomes inconsistent and prompts repeat.

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

- Item ids are created in the console and cannot be changed afterwards; create item units first,
  then store products.
- Deduplicate consumption locally to avoid double grant/deduct.

---

## data (cloud save)

There is no dedicated method namespace; the capability lives in storage hooks:

| Engine | Backend | Notes |
|---|---|---|
| Unity | IndexedDB `/idbfs/{hash}` and `/idbfs/{hash}/PlayerPrefs` | Auto-synced by default; **use `PlayerPrefs` as the key**, other keys need console config |
| H5 / Cocos | `localStorage` | Syncs everything when no cache key is configured; **read/write only after init** |

- Unity: only the `PlayerPrefs` key is synced automatically. Saves written to other IndexedDB
  keys/databases must declare database name / table / cache key in the developer console,
  otherwise sync is silently incomplete.
- H5 / Cocos: `localStorage` works normally, but reading before `init` returns empty/guest data,
  which looks like a rollback.
- The SDK monkey-patches `Storage.prototype.setItem/removeItem/clear` and mirrors keys without the
  `JOGOS` prefix to the host via `@sdk/cache`.
- Writes are debounced by 1 s, and 30 s in the worst case.
- Manual trigger is only `game.synchronizeToCloud()`, limited to once per minute.
- There is a size limit; the console warns when close, and nothing is backed up once exceeded.
- The submission form must select "use the JogosSDK data module".

---

## Common errors

```js
try {
  await JOGOS_SDK.user.getUser();
} catch (err) {
  // err may be a string, an Error, or {code, message}
}
```

- Always render with `String(err)` / `err.message || err`.
- Never abort game startup because an optional module failed: ads, ranking and payment must degrade gracefully.
- Only `init` / `loadingStart` / `loadingEnd` are part of the mandatory flow.
