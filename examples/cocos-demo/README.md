# Cocos Creator 示例工程（Jogos SDK）

Cocos Creator **3.8.7** 工程，演示 Jogos Cocos 专属 SDK 的完整接入。
平台团队提供的原始 Demo，已去除 `library/ temp/ build/` 等本地产物，可直接用 Creator 打开。

## 打开与运行

1. Cocos Dashboard → 添加项目 → 选择本目录 → 用 3.8.7 打开
2. 打开场景 `assets/JogosSDKDemo.scene` → 点击预览
3. 构建：构建发布 → Web Mobile → 产物在 `build/web-mobile/`，整包 zip 上传开发者后台

本地预览时 SDK 会走模拟广告（`localhost` 环境），不会请求真实广告。

## 新增到自己项目的最小步骤

1. 把 `assets/scripts/jogos/` 整个目录拷到你的工程 `assets/scripts/` 下：
   - `jogos-sdk.esm.ts`：SDK 加载器 + 完整类型定义（自带 CDN 兜底与 Jogos 同源规则）
   - `JogosSDK.ts`：单例封装（init 去重、blur/focus 暂停、暂停遮罩、banner 节点换算、toast）
   - `view/JogosBannerUI.ts`：banner 挂节点组件
   - `PreOrderMgr.ts`：订单补发/发货管理
2. 在**首个启动场景**的脚本 `onLoad` 里接入（loading 上报是推荐项，不再强制）：

```ts
import JogosSDK from './jogos/JogosSDK';

async onLoad() {
  const systemInfo = await JogosSDK.init();   // 1. 必须最先，且 await 完成
  if (!systemInfo) return;                    // 重复 init 会返回 null

  await JogosSDK.loadingStart();              // 2. 推荐：init 之后通知开始加载

  await this.loadYourAssets();                // 3. 首包 + 首场景加载

  await JogosSDK.loadingEnd();                // 4. 推荐：玩家可操作后再调用
  // 之后才可以进入主菜单/开始游戏
}
```

3. 广告（`requestAd` 已帮你处理广告期间的暂停/恢复与错误 toast）：

```ts
JogosSDK.requestAd('rewarded', {
  onstarted: () => {},
  onfinished: () => { /* 只在 onfinished 发奖 */ },
  onerror: (err) => { /* 不发奖 */ },
});
```

4. Banner：把 `assets/resources/prefab/BannerUI.prefab` 拖进你的场景，放在不遮挡操作区的位置，
   节点设置好宽高即可；组件会自动 `requestBannerWithNode`，窗口 resize 时自动跟随。

## Cocos 专属注意点

- `JogosSDK.onBlur` 里会用 `cc.game.pause()` 暂停引擎，并在 `loadingEnd` 之前跳过暂停（避免加载期卡死）。
- 暂停遮罩的挂载容器按 `GameDiv / Cocos3dGameContainer / Cocos2dGameContainer / layaContainer / egret-player` 顺序查找，
  最后回退到 canvas 父节点；容器会被临时设为 `position: relative`。
- Banner 的位置换算依赖 `getBoundingBoxToWorld()` 与 `canvas.getBoundingClientRect()`，
  并对 `devicePixelRatio` 做了换算；**不要自己再乘 DPR**，否则 banner 会偏移。
- `refreshBanner(update=true)` 只做位置刷新；创建类请求有 60s 本地频控（构建版生效）。
- `CC_DEV` 环境下取消 `cc.game.pause()`，方便调试；发布构建才会真正暂停。

## 相关文件

- 接入源码：[assets/scripts/jogos/JogosSDK.ts](file:///d:/projects/com/svn_unity/Client/Tools/JogosSDKIntergration/jogos-sdk-agent-kit/examples/cocos-demo/assets/scripts/jogos/JogosSDK.ts)
- Demo 入口：[assets/scripts/JogosSDKDemo.ts](file:///d:/projects/com/svn_unity/Client/Tools/JogosSDKIntergration/jogos-sdk-agent-kit/examples/cocos-demo/assets/scripts/JogosSDKDemo.ts)
- 官方文档：<https://docs.jogos.com/guide/sdk/introduction.html>
