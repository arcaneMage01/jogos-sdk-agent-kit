# Jogos SDK 接入踩坑清单

格式：**现象 → 原因 → 修法**。带 💥 的是提审/线上高频事故。

***

## 一、生命周期

> `loadingStart` / `loadingEnd` **已不再强制**。本节 3\~5 条只适用于你选择接入加载上报的情况；
> 推荐节奏是：`init` 之后 `loadingStart`，首包 + 首场景加载完再 `loadingEnd`。

### 1. 💥 一进游戏就报 `460 Can only be called after the successful call of the JOGOS_SDK.init method`

**现象**：控制台第一条 SDK 日志就是 460，广告/存档全挂。
**原因**：`init()` 是异步的，`loadingStart`、`getUser`、`requestAd` 在它 resolve 之前被调用。
**修法**：所有 SDK 调用排在 `await init()` 之后；封装一个 `ready` Promise 统一前置。

```js
const ready = JOGOS_SDK.init();
const startLoading = async () => { await ready; return JOGOS_SDK.game.loadingStart(); };
```

### 2. `init` 被调用多次 / 返回 `null`

**现象**：平台收到多次 init；页面刷新/场景重进时更明显。
**原因**：每个场景脚本都在 `onLoad` 里 init。
**修法**：单例 + 缓存 Promise。参考 `examples/cocos-demo/assets/scripts/jogos/JogosSDK.ts` 的做法：

```ts
private _sdk; // 非空即为进行中/已完成
async init() {
  if (this._cached) return this._cached;
  if (this._sdk) return null;      // 进行中，忽略重复调用
  this._sdk = await loadSdk();
  this._cached = await this._sdk.init();
  return this._cached;
}
```

### 3. 漏掉 `loadingStart` / `loadingEnd`（可选，不影响接入）

**现象**：平台后台看不到加载耗时。
**原因**：只接了 `init`。
**修法**：加载上报已不再是强制项。如果你想上报，推荐 `init` 后 `loadingStart`，
首包 + 首场景加载完再 `loadingEnd`（)。

### 4. 💥 `loadingEnd` 调用过早

**现象**：线上进入游戏后黑屏/白屏 1\~2 秒，玩家以为卡死。
**原因**：用 `createUnityInstance` 完成、首帧渲染、场景 `Start` 当作可玩信号。
**修法**：用"游戏画面/HUD 真正出现"或"玩家输入已响应"作为信号；宁晚勿早。

### 5. `loadingEnd` 调用过晚

**现象**：玩家已经玩了几十秒，平台统计的加载时长仍然很长。
**原因**：把 loadingEnd 写在教程结束/首关开始。
**修法**：进入主菜单或首关可操作时立即调用。

***

## 二、广告

### 6. 💥 依赖 `onstarted → onfinished` 的固定时序

**现象**：某些情况下奖励永远发不出去，或广告刚弹出就判定结束。
**原因**：平台可能**跳过 onstarted 直接 onfinished**。
**修法**：只把 `onfinished` 当成功；状态机不要以 `onstarted` 为前置条件。

### 7. 💥 `onerror` 里也发奖

**现象**：无填充/广告拦截时玩家白拿奖励，提审被拒。
**原因**：为了"体验好"在 error 分支也发奖。
**修法**：`onerror` 一律不发奖；提示"广告暂时不可用，稍后再试"，并提供金币购买等替代方案。

### 8. 💥 广告期间游戏没暂停 / 没静音（H5 必踩）

**现象**：广告播放时游戏音效继续响、角色继续跑；审核拒绝。
**原因**：Cocos/Unity 专属 SDK 会自动 pause，**HTML5 版不会**。
**修法**：请求广告前暂停并静音，`onfinished`/`onerror` 后恢复。`shared/jogos-bridge.js` 已内置。

### 9. 广告期间按钮还能点，触发重复请求

**现象**：连点"看广告"报 `500`，或者连续弹两次广告。
**原因**：没有 in-flight 锁。
**修法**：请求开始置 `adInFlight=true` 并禁用按钮，回调里释放。

### 10. 💥 插屏报 `500 At least a N second interval is required...`

**现象**：关卡切换时偶尔报错。
**原因**：同一玩家 60 秒内请求了多次插屏。
**修法**：本地也做冷却（拿 `systemInfo.midgameIntervalTime`），超时直接跳过；
不要用"每次死亡/每次切场景"无条件请求。

### 11. 插屏时机违规

**现象**：提审被拒"广告打断游戏进程"。
**原因**：在按钮点击、战斗中、菜单导航时弹插屏。
**修法**：只允许关卡切换、玩家死亡、地图加载。**不要在关卡开始时播**（应在上一关结束时）。

### 12. 激励广告没有替代方案 / 没有冷却

**现象**：被拒"强迫观看"。
**原因**：奖励只能看广告获得，且按钮频繁弹出。
**修法**：提供金币购买等替代；按钮加冷却倒计时或每日次数，失败时提示"稍后再试"。

### 13. 激励广告每日上限没处理

**现象**：玩家点击后毫无反应。
**原因**：超过每日 50 次，SDK 直接报错，游戏没提示。
**修法**：启动或关键节点用 `ad.getRewardAdCount()`；到 0 时隐藏/置灰按钮并说明原因。

***

## 三、Banner

### 14. 💥 Banner 不显示

**现象**：`requestBanner` 成功但没有广告。
**原因**：容器没有宽高（`div` 默认 0 高）、`display:none`、被父元素裁剪。
**修法**：给容器写死标准尺寸之一（300×250 / 320×50 / 728×90 / 468×60 / 320×100）。

### 15. 同时超过 2 个 banner

**现象**：抛 `500 At most two banners can be displayed at the same time`。
**原因**：多个界面各挂了一个 banner 组件，切场景没清。
**修法**：全局只保留 1~2 个容器，切界面时 `clearBanner`。

### 16. 同 id 60 秒内重复请求

**现象**：`500 The time for each call to method requestBanner cannot exceed ...`。
**原因**：每次界面显示都重新 `requestBanner`。
**修法**：同 id 只在"首次显示/尺寸变化"时请求，其余复用；本地加 60s 频控。

### 17. Banner 挡住了操作区

**现象**：审核拒绝"广告遮挡 UI"。
**原因**：容器放在拇指/摇杆/按钮区域。
**修法**：放在平均停留 ≥20 秒的界面空白处，移动端优先底部安全区外；实机截图确认。

### 18. 用 Canvas 自绘"假 banner"占位

**现象**：平台无法投放真实广告，等于没接。
**原因**：以为是游戏内贴图。
**修法**：必须用 **DOM 容器** + `banner.requestBanner(id)`，引擎内节点只能用来定位。

***

## 四、存档 / 云同步

### 19. 💥 自己写云同步，和 SDK 双写

**现象**：存档偶发回档、重复同步、平台侧数据抖动。
**原因**：SDK 已 hook `localStorage`，又在业务里调用 `synchronizeToCloud` / 自建队列。
**修法**：用稳定 localStorage key，交给 SDK 自动镜像；只保留一个同步源。

### 20. 高频调用 `synchronizeToCloud`

**现象**：平台限流；存档上传排队。
**原因**：每次存档/每关都调。
**修法**：≤1 次/分钟；很多场景根本不需要手动调。

### 21. 存档 key 不稳定

**现象**：每次进入都是新档。
**原因**：key 里带时间戳、随机数、`version` 大写不一致。
**修法**：`<game>.<slot>.v1` 这种固定格式；版本升级用迁移函数，不要换 key。

### 22. 存档超过体积限制

**现象**：控制台 warning，之后不再备份。
**原因**：把整个关卡/回放/日志塞进 localStorage。
**修法**：只存必要进度；在后台配置缓存 Key，只同步指定 key。

### 23. 启动强依赖 `getUser()`

**现象**：游客/网络异常时游戏卡在登录，进不去。
**原因**：把用户信息当成必选项。
**修法**：`getUser` 失败走游客流程；只有排行榜/内购等模块才要求登录。

***

## 五、时间 / 兼容性 / 联调

### 24. 用本地 `Date.now()` 做活动倒计时

**现象**：改系统时间就能刷活动奖励。
**原因**：没有用服务器时间校准。
**修法**：`offset = systemInfo.serverTime - Date.now()`，之后统一用 `Date.now() + offset`。

### 25. 移动端长按选中 / 右键菜单 / 页面滚动

**现象**：手机上长按弹出选择框、双指缩放、滑动页面把游戏拖走。
**原因**：缺少基础 CSS 与事件拦截。
**修法**：

```css
body { -webkit-user-select: none; user-select: none; overscroll-behavior: none; }
```

```js
window.addEventListener('wheel', e => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());
```

### 26. 用 `file://` 或带缓存的静态服务器调试

**现象**：改完代码刷新没变化；SDK 行为不对。
**原因**：浏览器缓存 / 非 HTTP 协议。
**修法**：用仓库的 `python tools/serve.py`（自带 `Cache-Control: no-store`）。

### 27. 在 localhost 验证广告效果

**现象**：本地能看到"广告"，上线却没有；或 QA 环境完全没广告。
**原因**：localhost 是模拟广告；QA 预览环境在正式上线前**主动禁用广告**。
**修法**：广告表现只在开发者后台 QA 工具/真实链路验证；本地只验证流程与回调。

### 28. 暂停/恢复不成对

**现象**：切后台回来游戏卡死、时间不流动。
**原因**：blur 调了 `pause`，focus 没调 `continuePlay`；或加载期间收到 blur 把引擎冻住。
**修法**：`hostPaused` 标志成对调用；**loadingEnd 之前的 blur 一律忽略**。
另外部分浏览器切标签页不派发 `window.blur/focus`，要用 `document.visibilitychange` 兜底
（hidden 暂停、visible 恢复），不要只押注 blur/focus。

### 29. 买断制游戏首场景没 init

**现象**：盗版可玩；或购买后无法切换正式版。
**原因**：在第二个场景才初始化。
**修法**：第一个启动场景完成 init 并等待回调，再执行第一行游戏逻辑；试玩版/正式版版本号保持一致。

### 30. 接入第三方广告 SDK

**现象**：直接拒审、无反馈。
**原因**：想补充广告收益。
**修法**：只允许 Jogos SDK 的广告；移除所有第三方广告 SDK 与推广链接。

***

## 六、Banner 与云存档（引擎差异）

### 31. 💥 在 Unity / Cocos 里直接用 H5 的 `banner.requestBanner`

**现象**：分辨率变化后 banner 错位、被拉伸、遮挡 UI；同一位置刷新报 500。
**原因**：Web 层 banner 不跟随引擎画布，页面不知道游戏内布局变了。
**修法**：

- Unity 用 `JogosBanner` 预制体/组件（`Resources/JogosBanner.prefab`）；
- Cocos 用 `JogosBannerUI` + `BannerUI.prefab`；
- 只有 H5 / three.js / Phaser 等引擎之外才用 H5 API，并自己处理 resize 同步。

### 32. 💥 Unity 云存档换了 `PlayerPrefs` 之外的 key

**现象**：本地有存档，换设备/清缓存后进度丢失。
**原因**：SDK 只会自动同步 `/idbfs/{hash}` 与 `/idbfs/{hash}/PlayerPrefs`；
其它 IndexedDB key 没在开发者后台配置，等于没同步。
**修法**：Unity 优先用 `PlayerPrefs` 存进度；确需自定义存储时，
在后台填写数据库名 / 表名 / 缓存 Key。

### 33. 💥 `localStorage` 在 `init` 之前读取

**现象**：启动读到空档或游客档，再保存后覆盖云端进度，表现为回档。
**原因**：`init` 还没把云存档灌回 localStorage，此时读到的是本地旧值/空值。
**修法**：所有 storage 读写都放在 `init` 成功之后；加载场景里先等 init 再读档。
