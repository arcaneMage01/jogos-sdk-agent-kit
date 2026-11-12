# AGENTS.md

This repository is the **agent integration kit** for the Jogos SDK. Any agent working in this repo or
using its material must follow these rules.

## Before starting a task

1. Read `.agents/skills/jogos-sdk-core/SKILL.md` (contract, lifecycle, ads/save/banner rules).
2. Then read the engine-specific skill:
   - Vanilla H5 / Phaser / Construct → `jogos-h5-integration`
   - Cocos Creator 2.x/3.x → `jogos-cocos-integration`
   - three.js / PlayCanvas / Babylon → `jogos-threejs-integration`
   - Unity WebGL → `examples/unity-demo/README.md` + `DEMO.md` (dedicated skill pending)
3. For concrete code, read the matching project under `examples/`. Never invent APIs.
4. If the task is about **publishing to the store** (draft, build address, review status), read
   `.agents/skills/jogos-publish/SKILL.md` and `docs/publish-mcp.md`.

## Hard constraints

- **Do not invent APIs.** `.agents/skills/jogos-sdk-core/references/api.md` is the source of truth;
  never call anything the official docs do not describe.
- **Follow the recommended lifecycle, not a mandatory one.** `init` → `loadingStart` → first bundle/scene
  loaded → `loadingEnd`; skipping loading reports does not fail the integration.
- **Do not integrate third-party ad SDKs.** Only Jogos SDK ads are allowed; violations are rejected outright.
- **Never grant rewarded rewards in `onerror`.** Only `onfinished` means the ad was watched.
- **Do not call `synchronizeToCloud` frequently.** With a stable localStorage key the SDK mirrors saves automatically.
- **Do not debug over `file://`.** Use HTTP; `python tools/serve.py` is recommended.
- **If you report `loadingEnd`**, use a "player can actually act" signal, never first-frame rendering.
- **Never invent `gameFileUrl` or `coverImage` when publishing.** Both must come from a real upload
  (`upload_game_package` / `upload_cover`); never put file bytes into tool arguments.

## After changing code

1. Run `python tools/verify_integration.py <build-dir>`; it must PASS.
2. Run `python tools/jogos_test.py <build-dir>` for the runtime gates: init resolves with no save
   access before it, loading order (optional), and blur/focus pause/resume. It injects an observer,
   so no game code changes are needed; PASS must hold or each FAIL must be explained and confirmed.
3. Walk through the acceptance checklist: `docs/acceptance.md`.
4. For changes touching ads/save/pause, confirm in the browser console that there is no `Uncaught`,
   and that the SDK log shows `pause` / `continuePlay` (plus `loadingStart` / `loadingEnd` if you report loading).

## Repository conventions

- Skills live in `.agents/skills/<skill-name>/SKILL.md` (a cross-tool neutral path).
- Examples must run offline with `?mock=1` and default to the real SDK.
- Adding an engine: create `examples/<engine>-demo/` + `.agents/skills/jogos-<engine>-integration/`,
  and register it in the README support matrix.
- Never commit local artifacts such as `library/`, `temp/`, `build/`, `node_modules/`.
- The repository content must be **English only** (docs, comments, UI strings); no Chinese characters.
