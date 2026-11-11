# Cocos Creator example project (Jogos SDK)

Cocos Creator **3.8.7** project demonstrating the full Cocos-specific Jogos SDK integration.
The scene only contains Canvas + Camera; the UI is built at runtime, so the SDK integration lines are easy to spot.

## Open and run

1. Cocos Dashboard → Add project → select this directory → open it with 3.8.7
2. Open `assets/JogosSDKDemo.scene` → press Preview
3. Build: Build → Web Mobile → output in `build/web-mobile/`; zip the whole directory and upload it

On `localhost` the SDK uses simulated ads and never requests real ones.

## Demo content (Coin Rush)

A 30-second coin-collection mini-game:

- Tap a coin for +10; the top-right **Watch Ad +100** is a permanent rewarded entry
- Round-over panel: **Watch Ad +15s** revive, **Play Again**
- On round end: submit the leaderboard and show an interstitial
- Bottom banner via `resources/prefab/BannerUI.prefab` (the `JogosBannerUI` component)
- Coin balance is stored in `sys.localStorage` and restored on the next launch

## Minimal steps to add it to your project

1. Copy the whole `assets/scripts/jogos/` directory into your project's `assets/scripts/`:
   - `jogos-sdk.esm.ts`: SDK loader + full type definitions (CDN fallback and Jogos same-origin rules)
   - `JogosSDK.ts`: singleton wrapper (init dedupe, blur/focus pause, pause overlay, banner node math, toast)
   - `JogosBridge.ts`: thin facade (boot / loadingEnd / rewarded / interstitial / banner / ranking / save)
   - `view/JogosBannerUI.ts`: banner component for a node
   - `PreOrderMgr.ts`: order reconciliation / delivery
2. Wire it in the **first startup scene**'s `onLoad` (loading reports are recommended, not mandatory):

```ts
import { JogosBridge } from './jogos/JogosBridge';

async onLoad() {
  const ok = await JogosBridge.boot();   // init + loadingStart, must run first
  if (!ok) return;                       // null while in-flight / false when init fails

  await this.loadYourAssets();           // first bundle + first scene

  await JogosBridge.loadingEnd();        // once the player can act
  // only now enter the main menu / start the game
}
```

3. Ads (`JogosBridge` wraps callbacks into `Promise<boolean>`; true only on finished):

```ts
const ok = await JogosBridge.showRewarded();
if (ok) { /* grant reward */ }

// Interstitial: only on level end / death / load
JogosBridge.showInterstitial();
```

4. Banner: drag `assets/resources/prefab/BannerUI.prefab` into your scene where it covers no controls and
   set the node size. The component calls `requestBannerWithNode` automatically and follows window resizes.

## Cocos-specific notes

- `JogosSDK.onBlur` pauses the engine with `cc.game.pause()` and skips pausing before `loadingEnd`
   (so loading cannot deadlock).
- The pause overlay attaches to the first existing container among
  `GameDiv / Cocos3dGameContainer / Cocos2dGameContainer / layaContainer / egret-player`, falling back to
  the canvas parent; the container is temporarily set to `position: relative`.
- Banner position math relies on `getBoundingBoxToWorld()` and `canvas.getBoundingClientRect()` and already
  applies `devicePixelRatio`; **do not multiply DPR again**, otherwise the banner drifts.
- `refreshBanner(update=true)` only updates the position; creation requests have a 60s local throttle
  (effective in release builds).
- `cc.game.pause()` is skipped in `CC_DEV` for easier debugging; only release builds truly pause.

## Related files

- SDK wrapper: [assets/scripts/jogos/JogosSDK.ts](file:///d:/projects/com/svn_unity/Client/Tools/JogosSDKIntergration/jogos-sdk-agent-kit/examples/cocos-demo/assets/scripts/jogos/JogosSDK.ts)
- Thin facade: [assets/scripts/jogos/JogosBridge.ts](file:///d:/projects/com/svn_unity/Client/Tools/JogosSDKIntergration/jogos-sdk-agent-kit/examples/cocos-demo/assets/scripts/jogos/JogosBridge.ts)
- Demo entry: [assets/scripts/JogosSDKDemo.ts](file:///d:/projects/com/svn_unity/Client/Tools/JogosSDKIntergration/jogos-sdk-agent-kit/examples/cocos-demo/assets/scripts/JogosSDKDemo.ts)
- Official docs: <https://docs.jogos.com/guide/sdk/introduction.html>
