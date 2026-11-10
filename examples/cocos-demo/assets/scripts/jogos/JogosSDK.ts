import JogosSdkEsm,{SystemInfo, PaymentOrder,UserInfo, RequestAdType, RequestAdCallbacks} from './jogos-sdk.esm';
export * from './jogos-sdk.esm';

export const AdSizes = {
  AdType1: { width: 728, height: 90 },
  AdType2: { width: 300, height: 250 },
  AdType3: { width: 320, height: 50 },
  AdType4: { width: 468, height: 60 },
  AdType5: { width: 320, height: 100 },
  AdType6: { width: 970, height: 90 },
  AdType7: { width: 160, height: 600 },
  AdType8: { width: 336, height: 280 },
  AdType9: { width: 300, height: 600 },
  AdType10: { width: 970, height: 250 },
  AdType11: { width: 250, height: 250 },
  AdType12: { width: 120, height: 600 },
} as const;

export type AdSizeType = (typeof AdSizes)[keyof typeof AdSizes];

export interface BannerAdOptions {
  adUnitId: string;
  adIntervals?: number;
  adSizeType?: AdSizeType;
  style: Partial<CSSStyleDeclaration> & {
    readonly realWidth?: number;
    readonly realHeight?: number;
  };
}

export class _JogosSDK {
  private static instance: _JogosSDK;
  private _sdk: typeof JogosSdkEsm | null = null;
  private initialized = false;
  private _jogosOnFocus: Function | null = null;
  private _jogosOnBlur: Function | null = null;
  private initialServerTime: number = 0;
  private _cachedSystemInfo: SystemInfo | null = null;
  private serverTimeOffset: number = 0;
  private _isLoadingEnd: boolean = false;

  private constructor() {}

  public static getInstance(): _JogosSDK {
    if (!_JogosSDK.instance) {
      _JogosSDK.instance = new _JogosSDK();      
    }
    return _JogosSDK.instance;
  }

  get sdk(){
    if(!this._sdk){
      throw new Error("SDK not initialized. Call init() first.");
    }
    return this._sdk;
  }

  public async init(): Promise<SystemInfo | null> {
    if (this.initialized && this._cachedSystemInfo) {
      return this._cachedSystemInfo;
    }
    //make sure init only once
    if(this._sdk){
      console.warn("SDK init process started, ignore dunplicate call.");
       return null
    }
    try {     
      this._sdk = JogosSdkEsm;
      this.addJogosEventListeners();
      const systemInfo = await this._sdk.init();      
      this._cachedSystemInfo = systemInfo;
      
      const clientNow = Date.now();
      //calculate server time offset
      this.serverTimeOffset = systemInfo.serverTime ? systemInfo.serverTime - clientNow : 0;
      
      this.initialized = true;
      return systemInfo;
    } catch (error) {
      console.error("SDK initialization failed:", error);
      throw error;
    }
  }

  getCurrentTime(): number {
    const systemTime = Date.now();
    return systemTime + this.serverTimeOffset;
  }

  public getSystemInfo(): SystemInfo {
    if (!this.initialized || !this._cachedSystemInfo) {
      throw new Error("SDK not initialized. Call init() first.");
    }
    return {
      ...this._cachedSystemInfo,
      serverTime: this.getCurrentTime() 
    };
  }

  get cachedSystemInfo(): SystemInfo | null {
    return this._cachedSystemInfo;
  }

  /**
   * @zh 设置游戏窗口获得焦点时的回调
   * @en Set the callback when the game window gains focus
   * @param cb 
   */
  setFocusCallback(cb: Function){
    this._jogosOnFocus = cb
  }

  /**
   * @zh 设置游戏窗口失焦时的回调
   * @en Set the callback when the game window loses focus
   * @param cb 
   */
  setBlurCallback(cb: Function){
    this._jogosOnBlur = cb
  }

  private addJogosEventListeners() {
    // @zh 当窗口失去焦点
    // @en When the game window loses focus
    window.addEventListener("blur", ()=>{
        this.onBlur()   
    });

    // @zh 当窗口重新获得焦点
    // @en When the game window gains focus
    window.addEventListener("focus", ()=>{
        this.onFocus()
    });
  }

  /**
   * @zh 游戏窗口获得焦点
   * @en Game window gains focus
   */
  private onFocus(){
    if(this._jogosOnFocus){
      this._jogosOnFocus()
    }else{            
      window["cc"]?.game?.resume?.()
      //window["Laya"]?.timer?.resume?.()
    }        
    this.sdk!.game.continuePlay()
    // @en Hide the pause overlay
    this.hidePauseOverlay()
  }

  /**
   * @zh 游戏窗口失焦
   * @en Game window loses focus
   */
  private onBlur(){    
    this.sdk!.game.pause()
    this.showPauseOverlay()
    //avoid dev / loading pause
    if(window["CC_DEV"] || window["CC_DEBUG"] || !this._isLoadingEnd){
      return
    }
    if(this._jogosOnBlur){
      this._jogosOnBlur()      
    }else{      
      window["cc"]?.game?.pause?.()
      //window["Laya"]?.timer?.resume?.()
    } 
  }

  /**
   * @zh 获取用户信息
   * @en Get user information
   */
  public async getUser(): Promise<UserInfo> {
    await this.init();
    return this.sdk!.user.getUser();
  }

  /**
   * @zh 获取用户令牌信息
   * @en Get user token information
   */
  public async getUserToken(): Promise<string> {
    await this.init();
    return this.sdk!.user.getUserToken();
  }

  /**
   * @zh 获取公钥
   * @en Get public key
   */
  public async getPublicKey(): Promise<string> {
    await this.init();
    return this.sdk!.user.getPublicKey();
  }

    /**
   * @zh 开始加载游戏 当您开始加载游戏时，都必须调用该函数
   * @en Start loading the game. You must call this function when you start loading the game.
   */
  public async loadingStart(): Promise<void> {
    await this.init();
    return this.sdk!.game.loadingStart();
  }

  /**
   * @zh 结束加载游戏 当加载完成并最终开始游戏时，必须调用该函数
   * @en End loading the game. You must call this function when the loading is complete and the game is about to start.
   */
  public async loadingEnd(): Promise<void> {
    this._isLoadingEnd = true;
    await this.init();    
    return this.sdk!.game.loadingEnd();
  }

  /**
   * @zh 游戏暂停
   * @en Game pause
   */
  public async pause(): Promise<void> {
    await this.init();
    return this.sdk!.game.pause();
  }

  /**
   * @zh 继续游戏
   * @en Continue playing the game
   */
  public async continuePlay(): Promise<void> {
    await this.init();
    return this.sdk!.game.continuePlay();
  }

  /**
   * @zh 游戏快乐时光
   * @en Game happy time
   */
  public async happytime(): Promise<void> {
    await this.init();
    return this.sdk!.game.happytime();
  }

  /**
   * @zh 同步缓存（进度）数据到云
   * @en Synchronize cached (progress) data to the cloud
   */
  public async synchronizeToCloud(): Promise<void> {
    await this.init();
    return this.sdk!.game.synchronizeToCloud();
  }

  /**
   * @zh 提交成就数据
   * @en Submit achievements data
   */
  public async commitAchievementsData(name: string, progress: number, hidden: boolean): Promise<void> {
    await this.init();
    return this.sdk!.game.commitAchievementsData(name, progress, hidden);
  }
  /**
   * @zh 打开成就窗口
   * @en Open achievements dialog
   */
  public async openAchievementsDialog(): Promise<void> {
    await this.init();
    return this.sdk!.game.openAchievementsDialog();
  }
  /**
   * @zh 提交排行榜数据
   * @en Submit ranking data
   */
  public async commitRankingData(rankingType: string, data: { [key: string]: any }): Promise<void> {
    await this.init();
    return this.sdk!.game.commitRankingData(rankingType, data);
  }
  /**
   * @zh 打开排行榜窗口
   * @en Open ranking dialog
   */
  public async openRankingDialog(rankingType: string): Promise<void> {
    await this.init();
    return this.sdk!.game.openRankingDialog(rankingType);
  }

  /**
   * @zh 请求显示横幅
   * @en Request to display a banner
   * @param id 
   * @param style 
   */
  public async requestBannerWithNode(node:any, update:boolean = false): Promise<string> {
      await this.init();      
      //adapt to cc2.x cc3.x      
      const rect = node.getBoundingBoxToWorld ? node.getBoundingBoxToWorld() : node._uiProps.uiTransformComp.getBoundingBoxToWorld();
      const visible = window["cc"].winSize || window["cc"].view.getVisibleSize();
      const canvasRect = window["cc"].game.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cssPerPoint = canvasRect.width / visible.width;

      const leftCss = canvasRect.left + rect.xMin * cssPerPoint;
      const topCss  = canvasRect.top + (canvasRect.height - (rect.yMin + rect.height) * cssPerPoint);
      const widthCss = rect.width * cssPerPoint;
      const heightCss = rect.height * cssPerPoint;

      const bannerId = node.uuid;
      const layout = {
          width: widthCss * dpr,
          height: heightCss * dpr,
          x: leftCss * dpr,
          y: topCss * dpr,
          update: update,
          unity: true,  //for sdk compatibility
      }
      try{
          //@ts-ignore
          await this.sdk!.banner.requestBanner(bannerId, layout);
      }catch(e){
          console.error(e);
          return '';
      }
      //avoid banner created but node is destroyed or not active, clear it
      if(!node.isValid || !node.active){
          this.clearBanner(bannerId);
      }
      return bannerId;
  }

  /**
  * @deprecated please use bannerWithNode instead
   * @zh 请求显示横幅
   * @en Request to display a banner
   * @param id 
   * @param style 
   */
  public async requestBanner(adOptions: BannerAdOptions): Promise<void> {
    await this.init();
    const { adUnitId, adSizeType, style } = adOptions;
    const baseStyle = adSizeType
      ? {
          width: `${adSizeType.width}px`,
          height: `${adSizeType.height}px`,
        }
      : {};

    const cssElement = {
      ...baseStyle,
      ...style,
      ...(style.left !== undefined && {
        left:
          typeof style.left === "string" && style.left.endsWith("%")
            ? style.left
            : `${style.left}px`,
      }),
      ...(style.right !== undefined && {
        right:
          typeof style.right === "string" && style.right.endsWith("%")
            ? style.right
            : `${style.right}px`,
      }),
      ...(style.top !== undefined && {
        top:
          typeof style.top === "string" && style.top.endsWith("%")
            ? style.top
            : `${style.top}px`,
      }),
      ...(style.bottom !== undefined && {
        bottom:
          typeof style.bottom === "string" && style.bottom.endsWith("%")
            ? style.bottom
            : `${style.bottom}px`,
      }),
    };
    return this.sdk!.banner.requestBanner(adUnitId, cssElement);
  }

  /**
   * @zh 清除指定横幅
   * @en Clear a specific banner
   * @param id DOM节点Id
   * @returns 
   */
  public async clearBanner(id: string): Promise<void> {
    await this.init();
    return this.sdk!.banner.clearBanner(id);
  }
  /**
   * @zh 清除所有横幅
   * @en Clear all banners
   */
  public async clearAllBanners(): Promise<void> {
    await this.init();
    return this.sdk!.banner.clearAllBanners();
  }
  /**
   * @zh 玩家是否有广告拦截器
   * @en Whether the player has an ad blocker
   */
  public async hasAdblock(): Promise<boolean> {
    await this.init();
    return this.sdk!.ad.hasAdblock();
  }

  /**
   * @zh 请求播放激励视频广告
   * @en Request Rewarded Ad 
   */
  public async requestAd(
    type: RequestAdType,
    callbacks: RequestAdCallbacks
  ): Promise<void> {
    await this.init();
    callbacks = callbacks || {} as RequestAdCallbacks
    callbacks.onstarted = callbacks.onstarted || (() => {})
    callbacks.onfinished = callbacks.onfinished || (() => {})
    callbacks.onerror = callbacks.onerror || (() => {})
    if(callbacks.onstarted){
      let replaceFunc = callbacks.onstarted
      callbacks.onstarted = () => {
        replaceFunc()
        this.onBlur()
      }
    }
    if(callbacks.onfinished){
      let replaceFunc = callbacks.onfinished
      callbacks.onfinished = () => {
        replaceFunc()
        this.onFocus()
      }
    }
    //make sure error callback not null
    let replaceFunc = callbacks.onerror || (() => {})
    callbacks.onerror = (error: { code: number; message: string } | string) => {        
      this.onFocus()
      if(typeof error == "string"){
        replaceFunc({code:0,message:error})
        this.showToast(`${error}`); 
      }else{
        replaceFunc(error)
        this.showToast(`${error?.code}`); 
      }
    }
    return this.sdk!.ad.requestAd(type, callbacks);
  }

  /**
   * @zh 获取激励广告剩余次数
   * @en Get the remaining number of rewarded ads
   */
  public async getRewardAdCount(): Promise<number> {
    await this.init();
    return this.sdk!.ad.getRewardAdCount();
  }

  // 买断游戏
  public async buyOut(): Promise<string> {
    await this.init();
    return this.sdk!.payment.buyOut();
  }

  /**
   * @zh 购买商品
   * @en Buy a product
   * @param goodsId
   * @returns orderId
   */
  public async buyGoods(goodId: string) {
    await this.init();
    return this.sdk!.payment.buyGoods(goodId);
  }

    /**
   * @zh 获取订单详情
   * @en Get order details   
   */
  public async getOrderDetail(orderNo: string): Promise<PaymentOrder> {
    await this.init();
    return this.sdk!.payment.getOrderDetail(orderNo);
  }

  public async getOrderList(
    status: 'pending' | 'fail' | 'cancel' | 'expire' | 'success' | 'refunding' | 'refunded' | 'refund-fail' | 'delivered',
    pageNo: number,
    pageSize: number,
  ): Promise<PaymentOrder[]> {
    await this.init();
    return this.sdk!.payment.getOrderList(status, pageNo, pageSize);
  }

    /**
   * @zh 通知平台订单已经发货
   * @en Notify the platform that the order has been delivered
   * @param orderNo 订单号
   */
  public async deliverGoods(orderNo: string): Promise<void> {
    await this.init();    
    return this.sdk!.payment.deliverGoods(orderNo);
  }

  /**
   * @zh 订阅订单支付完成通知
   * @en Subscribe to order payment completion notifications
   */
  public async subscribeOrderPaid(
    callbackFn: (order: PaymentOrder) => void
  ): Promise<void> {
    await this.init();
    return this.sdk!.payment.subscribeOrderPaid(callbackFn);
  }

  /**
   * @zh 确认弹窗
   * @en Show a message box with OK and OK/CANCEL buttons   
   */
  public showMsgBox(msg: string, params?:{type:"OK"|"OK_CANCEL", okCallback?:()=>void, cancelCallback?:()=>void}) {
      console.log("showMsgBox: ", msg, params);
      params = params || {type:"OK"}

      let msgBoxDiv = document.querySelector("msgBoxDiv");
      if(msgBoxDiv){
        msgBoxDiv.remove();
      }
      //创建div
      let div = document.createElement('msgBoxDiv');
      div.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: #fff;
        padding: 20px;
        border-radius: 10px;
        z-index: 10000;
        text-align: center;
        min-width: 200px;
      `;      
      div.innerHTML = `
        <p style="margin: 0 0 20px 0; font-size: 18px;">${msg}</p>
        <div style="display: flex; justify-content: center; gap: 10px;">
          <button id="confirmBtn" style="
            padding: 8px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            min-width: 80px;
          ">Ok</button>        
          ${params.type === "OK_CANCEL" ? `<button id="cancelBtn" style="
            padding: 8px 20px;
            background-color: #f44336;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            min-width: 80px;
          ">Cancel</button>` : ""}
        </div>
      `;
      document.body.appendChild(div);
      let btn = div.querySelector("#confirmBtn")!;
      btn.addEventListener("click",()=>{
        div.remove();
        params.okCallback?.()
      })

      if(params.type === "OK_CANCEL"){
        let btn = div.querySelector("#cancelBtn");
        btn.addEventListener("click",()=>{
          div.remove();
          params.cancelCallback?.()
        })
      }
      
  }


  public showToast(message: string, params?:{duration?:number, type?:"error" | "info"}): void {
    console.log("showToast: ", message, params); 
    if(typeof params == "number"){
       params = {duration:params}
    }else{
      params = params || {duration:2, type:"error"}
    }    
    const type = params.type || "error";
    const duration = params.duration || 2;
    //div
    const toast = document.createElement('div');
    toast.textContent = message;
    // styles
    let backgroundStyle: string;
    let boxShadowStyle: string;
    let borderStyle: string;
    let iconText: string;
    
    if (type === "error") {
      backgroundStyle = "linear-gradient(135deg,rgb(223, 136, 143),rgb(241, 119, 119))";
      boxShadowStyle = "0 8px 32px rgba(255, 71, 87, 0.4)";
      borderStyle = "2px solid #ff6b7a";
      iconText = "⚠️";
    } else { // info
      backgroundStyle = "linear-gradient(135deg,rgb(136, 196, 223),rgb(119, 181, 241))";
      boxShadowStyle = "0 8px 32px rgba(71, 150, 255, 0.4)";
      borderStyle = "2px solid #6bb7ff";
      iconText = "ℹ️";
    }
    
    toast.style.cssText = `
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${backgroundStyle};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      box-shadow: ${boxShadowStyle};
      border: ${borderStyle};
      z-index: 10000;
      pointer-events: none;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      transform: translate(-50%, -50%) scale(0.8);
      text-align: center;
      min-width: 200px;
      backdrop-filter: blur(10px);
    `;
    
    // icon
    const icon = document.createElement('span');
    icon.textContent = iconText;
    icon.style.cssText = `
      font-size: 18px;
      margin-right: 8px;
    `;
    toast.insertBefore(icon, toast.firstChild);
    //add child
    document.body.appendChild(toast);
    //show
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);    
    //auto hide
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, -50%) scale(0.8)';
      setTimeout(() => {
        if (toast.parentNode) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, duration * 1000);
  }

private showPauseOverlay() {
    // check exist
    let overlay = document.getElementById('pauseOverlay');
    if (!overlay) {
      // create div
      overlay = document.createElement('div');
      overlay.id = 'pauseOverlay';      
      //styles
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      overlay.style.display = 'flex';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      overlay.style.zIndex = '9999';
      overlay.style.pointerEvents = 'auto'; // Enable pointer events for click handling
      overlay.style.cursor = 'pointer'; // Show pointer cursor to indicate clickable
      
      //text "pause..."
      const pauseText = document.createElement('div');
      pauseText.textContent = 'pause...';
      pauseText.style.color = 'white';
      pauseText.style.fontSize = '32px';
      pauseText.style.fontWeight = 'bold';
      pauseText.style.pointerEvents = 'none'; // Prevent text from blocking overlay clicks
      
      overlay.appendChild(pauseText);
      
      // Add click event to trigger window focus
      overlay.addEventListener('click', () => {
        console.log('[JogosSDK] Pause overlay clicked, triggering window focus');         
        try {
          // Focus the window
          window.focus();        
        } catch (error) {
          console.warn('[JogosSDK] Error triggering focus:', error);
        }
      });      
      // find game html container to append gray mask
      const containerIds = [        
        'GameDiv',
        'Cocos3dGameContainer', 
        'Cocos2dGameContainer',
        'layaContainer',
        'egret-player',
        'egret-container'
      ].filter(Boolean); // filter empty id
      
      let gameDiv = null;
      let isLayaEngine = false;
      
      for (const id of containerIds) {
        gameDiv = document.getElementById(id);
        if (gameDiv) {
          // check if laya engine
          if (id === 'layaContainer') {
            isLayaEngine = true;
          }
          break;
        }
      }
      
      // fallback: find canvas element parent container
      if (!gameDiv) {
        const canvas = document.querySelector('canvas');
        gameDiv = canvas?.parentElement;
        // check if layaCanvas
        if (canvas && canvas.id === 'layaCanvas') {
          isLayaEngine = true;
        }
      }
      
      if (gameDiv) {
        // special handling for laya engine
        if (isLayaEngine) {
          // get canvas actual size and position
          const canvas = gameDiv.querySelector('canvas');
          if (canvas) {
            const canvasRect = canvas.getBoundingClientRect();
            const containerRect = gameDiv.getBoundingClientRect();            
            // set overlay position to match canvas actual position and size
            overlay.style.position = 'absolute';
            overlay.style.top = (canvasRect.top - containerRect.top) + 'px';
            overlay.style.left = (canvasRect.left - containerRect.left) + 'px';
            overlay.style.width = canvasRect.width + 'px';
            overlay.style.height = canvasRect.height + 'px';
          }
        }
        
        gameDiv.style.position = 'relative';
        gameDiv.appendChild(overlay);
      } else {
        document.body.appendChild(overlay);
        overlay.style.position = 'fixed';
      }
    } else {
      overlay.style.display = 'flex';
    }
  }

  private hidePauseOverlay() {
    const overlay = document.getElementById('pauseOverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
}

const JogosSDK = _JogosSDK.getInstance();
window["jogosSDKInst"] = window["jogosSDKInst"] || JogosSDK
window["JogosSDK"] = window["JogosSDK"] || JogosSDK
export default JogosSDK

declare global {
    interface Window {
        JogosSDK: _JogosSDK;
        jogosSDKInst: _JogosSDK;
    }
    var JogosSDK: _JogosSDK;
    var jogosSDKInst: _JogosSDK;
}
