---
name: jogos-cocos-integration
description: 把 Jogos SDK 接入 Cocos Creator 2.x / 3.x 游戏。当任务涉及 Cocos 工程接入平台广告、云存档、banner 节点、暂停遮罩、JogosSDK.ts / jogos-sdk.esm.ts、或 Cocos 构建 web-mobile 上传时使用。原生 H5 用 jogos-h5-integration。
---

# Cocos Creator 接入 Jogos SDK

Cocos 使用平台提供的专属 TS 封装，**不要**自己写 `JOGOS_SDK.init` 裸调用。
先读 `jogos-sdk-core` 了解通用契约。

## 1. 拷贝封装

把下面文件从 `examples/cocos-demo/assets/scripts/jogos/` 拷到你工程的 `assets/scripts/jogos/`：

| 文件 | 作用 |
|---|---|
| `jogos-sdk.esm.ts` | 动态加载 `jogos-sdk-v1.js` + 全量类型定义（含 CDN 兜底） |
| `JogosSDK.ts` | 单例封装：init 去重、loading、pause/resume、暂停遮罩、banner 节点换算、toast |
| `view/JogosBannerUI.ts` | banner 挂节点组件 |
| `PreOrderMgr.ts` | 订单订阅 / 补发 / 发货 |
| `OrderMgr.ts` | 订单管理（工程里只有 meta 的按需自行补） |

Banner 预制体：`examples/cocos-demo/assets/resources/prefab/BannerUI.prefab`。

## 2. 首个场景接入

```ts
import JogosSDK from './jogos/JogosSDK';

async onLoad() {
  const systemInfo = await JogosSDK.init();   // 必须最先，且 await
  if (!systemInfo) return;                    // 进行中/重复调用会返回 null

  await JogosSDK.loadingStart();              // 推荐（非强制）：init 之后

  // ... 首包 + 首个场景加载 ...

  await JogosSDK.loadingEnd();                // 推荐（非强制）：玩家可操作后
  // 进入主菜单/开始游戏
}
```

`init` 的顺序是硬约束；loading 上报是推荐项，不接也不会导致接入失败。
如果接入 `loadingEnd`，不要放在 `start()` 里，放在"loading 界面关闭、玩家可操作"的时刻。

## 3. 广告

```ts
JogosSDK.requestAd('rewarded', {
  onstarted: () => {},
  onfinished: () => { /* 只在 onfinished 发奖 */ },
  onerror: (err) => { /* 不发奖 */ },
});
```

封装已在内部处理：

- `onstarted` → `onBlur()`（暂停 + 遮罩）
- `onfinished` → `onFocus()`（恢复）
- `onerror` → 恢复 + toast（`error` 可能是字符串或 `{code,message}`）

所以**不要**在业务层再调一次 `pause/continuePlay`，否则会重复暂停。

插屏只在关卡结束/死亡时调用；60 秒内重复请求平台会报 500。

## 4. Banner

> **不要**在 Cocos 里直接调 H5 的 `banner.requestBanner`。Web 层广告不跟随 Cocos 画布，
> 分辨率变化后需要引擎侧同步位置，组件已经处理了这件事。

1. 把 `BannerUI.prefab` 拖进场景，放到不遮挡操作区的位置，设好节点宽高。
2. 组件会自动在 `onEnable` 里等 SDK init 完成后 `requestBannerWithNode(node)`。
3. 窗口 resize 会自动 `refreshBanner(true)` 更新位置。
4. `onDisable` 自动 `clearBanner`。

注意：

- 位置换算用 `node.getBoundingBoxToWorld()` + `canvas.getBoundingClientRect()`，
  **已经在内部乘过 DPR，不要再乘一次**。
- 构建版才有 60s 本地频控；开发版无频控属于预期。
- `developer.jogos*` 域名下会显示节点自带占位图，方便对位。

## 5. 引擎侧注意点

- `JogosSDK.onBlur()` 会调 `cc.game.pause()`；`CC_DEV` 下跳过，避免调试时被冻住。
- **`loadingEnd` 之前的 blur 被忽略**，防止加载阶段 `cc.game.pause()` 后 focus 丢失导致整局卡死。
- 暂停遮罩会挂到 `GameDiv / Cocos3dGameContainer / Cocos2dGameContainer /
  layaContainer / egret-player` 中第一个存在的容器，都没有则回退 canvas 父节点；
  会把容器临时设为 `position: relative`。
- 2.x 项目：`jogos-sdk.esm.ts` 与 `JogosSDK.ts` 的 API 同样可用，
  但 `requestBannerWithNode` 里 `_uiProps` 分支是 3.x 专用，2.x 会走 `getBoundingBoxToWorld`。
- 不要在 `onLoad` 里调用 `cc.game.pause()` 来模拟暂停；平台侧只认 `JogosSDK.pause()`。

## 6. 构建与上传

1. 构建发布 → **Web Mobile** → `build/web-mobile/`
2. 整个目录打包 zip（含 `index.html`、`cocos-js/`、`assets/`、`src/`）
3. 开发者后台 → 上传游戏 → 首次上传后可用 QA 预览环境验证真实广告
4. 首包 ≤50MB（PC）/ ≤25MB（移动）；超出时用远程资源/分包

## 7. 自测

```bash
python tools/serve.py --root examples/cocos-demo/build   # 构建产物目录
```

- [ ] 预览/构建后 `loadingStart` 与 `loadingEnd` 各一次
- [ ] 切窗口：游戏暂停 + 遮罩；切回恢复
- [ ] 看广告前后游戏状态正确，不重复弹窗
- [ ] banner 位置随窗口变化，且不挡按钮
- [ ] 存档重开仍在
- [ ] 控制台无 `Uncaught`、无 `460`

## 参考实现

- 完整工程：`examples/cocos-demo/`（Cocos Creator 3.8.7）
- 入口脚本：`examples/cocos-demo/assets/scripts/JogosSDKDemo.ts`
- 官方文档：<https://docs.jogos.com/guide/sdk/introduction.html>
