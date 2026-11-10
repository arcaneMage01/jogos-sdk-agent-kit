---
name: jogos-threejs-integration
description: 把 Jogos SDK 接入 three.js / PlayCanvas / Babylon.js 等自建 WebGL 渲染循环的游戏。当任务涉及 three.js 接入平台广告、暂停渲染循环、Raycaster 交互与广告冲突、WebGL 页面生命周期时使用。纯 2D H5 用 jogos-h5-integration。
---

# three.js / WebGL 引擎接入 Jogos SDK

协议与 H5 完全一致（见 `jogos-sdk-core`），差异只在**渲染循环与暂停**。
直接用 `shared/jogos-bridge.js`，不要自己重写生命周期。

## 核心：暂停要冻结“时间步进”，不是停 rAF

```js
import * as THREE from 'three';

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // 每帧都要 getDelta，避免恢复时跳帧

  if (!JogosBridge.isPaused) {
    update(dt);        // 只有非暂停才推进游戏逻辑/物理/计时
  }
  renderer.render(scene, camera);  // 暂停时仍然渲染（保证遮罩下面是定格画面）
}
```

反例：暂停时 `return` 掉 `requestAnimationFrame` 或不调用 `clock.getDelta()`——
恢复时 `delta` 会累积成几秒，角色瞬移/计时直接跳完。

如果用了 `THREE.AnimationMixer`：暂停时 `mixer.update(0)` 或直接不调用 update；
恢复时先 `clock.getDelta()` 丢弃一帧再继续。

## 启动顺序

```js
async function main() {
  const info = await JogosBridge.boot({ debug: true, savePrefix: 'mygame3d.' });
  if (!info) return;

  await preloadAssets();              // GLTF / 贴图 / 音频
  renderer.render(scene, camera);     // 首帧
  await JogosBridge.loadingEnd();     // 可选：首帧之后、可交互之前

  startRound();
  animate();
}
```

`loadingEnd` 是可选上报（平台不再强制）；如果接入，放在 `await preloadAssets()` 之后，
不要放在 `renderer` 创建时。

## 输入与广告冲突

Raycaster 的 `pointerdown` 必须在暂停时短路，否则广告期间点击会穿透到场景：

```js
canvas.addEventListener('pointerdown', (e) => {
  if (JogosBridge.isPaused || !state.running) return;
  // ... raycast ...
});
```

同时把 `touch-action: none` 加在 canvas 上，避免移动端浏览器手势抢占。

## 渲染器与 DPR

```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
```

- 平台会为 iOS / 低内存设备统一管理 DPR，**不要强制锁 1**，也不要无限放大。
- resize 时同时更新 `renderer.setSize(w, h, false)` 与 `camera.aspect`。
- 不要用 `renderer.setSize(w, h)`（第三参默认 true 会改 canvas style，导致 CSS 布局跳动）。

## 音频

three.js 没有内置全局音频总线。用一个 `masterGain` 统一控制：

```js
JogosBridge.onPause(() => { audioCtx.suspend(); });
JogosBridge.onResume(() => { audioCtx.resume(); });
```

浏览器要求用户手势后才能启动 `AudioContext`，把 `resume()` 放在第一次点击里。
广告期间必须静音——这是审核硬要求。

## 资源与包体

- three.js 走 CDN importmap 时记得锁版本：

```html
<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" } }
</script>
```

- 国内网络不稳定时把 `three.module.js` 放到本地 `vendor/`，importmap 指向 `./vendor/three.module.js`。
- 纹理优先 `.webp`/`.ktx2`；首包控制在 25MB 内（移动端）。
- 不要用 `file://` 打开，ES module + CORS 会直接失败。

## 自测

```bash
python tools/serve.py
# http://127.0.0.1:8080/examples/threejs-demo/
# 无网络：.../examples/threejs-demo/?mock=1
```

- [ ] 首帧出现后才 loadingEnd，遮罩恰好移除一次
- [ ] 切后台回来：场景定格→恢复，没有时间跳变
- [ ] 广告期间点击不会收集金币
- [ ] 音频在广告期间静音，结束后恢复
- [ ] resize 后画面不变形、banner 位置跟随
- [ ] 控制台无 `Uncaught`

## 参考实现

`examples/threejs-demo/`（`index.html` + `main.js`，Coin Orbit）。
