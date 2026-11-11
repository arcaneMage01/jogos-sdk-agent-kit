# 踩坑速查（Agent 版）

完整的现象/原因/修法见 [`../../../docs/pitfalls.md`](../../../docs/pitfalls.md)。
这里只列**改代码时必须检查**的条目。

## 生命周期

- [ ] 所有 SDK 调用都在 `await init()` 之后（否则 460）
- [ ] init 单例 + 缓存 Promise，不会并发调用
- [ ] （可选）接入 loading 上报时：`init` 后 `loadingStart`，首包+首场景加载完 `loadingEnd`
- [ ] （可选）`loadingEnd` 用"玩家可操作"信号，不是首帧/场景 Start
- [ ] 买断制：首场景 init 完成后才跑游戏逻辑

## 广告

- [ ] 只把 `onfinished` 当成功，`onerror` 不发奖
- [ ] 不假设 `onstarted` 一定先到
- [ ] 请求前置 in-flight 锁，按钮禁用
- [ ] 广告期间暂停 + 静音 + 锁交互，结束恢复
- [ ] 插屏只在关卡结束/死亡/加载；本地冷却 ≥ `midgameIntervalTime`
- [ ] 激励有金币替代方案 + 冷却；`getRewardAdCount()===0` 时隐藏
- [ ] 没有接入任何第三方广告 SDK

## Banner

- [ ] DOM 容器有明确宽高，尺寸属于 5 种标准值
- [ ] Unity / Cocos **没有**直接调 H5 `banner.requestBanner`，用的是各自组件/预制体
- [ ] 只有其它引擎才用 H5 banner，且 resize 后会重新同步位置
- [ ] 同时 ≤2 个，同 id 60s 内不重复请求
- [ ] 不遮挡按钮/摇杆/UI；移动端实机确认
- [ ] 切界面时清理 banner

## 存档

- [ ] key 稳定且带游戏前缀（`mygame.save.v1`）
- [ ] Unity 存档 key 是 `PlayerPrefs`，或其它 key 已在开发者后台配置
- [ ] localStorage 的读写都在 `init` 成功之后
- [ ] 没有自建云同步队列 / 没有高频 `synchronizeToCloud`
- [ ] 单测/联调确认 reload 后存档还在
- [ ] 游客态可玩，`getUser` 失败不阻塞

## 时间 / 兼容

- [ ] 活动倒计时用 `serverTime` 校准
- [ ] `user-select:none`、`contextmenu`、`wheel` 已处理
- [ ] HTTP 调试（`tools/serve.py`），不是 `file://`
- [ ] 暂停/恢复成对；loadingEnd 前的 blur 被忽略
- [ ] 本地广告表现不作为验收依据（QA 环境上线前也禁广告）

## 提审前

- [ ] `python tools/verify_integration.py <构建目录>` PASS
- [ ] 控制台无 `Uncaught`、无调试残留
- [ ] 首包 PC ≤50MB / 移动 ≤25MB；总包 PC ≤500MB / 移动 ≤250MB
- [ ] 英文可玩（提审拒绝 top 3）
