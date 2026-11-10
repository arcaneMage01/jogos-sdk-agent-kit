mergeInto(LibraryManager.library, {
  /**
   * 加载游戏脚本
   *
   * @returns {Promise<Object>}
   */
  JogosSDK_load: function () {
    return (
      window.JOGOS_SDK_LOADER ||
      (window.JOGOS_SDK_LOADER = new Promise(function (resolve, reject) {
        // 引入 sdk 脚本
        var script = document.createElement('script');
        var match = location.host.match(/\.jogos\w*\.com$/);

        script.src = match
          ? `${location.protocol}//www${match[0]}/sdk/jogos-sdk-v1.js`
          : 'https://sdk.jogosfans.com/jogos-sdk-v1.js';
        script.async = true;

        script.onload = resolve;

        script.onerror = function () {
          reject('Failed to load "jogos-sdk-v1.js". Please check your internet connection.');
        };

        document.head.appendChild(script);
      }).then(function () {
        return window.JOGOS_SDK;
      }))
    );
  },

  /**
   * 等待异步结果
   *
   * @param {string} type 消息类型
   * @param {Promise} promise 异步对象
   */
  JogosSDK_wait: function (type, promise) {
    promise
      .then(function (result) {
        if (result) {
          SendMessage('JogosSDKSingleton', type, typeof result === 'object' ? JSON.stringify(result) : result);
        } else {
          SendMessage('JogosSDKSingleton', type);
        }
      })
      .catch(function (err) {
        SendMessage('JogosSDKSingleton', type + 'Error', '' + err);
      });
  },

  /**
   * JogosSDK 初始化
   *
   * @callback {(info: SystemInfo) => void} JSLibCallback_Init 成功回调
   * @callback {(message: string) => void} JSLibCallback_InitError 错误回调
   *
   * interface SystemInfo {
   * // 游戏 Id
   * gameId: number;
   * // 设备类型
   * deviceType: 'pc' | 'tablet' | 'mobile';
   * // 当前语言
   * language: string;
   * // 操作系统（含版本号，用空格分隔）
   * os: string;
   * // 浏览器（含版本号，用空格分隔）
   * browser: string;
   * // 是否支持群聊
   * hasGameGroup: boolean;
   * // 服务端时间戳
   * serverTime: number;
   * // 横幅广告刷新时间
   * bannerIntervalTime: number;
   * // 中场广告最低间隔时间
   * midgameIntervalTime: number;
   * // 邀请参数
   * inviteArgs?: { [key: string]: any };
   * //买断游戏购买价格
   * gamePrice: Number;
   * }
   */
  JogosSDK_Init: function () {
    // to avoid warnings about Unity stringify beeing obsolete
    if (typeof UTF8ToString !== 'undefined') {
      window.unityStringify = UTF8ToString;
    } else {
      window.unityStringify = Pointer_stringify;
    }

    _JogosSDK_wait(
      'JSLibCallback_Init',
      _JogosSDK_load().then(function (sdk) {
        return sdk.init('Unity', Module, FS, IDBFS);
      }),
    );
  },

  /**
   * 获取用户信息
   *
   * @callback {(userInfo: UserInfo) => void} JSLibCallback_GetUser 成功回调
   * @callback {(message: string) => void} JSLibCallback_GetUserError 错误回调
   *
   * // 用户信息
   * interface UserInfo {
   *   // 用户 Id
   *   userId: string;
   *   // 用户名
   *   username: string;
   *   // 头像URL
   *   profilePictureUrl: string;
   *   // 游戏 Id
   *   gameId: number;
   * }
   */
  JogosSDK_GetUser: function () {
    _JogosSDK_wait(
      'JSLibCallback_GetUser',
      _JogosSDK_load().then(function (sdk) {
        return sdk.user.getUser();
      }),
    );
  },

  /**
   * 获取公钥
   *
   * @callback {() => string} JSLibCallback_GetPublicKey 成功回调
   * @callback {(message: string) => void} JSLibCallback_GetPublicKeyError 错误回调
   */
  JogosSDK_getPublicKey: function () {
    _JogosSDK_wait(
      'JSLibCallback_GetPublicKey',
      _JogosSDK_load().then(function (sdk) {
        return sdk.user.getPublicKey();
      }),
    );
  },

  /**
   * 获取用户令牌
   *
   * @callback {(token: string) => void} JSLibCallback_GetUserToken 成功回调
   * @callback {(message: string) => void} JSLibCallback_GetUserTokenError 错误回调
   */
  JogosSDK_GetUserToken: function () {
    _JogosSDK_wait(
      'JSLibCallback_GetUserToken',
      _JogosSDK_load().then(function (sdk) {
        return sdk.user.getUserToken();
      }),
    );
  },

  /**
   * 暂停游戏（游戏暂停时调用）
   *
   * @callback {() => void} JSLibCallback_GamePause 成功回调
   * @callback {(message: string) => void} JSLibCallback_GamePauseError 错误回调
   */
  JogosSDK_GamePause: function () {
    _JogosSDK_wait(
      'JSLibCallback_GamePause',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.pause();
      }),
    );
  },

  /**
   * 继续游戏（游戏通关时调用）
   *
   * @callback {() => void} JSLibCallback_GameContinue 成功回调
   * @callback {(message: string) => void} JSLibCallback_GameContinueError 错误回调
   */
  JogosSDK_GameContinue: function () {
    _JogosSDK_wait(
      'JSLibCallback_GameContinue',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.continuePlay();
      }),
    );
  },

  /**
   * 快乐时光（游戏通关时调用）
   *
   * @callback {() => void} JSLibCallback_HappyTime 成功回调
   * @callback {(message: string) => void} JSLibCallback_HappyTimeError 错误回调
   */
  JogosSDK_HappyTime: function () {
    _JogosSDK_wait(
      'JSLibCallback_HappyTime',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.happytime();
      }),
    );
  },

  /**
   * 同步缓存（进度）数据到云
   *
   * @callback {() => void} JSLibCallback_SynchronizeToCloud 成功回调
   * @callback {(message: string) => void} JSLibCallback_SynchronizeToCloudError 错误回调
   */
  JogosSDK_SynchronizeToCloud: function () {
    _JogosSDK_wait(
      'JSLibCallback_SynchronizeToCloud',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.synchronizeToCloud();
      }),
    );
  },

  /**
   * 检查指定玩家是否我的好友
   *
   * @param {number[]} userIds 玩家 Id 集合
   *
   * @callback {(isMyFriends:IsMyFriends[]) => void} JSLibCallback_IsMyFriends 成功回调
   * @callback {(message: string) => void} JSLibCallback_IsMyFriendsError 错误回调
   *
   * // 成功回调
   * interface IsMyFriends {
   *   // 玩家id
   *   userId: number;
   *   // 是否是好友
   *   isMyFriend: boolean;
   * }
   */
  JogosSDK_IsMyFriends: function (userIds) {
    userIds = JSON.parse(unityStringify(userIds));

    _JogosSDK_wait(
      'JSLibCallback_IsMyFriends',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.isMyFriends(userIds);
      }),
    );
  },

  /**
   * 向指定玩家发送请求加为好友申请
   *
   * @param {number} userId 请求加为好友的玩家 Id
   *
   * @callback {() => void} JSLibCallback_SendFriendRequest 成功回调
   * @callback {(message: string) => void} JSLibCallback_SendFriendRequestError 错误回调
   */
  JogosSDK_SendFriendRequest: function (userId) {
    _JogosSDK_wait(
      'JSLibCallback_SendFriendRequest',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.sendFriendRequest(userId);
      }),
    );
  },

  /**
   * 打开聊天窗口
   *
   * @param {number} userId 要和其聊天的玩家 Id
   *
   * @callback {() => void} JSLibCallback_OpenChatDialog 成功回调
   * @callback {(message: string) => void} JSLibCallback_OpenChatDialogError 错误回调
   */
  JogosSDK_OpenChatDialog: function (userId) {
    _JogosSDK_wait(
      'JSLibCallback_OpenChatDialog',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.openChatDialog(userId);
      }),
    );
  },

  /**
   * 打开邀请窗口
   *
   * @param {{ [key: string]: any }} inviteArgs 邀请参数（被邀请的玩家加入游戏时在初始化的时候会带上此参数）
   *
   * @callback {() => void} JSLibCallback_OpenInviteDialog 成功回调
   * @callback {(message: string) => void} JSLibCallback_OpenInviteDialogError 错误回调
   */
  JogosSDK_OpenInviteDialog: function (inviteArgs) {
    inviteArgs = JSON.parse(unityStringify(inviteArgs));

    _JogosSDK_wait(
      'JSLibCallback_OpenInviteDialog',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.openInviteDialog(inviteArgs);
      }),
    );
  },

  /**
   * 提交成就数据
   *
   * @param {string} name 成就名称
   * @param {number} progress 完成进度
   * @param {boolean} hidden 隐藏标记
   *
   * @callback {() => void} JSLibCallback_CommitAchievementsData 成功回调
   * @callback {(message: string) => void} JSLibCallback_CommitAchievementsDataError 错误回调
   */
  JogosSDK_CommitAchievementsData: function (name, progress, hidden) {
    name = unityStringify(name);

    _JogosSDK_wait(
      'JSLibCallback_CommitAchievementsData',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.commitAchievementsData(name, progress, hidden);
      }),
    );
  },

  /**
   * 打开成就窗口
   *
   * @callback {() => void} JSLibCallback_OpenAchievementsDialog 成功回调
   * @callback {(message: string) => void} JSLibCallback_OpenAchievementsDialogError 错误回调
   */
  JogosSDK_OpenAchievementsDialog: function () {
    _JogosSDK_wait(
      'JSLibCallback_OpenAchievementsDialog',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.openAchievementsDialog();
      }),
    );
  },

  /**
   * 提交排行榜数据
   *
   * @param {string} rankingName 排行榜名称
   * @param {Object} data 排行榜数据（键值对，值只能是数字，字符串和日期三者之一，需与在开发者中心配置数据格式保持一致）
   *
   * @callback {() => void} JSLibCallback_CommitRankingData 成功回调
   * @callback {(message: string) => void} JSLibCallback_CommitRankingDataError 错误回调
   */
  JogosSDK_CommitRankingData: function (rankingName, data) {
    rankingName = unityStringify(rankingName);
    data = JSON.parse(unityStringify(data));

    _JogosSDK_wait(
      'JSLibCallback_CommitRankingData',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.commitRankingData(rankingName, data);
      }),
    );
  },

  /**
   * 打开排行榜窗口
   *
   * @param {string} rankingName 排行榜名称
   *
   * @callback {() => void} JSLibCallback_OpenRankingDialog 成功回调
   * @callback {(message: string) => void} JSLibCallback_OpenRankingDialogError 错误回调
   */
  JogosSDK_OpenRankingDialog: function (rankingName) {
    rankingName = unityStringify(rankingName);

    _JogosSDK_wait(
      'JSLibCallback_OpenRankingDialog',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.openRankingDialog(rankingName);
      }),
    );
  },

  /**
   * 兑换奖品
   *
   * @param {string} cdkey 兑换码
   *
   * @callback {(cdkey: string) => void} JSLibCallback_ExchangePrizes 成功回调
   * @callback {(message: string) => void} JSLibCallback_ExchangePrizesError 错误回调
   */
  JogosSDK_ExchangePrizes: function (cdkey) {
    cdkey = unityStringify(cdkey);

    _JogosSDK_wait(
      'JSLibCallback_ExchangePrizes',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.exchangePrizes(cdkey);
      }),
    );
  },

  /**
   * 分享
   *
   * @param {GameShareArgs} data 游戏分享参数
   *
   * @callback {() => void} JSLibCallback_Share 成功回调
   * @callback {(message: string) => void} JSLibCallback_ShareError 错误回调
   *
   * interface GameShareArgs {
   *   userName: string;         // 玩家昵称
   *   userRoleId: string;       // 游戏内角色ID
   *   serverId: string;         // 角色所在区服ID
   *   shareType: string;        // 分享类型（game/achievement/activity等）
   *   gameName: string;         // 游戏名称
   *   shareImage:string;        //分享图片（如游戏logo/截图等）
   *   dynamicContent:string;    //分享内容
   *   targetPlatform:string;    //目标社交平台（Facebook/Twitter/wechat等）
   * }
   */
  JogosSDK_Share: function (data) {
    data = JSON.parse(unityStringify(data));

    _JogosSDK_wait(
      'JSLibCallback_Share',
      _JogosSDK_load().then(function (sdk) {
        return sdk.game.share(data);
      }),
    );
  },

  /**
   * 请求播放视频广告
   *
   * @param {'midgame' | 'rewarded'} type 广告类型  midgame: 中场广告  rewarded: 激励广告
   *
   * @callback {() => void} JSLibCallback_RequestAdStarted 开始播放回调
   * @callback {() => void} JSLibCallback_RequestAdFinished 结束播放回调
   * @callback {(message: string) => void} JSLibCallback_RequestAdError 错误回调
   */
  JogosSDK_RequestAd: function (type) {
    type = unityStringify(type);

    _JogosSDK_load().then(function (sdk) {
      sdk.ad.requestAd(type, {
        onstarted: function () {
          SendMessage('JogosSDKSingleton', 'JSLibCallback_RequestAdStarted', type);
        },
        onfinished: function () {
          SendMessage('JogosSDKSingleton', 'JSLibCallback_RequestAdFinished', type);
        },
        onerror: function (err) {
          SendMessage('JogosSDKSingleton', 'JSLibCallback_RequestAdError', err.code ? err.message : err);
        },
      });
    });
  },

  /**
   * 获取激励广告剩余次数
   *
   * @callback {(count: number) => void} JSLibCallback_GetRewardAdCount 成功回调
   * @callback {(message: string) => void} JSLibCallback_GetRewardAdCountError 错误回调
   */
  JogosSDK_GetRewardAdCount: function () {
    _JogosSDK_wait(
      'JSLibCallback_GetRewardAdCount',
      _JogosSDK_load().then(function (sdk) {
        return sdk.ad.getRewardAdCount();
      }),
    );
  },

  /**
   * 玩家是否有广告拦截器
   *
   * @callback {(hasAdBlock: boolean) => void} JSLibCallback_HasAdblock 成功回调
   * @callback {(message: string) => void} JSLibCallback_HasAdblockError 错误回调
   */
  JogosSDK_HasAdblock: function () {
    _JogosSDK_wait(
      'JSLibCallback_HasAdblock',
      _JogosSDK_load().then(function (sdk) {
        return sdk.ad.hasAdblock(id);
      }),
    );
  },

  /**
   * 请求显示横幅
   *
   * @param {string} id DOM节点Id
   * @param {UnityLayout} layout Unity 布局数据
   *
   * @callback {(id: string) => void} JSLibCallback_RequestBanner 成功回调
   * @callback {(message: string) => void} JSLibCallback_RequestBannerError 错误回调
   * @callback {() => void} JSLibCallback_WindowResize 容器大小变化回调（需在此回调用重新调用 JogosSDK_RequestBanner 方法，并把 layout.update 设为 true）
   *
   * interface UnitLayout {
   *   x: number;         // 条幅在屏幕上的 x 坐标
   *   y: number;         // 条幅在屏幕上的 y 坐标
   *   width: number;     // 条幅在屏幕上的宽度
   *   height: number;    // 条幅在屏幕上的高度
   *   update?: boolean;  // 是否窗口变化带来的位置更新
   * }
   */
  JogosSDK_RequestBanner: function (id, layout) {
    id = unityStringify(id);
    layout = JSON.parse(unityStringify(layout));

    window.JOGOS_UNITY_ONRESIZE ||
      (function () {
        var delay = 0;

        function update() {
          SendMessage('JogosSDKSingleton', 'JSLibCallback_WindowResize');
          delay = 0;
        }

        function throttle() {
          if (!delay) {
            delay = setTimeout(update, 500);
          }
        }

        window.addEventListener('resize', throttle);
        window.JOGOS_UNITY_ONRESIZE = true;
      })();

    _JogosSDK_wait(
      'JSLibCallback_RequestBanner',
      _JogosSDK_load().then(function (sdk) {
        return sdk.banner.requestBanner(id, layout).then(function () {
          return id;
        });
      }),
    );
  },

  /**
   * 清除指定横幅
   *
   * @param {string} id DOM节点Id
   *
   * @callback {(id: string) => void} JSLibCallback_ClearBanner 成功回调
   * @callback {(message: string) => void} JSLibCallback_ClearBannerError 错误回调
   */
  JogosSDK_ClearBanner: function (id) {
    id = unityStringify(id);

    _JogosSDK_wait(
      'JSLibCallback_ClearBanner',
      _JogosSDK_load().then(function (sdk) {
        return sdk.banner.clearBanner(id).then(function () {
          return id;
        });
      }),
    );
  },

  /**
   * 清除所有横幅
   *
   * @callback {() => void} JSLibCallback_ClearAllBanners 成功回调
   * @callback {(message: string) => void} JSLibCallback_ClearAllBannersError 错误回调
   */
  JogosSDK_ClearAllBanners: function () {
    _JogosSDK_wait(
      'JSLibCallback_ClearAllBanners',
      _JogosSDK_load().then(function (sdk) {
        return sdk.banner.clearAllBanners();
      }),
    );
  },

  /**
   * 买断游戏
   *
   * @callback {(orderNo: string) => void} JSLibCallback_BuyOut 成功回调
   * @callback {(message: string) => void} JSLibCallback_BuyOutError 错误回调
   */
  JogosSDK_BuyOut: function () {
    _JogosSDK_wait(
      'JSLibCallback_BuyOut',
      _JogosSDK_load().then(function (sdk) {
        return sdk.payment.buyOut();
      }),
    );
  },

  /**
   * 购买商品
   *
   * @param {string} goodsId 商品Id
   *
   * @callback {(result: { orderNo: string, goodsId: string }) => void} JSLibCallback_BuyGoods 成功回调
   * @callback {(message: string) => void} JSLibCallback_BuyGoodsError 错误回调
   */
  JogosSDK_BuyGoods: function (goodsId) {
    goodsId = unityStringify(goodsId);

    _JogosSDK_wait(
      'JSLibCallback_BuyGoods',
      _JogosSDK_load().then(function (sdk) {
        return sdk.payment.buyGoods(goodsId).then(function (orderNo) {
          return {
            orderNo: orderNo,
            goodsId: goodsId,
          };
        });
      }),
    );
  },

  /**
   * 获取订单详情
   *
   * @params {string} orderNo 订单编号
   *
   * @callback {(order: PaymentOrder) => void} JSLibCallback_GetOrderDetail 成功回调
   * @callback {(message: string) => void} JSLibCallback_GetOrderDetailError 错误回调
   *
   * // 支付订单
   * interface PaymentOrder {
   *   // 游戏 Id
   *   gameId: number;
   *   // 游戏名称
   *   gameName: string;
   *   // 用户 Id
   *   userId: number;
   *   // 订单编号
   *   orderNo: string;
   *   // 商品 Id
   *   goodsId: string;
   *   // 商品名称
   *   goodsName: string;
   *   // 币种
   *   currency: string;
   *   // 国家
   *   country: string;
   *   // 折扣
   *   discount: number;
   *   // 热力币扣减
   *   calorcoin: number;
   *   // 支付金额
   *   paid: number;
   *   // 支付渠道
   *   channel: string;
   *   // 支付类型
   *   paymentType: string;
   *   // 支付单号
   *   paymentNo: string;
   *   // 订单状态  pending: 待支付  fail: 支付失败  cancel: 已取消  expire: 已过期  success: 支付成功  refunding: 退款中  refunded: 退款成功  refund-fail: 退款失败  delivered: 已发货
   *   status: 'pending' | 'fail' | 'cancel' | 'expire' | 'success' | 'refunding' | 'refunded' | 'refund-fail' | 'delivered';
   *   // 订单创建时间
   *   createTime: String;
   *   // 退款单号
   *   refundNo: String;
   *   // 退款说明
   *   refundDescription: String;
   *   // 退款时间
   *   refundTime: String;
   *   // 成功退款时间
   *   refundedTime: String;
   * }
   */
  JogosSDK_GetOrderDetail: function (orderNo) {
    orderNo = unityStringify(orderNo);

    _JogosSDK_wait(
      'JSLibCallback_GetOrderDetail',
      _JogosSDK_load().then(function (sdk) {
        return sdk.payment.getOrderDetail(orderNo);
      }),
    );
  },

  /**
   * 获取订单列表（PaymentOrder 见 JogosSDK_GetOrderDetail）
   *
   * @params {'pending' | 'fail' | 'cancel' | 'expire' | 'success' | 'refunding' | 'refunded' | 'refund-fail' | 'delivered'} status 订单状态
   * @params {number} pageNo 分页页码
   * @params {number} pageSize 每页记录数
   *
   * @callback {(orders: PaymentOrder[]) => void} JSLibCallback_GetOrderList 成功回调
   * @callback {(message: string) => void} JSLibCallback_GetOrderListError 错误回调
   */
  JogosSDK_GetOrderList: function (status, pageNo, pageSize) {
    status = unityStringify(status);

    _JogosSDK_wait(
      'JSLibCallback_GetOrderList',
      _JogosSDK_load().then(function (sdk) {
        return sdk.payment.getOrderList(status, pageNo, pageSize);
      }),
    );
  },

  /**
   * 通知平台订单已经发货
   *
   * @param orderNo 订单号
   *
   * @callback {() => void} JSLibCallback_DeliverGoods 成功回调
   * @callback {(message: string) => void} JSLibCallback_DeliverGoodsError 错误回调
   */
  JogosSDK_DeliverGoods: function (orderNo) {
    orderNo = unityStringify(orderNo);

    _JogosSDK_wait(
      'JSLibCallback_DeliverGoods',
      _JogosSDK_load().then(function (sdk) {
        return sdk.payment.deliverGoods(orderNo);
      }),
    );
  },

  /**
   * 订阅订单支付完成通知（PaymentOrder 见 JogosSDK_GetOrderDetail）
   *
   * @callback {(order: PaymentOrder) => void} JSLibCallback_SubscribeOrderPaid 成功回调（PaymentOrder 见 JogosSDK_GetOrderDetail）
   * @callback {(message: string) => void} JSLibCallback_SubscribeOrderPaidError 错误回调
   */
  JogosSDK_SubscribeOrderPaid: function () {
    _JogosSDK_load().then(function (sdk) {
      sdk.payment.subscribeOrderPaid(function (order) {
        SendMessage('JogosSDKSingleton', 'JSLibCallback_SubscribeOrderPaid', JSON.stringify(order));
      });
    });
  },

  /**
   * 请求打开购买道具窗口
   *
   * @param {number} level 关卡或等级
   *
   * @callback {(items: GameItem[]) => void} JSLibCallback_OpenBuyGameItemsDialog 成功回调
   * @callback {(message: string) => void} JSLibCallback_OpenBuyGameItemsDialogError 错误回调
   *
   * // 游戏道具
   * interface GameItem {
   *   // 道具id
   *   id: string;
   *   // 持有数量
   *   amount: number;
   *   // 与上次返回的道具数量的差值
   *   difference: number;
   * }
   */
  JogosSDK_OpenBuyGameItemsDialog: function (level) {
    _JogosSDK_wait(
      'JSLibCallback_OpenBuyGameItemsDialog',
      _JogosSDK_load().then(function (sdk) {
        return sdk.gameItem.openBuyGameItemsDialog(level);
      }),
    );
  },

  /**
   * 获取玩家持有道具列表
   *
   * @callback {(items: GameItem[]) => void} JSLibCallback_GetUserGameItems 成功回调
   * @callback {(message: string) => void} JSLibCallback_GetUserGameItemsError 错误回调
   */
  JogosSDK_GetUserGameItems: function () {
    _JogosSDK_wait(
      'JSLibCallback_GetUserGameItems',
      _JogosSDK_load().then(function (sdk) {
        return sdk.gameItem.getUserGameItems();
      }),
    );
  },

  /**
   * 增加玩家持有的道具
   *
   * @param {string} id 道具id
   * @param {number} amount 道具数量
   *
   * @callback {(items: GameItem[]) => void} JSLibCallback_AddGameItem 成功回调
   * @callback {(message: string) => void} JSLibCallback_AddGameItemError 错误回调
   */
  JogosSDK_AddGameItem: function (id, amount) {
    id = unityStringify(id);
    _JogosSDK_wait(
      'JSLibCallback_AddGameItem',
      _JogosSDK_load().then(function (sdk) {
        return sdk.gameItem.addGameItem(id, amount);
      }),
    );
  },

  /**
   * 减少玩家持有的道具
   *
   * @param {string} id 道具id
   * @param {number} amount 道具数量
   *
   * @callback {(items: GameItem[]) => void} JSLibCallback_SubtractGameItem 成功回调
   * @callback {(message: string) => void} JSLibCallback_SubtractGameItemError 错误回调
   */
  JogosSDK_SubtractGameItem: function (id, amount) {
    id = unityStringify(id);
    _JogosSDK_wait(
      'JSLibCallback_SubtractGameItem',
      _JogosSDK_load().then(function (sdk) {
        return sdk.gameItem.subtractGameItem(id, amount);
      }),
    );
  },

  /**
   * 订阅道具变更通知
   *
   * @callback {(items: GameItem[]) => void} JSLibCallback_SubscribeGameItemChange 成功回调
   * @callback {(message: string) => void} JSLibCallback_SubscribeGameItemChangeError 错误回调
   */
  JogosSDK_SubscribeGameItemChange: function () {
    _JogosSDK_load().then(function (sdk) {
      sdk.gameItem.subscribeGameItemChange(function (items) {
        SendMessage('JogosSDKSingleton', 'JSLibCallback_SubscribeGameItemChange', JSON.stringify(items));
      });
    });
  },
});
