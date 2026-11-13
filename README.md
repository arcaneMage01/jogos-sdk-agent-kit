# Jogos SDK Agent Kit

An integration kit for the Jogos platform SDK, built for **AI agents and developers**: an executable
integration contract, runnable examples, a pitfall checklist and self-check scripts.

The official docs are written for humans and spread across 10+ pages; this repo compresses them into a
structure **an agent can execute directly**:

- `.agents/skills/` — per-engine skills; an agent reads one file and can finish the integration
- `examples/` — four runnable projects (H5 / Cocos / three.js / Unity); copy and adapt
- `shared/jogos-bridge.js` — engine-agnostic integration layer that wraps lifecycle/ads/save/banner pitfalls
- `tools/` — local static server plus an integration self-check script

> Official docs: <https://docs.jogos.com/guide/sdk/introduction.html>
> Coverage: **H5 / Cocos / three.js / Unity WebGL**; all four examples are the same playable coin game.

---

## Repository layout

```
.
├── .agents/skills/
│   ├── jogos-sdk-core/            # Shared integration contract (read this first)
│   ├── jogos-h5-integration/      # Vanilla H5 / Canvas / Phaser / Construct
│   ├── jogos-cocos-integration/   # Cocos Creator 2.x / 3.x
│   ├── jogos-threejs-integration/ # three.js / PlayCanvas and other WebGL engines
│   └── jogos-publish/             # Store publishing through the Jogos MCP server
├── shared/
│   ├── jogos-bridge.js            # Engine-agnostic layer (shared by H5/three.js examples)
│   └── page-shell.js              # Browser default-behavior fixes (scroll/context menu/selection)
├── examples/
│   ├── h5-canvas/                 # Vanilla Canvas playable example (Coin Rush)
│   ├── threejs-demo/              # three.js playable example (Coin Orbit)
│   ├── cocos-demo/                # Full Cocos Creator 3.8.7 project (runtime-built UI)
│   └── unity-demo/                # Unity SDK source project + playable IAA demo (Loading/Game)
├── docs/
│   ├── main-flow.md               # Main flow: ads / banner / ranking / cloud save / IAP dedupe
│   ├── quickstart.md              # 30-minute integration path
│   ├── pitfalls.md                # 33 real pitfalls (symptom / cause / fix)
│   ├── requirements.md            # Platform requirements + ad rules + bundle limits
│   ├── acceptance.md              # Pre-submission acceptance checklist
│   └── publish-mcp.md             # Store publishing through the Jogos MCP server
└── tools/
    ├── serve.py                   # Local static server (no-store so edits take effect)
    ├── verify_integration.py      # Static scan of build output for integration points
    ├── jogos_observer.js          # Injected runtime observer (init / storage / pause hooks)
    └── jogos_test.py              # Playwright runtime test for the three gate checks
```

---

## Run it in 5 minutes

```bash
# 1. Start the local server (HTTP is required; SDK behavior differs under file://)
python tools/serve.py            # http://127.0.0.1:8080

# 2. Open an example
#    H5        http://127.0.0.1:8080/examples/h5-canvas/
#    three.js  http://127.0.0.1:8080/examples/threejs-demo/
#    Cocos     open examples/cocos-demo/ with Cocos Creator 3.8.7
#    Unity     open examples/unity-demo/ with Unity 2021.3 and press Play

# 3. Offline / no CDN: force mock mode (ads, save and banner are simulated locally)
http://127.0.0.1:8080/examples/h5-canvas/?mock=1
```

On `localhost` the official SDK already simulates ads. `?mock=1` is only a fallback when the SDK script
cannot load at all, and **must never be used as acceptance evidence**.

---

## Integration contract (identical for every engine)

Only the `init` order is a hard requirement; loading reports are recommended:

```js
// 1. Load the SDK script (index.html)
// <script src="https://www.jogos.com/sdk/jogos-sdk-v1.js"></script>

// 2. Initialize and await completion; no other API may be called before this
const systemInfo = await window.JOGOS_SDK.init();

// 3. Recommended (not mandatory): tell the platform loading started
await window.JOGOS_SDK.game.loadingStart();

// 4. Recommended (not mandatory): first bundle + first scene loaded, player can act
await window.JOGOS_SDK.game.loadingEnd();

// 5. Pause/resume (level end, menu open, focus loss)
await window.JOGOS_SDK.game.pause();
await window.JOGOS_SDK.game.continuePlay();
```

Three hard rules:

1. **Calling anything before `init` throws `460`**, and `init` may only run once (cache the promise).
2. **`loadingStart` / `loadingEnd` are no longer mandatory** but recommended: `loadingStart` after `init`,
   `loadingEnd` once the first bundle + first scene are loaded. If you use it, `loadingEnd` must mean
   "truly playable" — never first-frame rendering.
3. **Rewarded ads grant only on `onfinished`**, never on `onerror`; do not rely on
   `onstarted → onfinished` ordering (a direct `finished` path exists).

---

## Main flow (start here)

95% of integrators only need these four things. Full details, code and pitfalls: [docs/main-flow.md](docs/main-flow.md).

| Capability | Key points |
|---|---|
| Rewarded / interstitial | Grant only on `onfinished`; interstitial only on level end/death; pause + mute + block input during ads |
| Banner | **Unity uses the `JogosBanner` prefab/component; Cocos uses `JogosBannerUI` + `BannerUI.prefab`**; only engines outside those two use the H5 `banner.requestBanner`, and they must re-sync position on resize |
| Ranking | Leaderboard name/data type must match the console; the second argument is `{ dataType: value }`, e.g. `{ "number": 1200 }` |
| Cloud save | Unity uses IndexedDB and **keeps the key `PlayerPrefs`** (other keys need console config); localStorage may only be read/written after `init` succeeds |
| IAP | Write a local pre-order first, reconcile on startup plus polling fallback, and call `deliverGoods` only after the game grants the item (see `PreOrderMgr.ts`) |

Why banner cannot use the H5 approach: **a web-layer ad does not follow the engine canvas**, so when the
viewport changes the page and in-game layout drift apart. The engine component must push the new
position/size to the page; the Unity/Cocos wrappers already do this.

---

## Using the skills (for agents)

**Option A: let the agent read this repo directly**

Point the agent at the repo path, for example:

```
Before integrating the Jogos SDK, read jogos-sdk-agent-kit/.agents/skills/jogos-sdk-core/SKILL.md,
then follow .agents/skills/jogos-cocos-integration/SKILL.md.
Run tools/verify_integration.py when done.
```

**Option B: copy the skills into your game repo (recommended long-term)**

```bash
# Neutral cross-tool directory recognized by Claude Code / Cursor / Trae / Codex
cp -r .agents/skills/jogos-sdk-core .agents/skills/jogos-h5-integration <your-game>/.agents/skills/
```

> Note: keep skills in `.agents/skills/` (or `.agent/skills/`), **not only in `.trae/` / `.cursor/`**,
> otherwise another toolchain will not find them.

**Option C: one-line task template**

```
Integrate the Jogos SDK into the current game following .agents/skills/jogos-sdk-core/SKILL.md:
- init first, then loadingStart; loadingEnd once assets are ready
- pause/continuePlay on blur/focus; pause and mute during ads
- grant rewarded ads only on onfinished; interstitial only on level end
- save with a stable localStorage key; do not call synchronizeToCloud frequently
- run python tools/verify_integration.py <build-dir> when done
```

---

## Engine support matrix

| Engine | Status | Integration | Example |
|---|---|---|---|
| Vanilla H5 / Canvas / Phaser / Construct | ✅ | HTML5 SDK + `shared/jogos-bridge.js` | `examples/h5-canvas` |
| three.js / PlayCanvas / Babylon | ✅ | Same as H5 | `examples/threejs-demo` |
| Cocos Creator 3.x | ✅ | Platform TypeScript wrapper + `JogosBridge.ts` | `examples/cocos-demo` |
| Cocos Creator 2.x | ✅ | Same HTML5 SDK (identical API) | See `jogos-cocos-integration` |
| Unity WebGL | ✅ | `JogosSDK` source project (v1.3.1) + page-side `jogos-boot.js` + playable IAA demo | `examples/unity-demo` |

---

## Before submission

Two gates: a static scan of the build output, and a runtime test in a real browser. Both exit
non-zero when something must be fixed.

### 1. Static scan

```bash
python tools/verify_integration.py <your-build-dir>
```

It checks SDK inclusion, init/loading order, pause/continuePlay, rewarded grant timing, banner
containers, save keys, mobile CSS and leftover debug code.

### 2. Runtime test (injected observer)

```bash
pip install playwright && playwright install chromium    # once
python tools/jogos_test.py <your-build-dir>
```

`tools/jogos_observer.js` is injected with Playwright `addInitScript`, so it runs before every page
script and **no game code changes are needed**. It hooks `JOGOS_SDK.init`, `game.loadingStart`,
`game.loadingEnd`, `game.pause`, `game.continuePlay`, `Storage.prototype.*` and `IDBFactory.open`,
then reports facts (never retries or fakes a call):

| # | Check | FAIL means |
|---|---|---|
| 1.1–1.2 | `init()` called and resolved | SDK missing, blocked, or init never settles |
| 1.3 | no save access before init resolved | business code touches localStorage / IndexedDB too early |
| 2.1 | `loadingStart` after init, `loadingEnd` after that | wrong order; missing `loadingEnd` is only a warning (reports are optional) |
| 3.1 / 3.3 | blur → `game.pause()`, focus → `game.continuePlay()` | focus handling is missing |
| 3.2 / 3.4 | the game really stops and resumes | `pause()` was called but the game keeps running |
| 3.5 | visibilitychange pause/resume | neither window blur nor tab switch pauses the game |

```bash
python tools/jogos_test.py examples/h5-canvas --root .          # page loads ../../shared/*
python tools/jogos_test.py examples/cocos-demo/build/web-desktop
python tools/jogos_test.py http://127.0.0.1:8080/my-game/
python tools/jogos_test.py dist --headful --json report.json
```

`--root` serves a parent directory (needed when the page references `../shared/...`).

Engine pause state is read from `JogosBridge.isPaused`, `cc.game` / `cc.director`, Phaser's
`game.loop.running`, or your own `window.__JOGOS_GAME__.isPaused`. **Unity WebGL does not expose
`Time.timeScale` to JS**, so when no signal exists the report emits a WARN and asks for manual
confirmation; a two-screenshot comparison of the canvas is added as weak evidence only.

Without Playwright you can still use the observer manually — load it first in `<head>` and add
`data-ui="1"` for an on-screen badge:

```html
<script src="/tools/jogos_observer.js" data-ui="1"></script>
```

Manual checklist: [docs/acceptance.md](docs/acceptance.md). Historical pitfalls: [docs/pitfalls.md](docs/pitfalls.md).

---

## Publishing to the store (MCP)

Passing both gates proves the build **runs**; it does not put the game on the store. The platform
exposes an MCP server for that half of the job:

```
https://www.jogospre.com/api/mcp        # pre-release
```

Ten tools, three scopes (`games:read` / `games:write` / `games:publish`):

```text
get_guidelines → list_catalog → upload_cover → create_game
              → upload_game_package → get_publish_status (qa) → publish_game
```

Three things to know before you start:

- uploads are **two-step tickets**: the tools return a one-time URL and the bytes are POSTed there,
  never passed as tool arguments
- `publish_game` submits for review only; it never publishes directly
- submission is gated by the console self-test (`qa.checks`: `SAVE_OPTION`, `SAVE_SDK`, plus the demo
  pair for buy-out games); missing items come back as `GAME_VERSION_QA_ERROR`

Setup, verified response shapes, status codes, the OAuth discovery pitfall and the open questions for
the platform: [docs/publish-mcp.md](docs/publish-mcp.md).
Agent-facing procedure: [.agents/skills/jogos-publish/SKILL.md](.agents/skills/jogos-publish/SKILL.md).

---

## Platform requirements (summary)

- Ads may only be requested through the Jogos SDK; **any third-party ad SDK is forbidden**
- Interstitial only on level transitions/player death/map loading; never on button clicks or during combat
- Every game must call `init`; `loadingStart` / `loadingEnd` are recommended but not mandatory
- First bundle: PC ≤ 50MB, mobile ≤ 25MB; total: PC ≤ 500MB, mobile ≤ 250MB
- Must support Chrome / Edge and touch on mobile; desktop defaults to landscape
- English support is required (top-3 rejection reason)

Full requirements: [docs/requirements.md](docs/requirements.md).
