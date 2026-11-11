---
name: jogos-threejs-integration
description: Integrate the Jogos SDK into games with a custom WebGL loop such as three.js / PlayCanvas / Babylon.js. Use when adding platform ads to three.js, freezing the render loop during ads, resolving Raycaster vs ad conflicts, or handling WebGL page lifecycle. For plain 2D H5 use jogos-h5-integration.
---

# three.js / WebGL engine integration

The protocol is identical to H5 (see `jogos-sdk-core`); the only differences are the **render loop and pause**.
Use `shared/jogos-bridge.js` directly and do not rewrite the lifecycle.

## Core: pausing must freeze the time step, not stop rAF

```js
import * as THREE from 'three';

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // call getDelta every frame to avoid a jump on resume

  if (!JogosBridge.isPaused) {
    update(dt);        // advance game logic / physics / timers only when not paused
  }
  renderer.render(scene, camera);  // keep rendering while paused so the frame behind the overlay is stable
}
```

Anti-pattern: returning early from `requestAnimationFrame` or skipping `clock.getDelta()` while paused.
On resume the delta accumulates to several seconds, teleporting characters or draining the timer.

If you use `THREE.AnimationMixer`: call `mixer.update(0)` while paused (or skip update), and on resume
discard one frame by calling `clock.getDelta()` before continuing.

## Startup order

```js
async function main() {
  const info = await JogosBridge.boot({ debug: true, savePrefix: 'mygame3d.' });
  if (!info) return;

  await preloadAssets();              // GLTF / textures / audio
  renderer.render(scene, camera);     // first frame
  await JogosBridge.loadingEnd();     // optional: after the first frame, before interaction

  startRound();
  animate();
}
```

`loadingEnd` is an optional report (no longer mandatory). If you use it, call it after
`await preloadAssets()`, never at renderer creation time.

## Input vs ads

Raycaster `pointerdown` must short-circuit while paused, otherwise clicks during an ad leak into the scene:

```js
canvas.addEventListener('pointerdown', (e) => {
  if (JogosBridge.isPaused || !state.running) return;
  // ... raycast ...
});
```

Also put `touch-action: none` on the canvas so mobile browser gestures do not steal input.

## Renderer and DPR

```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
```

- The platform manages DPR for iOS / low-memory devices; **do not force it to 1** and do not scale it up unbounded.
- On resize update both `renderer.setSize(w, h, false)` and `camera.aspect`.
- Do not use `renderer.setSize(w, h)` (the third argument defaults to true and rewrites canvas style,
  causing CSS layout jumps).

## Audio

three.js has no global audio bus. Use one `masterGain` for everything:

```js
JogosBridge.onPause(() => { audioCtx.suspend(); });
JogosBridge.onResume(() => { audioCtx.resume(); });
```

Browsers require a user gesture before starting `AudioContext`; call `resume()` in the first click.
Audio must be muted during ads — this is a hard review requirement.

## Banner

three.js counts as "other engine", so only the H5 DOM banner is available:
a fixed-size container plus `JogosBridge.showBanner(el)`.

The H5 API cannot update position only, and the same id within 60 s is rejected. Therefore:

- Design the container so it **does not move on resize** (e.g. pinned to the bottom safe area or a side rail).
- If it really must move, wait 60 s before requesting again.
- Do not scale the container with CSS transforms; its size must be one of the standard values.

## Assets and bundle size

- When loading three.js from a CDN importmap, pin the version:

```html
<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" } }
</script>
```

- When the network is unreliable, copy `three.module.js` into a local `vendor/` and point the importmap
  at `./vendor/three.module.js`.
- Prefer `.webp` / `.ktx2` textures; keep the first bundle under 25MB (mobile).
- Never open via `file://`; ES modules + CORS will fail immediately.

## Self-check

```bash
python tools/serve.py
# http://127.0.0.1:8080/examples/threejs-demo/
# offline: .../examples/threejs-demo/?mock=1

python tools/jogos_test.py examples/threejs-demo --root .   # automated runtime gates
```

- [ ] `init` resolves and no localStorage access happens before it
- [ ] `loadingEnd` fires after the first frame; the overlay is removed exactly once
- [ ] Switching to the background freezes the scene (including shader/time-driven animation) and resuming has no time jump
- [ ] Clicks during ads do not collect coins
- [ ] Audio is muted during ads and restored afterwards
- [ ] Resize does not distort the view and the banner follows
- [ ] Console has no `Uncaught`

> three.js has no standard pause flag. Either use `shared/jogos-bridge.js` (exposes `isPaused`) or
> set `window.__JOGOS_GAME__ = { isPaused: ... }` from your loop, so the runtime test can verify it.

## Reference implementation

`examples/threejs-demo/` (`index.html` + `main.js`, Coin Orbit).
