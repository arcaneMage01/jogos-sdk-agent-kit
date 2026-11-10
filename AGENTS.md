# AGENTS.md

本仓库是 Jogos SDK 的 **Agent 接入工具包**。任何 Agent 在此仓库或使用本仓库资料时，遵循以下规则。

## 任务开始前

1. 先读 `.agents/skills/jogos-sdk-core/SKILL.md`（接入契约、生命周期、广告/存档/banner 规则）。
2. 再读对应引擎的 skill：
   - 原生 H5 / Phaser / Construct → `jogos-h5-integration`
   - Cocos Creator 2.x/3.x → `jogos-cocos-integration`
   - three.js / PlayCanvas / Babylon → `jogos-threejs-integration`
3. 需要具体代码时，直接看 `examples/` 下对应工程，不要凭空生成 API。

## 硬性约束

- **不要发明 API。** 所有接口以 `.agents/skills/jogos-sdk-core/references/api.md` 为准；
  官方文档没写的接口一律不要调用。
- **不要跳生命周期。** `init` → `loadingStart` → 资源加载 → `loadingEnd`，顺序不可变。
- **不要接入第三方广告 SDK。** 平台只允许 Jogos SDK 的广告，违反直接拒审。
- **不要在 `onerror` 里发激励奖励。** 只有 `onfinished` 代表看完。
- **不要频繁调用 `synchronizeToCloud`。** 使用稳定 localStorage key 时 SDK 会自动镜像存档。
- **不要用 `file://` 调试。** 必须走 HTTP，推荐 `python tools/serve.py`。
- **不要用首帧渲染当作 loadingEnd 信号**，要用“玩家真正可以操作”的信号。

## 修改代码后

1. 运行 `python tools/verify_integration.py <构建目录>`，必须 PASS。
2. 跑一遍验收清单：`docs/acceptance.md`。
3. 涉及广告/存档/暂停的改动，必须在浏览器控制台确认无 `Uncaught`，且 SDK 日志里能看到
   `loadingStart` / `loadingEnd` / `pause` / `continuePlay`。

## 仓库约定

- skills 放在 `.agents/skills/<skill-name>/SKILL.md`（跨工具中性路径）。
- 示例必须能在 `?mock=1` 下离线跑通，且默认走真实 SDK。
- 新增引擎支持时：新建 `examples/<engine>-demo/` + `.agents/skills/jogos-<engine>-integration/`，
  并在 README 支持矩阵登记。
- 不要提交 `library/`、`temp/`、`build/`、`node_modules/` 等本地产物。
