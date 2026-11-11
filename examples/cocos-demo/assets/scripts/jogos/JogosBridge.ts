import { Node, director, sys } from 'cc';

import JogosSDK, { RequestAdCallbacks } from './JogosSDK';

/**
 * JogosBridge — thin Cocos facade that keeps the same call shape as shared/jogos-bridge.js.
 *
 * It only does four things:
 *   1. init + loadingStart startup flow (duplicate-call guard)
 *   2. Rewarded/interstitial ads normalized to Promise<boolean>; only onfinished counts as success
 *   3. Banner positioned by a node (engine component style); never call the H5 banner.requestBanner
 *   4. localStorage saves (read/write only after init succeeds)
 */
export class JogosBridge {
    private static _booted = false;
    private static _adBusy = false;
    private static _pauseBound = false;
    private static _lastInterstitialAt = 0;
    private static readonly _interstitialGap = 60 * 1000;
    private static readonly _savePrefix = 'jogos.';

    /** init -> loadingStart. Returns false on failure; do not call other APIs then. */
    public static async boot(): Promise<boolean> {
        if (JogosBridge._booted) {
            return true;
        }

        try {
            const info = await JogosSDK.init();
            if (!info) {
                return false;
            }

            await JogosSDK.loadingStart();
            JogosBridge._booted = true;
            JogosBridge.bindPause();
            return true;
        } catch (e) {
            console.error('[JogosBridge] boot failed', e);
            return false;
        }
    }

    /**
     * The SDK reports pause() to the platform; the game must also stop its own update loop.
     * Cocos Creator keeps director and game running separately, so freeze the director here.
     */
    private static bindPause(): void {
        if (JogosBridge._pauseBound || typeof window === 'undefined') {
            return;
        }
        JogosBridge._pauseBound = true;
        window.addEventListener('blur', () => {
            director.pause();
        });
        window.addEventListener('focus', () => {
            director.resume();
        });
    }

    /** Call when the first bundle + first scene are playable (recommended, not mandatory). */
    public static loadingEnd(): Promise<void> {
        return JogosSDK.loadingEnd();
    }

    /** Rewarded video: resolves true only on onfinished. */
    public static showRewarded(): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            if (JogosBridge._adBusy) {
                resolve(false);
                return;
            }

            JogosBridge._adBusy = true;
            let settled = false;
            const finish = (ok: boolean) => {
                if (settled) {
                    return;
                }
                settled = true;
                JogosBridge._adBusy = false;
                JogosBridge.resetPauseState();
                resolve(ok);
            };

            const callbacks: RequestAdCallbacks = {
                onfinished: () => finish(true),
                onerror: () => finish(false),
            };

            JogosSDK.requestAd('rewarded', callbacks).catch(() => finish(false));
        });
    }

    /** Interstitial: only on level end / death / load; 60s local throttle. */
    public static showInterstitial(): Promise<boolean> {
        const now = Date.now();
        if (JogosBridge._adBusy || now - JogosBridge._lastInterstitialAt < JogosBridge._interstitialGap) {
            return Promise.resolve(false);
        }

        return new Promise<boolean>((resolve) => {
            JogosBridge._adBusy = true;
            JogosBridge._lastInterstitialAt = now;
            let settled = false;
            const finish = (ok: boolean) => {
                if (settled) {
                    return;
                }
                settled = true;
                JogosBridge._adBusy = false;
                JogosBridge.resetPauseState();
                resolve(ok);
            };

            const callbacks: RequestAdCallbacks = {
                onfinished: () => finish(true),
                onerror: () => finish(false),
            };

            JogosSDK.requestAd('midgame', callbacks).catch(() => finish(false));
        });
    }

    /** Banner follows the node: position the node first, then call this. */
    public static async showBanner(node: Node): Promise<string> {
        try {
            return await JogosSDK.requestBannerWithNode(node);
        } catch (e) {
            console.warn('[JogosBridge] banner failed', e);
            return '';
        }
    }

    /** Ranking: the second argument is { dataType: value }; the key must match the developer console. */
    public static commitRanking(name: string, value: number): Promise<void> {
        return JogosSDK.commitRankingData(name, { number: value }).catch(() => undefined);
    }

    /** Save: localStorage, only call it after boot succeeds. */
    public static save(key: string, value: any): void {
        try {
            sys.localStorage.setItem(JogosBridge._savePrefix + key, JSON.stringify(value));
        } catch (e) {
            console.warn('[JogosBridge] save failed', e);
        }
    }

    public static load<T>(key: string, fallback: T): T {
        try {
            const raw = sys.localStorage.getItem(JogosBridge._savePrefix + key);
            return raw == null ? fallback : (JSON.parse(raw) as T);
        } catch (e) {
            console.warn('[JogosBridge] load failed', e);
            return fallback;
        }
    }

    /**
     * Safety restore after an ad callback: dev builds may leave the SDK pause overlay behind,
     * which would cover the game (normally not an issue in release builds).
     */
    private static resetPauseState(): void {
        try {
            JogosSDK.continuePlay();
        } catch (e) {
            // ignore
        }

        if (typeof document !== 'undefined') {
            const overlay = document.getElementById('pauseOverlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }
    }
}
