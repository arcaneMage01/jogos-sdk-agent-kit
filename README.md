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
│   └── jogos-threejs-integration/ # three.js / PlayCanvas and other WebGL engines
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
│   └── acceptance.md              # Pre-submission acceptance checklist
└── tools/
    ├── serve.py                   # Local static server (no-store so edits take effect)
    └── verify_integration.py      # Scans build output and checks integration points
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
| Unity WebGL | ✅ | `JogosSDK` source project (v1.2.0) + playable IAA demo | `examples/unity-demo` |

---

## Before submission

```bash
python tools/verify_integration.py <your-build-dir>
```

It checks: SDK inclusion, init/loadingStart/loadingEnd order, pause/continuePlay, rewarded grant timing,
banner containers, save keys, mobile CSS, leftover debug code and more.

Manual checklist: [docs/acceptance.md](docs/acceptance.md). Historical pitfalls: [docs/pitfalls.md](docs/pitfalls.md).

---

## Platform requirements (summary)

- Ads may only be requested through the Jogos SDK; **any third-party ad SDK is forbidden**
- Interstitial only on level transitions/player death/map loading; never on button clicks or during combat
- Every game must call `init`; `loadingStart` / `loadingEnd` are recommended but not mandatory
- First bundle: PC ≤ 50MB, mobile ≤ 25MB; total: PC ≤ 500MB, mobile ≤ 250MB
- Must support Chrome / Edge and touch on mobile; desktop defaults to landscape
- English support is required (top-3 rejection reason)

Full requirements: [docs/requirements.md](docs/requirements.md).
