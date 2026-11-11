mergeInto(LibraryManager.library, {
  /**
   * Loads the game script.
   *
   * @returns {Promise<Object>}
   */
  JogosSDK_load: function () {
    return (
      window.JOGOS_SDK_LOADER ||
      (window.JOGOS_SDK_LOADER = new Promise(function (resolve, reject) {
        // Inject the SDK script
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
   * Waits for an async result.
   *
   * @param {string} type Message type
   * @param {Promise} promise Async object
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
   * Initializes JogosSDK.
   *
   * @callback {(info: SystemInfo) => void} JSLibCallback_Init Success callback
   * @callback {(message: string) => void} JSLibCallback_InitError Error callback
   *
   * interface SystemInfo {
   * // Game Id
   * gameId: number;
   * // Device type
   * deviceType: 'pc' | 'tablet' | 'mobile';
   * // Current language
   * language: string;
   * // Operating system (including version, space separated)
   * os: string;
   * // Browser (including version, space separated)
   * browser: string;
   * // Whether group chat is supported
   * hasGameGroup: boolean;
   * // Server timestamp
   * serverTime: number;
   * // Banner ad refresh interval
   * bannerIntervalTime: number;
   * // Minimum interval between midgame ads
   * midgameIntervalTime: number;
   * // Invite arguments
   * inviteArgs?: { [key: string]: any };
   * // Buyout game price
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

    var initPromise = _JogosSDK_load().then(function (sdk) {
      return sdk.init('Unity', Module, FS, IDBFS);
    });
    // Let LoadingStart / LoadingEnd wait for init to finish (otherwise they throw 460)
    window.JOGOS_SDK_INIT_PROMISE = initPromise;
    _JogosSDK_wait('JSLibCallback_Init', initPromise);
  },

  /**
   * Tell the platform the game started loading.
   * Must be called after JogosSDK_Init; it waits for init internally.
   */
  JogosSDK_LoadingStart: function () {
    if (!window.JOGOS_SDK_INIT_PROMISE) {
      console.warn('[JogosSDK] LoadingStart ignored: call JogosSDK.Init first.');
      return;
    }
    window.JOGOS_SDK_INIT_PROMISE
      .then(function () {
        return window.JOGOS_SDK.game.loadingStart();
      })
      .catch(function (err) {
        console.warn('[JogosSDK] loadingStart failed:', err);
      });
  },

  /**
   * Tell the platform loading finished and the player can act.
   * Do not use early signals such as first frame or scene Start.
   */
  JogosSDK_LoadingEnd: function () {
    if (!window.JOGOS_SDK_INIT_PROMISE) {
      console.warn('[JogosSDK] LoadingEnd ignored: call JogosSDK.Init first.');
      return;
    }
    window.JOGOS_SDK_INIT_PROMISE
      .then(function () {
        return window.JOGOS_SDK.game.loadingEnd();
      })
      .catch(function (err) {
        console.warn('[JogosSDK] loadingEnd failed:', err);
      });
  },

  /**
   * Gets user info.
   *
   * @callback {(userInfo: UserInfo) => void} JSLibCallback_GetUser Success callback
   * @callback {(message: string) => void} JSLibCallback_GetUserError Error callback
   *
   * // User info
   * interface UserInfo {
   *   // User Id
   *   userId: string;
   *   // Username
   *   username: string;
   *   // Avatar URL
   *   profilePictureUrl: string;
   *   // Game Id
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
   * Gets the public key.
   *
   * @callback {() => string} JSLibCallback_GetPublicKey Success callback
   * @callback {(message: string) => void} JSLibCallback_GetPublicKeyError Error callback
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
   * Gets the user token.
   *
   * @callback {(token: string) => void} JSLibCallback_GetUserToken Success callback
   * @callback {(message: string) => void} JSLibCallback_GetUserTokenError Error callback
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
   * Pauses the game (call when the game is paused).
   *
   * @callback {() => void} JSLibCallback_GamePause Success callback
   * @callback {(message: string) => void} JSLibCallback_GamePauseError Error callback
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
   * Continues the game (call when the player clears the game).
   *
   * @callback {() => void} JSLibCallback_GameContinue Success callback
   * @callback {(message: string) => void} JSLibCallback_GameContinueError Error callback
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
   * Happy time (call when the player clears the game).
   *
   * @callback {() => void} JSLibCallback_HappyTime Success callback
   * @callback {(message: string) => void} JSLibCallback_HappyTimeError Error callback
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
   * Synchronizes cached (progress) data to the cloud.
   *
   * @callback {() => void} JSLibCallback_SynchronizeToCloud Success callback
   * @callback {(message: string) => void} JSLibCallback_SynchronizeToCloudError Error callback
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
   * Checks whether the given players are my friends.
   *
   * @param {number[]} userIds Set of player Ids
   *
   * @callback {(isMyFriends:IsMyFriends[]) => void} JSLibCallback_IsMyFriends Success callback
   * @callback {(message: string) => void} JSLibCallback_IsMyFriendsError Error callback
   *
   * // Success callback
   * interface IsMyFriends {
   *   // Player id
   *   userId: number;
   *   // Whether this player is my friend
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
   * Sends a friend request to the given player.
   *
   * @param {number} userId Id of the player to add as friend
   *
   * @callback {() => void} JSLibCallback_SendFriendRequest Success callback
   * @callback {(message: string) => void} JSLibCallback_SendFriendRequestError Error callback
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
   * Opens the chat dialog.
   *
   * @param {number} userId Id of the player to chat with
   *
   * @callback {() => void} JSLibCallback_OpenChatDialog Success callback
   * @callback {(message: string) => void} JSLibCallback_OpenChatDialogError Error callback
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
   * Opens the invite dialog.
   *
   * @param {{ [key: string]: any }} inviteArgs Invite arguments (passed to invited players on init when they join the game)
   *
   * @callback {() => void} JSLibCallback_OpenInviteDialog Success callback
   * @callback {(message: string) => void} JSLibCallback_OpenInviteDialogError Error callback
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
   * Commits achievement data.
   *
   * @param {string} name Achievement name
   * @param {number} progress Completion progress
   * @param {boolean} hidden Hidden flag
   *
   * @callback {() => void} JSLibCallback_CommitAchievementsData Success callback
   * @callback {(message: string) => void} JSLibCallback_CommitAchievementsDataError Error callback
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
   * Opens the achievements dialog.
   *
   * @callback {() => void} JSLibCallback_OpenAchievementsDialog Success callback
   * @callback {(message: string) => void} JSLibCallback_OpenAchievementsDialogError Error callback
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
   * Commits ranking data.
   *
   * @param {string} rankingName Ranking name
   * @param {Object} data Ranking data (key-value pairs; values must be a number, string, or date following the format configured in the developer center)
   *
   * @callback {() => void} JSLibCallback_CommitRankingData Success callback
   * @callback {(message: string) => void} JSLibCallback_CommitRankingDataError Error callback
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
   * Opens the ranking dialog.
   *
   * @param {string} rankingName Ranking name
   *
   * @callback {() => void} JSLibCallback_OpenRankingDialog Success callback
   * @callback {(message: string) => void} JSLibCallback_OpenRankingDialogError Error callback
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
   * Redeems prizes.
   *
   * @param {string} cdkey Redeem code
   *
   * @callback {(cdkey: string) => void} JSLibCallback_ExchangePrizes Success callback
   * @callback {(message: string) => void} JSLibCallback_ExchangePrizesError Error callback
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
   * Shares content.
   *
   * @param {GameShareArgs} data Game share arguments
   *
   * @callback {() => void} JSLibCallback_Share Success callback
   * @callback {(message: string) => void} JSLibCallback_ShareError Error callback
   *
   * interface GameShareArgs {
   *   userName: string;         // Player nickname
   *   userRoleId: string;       // In-game character ID
   *   serverId: string;         // Server ID of the character
   *   shareType: string;        // Share type (game/achievement/activity, etc.)
   *   gameName: string;         // Game name
   *   shareImage:string;        // Share image (e.g. game logo/screenshot)
   *   dynamicContent:string;    // Share content
   *   targetPlatform:string;    // Target social platform (Facebook/Twitter/wechat, etc.)
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
   * Requests a video ad.
   *
   * @param {'midgame' | 'rewarded'} type Ad type  midgame: midgame ad  rewarded: rewarded ad
   *
   * @callback {() => void} JSLibCallback_RequestAdStarted On play started
   * @callback {() => void} JSLibCallback_RequestAdFinished On play finished
   * @callback {(message: string) => void} JSLibCallback_RequestAdError Error callback
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
   * Gets the remaining rewarded ad count.
   *
   * @callback {(count: number) => void} JSLibCallback_GetRewardAdCount Success callback
   * @callback {(message: string) => void} JSLibCallback_GetRewardAdCountError Error callback
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
   * Checks whether the player has an ad blocker.
   *
   * @callback {(hasAdBlock: boolean) => void} JSLibCallback_HasAdblock Success callback
   * @callback {(message: string) => void} JSLibCallback_HasAdblockError Error callback
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
   * Requests showing a banner.
   *
   * @param {string} id DOM node Id
   * @param {UnityLayout} layout Unity layout data
   *
   * @callback {(id: string) => void} JSLibCallback_RequestBanner Success callback
   * @callback {(message: string) => void} JSLibCallback_RequestBannerError Error callback
   * @callback {() => void} JSLibCallback_WindowResize Container resize callback (call JogosSDK_RequestBanner again here and set layout.update to true)
   *
   * interface UnitLayout {
   *   x: number;         // Banner x coordinate on screen
   *   y: number;         // Banner y coordinate on screen
   *   width: number;     // Banner width on screen
   *   height: number;    // Banner height on screen
   *   update?: boolean;  // Whether this is a position update caused by a window change
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
   * Clears the specified banner.
   *
   * @param {string} id DOM node Id
   *
   * @callback {(id: string) => void} JSLibCallback_ClearBanner Success callback
   * @callback {(message: string) => void} JSLibCallback_ClearBannerError Error callback
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
   * Clears all banners.
   *
   * @callback {() => void} JSLibCallback_ClearAllBanners Success callback
   * @callback {(message: string) => void} JSLibCallback_ClearAllBannersError Error callback
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
   * Buys the game (buyout).
   *
   * @callback {(orderNo: string) => void} JSLibCallback_BuyOut Success callback
   * @callback {(message: string) => void} JSLibCallback_BuyOutError Error callback
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
   * Buys goods.
   *
   * @param {string} goodsId Goods Id
   *
   * @callback {(result: { orderNo: string, goodsId: string }) => void} JSLibCallback_BuyGoods Success callback
   * @callback {(message: string) => void} JSLibCallback_BuyGoodsError Error callback
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
   * Gets order detail.
   *
   * @params {string} orderNo Order number
   *
   * @callback {(order: PaymentOrder) => void} JSLibCallback_GetOrderDetail Success callback
   * @callback {(message: string) => void} JSLibCallback_GetOrderDetailError Error callback
   *
   * // Payment order
   * interface PaymentOrder {
   *   // Game Id
   *   gameId: number;
   *   // Game name
   *   gameName: string;
   *   // User Id
   *   userId: number;
   *   // Order number
   *   orderNo: string;
   *   // Goods Id
   *   goodsId: string;
   *   // Goods name
   *   goodsName: string;
   *   // Currency
   *   currency: string;
   *   // Country
   *   country: string;
   *   // Discount
   *   discount: number;
   *   // Calor coin deduction
   *   calorcoin: number;
   *   // Paid amount
   *   paid: number;
   *   // Payment channel
   *   channel: string;
   *   // Payment type
   *   paymentType: string;
   *   // Payment number
   *   paymentNo: string;
   *   // Order status  pending: awaiting payment  fail: payment failed  cancel: canceled  expire: expired  success: payment succeeded  refunding: refunding  refunded: refunded  refund-fail: refund failed  delivered: delivered
   *   status: 'pending' | 'fail' | 'cancel' | 'expire' | 'success' | 'refunding' | 'refunded' | 'refund-fail' | 'delivered';
   *   // Order creation time
   *   createTime: String;
   *   // Refund number
   *   refundNo: String;
   *   // Refund description
   *   refundDescription: String;
   *   // Refund time
   *   refundTime: String;
   *   // Successful refund time
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
   * Gets the order list (see JogosSDK_GetOrderDetail for PaymentOrder).
   *
   * @params {'pending' | 'fail' | 'cancel' | 'expire' | 'success' | 'refunding' | 'refunded' | 'refund-fail' | 'delivered'} status Order status
   * @params {number} pageNo Page number
   * @params {number} pageSize Records per page
   *
   * @callback {(orders: PaymentOrder[]) => void} JSLibCallback_GetOrderList Success callback
   * @callback {(message: string) => void} JSLibCallback_GetOrderListError Error callback
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
   * Notifies the platform that the order has been delivered.
   *
   * @param orderNo Order number
   *
   * @callback {() => void} JSLibCallback_DeliverGoods Success callback
   * @callback {(message: string) => void} JSLibCallback_DeliverGoodsError Error callback
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
   * Subscribes to order paid notifications (see JogosSDK_GetOrderDetail for PaymentOrder).
   *
   * @callback {(order: PaymentOrder) => void} JSLibCallback_SubscribeOrderPaid Success callback (see JogosSDK_GetOrderDetail for PaymentOrder)
   * @callback {(message: string) => void} JSLibCallback_SubscribeOrderPaidError Error callback
   */
  JogosSDK_SubscribeOrderPaid: function () {
    _JogosSDK_load().then(function (sdk) {
      sdk.payment.subscribeOrderPaid(function (order) {
        SendMessage('JogosSDKSingleton', 'JSLibCallback_SubscribeOrderPaid', JSON.stringify(order));
      });
    });
  },

  /**
   * Requests opening the buy game items dialog.
   *
   * @param {number} level Level or stage
   *
   * @callback {(items: GameItem[]) => void} JSLibCallback_OpenBuyGameItemsDialog Success callback
   * @callback {(message: string) => void} JSLibCallback_OpenBuyGameItemsDialogError Error callback
   *
   * // Game item
   * interface GameItem {
   *   // Item id
   *   id: string;
   *   // Owned amount
   *   amount: number;
   *   // Difference from the amount returned last time
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
   * Gets the list of items owned by the player.
   *
   * @callback {(items: GameItem[]) => void} JSLibCallback_GetUserGameItems Success callback
   * @callback {(message: string) => void} JSLibCallback_GetUserGameItemsError Error callback
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
   * Adds items owned by the player.
   *
   * @param {string} id Item id
   * @param {number} amount Item amount
   *
   * @callback {(items: GameItem[]) => void} JSLibCallback_AddGameItem Success callback
   * @callback {(message: string) => void} JSLibCallback_AddGameItemError Error callback
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
   * Subtracts items owned by the player.
   *
   * @param {string} id Item id
   * @param {number} amount Item amount
   *
   * @callback {(items: GameItem[]) => void} JSLibCallback_SubtractGameItem Success callback
   * @callback {(message: string) => void} JSLibCallback_SubtractGameItemError Error callback
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
   * Subscribes to game item change notifications.
   *
   * @callback {(items: GameItem[]) => void} JSLibCallback_SubscribeGameItemChange Success callback
   * @callback {(message: string) => void} JSLibCallback_SubscribeGameItemChangeError Error callback
   */
  JogosSDK_SubscribeGameItemChange: function () {
    _JogosSDK_load().then(function (sdk) {
      sdk.gameItem.subscribeGameItemChange(function (items) {
        SendMessage('JogosSDKSingleton', 'JSLibCallback_SubscribeGameItemChange', JSON.stringify(items));
      });
    });
  },
});
