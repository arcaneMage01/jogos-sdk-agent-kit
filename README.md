# Jogos SDK Agent Kit

给 **AI Agent 与开发者** 用的 Jogos 平台 SDK 接入工具包：一份可执行的接入契约、可运行示例、踩坑清单和自检脚本。

官方文档面向人阅读，信息分散在 10+ 个页面里；本仓库把它们压缩成 **Agent 可直接执行的结构**：

- `.agents/skills/` — 按引擎拆分的 skills，Agent 读一个文件就能完整接入
- `examples/` — H5 / Cocos / three.js 三个可运行工程，复制即可改
- `shared/jogos-bridge.js` — 与引擎无关的接入层，把生命周期/广告/存档/banner 的坑封掉
- `tools/` — 本地静态服务器 + 接入自检脚本

> 官方文档：<https://docs.jogospre.com/guide/sdk/introduction.html>
> 当前覆盖：**H5 / Cocos / three.js**。Unity（`.unitypackage` + WebGL）在下一阶段补充。

---

## 目录结构

```
.
├── .agents/skills/
│   ├── jogos-sdk-core/            # 通用接入契约（先读这个）
│   ├── jogos-h5-integration/      # 原生 H5 / Canvas / Phaser / Construct
│   ├── jogos-cocos-integration/   # Cocos Creator 2.x / 3.x
│   └── jogos-threejs-integration/ # three.js / PlayCanvas 等 WebGL 引擎
├── shared/
│   ├── jogos-bridge.js            # 引擎无关接入层（H5/three.js 示例共用）
│   └── page-shell.js              # 浏览器默认行为修复（禁滚动/右键/选中）
├── examples/
│   ├── h5-canvas/                 # 原生 Canvas 可玩示例（Coin Rush）
│   ├── threejs-demo/              # three.js 可玩示例（Coin Orbit）
│   └── cocos-demo/                # Cocos Creator 3.8.7 完整工程
├── docs/
│   ├── quickstart.md              # 30 分钟接入路线
│   ├── pitfalls.md                # 30 个真实坑位（现象/原因/修法）
│   ├── requirements.md            # 平台技术要求 + 广告规范 + 包体红线
│   └── acceptance.md              # 提审前验收清单
└── tools/
    ├── serve.py                   # 本地静态服务（no-store，避免改完不生效）
    └── verify_integration.py      # 扫描构建产物，检查接入点是否齐全
```

---

## 5 分钟跑起来

```bash
# 1. 起本地服务（必须用 HTTP，file:// 下 SDK 行为不一致）
python tools/serve.py            # http://127.0.0.1:8080

# 2. 打开示例
#    H5        http://127.0.0.1:8080/examples/h5-canvas/
#    three.js  http://127.0.0.1:8080/examples/threejs-demo/
#    Cocos     用 Cocos Creator 3.8.7 打开 examples/cocos-demo/

# 3. 无网络/无 CDN 时强制 mock 联调（广告、存档、banner 都是本地模拟）
http://127.0.0.1:8080/examples/h5-canvas/?mock=1
```

`localhost` 下官方 SDK 本身就使用模拟广告；`?mock=1` 是连 SDK 脚本都加载不到时的兜底，**不能用于提审验收**。

---

## 接入契约（所有引擎一致）

只有 `init` 的顺序是硬约束；loading 上报是推荐流程：

```js
// 1. 加载 SDK 脚本（index.html）
// <script src="https://www.jogos.com/sdk/jogos-sdk-v1.js"></script>

// 2. 初始化，必须 await 完成；之后才能调用其它任何接口
const systemInfo = await window.JOGOS_SDK.init();

// 3. 推荐（非强制）：init 之后通知平台开始加载
await window.JOGOS_SDK.game.loadingStart();

// 4. 推荐（非强制）：首包 + 首场景加载完、玩家可操作时
await window.JOGOS_SDK.game.loadingEnd();

// 5. 暂停/恢复（关卡结束、打开菜单、失焦）
await window.JOGOS_SDK.game.pause();
await window.JOGOS_SDK.game.continuePlay();
```

三条硬规则：

1. **init 之前调用任何接口都会抛 `460`**，且 init 只允许一次（自己缓存 Promise）。
2. **`loadingStart` / `loadingEnd` 不再是强制项**，但推荐保留：`init` 后 `loadingStart`，
   首包 + 首场景加载完再 `loadingEnd`；如果接入，`loadingEnd` 必须等"真正可玩"，不能用首帧渲染。
3. **激励广告只在 `onfinished` 发奖**，`onerror` 不发；不要依赖 `onstarted → onfinished` 的时序（可能直接 finished）。

---

## 使用 Skills（给 Agent）

**方式 A：让 Agent 直接读本仓库**

把仓库路径告诉 Agent，例如：

```
接入 Jogos SDK 前先读 jogos-sdk-agent-kit/.agents/skills/jogos-sdk-core/SKILL.md，
再按 .agents/skills/jogos-cocos-integration/SKILL.md 的步骤改。
改完跑 tools/verify_integration.py。
```

**方式 B：把 skill 拷进你的游戏仓库（推荐长期使用）**

```bash
# 跨工具中性目录，Claude Code / Cursor / Trae / Codex 都能识别
cp -r .agents/skills/jogos-sdk-core .agents/skills/jogos-h5-integration <your-game>/.agents/skills/
```

> 注意：skill 要放在 `.agents/skills/`（或 `.agent/skills/`），**不要只放 `.trae/` / `.cursor/`**，
> 否则换个工具链 Agent 就找不到了。

**方式 C：一句话任务模板**

```
把 Jogos SDK 接入当前游戏，遵守 .agents/skills/jogos-sdk-core/SKILL.md：
- 先 init 再 loadingStart，资源就绪后 loadingEnd
- blur/focus 时 pause/continuePlay，广告期间暂停并静音
- 激励广告只在 onfinished 发奖，插屏只在关卡结束播
- 存档用稳定 localStorage key，不要频繁 synchronizeToCloud
- 完成后运行 python tools/verify_integration.py <构建目录>
```

---

## 引擎支持矩阵

| 引擎 | 状态 | 接入方式 | 示例 |
|---|---|---|---|
| 原生 H5 / Canvas / Phaser / Construct | ✅ | HTML5 版 SDK + `shared/jogos-bridge.js` | `examples/h5-canvas` |
| three.js / PlayCanvas / Babylon | ✅ | 同 H5 | `examples/threejs-demo` |
| Cocos Creator 3.x | ✅ | 平台专属 TS 封装 | `examples/cocos-demo` |
| Cocos Creator 2.x | ✅ | 同 HTML5 版（API 一致） | 参考 `jogos-cocos-integration` |
| Unity WebGL | 🚧 工程已就位 | `unity-package-src/`（SDK v1.1.0 源码工程），loading 生命周期待补 | 待补 |

---

## 提审前必做

```bash
python tools/verify_integration.py <你的构建产物目录>
```

它会检查：SDK 引入、init/loadingStart/loadingEnd 顺序调用、pause/continuePlay、
激励广告发奖时机、banner 容器、存档 key、移动端 CSS、控制台残留调试代码等。

人工验收清单见 [docs/acceptance.md](docs/acceptance.md)，
历史踩坑见 [docs/pitfalls.md](docs/pitfalls.md)。

---

## 平台硬性要求（摘要）

- 只允许通过 Jogos SDK 请求广告，**禁止接入任何第三方广告 SDK**
- 插屏只能在关卡切换/玩家死亡/地图加载时；禁止在按钮点击、战斗中使用
- 每个游戏必须调用 `init`；`loadingStart` / `loadingEnd` 推荐但不强制
- 首包：PC ≤ 50MB、移动 ≤ 25MB；总包：PC ≤ 500MB、移动 ≤ 250MB
- 必须支持 Chrome / Edge，移动端支持触摸；桌面默认横屏
- 需要英文支持（提审拒绝原因 top 3）

完整要求见 [docs/requirements.md](docs/requirements.md)。
