# Quickstart · 30 分钟接入 Jogos SDK

三条路径选一条，公共契约完全相同。先读 [`../.agents/skills/jogos-sdk-core/SKILL.md`](../.agents/skills/jogos-sdk-core/SKILL.md)，
主流程（广告 / Banner / 排行 / 云存档 / 内购防丢单）见 [`main-flow.md`](main-flow.md)。

---

## 0. 先确认你属于哪一类

| 你的项目 | 走这条路 |
|---|---|
| 原生 JS / Canvas / Phaser / Construct / GDevelop | [A. H5](#a-h5游戏) |
| three.js / PlayCanvas / Babylon.js | [B. three.js](#b-threejs--webgl-引擎) |
| Cocos Creator 3.x / 2.x | [C. Cocos](#c-cocos-creator) |
| Unity | 下一阶段（`.unitypackage`） |

---

## A. H5 游戏

### A1. 引入 SDK

```html
<!-- body 内，游戏脚本之前 -->
<script src="https://www.jogos.com/sdk/jogos-sdk-v1.js"></script>
```

或使用本仓库封装（推荐，自动处理加载、暂停、广告、存档）：

```html
<script src="shared/jogos-bridge.js"></script>
```

### A2. 启动

```js
// 裸接法（loading 上报推荐但非强制）
const info = await window.JOGOS_SDK.init();
await window.JOGOS_SDK.game.loadingStart();   // 推荐：init 之后
await loadAssets();
await window.JOGOS_SDK.game.loadingEnd();     // 推荐：首包+首场景加载完
```

```js
// 用 bridge
const info = await JogosBridge.boot({ debug: true, savePrefix: 'mygame.' });
await loadAssets();
await JogosBridge.loadingEnd();
```

### A3. 暂停 / 恢复

```js
JogosBridge.onPause(() => game.pause());
JogosBridge.onResume(() => game.resume());
// 或者在循环里： if (!JogosBridge.isPaused) update(dt);
```

### A4. 广告

```js
const ok = await JogosBridge.showRewarded();   // 只有 true 才发奖
await JogosBridge.showInterstitial();          // 只在关卡结束调用
```

### A5. 存档 + banner

```js
JogosBridge.save('progress', { level: 2 });
JogosBridge.showBanner(document.getElementById('banner-slot'));
```

完整可运行代码：[`examples/h5-canvas/`](../examples/h5-canvas/)。

---

## B. three.js / WebGL 引擎

与 A 完全相同，只改渲染循环：

```js
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!JogosBridge.isPaused) update(dt);   // 暂停时冻结时间步进
  renderer.render(scene, camera);
}
```

注意：

- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`，不要强锁 1
- 广告期间 `pointerdown` 要短路，避免穿透点击
- `AudioContext` 在广告期间 `suspend()`

完整示例：[`examples/threejs-demo/`](../examples/threejs-demo/)。

---

## C. Cocos Creator

1. 拷贝 `examples/cocos-demo/assets/scripts/jogos/` 到你工程
2. 首个场景脚本：

```ts
// boot() 内部完成 init + loadingStart
const ok = await JogosBridge.boot();
if (!ok) return;
await this.loadAssets();
await JogosBridge.loadingEnd();   // 玩家可操作时
```

3. 广告：`await JogosBridge.showRewarded()`（只有 onfinished 才为 true）
4. Banner：把 `BannerUI.prefab` 放进场景，设好宽高
5. 构建 Web Mobile，整包 zip 上传

完整工程：[`examples/cocos-demo/`](../examples/cocos-demo/)（Cocos Creator 3.8.7）。

---

## D. Unity WebGL

1. 直接打开 [`examples/unity-demo/`](../examples/unity-demo/)（Unity 2021.3），Play 即可
2. 接入代码在 `Assets/Demo/IAA/Scripts/`：
   - `StartLoad.cs`：`JogosSDK.Init` → `LoadingStart` → 场景加载完 `LoadingEnd`
   - `CoinRushGame.cs`：激励/插屏/Banner/排行榜/PlayerPrefs 存档
3. 业务工程：导入 SDK 后同样把 `Init` 放在首个场景，**不要**自己处理失焦暂停（SDK 已做）
4. Banner 用 `JogosBanner` 组件 / `Resources/JogosBanner.prefab`，不要用 H5 接口

详细说明：[`examples/unity-demo/DEMO.md`](../examples/unity-demo/DEMO.md)。

---

## E. 官方 HTML5_Demo 怎么用

官方文档末尾提供了一个纯接口按钮页（`HTML5_Demo.zip`），适合**验证接口是否通**，
不适合作为接入模板。它只有 `init` 与按钮调用，没有生命周期与暂停处理。

```bash
# 解压后放到任意 HTTP 服务下打开即可；需要把 sdk/jogos-sdk-v1.js 放到同级 sdk/ 目录
python tools/serve.py --root <解压目录>
```

---

## E. 验证

```bash
python tools/verify_integration.py <构建产物目录>
```

然后人工过 [`acceptance.md`](acceptance.md)。

---

## F. 部署

- 开发者后台 → 上传游戏 → 选择 SDK 版本/方向 → QA 预览
- 提审前确认："游戏保存进度的方式" 选择了 **Jogos SDK 数据模块**（否则云存档被禁用）
- 广告在 QA 预览环境被平台主动禁用，属正常现象
- 包体：首包 PC ≤50MB / 移动 ≤25MB；总包 PC ≤500MB / 移动 ≤250MB；文件数 ≤5000 / ≤3000
