/**
 * Loads the SDK script
 */
const load = (window as any).JOGOS_SDK
  ? Promise.resolve((window as any).JOGOS_SDK)
  : new Promise((resolve, reject) => {
      let script = document.createElement('script');
      var match = location.host.match(/\.jogos\w*\.com$/);

      script.src = match
        ? `${location.protocol}//www${match[0]}/sdk/jogos-sdk-v1.js`
        : 'https://sdk.jogosfans.com/jogos-sdk-v1.js';
      script.async = true;

      script.onload = () => resolve(void 0);
      script.onerror = () => reject('Failed to load jogos-sdk-v1.js. Please check your internet connection.');

      document.head.appendChild(script);
    }).then(() => (window as any).JOGOS_SDK);

/**
 * Game item
 */
export interface GameItem {
  /**
   * Item id
   */
  id: string;

  /**
   * Owned amount
   */
  amount: number;

  /**
   * Difference from the amount returned last time
   */
  difference: number;
}

/**
 * System information
 */
export interface SystemInfo {
  /**
   * Current game id
   */
  gameId: number;

  /**
   * Device type
   */
  deviceType: 'pc' | 'mobile' | 'tablet';

  /**
   * Current language
   */
  language: string;

  /**
   * Current operating system and version
   */
  os: string;

  /**
   * Current browser and version
   */
  browser: string;

  /**
   * Whether group chat is supported
   */
  hasGameGroup: boolean;

  /**
   * Current server timestamp
   */
  serverTime: number;

  /**
   * Banner ad refresh interval
   */
  bannerIntervalTime: number;

  /**
   * Minimum interval between midgame ads
   */
  midgameIntervalTime: number;

  /**
   * Invite arguments
   */
  invateArgs?: { [key: string]: any };
}

/**
 * User information
 */
export interface UserInfo {
  /**
   * User id
   */
  userId: string;

  /**
   * Username
   */
  username: string;

  /**
   * Avatar URL
   */
  profilePictureUrl: string;

  /**
   * Game id
   */
  gameId: number;
}

/**
 * Ad type to play
 */
export type RequestAdType = 'midgame' | 'rewarded';

/**
 * Ad playback callbacks
 */
export interface RequestAdCallbacks {
  /**
   * Called after playback starts
   */
  onstarted(): void;

  /**
   * Called after playback ends
   */
  onfinished(): void;

  /**
   * Called when playback fails
   *
   * @param error Error information
   */
  onerror(error: {
    /**
     * Error code
     *
     * 400: Ad request limit exceeded
     * 500: Promise error
     */
    code: number;

    /**
     * Error message
     */
    message: string;
  }): void;
}

/**
 * Payment order
 */
export interface PaymentOrder {
  /**
   * Game id
   */
  gameId: number;

  /**
   * Game name
   */
  gameName: string;

  /**
   * User id
   */
  userId: number;

  /**
   * Order number
   */
  orderNo: string;

  /**
   * Goods id
   */
  goodsId: string;

  /**
   * Goods name
   */
  goodsName: string;

  /**
   * Currency
   */
  currency: string;

  /**
   * Country
   */
  country: string;

  /**
   * Discount
   */
  discount: number;

  /**
   * Calorcoin deduction
   */
  calorcoin: number;

  /**
   * Paid amount
   */
  paid: number;

  /**
   * Payment channel
   */
  channel: string;

  /**
   * Payment type
   */
  paymentType: string;

  /**
   * Payment number
   */
  paymentNo: string;

  /**
   * Order status  pending: awaiting payment  fail: payment failed  cancel: canceled  expire: expired  success: payment succeeded  refunding: refund in progress  refunded: refund succeeded  refund-fail: refund failed  delivered: delivered
   */
  status: 'pending' | 'fail' | 'cancel' | 'expire' | 'success' | 'refunding' | 'refunded' | 'refund-fail' | 'delivered';

  /**
   * Order creation time
   */
  createTime: String;

  /**
   * Refund number
   */
  refundNo: String;

  /**
   * Refund description
   */
  refundDescription: String;

  /**
   * Refund time
   */
  refundTime: String;

  /**
   * Refund completion time
   */
  refundedTime: String;
}

/**
 * Game share arguments
 */
export interface GameShareArgs {
  /**
   * Player nickname
   */
  userName: string;
  /**
   * In-game character ID
   */
  userRoleId: string;
  /**
   * ID of the server the character belongs to
   */
  serverId: string;
  /**
   * Share type (game/achievement/activity, etc.)
   */
  shareType: 'game' | 'achievement' | 'activity';
  /**
   * Game name
   */
  gameName: string;
  /**
   * Share image (e.g. game logo/screenshot)
   */
  shareImage: string;
  /**
   * Share content
   */
  dynamicContent: string;
  /**
   * Target social platform (Facebook/Twitter/wechat, etc.)
   */
  targetPlatform: string;
}

export default {
  /**
   * Initializes JOGOS_SDK (required and must be the first call; other methods are available only after it succeeds)
   *
   * @param engine Game engine
   * @param args Custom argument collection
   */
  init(engine?: string, ...args: any[]): Promise<SystemInfo> {
    return load.then((sdk) => sdk.init(engine, ...args));
  },

  /**
   * User APIs
   */
  user: {
    /**
     * Retrieves user information
     */
    getUser(): Promise<UserInfo> {
      return load.then((sdk) => sdk.user.getUser());
    },

    /**
     * Retrieves the public key
     */
    getPublicKey(): Promise<string> {
      return load.then((sdk) => sdk.user.getPublicKey());
    },

    /**
     * Retrieves the user token
     */
    getUserToken(): Promise<string> {
      return load.then((sdk) => sdk.user.getUserToken());
    },
  },

  /**
   * Game APIs
   */
  game: {
    /**
     * Pauses the game
     */
    pause(): Promise<void> {
      return load.then((sdk) => sdk.game.pause());
    },

    /**
     *
     * @returns Resume the game
     */
    continuePlay(): Promise<void> {
      return load.then((sdk) => sdk.game.continuePlay());
    },

    /**
     * Notifies the start of game loading. Must be called whenever game loading starts.
     */
    loadingStart(): Promise<void> {
      return load.then((sdk) => sdk.game.loadingStart());
    },

    /**
     * Notifies the end of game loading. Must be called when loading finishes and the game actually starts.
     */
    loadingEnd(): Promise<void> {
      return load.then((sdk) => sdk.game.loadingEnd());
    },

    /**
     * Game happy time
     */
    happytime(): Promise<void> {
      return load.then((sdk) => sdk.game.happytime());
    },

    /**
     * Synchronizes cached (progress) data to the cloud
     */
    synchronizeToCloud(): Promise<void> {
      return load.then((sdk) => sdk.game.synchronizeToCloud());
    },

    /**
     * Checks whether the given players are my friends
     *
     * @param userIds Player id collection
     */
    isMyFriends(userIds: number[]): Promise<Array<{ userId: number; isMyFriend: boolean }>> {
      return load.then((sdk) => sdk.game.isMyFriends(userIds));
    },

    /**
     * Sends a friend request to the given player
     *
     * @param userId Id of the player to send the friend request to
     */
    sendFriendRequest(userId: number): Promise<void> {
      return load.then((sdk) => sdk.game.sendFriendRequest(userId));
    },

    /**
     * Opens the chat window
     *
     * @param userId Id of the player to chat with
     */
    openChatDialog(userId: number): Promise<void> {
      return load.then((sdk) => sdk.game.openChatDialog(userId));
    },

    /**
     * Opens the invite window
     *
     * @param invateArgs Invite arguments (passed back to the invited player during initialization when they join the game)
     */
    openInvateDialog(invateArgs: { [key: string]: any }): Promise<void> {
      return load.then((sdk) => sdk.game.openInvateDialog(invateArgs));
    },

    /**
     * Commits achievement data
     *
     * @param name Achievement name
     * @param progress Completion progress
     * @param hidden Hidden flag
     */
    commitAchievementsData(name: string, progress: number, hidden: boolean) {
      return load.then((sdk) => sdk.game.commitAchievementsData(name, progress, hidden));
    },

    /**
     * Opens the achievements window
     */
    openAchievementsDialog(): Promise<void> {
      return load.then((sdk) => sdk.game.openAchievementsDialog());
    },

    /**
     * Commits leaderboard data
     *
     * @param rankingName Leaderboard name
     * @param data Leaderboard data (key-value pairs; values may only be numbers, strings or dates, and must match the data format configured in the Developer Center)
     */
    commitRankingData(rankingName: string, data: { [key: string]: any }): Promise<void> {
      return load.then((sdk) => sdk.game.commitRankingData(rankingName, data));
    },

    /**
     * Opens the leaderboard window
     *
     * @param rankingName Leaderboard name
     */
    openRankingDialog(rankingName: string): Promise<void> {
      return load.then((sdk) => sdk.game.openRankingDialog(rankingName));
    },

    /**
     * Redeems a prize
     *
     * @param cdkey Redemption code
     *
     * @returns cdkeyId
     */
    exchangePrizes(cdkey: string): Promise<string> {
      return load.then((sdk) => sdk.game.exchangePrizes(cdkey));
    },

    /**
     * Share API
     * @param  data Game share arguments
     *
     */
    share(data: GameShareArgs): Promise<void> {
      return load.then((sdk) => sdk.game.share(data));
    },
  },

  /**
   * Video ad APIs
   */
  ad: {
    /**
     * Requests to play a video ad
     *
     * @param type Ad type
     * @param callbacks Callback collection
     */
    requestAd(type: RequestAdType, callbacks: RequestAdCallbacks): void {
      load.then((sdk) => sdk.ad.requestAd(type, callbacks));
    },

    /**
     * Retrieves the remaining rewarded ad count
     */
    getRewardAdCount(): Promise<number> {
      return load.then((sdk) => sdk.ad.getRewardAdCount());
    },

    /**
     * Checks whether the player has an ad blocker
     *
     * @returns Promise<true>: blocked  Promise<false>: not blocked
     */
    hasAdblock(): Promise<boolean> {
      return load.then((sdk) => sdk.ad.hasAdblock());
    },
  },

  /**
   * Banner ad APIs
   */
  banner: {
    /**
     * Requests to show a banner
     *
     * @param id Unique node id
     * @param style Style
     * @example
     * requestBanner('banner-id', { left: '0', right: '0', height: '50px', bottom: '10px' });
     */
    requestBanner(id: string, style: Partial<CSSStyleDeclaration>): Promise<void> {
      return load.then((sdk) => sdk.banner.requestBanner(id, style));
    },

    /**
     * Clears the specified banner
     *
     * @param id DOM node id
     */
    clearBanner(id: string): Promise<void> {
      return load.then((sdk) => sdk.banner.clearBanner(id));
    },

    /**
     * Clears all banners
     */
    clearAllBanners(): Promise<void> {
      return load.then((sdk) => sdk.banner.clearAllBanners());
    },
  },

  /**
   * Payment APIs
   */
  payment: {
    /**
     * Buys out the game
     *
     * @returns Order number
     */
    buyOut(): Promise<string> {
      return load.then((sdk) => sdk.payment.buyOut());
    },

    /**
     * Purchases goods
     *
     * @param goodsId Goods id
     * @returns Order number
     */
    buyGoods(goodsId: string): Promise<string> {
      return load.then((sdk) => sdk.payment.buyGoods(goodsId));
    },

    /**
     * Retrieves order details
     *
     * @params orderNo Order number
     */
    getOrderDetail(orderNo: string): Promise<PaymentOrder> {
      return load.then((sdk) => sdk.payment.getOrderDetail(orderNo));
    },

    /**
     * Retrieves the order list
     *
     * @params status Order status
     */
    getOrderList(
      status:
        | 'pending'
        | 'fail'
        | 'cancel'
        | 'expire'
        | 'success'
        | 'refunding'
        | 'refunded'
        | 'refund-fail'
        | 'delivered',
      pageNo: number,
      pageSize: number,
    ): Promise<PaymentOrder[]> {
      return load.then((sdk) => sdk.payment.getOrderList(status, pageNo, pageSize));
    },

    /**
     * Notifies the platform that the order has been delivered
     *
     * @param orderNo Order number
     */
    deliverGoods(orderNo: string): Promise<void> {
      return load.then((sdk) => sdk.payment.deliverGoods(orderNo));
    },

    /**
     * Subscribes to order payment completion notifications
     *
     * @param callbackFn Payment completion callback
     */
    subscribeOrderPaid(callbackFn: (order: PaymentOrder) => void): Promise<void> {
      return load.then((sdk) => sdk.payment.subscribeOrderPaid(callbackFn));
    },
  },

  /**
   * Game item APIs
   */
  gameItem: {
    /**
     * Requests to open the buy-items window
     *
     * @param level Level or stage
     */
    openBuyGameItemsDialog(level: number): Promise<GameItem[]> {
      return load.then((sdk) => sdk.gameItem.openBuyGameItemsDialog(level));
    },

    /**
     * Retrieves the list of items owned by the player
     */
    getUserGameItems(): Promise<GameItem[]> {
      return load.then((sdk) => sdk.gameItem.getUserGameItems());
    },

    /**
     * Adds items owned by the player
     *
     * @param id Item id
     * @param amount Item amount
     */
    addGameItem(id: string, amount: number): Promise<GameItem[]> {
      return load.then((sdk) => sdk.gameItem.addGameItem(id, amount));
    },

    /**
     * Removes items owned by the player
     *
     * @param id Item id
     * @param amount Item amount
     */
    subtractGameItem(id: string, amount: number): Promise<GameItem[]> {
      return load.then((sdk) => sdk.gameItem.subtractGameItem(id, amount));
    },

    /**
     * Subscribes to item change notifications
     *
     * @param callbackFn Payment completion callback
     */
    subscribeGameItemChange(callbackFn: (items: GameItem[]) => void): Promise<void> {
      return load.then((sdk) => sdk.gameItem.subscribeGameItemChange(callbackFn));
    },
  },
};
