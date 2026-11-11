# Cocos Creator 示例工程（Jogos SDK）

Cocos Creator **3.8.7** 工程，演示 Jogos Cocos 专属 SDK 的完整接入。
场景里只有 Canvas + Camera，UI 在运行时创建，可以直接读「哪几行是 SDK 接入」。

## 打开与运行

1. Cocos Dashboard → 添加项目 → 选择本目录 → 用 3.8.7 打开
2. 打开场景 `assets/JogosSDKDemo.scene` → 点击预览
3. 构建：构建发布 → Web Mobile → 产物在 `build/web-mobile/`，整包 zip 上传开发者后台

本地预览时 SDK 会走模拟广告（`localhost` 环境），不会请求真实广告。

## Demo 内容（Coin Rush）

30 秒一局的金币收集小游戏：

- 点击金币 +10，右上角 **Watch Ad +100** 常驻激励视频
- 结算面板：**Watch Ad +15s** 复活、**Play Again** 重开
- 结算时提交排行榜 + 播插屏
- 底部 banner 走 `resources/prefab/BannerUI.prefab`（`JogosBannerUI` 组件）
- 金币余额存 `sys.localStorage`，下次启动恢复

## 新增到自己项目的最小步骤

1. 把 `assets/scripts/jogos/` 整个目录拷到你的工程 `assets/scripts/` 下：
   - `jogos-sdk.esm.ts`：SDK 加载器 + 完整类型定义（自带 CDN 兜底与 Jogos 同源规则）
   - `JogosSDK.ts`：单例封装（init 去重、blur/focus 暂停、暂停遮罩、banner 节点换算、toast）
   - `JogosBridge.ts`：薄封装（boot / loadingEnd / 激励 / 插屏 / banner / 排行 / 存档）
   - `view/JogosBannerUI.ts`：banner 挂节点组件
   - `PreOrderMgr.ts`：订单补发/发货管理
2. 在**首个启动场景**的脚本 `onLoad` 里接入（loading 上报是推荐项，不再强制）：

```ts
import { JogosBridge } from './jogos/JogosBridge';

async onLoad() {
  const ok = await JogosBridge.boot();   // init + loadingStart，必须最先
  if (!ok) return;                       // 重复 init 返回 null / 初始化失败

  await this.loadYourAssets();           // 首包 + 首场景加载

  await JogosBridge.loadingEnd();        // 玩家可操作后再调用
  // 之后才可以进入主菜单/开始游戏
}
```

3. 广告（`JogosBridge` 已把回调包成 `Promise<boolean>`，只有 finished 才为 true）：

```ts
const ok = await JogosBridge.showRewarded();
if (ok) { /* 发奖 */ }

// 插屏：只放在关卡结束/死亡/加载
JogosBridge.showInterstitial();
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
- 薄封装：[assets/scripts/jogos/JogosBridge.ts](file:///d:/projects/com/svn_unity/Client/Tools/JogosSDKIntergration/jogos-sdk-agent-kit/examples/cocos-demo/assets/scripts/jogos/JogosBridge.ts)
- Demo 入口：[assets/scripts/JogosSDKDemo.ts](file:///d:/projects/com/svn_unity/Client/Tools/JogosSDKIntergration/jogos-sdk-agent-kit/examples/cocos-demo/assets/scripts/JogosSDKDemo.ts)
- 官方文档：<https://docs.jogos.com/guide/sdk/introduction.html>
