## 简介-开始
```typescript
import JogosSDK from './JogosSDK'
 //....Scene Launch Script
 async onLoad() {
    let systemInfo = await JogosSDK.init()
    if(!systemInfo){
            return
    }
    console.log(systemInfo)
 }
```
## 用户
```typescript
JogosSdk.sdk.user;
```
```typescript
try {
  const user = await JogosSDK.getUser();
  console.log(user);
} catch (err) {
  console.log('Get user error: ', err);
}
//同等的Pormise调用方式：
JogosSDK
  .getUser()
  .then((user) => console.log(user))
  .catch((err) => console.log('Get user error: ', err));
```

## 用户-getUser
```typescript
try {
  const user = await JogosSDK.getUser();
  console.log('Get user result', user);
} catch (err) {
  // 处理异常
  console.error(err);
}
```

## 用户令牌-getUserToken
```typescript
try {
  const token = await JogosSDK.getUserToken();
  console.log('Get token result', token);
} catch (err) {
  // 处理异常
  console.error(err);
}
```

## 游戏-游戏信息
```typescript
JogosSdk.sdk.game;
```

## 游戏-暂停/继续
```typescript
// 告知我们游戏已暂停
await JogosSDK.pause();
// 告知我们暂停的游戏已继续
await JogosSDK.continuePlay();
```

## 游戏-加载开始/结束
```typescript
// 告知我们游戏开始加载
await JogosSDK.loadingStart();
// 告知我们游戏加载已经结束
await JogosSDK.loadingEnd();
```
## 游戏-欢乐时光
```typescript
// 激活游戏欢乐时光
await JogosSDK.happytime();
```

## 横幅广告

参照deme工程中的BannerUI.prefab，拷贝它并应用到游戏场景中，将改节点设置为active = true即可，横幅广告会限制在该节点对应的屏幕矩形区域内

```typescript
// 横幅广告示例
const bannerId = await JogosSDK.requestBannerWithNode(refNode);
// 屏幕适配发生变化时，横幅广告动态调整位置
onResize(){
    this.scheduleOnce(()=>{
        JogosSDK.requestBannerWithNode(refNode, true);
    });
}
```

## 视频广告
```typescript
JogosSdk.reqeustAd();
```
## 请求播放视频广告
```typescript
// 请求播放视频广告
// 回调函数
const callbacks = {
  // 开始播放广告时会调用此函数
  onstarted: () => console.log('ad started'),
  // 播放广告结束时会调用此函数
  onfinished: () => console.log('ad finished'),
  // 播放广告出错时会调用此函数
  onerror: (error) => console.log('ad error:', error),
};

// 请求显示插屏广告
JogosSdk.requestAd('midgame', callbacks);
// 请求显示激励广告
JogosSdk.requestAd('rewarded', callbacks);
```

##调用广告须知
```typescript
const result = await JogosSdk.sdk.ad.getRewardAdCount();
console.log('Remaining rewardAd count ', result);
```

## 云存储
```typescript
await JogosSdk.synchronizeToCloud();
```

## 活动 排行榜
```typescript
/**
 * 打开排行榜窗口
 *
 * @param rankingName 排行榜名称
 */
await JogosSdk.openRankingDialog(rankingName: string);
```

## 活动 上报成就接口
```typescript
/**
 * 提交玩家成就数据
 *
 * @param name 成就ID
 * @param progress 完成进度
 * @param hidden 隐藏标记
 */
await JogosSdk.commitAchievementsData(name: string, progress: number, hidden: boolean);
```

## 活动 打开成就界面
```typescript
await JogosSdk.openAchievementsDialog();
```
## CDKey
```typescript
/**
 * 兑换奖品
 * @param cdkey 兑换码
 */
await JogosSdk.sdk.game.exchangePrizes(cdkey: string);
```

## 支付
```typescript
JogosSdk.sdk.payment;
```

## 支付-发起订单
```typescript
/**
 * 发起支付订单
 * @param productId 商品ID
 * @param amount 金额
 * @param currency 货币类型
 * @param callback 回调函数
 */
let orderNo = await JogosSDK.sdk.payment.buyGoods(goodsId: string);
```

## 订阅订阅订单支付完成通知
```typescript
JogosSDK.sdk.payment.subscribeOrderPaid(callbackFn: (order: PaymentOrder) => void);
```

## 由客户端处理发货(单机游戏)
```typescript
/**
 * 处理支付订单完成通知
 * @param order 支付订单
 */
await JogosSDK.sdk.payment.deliverGoods(orderNo: string);
```

## 获取订单信息
```typescript
await JogosSDK.sdk.payment.getOrderDetail(orderNo: string);
```

## 获取订单列表
```typescript
let orderList = await JogosSDK.payment.getOrderList(
  status?: 'pending' | 'fail' | 'cancel' | 'expire' | 'success' | 'refunding' | 'refunded',
  pageNo?: number,  // 页码：默认为1
  pageSize?: number // 每页记录数：默认为20
);
```

## 买断制游戏
```typescript
// 成功返回订单编号
let orderNo = await JogosSDK.sdk.payment.buyOut();
```