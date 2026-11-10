/**
 * 加载脚本
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
 * 游戏道具
 */
export interface GameItem {
  /**
   * 道具id
   */
  id: string;

  /**
   * 持有数量
   */
  amount: number;

  /**
   * 与上次返回的道具数量的差值
   */
  difference: number;
}

/**
 * 系统信息
 */
export interface SystemInfo {
  /**
   * 当前游戏 Id
   */
  gameId: number;

  /**
   * 设备类型
   */
  deviceType: 'pc' | 'mobile' | 'tablet';

  /**
   * 当前语言
   */
  language: string;

  /**
   * 当前操作系统及版本
   */
  os: string;

  /**
   * 当前浏览器及版本
   */
  browser: string;

  /**
   * 是否支持群聊
   */
  hasGameGroup: boolean;

  /**
   * 当前服务器时间戳
   */
  serverTime: number;

  /**
   * 横幅广告刷新时间
   */
  bannerIntervalTime: number;

  /**
   * 中场广告最低间隔时间
   */
  midgameIntervalTime: number;

  /**
   * 邀请参数
   */
  invateArgs?: { [key: string]: any };
}

/**
 * 用户信息
 */
export interface UserInfo {
  /**
   * 用户 Id
   */
  userId: string;

  /**
   * 用户名
   */
  username: string;

  /**
   * 头像URL
   */
  profilePictureUrl: string;

  /**
   * 游戏 Id
   */
  gameId: number;
}

/**
 * 播放广告类型
 */
export type RequestAdType = 'midgame' | 'rewarded';

/**
 * 播放广告回调
 */
export interface RequestAdCallbacks {
  /**
   * 开始播放后
   */
  onstarted(): void;

  /**
   * 结束播放后
   */
  onfinished(): void;

  /**
   * 播放出错
   *
   * @param error 错误信息
   */
  onerror(error: {
    /**
     * 错误码
     *
     * 400: 超出广告数量限制
     * 500: Promise 错误
     */
    code: number;

    /**
     * 错误消息
     */
    message: string;
  }): void;
}

/**
 * 支付订单
 */
export interface PaymentOrder {
  /**
   * 游戏 Id
   */
  gameId: number;

  /**
   * 游戏名称
   */
  gameName: string;

  /**
   * 用户 Id
   */
  userId: number;

  /**
   * 订单编号
   */
  orderNo: string;

  /**
   * 商品 Id
   */
  goodsId: string;

  /**
   * 商品名称
   */
  goodsName: string;

  /**
   * 币种
   */
  currency: string;

  /**
   * 国家
   */
  country: string;

  /**
   * 折扣
   */
  discount: number;

  /**
   * 热力币扣减
   */
  calorcoin: number;

  /**
   * 支付金额
   */
  paid: number;

  /**
   * 支付渠道
   */
  channel: string;

  /**
   * 支付类型
   */
  paymentType: string;

  /**
   * 支付单号
   */
  paymentNo: string;

  /**
   * 订单状态  pending: 待支付  fail: 支付失败  cancel: 已取消  expire: 已过期  success: 支付成功  refunding: 退款中  refunded: 退款成功  refund-fail: 退款失败  delivered: 已发货
   */
  status: 'pending' | 'fail' | 'cancel' | 'expire' | 'success' | 'refunding' | 'refunded' | 'refund-fail' | 'delivered';

  /**
   * 订单创建时间
   */
  createTime: String;

  /**
   * 退款单号
   */
  refundNo: String;

  /**
   * 退款说明
   */
  refundDescription: String;

  /**
   * 退款时间
   */
  refundTime: String;

  /**
   * 成功退款时间
   */
  refundedTime: String;
}

/**
 * 游戏分享参数
 */
export interface GameShareArgs {
  /**
   * 玩家昵称
   */
  userName: string;
  /**
   * 游戏内角色ID
   */
  userRoleId: string;
  /**
   * 角色所在区服ID
   */
  serverId: string;
  /**
   * 分享类型（game/achievement/activity等）
   */
  shareType: 'game' | 'achievement' | 'activity';
  /**
   * 游戏名称
   */
  gameName: string;
  /**
   * 分享图片（如游戏logo/截图等）
   */
  shareImage: string;
  /**
   * 分享内容
   */
  dynamicContent: string;
  /**
   * 目标社交平台（Facebook/Twitter/wechat等）
   */
  targetPlatform: string;
}

export default {
  /**
   * 初始化 JOGOS_SDK（必须且作为第一个方法调用，成功后才能调用其它方法）
   *
   * @param engine 游戏引擎
   * @param args 自定义参数集合
   */
  init(engine?: string, ...args: any[]): Promise<SystemInfo> {
    return load.then((sdk) => sdk.init(engine, ...args));
  },

  /**
   * 用户类接口
   */
  user: {
    /**
     * 获取用户信息
     */
    getUser(): Promise<UserInfo> {
      return load.then((sdk) => sdk.user.getUser());
    },

    /**
     * 获取公钥
     */
    getPublicKey(): Promise<string> {
      return load.then((sdk) => sdk.user.getPublicKey());
    },

    /**
     * 获取用户令牌信息
     */
    getUserToken(): Promise<string> {
      return load.then((sdk) => sdk.user.getUserToken());
    },
  },

  /**
   * 游戏类接口
   */
  game: {
    /**
     * 游戏暂停
     */
    pause(): Promise<void> {
      return load.then((sdk) => sdk.game.pause());
    },

    /**
     *
     * @returns 继续游戏
     */
    continuePlay(): Promise<void> {
      return load.then((sdk) => sdk.game.continuePlay());
    },

    /**
     * 开始加载游戏 当您开始加载游戏时，都必须调用该函数
     */
    loadingStart(): Promise<void> {
      return load.then((sdk) => sdk.game.loadingStart());
    },

    /**
     * 结束加载游戏 当加载完成并最终开始游戏时，必须调用该函数
     */
    loadingEnd(): Promise<void> {
      return load.then((sdk) => sdk.game.loadingEnd());
    },

    /**
     * 游戏快乐时光
     */
    happytime(): Promise<void> {
      return load.then((sdk) => sdk.game.happytime());
    },

    /**
     * 同步缓存（进度）数据到云
     */
    synchronizeToCloud(): Promise<void> {
      return load.then((sdk) => sdk.game.synchronizeToCloud());
    },

    /**
     * 检查指定玩家是否我的好友
     *
     * @param userIds 玩家 Id 集合
     */
    isMyFriends(userIds: number[]): Promise<Array<{ userId: number; isMyFriend: boolean }>> {
      return load.then((sdk) => sdk.game.isMyFriends(userIds));
    },

    /**
     * 向指定玩家发送请求加为好友申请
     *
     * @param userId 请求加为好友的玩家 Id
     */
    sendFriendRequest(userId: number): Promise<void> {
      return load.then((sdk) => sdk.game.sendFriendRequest(userId));
    },

    /**
     * 打开聊天窗口
     *
     * @param userId 要和其聊天的玩家 Id
     */
    openChatDialog(userId: number): Promise<void> {
      return load.then((sdk) => sdk.game.openChatDialog(userId));
    },

    /**
     * 打开邀请窗口
     *
     * @param invateArgs 邀请参数（被邀请的玩家加入游戏时在初始化的时候会带上此参数）
     */
    openInvateDialog(invateArgs: { [key: string]: any }): Promise<void> {
      return load.then((sdk) => sdk.game.openInvateDialog(invateArgs));
    },

    /**
     * 提交成就数据
     *
     * @param name 成就名称
     * @param progress 完成进度
     * @param hidden 隐藏标记
     */
    commitAchievementsData(name: string, progress: number, hidden: boolean) {
      return load.then((sdk) => sdk.game.commitAchievementsData(name, progress, hidden));
    },

    /**
     * 打开成就窗口
     */
    openAchievementsDialog(): Promise<void> {
      return load.then((sdk) => sdk.game.openAchievementsDialog());
    },

    /**
     * 提交排行榜数据
     *
     * @param rankingName 排行榜名称
     * @param data 排行榜数据（键值对，值只能是数字，字符串和日期三者之一，需与在开发者中心配置数据格式保持一致）
     */
    commitRankingData(rankingName: string, data: { [key: string]: any }): Promise<void> {
      return load.then((sdk) => sdk.game.commitRankingData(rankingName, data));
    },

    /**
     * 打开排行榜窗口
     *
     * @param rankingName 排行榜名称
     */
    openRankingDialog(rankingName: string): Promise<void> {
      return load.then((sdk) => sdk.game.openRankingDialog(rankingName));
    },

    /**
     * 兑换奖品
     *
     * @param cdkey 兑换码
     *
     * @returns cdkeyId
     */
    exchangePrizes(cdkey: string): Promise<string> {
      return load.then((sdk) => sdk.game.exchangePrizes(cdkey));
    },

    /**
     * 分享接口
     * @param  data 游戏分享参数
     *
     */
    share(data: GameShareArgs): Promise<void> {
      return load.then((sdk) => sdk.game.share(data));
    },
  },

  /**
   * 视频类广告接口
   */
  ad: {
    /**
     * 请求播放视频广告
     *
     * @param type 广告类型
     * @param callbacks 回调函数集合
     */
    requestAd(type: RequestAdType, callbacks: RequestAdCallbacks): void {
      load.then((sdk) => sdk.ad.requestAd(type, callbacks));
    },

    /**
     * 获取激励广告剩余次数
     */
    getRewardAdCount(): Promise<number> {
      return load.then((sdk) => sdk.ad.getRewardAdCount());
    },

    /**
     * 玩家是否有广告拦截器
     *
     * @returns Promise<true>: 有拦截  Promise<false>: 没有拦截
     */
    hasAdblock(): Promise<boolean> {
      return load.then((sdk) => sdk.ad.hasAdblock());
    },
  },

  /**
   * 条幅广告类接口
   */
  banner: {
    /**
     * 请求显示横幅
     *
     * @param id 节点唯一Id
     * @param style 样式
     * @example
     * requestBanner('banner-id', { left: '0', right: '0', height: '50px', bottom: '10px' });
     */
    requestBanner(id: string, style: Partial<CSSStyleDeclaration>): Promise<void> {
      return load.then((sdk) => sdk.banner.requestBanner(id, style));
    },

    /**
     * 清除指定横幅
     *
     * @param id DOM节点Id
     */
    clearBanner(id: string): Promise<void> {
      return load.then((sdk) => sdk.banner.clearBanner(id));
    },

    /**
     * 清除所有横幅
     */
    clearAllBanners(): Promise<void> {
      return load.then((sdk) => sdk.banner.clearAllBanners());
    },
  },

  /**
   * 支付类接口
   */
  payment: {
    /**
     * 买断游戏
     *
     * @returns 订单编号
     */
    buyOut(): Promise<string> {
      return load.then((sdk) => sdk.payment.buyOut());
    },

    /**
     * 购买商品
     *
     * @param goodsId 商品Id
     * @returns 订单编号
     */
    buyGoods(goodsId: string): Promise<string> {
      return load.then((sdk) => sdk.payment.buyGoods(goodsId));
    },

    /**
     * 获取订单详情
     *
     * @params orderNo 订单编号
     */
    getOrderDetail(orderNo: string): Promise<PaymentOrder> {
      return load.then((sdk) => sdk.payment.getOrderDetail(orderNo));
    },

    /**
     * 获取订单列表
     *
     * @params status 订单状态
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
     * 通知平台订单已经发货
     *
     * @param orderNo 订单号
     */
    deliverGoods(orderNo: string): Promise<void> {
      return load.then((sdk) => sdk.payment.deliverGoods(orderNo));
    },

    /**
     * 订阅订单支付完成通知
     *
     * @param callbackFn 支付完成回调方法
     */
    subscribeOrderPaid(callbackFn: (order: PaymentOrder) => void): Promise<void> {
      return load.then((sdk) => sdk.payment.subscribeOrderPaid(callbackFn));
    },
  },

  /**
   * 道具类接口
   */
  gameItem: {
    /**
     * 请求打开购买道具窗口
     *
     * @param level 关卡或等级
     */
    openBuyGameItemsDialog(level: number): Promise<GameItem[]> {
      return load.then((sdk) => sdk.gameItem.openBuyGameItemsDialog(level));
    },

    /**
     * 获取玩家持有道具列表
     */
    getUserGameItems(): Promise<GameItem[]> {
      return load.then((sdk) => sdk.gameItem.getUserGameItems());
    },

    /**
     * 增加玩家持有的道具
     *
     * @param id 道具id
     * @param amount 道具数量
     */
    addGameItem(id: string, amount: number): Promise<GameItem[]> {
      return load.then((sdk) => sdk.gameItem.addGameItem(id, amount));
    },

    /**
     * 减少玩家持有的道具
     *
     * @param id 道具id
     * @param amount 道具数量
     */
    subtractGameItem(id: string, amount: number): Promise<GameItem[]> {
      return load.then((sdk) => sdk.gameItem.subtractGameItem(id, amount));
    },

    /**
     * 订阅道具变更通知
     *
     * @param callbackFn 支付完成回调方法
     */
    subscribeGameItemChange(callbackFn: (items: GameItem[]) => void): Promise<void> {
      return load.then((sdk) => sdk.gameItem.subscribeGameItemChange(callbackFn));
    },
  },
};
