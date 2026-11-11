---
name: jogos-h5-integration
description: 把 Jogos SDK 接入原生 H5 / Canvas / Phaser / Construct / GDevelop 等非 Unity、非 Cocos 的 Web 游戏。当任务涉及 index.html 引入 jogos-sdk-v1.js、HTML5 游戏接平台广告/云存档/banner、或排查 H5 接入的加载与暂停问题时使用。Cocos 用 jogos-cocos-integration，three.js 用 jogos-threejs-integration。
---

# H5 游戏接入 Jogos SDK

先读 `jogos-sdk-core`（生命周期、广告语义、存档规则）。本文只讲 H5 落地。

## 推荐做法：用共享接入层

仓库根 `shared/jogos-bridge.js` 已经处理好：动态加载 SDK、init 单例、生命周期、
blur/focus 暂停、广告 in-flight 锁与频控、banner 容器、localStorage 存档、`?mock=1` 离线联调。

```html
<script src="shared/jogos-bridge.js"></script>
<script src="./game.js"></script>
```

```js
// game.js
(async () => {
  const info = await JogosBridge.boot({ debug: true, savePrefix: 'mygame.' });
  if (!info) return;                    // boot 内部已兜底为 mock

  await loadMyAssets();                 // 你自己的资源
  await JogosBridge.loadingEnd();       // 真正可玩之后

  JogosBridge.showBanner(document.getElementById('banner-slot'));
  startGame();
})();
```

游戏循环里用 `JogosBridge.isPaused` 冻结逻辑（bridge 在 blur/广告时会自动置位）：

```js
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
  if (!JogosBridge.isPaused) update(dt);
  render();
}
```

若引擎有自带时钟（Phaser `scene.pause()`、Construct 暂停事件），用回调对接：

```js
JogosBridge.onPause(() => game.pause());
JogosBridge.onResume(() => game.resume());
```

## 不用 bridge 的裸接法

必须自己补齐 init / 暂停恢复 / 广告这几项（loading 上报可选，接入时按推荐节奏）：

```js
// 1. 引入（body 内、游戏脚本之前）
// <script src="https://www.jogos.com/sdk/jogos-sdk-v1.js"></script>

// 2. init 单例
let inited;
function ready() { return inited || (inited = window.JOGOS_SDK.init()); }

// 3. 推荐（非强制）：init 后 loadingStart，首包+首场景加载完 loadingEnd
await ready();
await JOGOS_SDK.game.loadingStart();
await loadAssets();
await JOGOS_SDK.game.loadingEnd();

// 4. 暂停/恢复（成对）
let paused = false;
window.addEventListener('blur', () => {
  if (paused || !gameReady) return;
  paused = true; JOGOS_SDK.game.pause(); game.pause(); muteAll(); showPauseOverlay();
});
window.addEventListener('focus', () => {
  if (!paused) return;
  paused = false; JOGOS_SDK.game.continuePlay(); game.resume(); unmuteAll(); hidePauseOverlay();
});

// 5. 激励广告
function showRewarded() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (done) return; done = true; unmuteAll(); JOGOS_SDK.game.continuePlay(); resolve(ok); };
    muteAll(); JOGOS_SDK.game.pause();
    JOGOS_SDK.ad.requestAd('rewarded', {
      onfinished: () => finish(true),
      onerror: () => finish(false),
    });
  });
}
```

## index.html 必备

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; overscroll-behavior: none; }
  body { -webkit-user-select: none; user-select: none; }
  canvas { display: block; touch-action: none; }
</style>
```

```js
window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
```

## 存档

```js
JogosBridge.save('progress', { level: 3, coins: 120 });
const p = JogosBridge.load('progress', { level: 1, coins: 0 });
```

- 只存必要进度；key 固定带游戏前缀。
- 不要自己写上传队列；SDK 已 hook `localStorage`。
- 需要强制检查点时才 `JogosBridge.syncToCloud()`（≤1 次/分钟）。

## Banner

> 仅适用于原生 H5 / three.js / Phaser / Construct 等**非 Cocos、非 Unity** 项目。
> Cocos 用 `JogosBannerUI` + `BannerUI.prefab`，Unity 用 `JogosBanner` 预制体/组件。

```html
<div id="banner-slot" style="width:300px;height:250px"></div>
```

```js
JogosBridge.showBanner(document.getElementById('banner-slot'));
// 切界面/隐藏时
JogosBridge.hideBanner();
```

- 尺寸只能是 728×90 / 300×250 / 320×50 / 468×60 / 320×100。
- Web 层 banner 不跟随画布，**resize / 横竖屏切换后必须重新同步位置**；
  `JogosBridge.showBanner` 会按容器 `getBoundingClientRect` 重算，并做 60s 频控。
- 桌面可以放侧栏；移动端通常隐藏或改 320×50，避免遮挡操作。

## 自测

```bash
python tools/serve.py                       # 起服务
# 打开 http://127.0.0.1:8080/examples/h5-canvas/
# 断网/无 CDN 时：.../examples/h5-canvas/?mock=1
```

- [ ] 刷新后 loadingStart/loadingEnd 各出现一次
- [ ] 切标签页 → 遮罩出现且游戏冻结；切回恢复
- [ ] 激励广告结束才加分；取消/失败不加分
- [ ] 连续点广告不会重复弹出
- [ ] banner 出现在容器位置，且不挡按钮
- [ ] reload 后存档还在
- [ ] 控制台无 `Uncaught`

## 参考实现

- 可玩示例：`examples/h5-canvas/`（`index.html` + `game.js`）
- 接入层：`shared/jogos-bridge.js`
- 官方最小 Demo（纯接口按钮页）：见 `docs/quickstart.md` 的“官方 HTML5_Demo”
