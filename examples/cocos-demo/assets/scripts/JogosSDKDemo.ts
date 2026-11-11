import {
    _decorator,
    Button,
    Color,
    Component,
    Graphics,
    instantiate,
    Label,
    Node,
    Prefab,
    resources,
    UITransform,
    view,
} from 'cc';

import { JogosBridge } from './jogos/JogosBridge';

const { ccclass } = _decorator;

interface CoinCell {
    node: Node;
    btn: Button;
    active: boolean;
    cell: number;
    respawnAt: number;
}

/**
 * Coin Rush — Jogos SDK integration example for Cocos Creator.
 *
 * The scene only contains Canvas + Camera; all UI is created here at runtime,
 * so the SDK integration lines are immediately visible and the project is not
 * filled with demo buttons.
 *
 * There are only four integration points: startup (boot/loadingEnd), round end
 * (ranking + interstitial), rewarded video (top-right button / revive) and banner
 * (BannerUI node).
 */
@ccclass('JogosSDKDemo')
export class JogosSDKDemo extends Component {
    private static readonly ROUND_SECONDS = 30;
    private static readonly REVIVE_SECONDS = 15;
    private static readonly RESPAWN_DELAY = 2000;
    private static readonly COIN_VALUE = 10;
    private static readonly AD_REWARD = 100;
    private static readonly CELLS = 9;
    private static readonly RANKING_NAME = 'HighScore';

    private _w = 1280;
    private _h = 720;

    private _loadingRoot: Node | null = null;
    private _loadingBar: Graphics | null = null;
    private _loadingLabel: Label | null = null;

    private _overlay: Node | null = null;
    private _finalLabel: Label | null = null;
    private _coinsLabel: Label | null = null;
    private _timeLabel: Label | null = null;
    private _adButton: Button | null = null;
    private _reviveButton: Button | null = null;

    private _coins: CoinCell[] = [];
    private _cellTaken: boolean[] = new Array(JogosSDKDemo.CELLS).fill(false);

    private _coinBalance = 0;
    private _roundScore = 0;
    private _timeLeft = JogosSDKDemo.ROUND_SECONDS;
    private _running = false;

    private _ready = false;
    private _bannerNode: Node | null = null;

    onLoad() {
        // Visible area in design resolution; matches the actual Canvas size
        const size = view.getVisibleSize();
        if (size.width > 0 && size.height > 0) {
            this._w = size.width;
            this._h = size.height;
        }

        this.buildBackground();
        this.buildPlayArea();
        this.buildOverlay();
        this.buildHud();
        this.buildLoading();

        this.boot();
    }

    update(dt: number) {
        if (!this._running) {
            return;
        }

        this._timeLeft -= dt;
        if (this._timeLabel) {
            this._timeLabel.string = Math.ceil(Math.max(0, this._timeLeft)) + 's';
        }

        const now = Date.now();
        for (const coin of this._coins) {
            if (!coin.active && now >= coin.respawnAt) {
                this.reviveCoin(coin);
            }
        }

        if (this._timeLeft <= 0) {
            this.endRound();
        }
    }

    onDestroy() {
        if (this._bannerNode && this._bannerNode.isValid) {
            this._bannerNode.destroy();
        }
    }

    // ------------------------------------------------------------ startup

    private async boot() {
        this.setLoadingText('Initializing Jogos SDK…');

        const ok = await JogosBridge.boot();
        if (!ok) {
            this.setLoadingText('SDK init failed, check the console');
            return;
        }

        // Simulate first bundle / first scene loading; replace with your real progress
        for (let i = 0; i <= 20; i++) {
            this.setLoadingProgress(i / 20, 'Loading ' + Math.round((i / 20) * 100) + '%');
            await this.delay(25);
        }

        // Player can act now: report loading end (recommended)
        await JogosBridge.loadingEnd();

        // Saves may only be read after init succeeded
        this._coinBalance = JogosBridge.load('coins', 0);
        if (this._coinsLabel) {
            this._coinsLabel.string = 'COINS ' + this._coinBalance;
        }

        this.showBanner();

        if (this._loadingRoot) {
            this._loadingRoot.active = false;
        }

        this._ready = true;
        this.startRound();
    }

    private showBanner() {
        resources.load('prefab/BannerUI', Prefab, (err, prefab) => {
            if (err || !prefab || !this.node.isValid) {
                return;
            }
            // Banner is positioned by an engine node; JogosBannerUI refreshes it on resize.
            // The component already calls requestBannerWithNode in onEnable, so do not request again.
            this._bannerNode = instantiate(prefab);
            this._bannerNode.setParent(this.node);
            this._bannerNode.active = true;
        });
    }

    // ------------------------------------------------------------ game

    private startRound() {
        this._roundScore = 0;
        this._timeLeft = JogosSDKDemo.ROUND_SECONDS;
        this._running = true;

        if (this._overlay) {
            this._overlay.active = false;
        }
        if (this._reviveButton) {
            this._reviveButton.node.active = true;
            this._reviveButton.interactable = true;
        }
        if (this._finalLabel) {
            this._finalLabel.string = '0';
        }
        if (this._timeLabel) {
            this._timeLabel.string = JogosSDKDemo.ROUND_SECONDS + 's';
        }

        this._cellTaken.fill(false);
        for (const coin of this._coins) {
            coin.active = false;
            this.reviveCoin(coin);
        }
    }

    private endRound() {
        if (!this._running) {
            return;
        }

        this._running = false;
        this._timeLeft = 0;

        for (const coin of this._coins) {
            this.hideCoin(coin);
        }

        // Ranking: leaderboard name and { dataType: value } must match the developer console
        JogosBridge.commitRanking(JogosSDKDemo.RANKING_NAME, this._roundScore);

        // Interstitial only on level end / death / load
        JogosBridge.showInterstitial();

        if (this._finalLabel) {
            this._finalLabel.string = String(this._roundScore);
        }
        if (this._overlay) {
            this._overlay.active = true;
        }
    }

    private onCoinClicked(coin: CoinCell) {
        if (!this._running || !coin.active) {
            return;
        }

        this.hideCoin(coin);
        coin.respawnAt = Date.now() + JogosSDKDemo.RESPAWN_DELAY;

        this._roundScore += JogosSDKDemo.COIN_VALUE;
        this.addCoins(JogosSDKDemo.COIN_VALUE);
    }

    private hideCoin(coin: CoinCell) {
        coin.active = false;
        this._cellTaken[coin.cell] = false;
        coin.node.active = false;
    }

    private reviveCoin(coin: CoinCell) {
        const cell = this.pickFreeCell();
        coin.cell = cell;
        coin.active = true;
        this._cellTaken[cell] = true;

        const col = cell % 3;
        const row = Math.floor(cell / 3);
        const jitterX = (Math.random() - 0.5) * 32;
        const jitterY = (Math.random() - 0.5) * 32;

        coin.node.setPosition((col - 1) * 210 + jitterX, this.playCenterY + (1 - row) * 150 + jitterY);
        coin.node.active = true;
    }

    private pickFreeCell(): number {
        const free: number[] = [];
        for (let i = 0; i < this._cellTaken.length; i++) {
            if (!this._cellTaken[i]) {
                free.push(i);
            }
        }
        if (free.length === 0) {
            return Math.floor(Math.random() * JogosSDKDemo.CELLS);
        }
        return free[Math.floor(Math.random() * free.length)];
    }

    private get playCenterY(): number {
        return (this._h / 2 - 120 + (-this._h / 2 + 190)) / 2;
    }

    // ------------------------------------------------------------ SDK calls

    private async onWatchAdClicked() {
        if (!this._ready || !this._adButton) {
            return;
        }

        this._adButton.interactable = false;
        const ok = await JogosBridge.showRewarded();
        if (ok) {
            this.addCoins(JogosSDKDemo.AD_REWARD);
        }
        this._adButton.interactable = true;
    }

    private async onReviveClicked() {
        if (!this._reviveButton) {
            return;
        }

        this._reviveButton.interactable = false;
        const ok = await JogosBridge.showRewarded();

        if (!ok) {
            this._reviveButton.interactable = true;
            this._reviveButton.node.active = false;
            return;
        }

        this._reviveButton.interactable = true;
        this._running = true;
        this._timeLeft = JogosSDKDemo.REVIVE_SECONDS;

        if (this._overlay) {
            this._overlay.active = false;
        }
        if (this._timeLabel) {
            this._timeLabel.string = JogosSDKDemo.REVIVE_SECONDS + 's';
        }
        for (const coin of this._coins) {
            if (!coin.active) {
                this.reviveCoin(coin);
            }
        }
    }

    private addCoins(amount: number) {
        this._coinBalance += amount;
        if (this._coinsLabel) {
            this._coinsLabel.string = 'COINS ' + this._coinBalance;
        }
        JogosBridge.save('coins', this._coinBalance);
    }

    // ------------------------------------------------------------ UI

    private buildBackground() {
        const node = this.makeNode('Background', this.node, this._w, this._h);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(11, 17, 32, 255);
        g.rect(-this._w / 2, -this._h / 2, this._w, this._h);
        g.fill();
    }

    private buildPlayArea() {
        const root = this.makeNode('PlayArea', this.node, this._w, this._h);

        for (let i = 0; i < JogosSDKDemo.CELLS; i++) {
            const node = this.makeNode('Coin' + i, root, 96, 96);

            const g = node.addComponent(Graphics);
            g.fillColor = new Color(255, 201, 60, 255);
            g.circle(0, 0, 46);
            g.fill();
            g.lineWidth = 5;
            g.strokeColor = new Color(201, 143, 26, 255);
            g.circle(0, 0, 46);
            g.stroke();

            const btn = node.addComponent(Button);
            btn.transition = Button.Transition.SCALE;
            btn.zoomScale = 0.92;

            const coin: CoinCell = { node, btn, active: false, cell: i, respawnAt: 0 };
            node.on(Button.EventType.CLICK, () => this.onCoinClicked(coin), this);
            this._coins.push(coin);
        }
    }

    private buildHud() {
        const top = this._h / 2 - 44;

        this._coinsLabel = this.makeLabel('CoinsLabel', this.node, 'COINS 0', 30, Color.WHITE,
            400, 56, -this._w / 2 + 24, top, Label.HorizontalAlign.LEFT, 0);

        this._timeLabel = this.makeLabel('TimeLabel', this.node, JogosSDKDemo.ROUND_SECONDS + 's', 32,
            new Color(206, 224, 255, 255), 200, 56, 0, top);

        this._adButton = this.makeButton(
            'WatchAdButton', this.node, 'Watch Ad +' + JogosSDKDemo.AD_REWARD,
            250, 64, this._w / 2 - 24 - 125, top, new Color(255, 171, 61, 255),
            () => this.onWatchAdClicked());
    }

    private buildOverlay() {
        const overlay = this.makeNode('RoundOver', this.node, this._w, this._h);
        const dim = overlay.addComponent(Graphics);
        dim.fillColor = new Color(0, 0, 0, 184);
        dim.rect(-this._w / 2, -this._h / 2, this._w, this._h);
        dim.fill();
        // Swallow touches so they do not reach the coins underneath
        overlay.on(Node.EventType.TOUCH_START, () => undefined, this);

        const card = this.makeNode('Card', overlay, 460, 340);
        const cardBg = card.addComponent(Graphics);
        cardBg.fillColor = new Color(14, 20, 37, 250);
        cardBg.roundRect(-230, -170, 460, 340, 20);
        cardBg.fill();

        this.makeLabel('Title', card, 'Round Over', 40, Color.WHITE, 400, 60, 0, 108);

        this.makeLabel('Hint', card, 'Coins this round', 22, new Color(143, 168, 216, 255), 400, 36, 0, 48);

        this._finalLabel = this.makeLabel('Final', card, '0', 34, Color.WHITE, 400, 48, 0, 8);

        this._reviveButton = this.makeButton('ReviveButton', card, 'Watch Ad +15s', 320, 68, 0, -76,
            new Color(255, 171, 61, 255), () => this.onReviveClicked());

        this.makeButton('AgainButton', card, 'Play Again', 320, 68, 0, -156,
            new Color(63, 125, 255, 255), () => this.startRound());

        overlay.active = false;
        this._overlay = overlay;
    }

    private buildLoading() {
        const root = this.makeNode('Loading', this.node, this._w, this._h);
        const bg = root.addComponent(Graphics);
        bg.fillColor = new Color(8, 12, 22, 255);
        bg.rect(-this._w / 2, -this._h / 2, this._w, this._h);
        bg.fill();

        this.makeLabel('Title', root, 'Coin Rush', 44, Color.WHITE, 500, 70, 0, 60);
        this._loadingLabel = this.makeLabel('Status', root, 'Initializing Jogos SDK…', 22,
            new Color(143, 168, 216, 255), 600, 40, 0, 0);

        const barBg = this.makeNode('BarBg', root, 360, 8, 0, -60);
        const barBgGraphics = barBg.addComponent(Graphics);
        barBgGraphics.fillColor = new Color(255, 255, 255, 20);
        barBgGraphics.roundRect(-180, -4, 360, 8, 4);
        barBgGraphics.fill();

        const bar = this.makeNode('BarFill', root, 360, 8, 0, -60);
        this._loadingBar = bar.addComponent(Graphics);

        this._loadingRoot = root;
    }

    private setLoadingText(text: string) {
        if (this._loadingLabel) {
            this._loadingLabel.string = text;
        }
    }

    private setLoadingProgress(progress: number, text?: string) {
        if (text) {
            this.setLoadingText(text);
        }
        if (this._loadingBar) {
            const width = 360 * Math.max(0, Math.min(1, progress));
            this._loadingBar.clear();
            this._loadingBar.fillColor = new Color(63, 125, 255, 255);
            this._loadingBar.roundRect(-180, -4, width, 8, 4);
            this._loadingBar.fill();
        }
    }

    private makeNode(name: string, parent: Node, width: number, height: number, x = 0, y = 0): Node {
        const node = new Node(name);
        node.setParent(parent);
        const ui = node.addComponent(UITransform);
        ui.setContentSize(width, height);
        node.setPosition(x, y, 0);
        return node;
    }

    private makeLabel(
        name: string,
        parent: Node,
        text: string,
        fontSize: number,
        color: Color,
        width: number,
        height: number,
        x: number,
        y: number,
        align: Label.HorizontalAlign = Label.HorizontalAlign.CENTER,
        anchorX = 0.5,
    ): Label {
        const node = this.makeNode(name, parent, width, height, x, y);
        node.getComponent(UITransform)!.setAnchorPoint(anchorX, 0.5);

        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 6;
        label.color = color;
        label.horizontalAlign = align;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return label;
    }

    private makeButton(
        name: string,
        parent: Node,
        text: string,
        width: number,
        height: number,
        x: number,
        y: number,
        color: Color,
        onClick: () => void,
    ): Button {
        const node = this.makeNode(name, parent, width, height, x, y);

        const g = node.addComponent(Graphics);
        g.fillColor = color;
        g.roundRect(-width / 2, -height / 2, width, height, Math.min(14, height / 2));
        g.fill();

        const btn = node.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.96;
        node.on(Button.EventType.CLICK, onClick, this);

        this.makeLabel('Label', node, text, 26, Color.WHITE, width, height, 0, 0);
        return btn;
    }

    private delay(ms: number): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }
}
