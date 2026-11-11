import { Node, sys } from 'cc';

import JogosSDK, { RequestAdCallbacks } from './JogosSDK';

/**
 * JogosBridge —— Cocos 侧的薄封装，和仓库 shared/jogos-bridge.js 保持同一套调用姿势。
 *
 * 只做四件事：
 *   1. init + loadingStart 的启动流程（重复调用保护）
 *   2. 激励/插屏广告统一成 Promise<boolean>，只有 onfinished 才算成功
 *   3. banner 用节点位置（引擎组件用法），不要直接调 H5 的 banner.requestBanner
 *   4. localStorage 存档（必须在 init 成功后才能读写）
 */
export class JogosBridge {
    private static _booted = false;
    private static _adBusy = false;
    private static _lastInterstitialAt = 0;
    private static readonly _interstitialGap = 60 * 1000;
    private static readonly _savePrefix = 'jogos.';

    /** init -> loadingStart。失败返回 false，不要继续调用其它接口。 */
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
            return true;
        } catch (e) {
            console.error('[JogosBridge] boot failed', e);
            return false;
        }
    }

    /** 首包 + 首场景可玩时调用（推荐项，不是强制项）。 */
    public static loadingEnd(): Promise<void> {
        return JogosSDK.loadingEnd();
    }

    /** 激励视频：只有 onfinished 才返回 true。 */
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

    /** 插屏：只放在关卡结束/死亡/加载；本地做 60s 频控。 */
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

    /** banner 跟着节点走：先把节点摆好，再调用。 */
    public static async showBanner(node: Node): Promise<string> {
        try {
            return await JogosSDK.requestBannerWithNode(node);
        } catch (e) {
            console.warn('[JogosBridge] banner failed', e);
            return '';
        }
    }

    /** 排行榜：第二个参数是 { 数据类型: 值 }，key 要和开发者后台配置一致。 */
    public static commitRanking(name: string, value: number): Promise<void> {
        return JogosSDK.commitRankingData(name, { number: value }).catch(() => undefined);
    }

    /** 存档：localStorage，必须在 boot 成功之后调用。 */
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
     * 广告回调结束后兜底恢复：开发构建里 SDK 的暂停遮罩可能残留，
     * 不清掉会盖住游戏画面（线上构建一般不会出现）。
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
