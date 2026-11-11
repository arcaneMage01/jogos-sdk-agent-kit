using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using UnityEngine;

namespace JogosGames.Engine.SDK
{
    public class PaymentModule : MonoBehaviour
    {
        private JogosSDK _JogosSDK;


        public void Init(JogosSDK JogosSDK)
        {
            _JogosSDK = JogosSDK;
        }

        #region pay

        private List<Action<PaymentOrder>> _payCallback = new List<Action<PaymentOrder>>();
        private List<Action<string>> _payErrorCallback = new List<Action<string>>();

        private void BuyCallback(PaymentOrder orderInfo)
        {
            var tempList = _payCallback.Select(c => c).ToList();
            tempList.ForEach(c => c(orderInfo));
        }

        private void ErrorCallback(string errorMsg)
        {
            var tempList = _payErrorCallback.Select(c => c).ToList();
            tempList.ForEach(c => c(errorMsg));
        }

        private PaymentOrder GetTestSucessPurchaseOrder(string goodsId)
        {
            var testOrder = new PaymentOrder();
            testOrder.goodsId = goodsId;
            testOrder.status = "success";
            return testOrder;
        }

        #region buy out

        private Action<string, string> _bugCallBack;

        public void BuyOut(Action<string, string> callback)
        {
            _bugCallBack = callback;
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    JogosSDK_BuyOut();
                },
                () =>
                {
                    JSLibCallback_BuyOut("Test1");
                    BuyCallback(GetTestSucessPurchaseOrder(""));
                }
            );
        }

        public void JSLibCallback_BuyOut(string orderId)
        {
            _bugCallBack?.Invoke(orderId, "");
            _JogosSDK.DebugLog("JSLibCallback_BuyOut:" + orderId);
        }
        public void JSLibCallback_BuyOutError(string msg)
        {
            _JogosSDK.DebugLog("JSLibCallback_BuyOutError:" + msg);
            ErrorCallback(msg);
        }

        #endregion

        #region buy goods

        public void BuyGoods(string goodsId, Action<string, string> callback)
        {
            _bugCallBack = callback;
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    JogosSDK_BuyGoods(goodsId);
                },
                () =>
                {
                    JSLibCallback_BuyGoods("{\"orderId\":\"1\",\"goodsId\":\"" + goodsId + "\"}");
                    BuyCallback(GetTestSucessPurchaseOrder(goodsId));
                }
            );
        }

        public void JSLibCallback_BuyGoods(string resultJson)
        {
            var orderInfo = JsonUtility.FromJson<BuyGoodsResult>(resultJson);
            if (orderInfo != null)
            {
                _bugCallBack?.Invoke(orderInfo.orderNo, orderInfo.goodsId);

                //StartCheckOrder(orderInfo.orderNo);
            }
            _JogosSDK.DebugLog("JSLibCallback_BuyGoods:" + resultJson);
        }
        public void JSLibCallback_BuyGoodsError(string msg)
        {
            _JogosSDK.DebugLog("JSLibCallback_BuyError:" + msg);
            ErrorCallback(msg);
        }
        #endregion

        #region get cur orderInfo

        private List<Action<PaymentOrder>> _getOrderInfoCallback = new List<Action<PaymentOrder>>();
        private List<Action<PaymentOrder[]>> _getOrderListCallback = new List<Action<PaymentOrder[]>>();

        private void GetOrderInfoCallBack(PaymentOrder orderInfo)
        {
            var tempList = _getOrderInfoCallback.Select(c => c).ToList();
            _getOrderInfoCallback.Clear();
            tempList.ForEach(c => c(orderInfo));

            CheckOrderDeliverCallBack(orderInfo);
        }

        private void GetOrderListCallBack(PaymentOrder[] orderInfo)
        {
            var tempList = _getOrderListCallback.Select(c => c).ToList();
            _getOrderListCallback.Clear();
            tempList.ForEach(c => c(orderInfo));
        }

        public void GetOrderInfo(string orderId, Action<PaymentOrder> callBack)
        {
            if(callBack != null && !_getOrderInfoCallback.Contains(callBack))
                _getOrderInfoCallback.Add(callBack);
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    JogosSDK_GetOrderDetail(orderId);
                },
                () =>
                {
                    GetOrderInfoCallBack(GetTestSucessPurchaseOrder(""));
                }
            );
        }

        public void JSLibCallback_GetOrderDetail(string orderJson)
        {
            _JogosSDK.DebugLog("JSLibCallback_GetOrderDetail contex:" + orderJson);
            var orderInfo = JsonUtility.FromJson<PaymentOrder>(orderJson);
            if (orderInfo != null)
            {
                GetOrderInfoCallBack(orderInfo);
                _JogosSDK.DebugLog("JSLibCallback_GetOrderDetail sucess:" + orderInfo.goodsId);
            }
            else
            {
                _JogosSDK.DebugLog("JSLibCallback_GetOrderDetail error:" + orderJson);
            }

        }
        public void JSLibCallback_GetOrderDetailError(string msg)
        {
            _JogosSDK.DebugLog("JSLibCallback_GetOrderDetailError:" + msg);
        }

        /// <summary>
        /// GetCurOrderList
        /// </summary>
        /// <param name="status">{'pending' | 'fail' | 'cancel' | 'expire' | 'success' | 'refunding' | 'refunded' | 'refund-fail';} </param>
        public void GetOrderList(string status, int pageNo, int pageSize, Action<PaymentOrder[]> callback)
        {
            if(!_getOrderListCallback.Contains(callback))
                _getOrderListCallback.Add(callback);
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    JogosSDK_GetOrderList(status, pageNo, pageSize);
                },
                () =>
                {
                    GetOrderInfoCallBack(GetTestSucessPurchaseOrder(""));
                }
            );
        }

        public void JSLibCallback_GetOrderList(string orderJson)
        {
            _JogosSDK.DebugLog(" JSLibCallback_GetOrderList contex:" + orderJson);
            var orderInfos = JsonUtility.FromJson<PaymentOrderList>("{\"paymentOrderList\":" + orderJson + "}");
            if (orderInfos != null)
            {
                GetOrderListCallBack(orderInfos.paymentOrderList);
                _JogosSDK.DebugLog(" JSLibCallback_GetOrderList sucess:" + orderInfos.paymentOrderList.Length);
            }
            else
            {
                _JogosSDK.DebugLog(" JSLibCallback_GetOrderList error:" + orderJson);
            }

        }
        public void JSLibCallback_GetOrderListError(string msg)
        {
            _JogosSDK.DebugLog("JSLibCallback_GetOrderListError:" + msg);
        }

        #endregion

        #region Subscribe Order

        private bool _autoDeliver;
        public bool IsAutoDeliver
        {
            get
            {
                return _autoDeliver;
            }
            set
            {
                _autoDeliver = value;
            }
        }

        private bool _hasInitSubscribe;

        public void SubscribeOrderPaid(Action<PaymentOrder> callBack, Action<string> errorCallback = null, bool autoDeliver = true)
        {
            _autoDeliver = autoDeliver;
            if(!_payCallback.Contains(callBack))
                _payCallback.Add(callBack);
            if(errorCallback != null && !_payErrorCallback.Contains(errorCallback))
                _payErrorCallback.Add(errorCallback);

            InitSDKSubscribeOrder();
        }

        private void InitSDKSubscribeOrder()
        {
            if (_hasInitSubscribe)
                return;

            _hasInitSubscribe = true;
            _JogosSDK.WrapSDKAction(
                    () =>
                    {
                        _JogosSDK.DebugLog("JogosSDK_SubscribeOrderPaid:");
                        JogosSDK_SubscribeOrderPaid();
                    },
                    () =>
                    {
                        PaymentOrder emptyOrder = new PaymentOrder();
                        emptyOrder.status = "success";
                        JSLibCallback_SubscribeOrderPaid(JsonUtility.ToJson(emptyOrder));
                    }
                );
        }

        public void JSLibCallback_SubscribeOrderPaid(string orderJson)
        {
            var orderInfo = JsonUtility.FromJson<PaymentOrder>(orderJson);
            if (orderInfo != null)
            {
                if (orderInfo.status.Equals("success"))
                {
                    SetOrderChecked(orderInfo.orderNo);
                    if (IsAutoDeliver)
                    {
                        DeliverGoods(orderInfo.orderNo);
                    }
                    BuyCallback(orderInfo);
                }
                else
                {
                    ErrorCallback(orderInfo.status);
                }
                _JogosSDK.DebugLog("JSLibCallback_SubscribeOrderPaid sucess:" + orderInfo.goodsId);
            }
            else
            {
                _JogosSDK.DebugLog("JSLibCallback_SubscribeOrderPaid error:" + orderJson);
            }

        }
        public void JSLibCallback_SubscribeOrderPaidError(string msg)
        {
            ErrorCallback(msg);
            _JogosSDK.DebugLog("JSLibCallback_SubscribeOrderPaidError:" + msg);
        }

        #endregion

        #region DeliverGoods

        private Action _deliverGoodCallback;
        private Action<string> _deliverGoodCErrorCallback;

        public void DeliverGoods(string orderId, Action callBack = null, Action<string> errorCallback = null)
        {
            _deliverGoodCallback = (callBack);
            _deliverGoodCErrorCallback = (errorCallback);

            _JogosSDK.DebugLog("DeliverGoods:" + orderId);
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    JogosSDK_DeliverGoods(orderId);
                },
                () =>
                {

                }
            );
        }

        public void JSLibCallback_DeliverGoods()
        {
            _deliverGoodCallback?.Invoke();
            _JogosSDK.DebugLog("JSLibCallback_DeliverGoods sucess:");

        }
        public void JSLibCallback_DeliverGoodsError(string msg)
        {
            _deliverGoodCErrorCallback?.Invoke(msg);
            _JogosSDK.DebugLog("JSLibCallback_DeliverGoodsError:" + msg);
        }

        #endregion

        #region check order

        private List<string> _checkOrderList = new List<string>();

        private void CheckOrderDeliverCallBack(PaymentOrder orderInfo)
        {
            if (orderInfo.status != "success")
                return;

            var foundItem = _checkOrderList.Find((checkNo) => { return orderInfo.orderNo == checkNo; });


            if (_checkOrderList.Contains(orderInfo.orderNo))
            {
                SetOrderChecked(orderInfo.orderNo);
                if (IsAutoDeliver)
                {
                    DeliverGoods(orderInfo.orderNo);
                }
                BuyCallback(orderInfo);
            }

            if (_checkOrderList.Count == 0)
                StopCheckOrder();
        }

        private void StartCheckOrder(string orderNo)
        {
            if (string.IsNullOrEmpty(orderNo))
                return;
            CancelInvoke("CheckOrderInvoke");
            if(!_checkOrderList.Contains(orderNo))
                _checkOrderList.Add(orderNo);

            InvokeRepeating("CheckOrderInvoke", 1, 1);
        }

        private void CheckOrderInvoke()
        {
            _JogosSDK.DebugLog("CheckOrderInvoke call:");

            foreach (var orderNo in _checkOrderList)
            {
                GetOrderInfo(orderNo, null);
            }
        }

        private void SetOrderChecked(string orderNo)
        {
            _checkOrderList.Remove(orderNo);
            if (_checkOrderList.Count == 0)
            {
                StopCheckOrder();
            }
        }

        private void StopCheckOrder()
        {
            CancelInvoke("CheckOrderInvoke");
        }

        #endregion

        #region open paydialog 

        private readonly List<Action<GameItem[]>> _openPaymentDialogCallbacks = new List<Action<GameItem[]>>();
        private readonly List<Action<string>> _openPaymentDialogErrorCallbacks = new List<Action<string>>();

        /// <summary>
        /// Open the payment dialog
        /// </summary>
        /// <param name="level"></param> Required level to unlock payment
        /// <param name="action"></param>
        public void OpenPaymentDialog(int level, Action<GameItem[]> action,Action<string> errorCallback = null)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _openPaymentDialogCallbacks.Add(action);
                    if (errorCallback != null)
                        _openPaymentDialogErrorCallbacks.Add(errorCallback);
                    JogosSDK_OpenBuyGameItemsDialog(level);
                },
                () =>
                {

                }
            );
        }

        public void JSLibCallback_OpenBuyGameItemsDialog(string json)
        {
            var gameItems = JsonUtility.FromJson<GameItemList>("{\"gameItemList\":" + json + "}");
            if (gameItems != null)
            {
                var tempList = _openPaymentDialogCallbacks.Select(c => c).ToList();
                _openPaymentDialogCallbacks.Clear();
                tempList.ForEach(c => c(gameItems.gameItemList));
                _JogosSDK.DebugLog("JSLibCallback_OpenBuyGameItemsDialog sucess:" + json);
            }
            else
            {
                _JogosSDK.DebugLog("JSLibCallback_OpenBuyGameItemsDialog error:" + json);
            }
        }

        public void JSLibCallback_OpenBuyGameItemsDialogError(string msg)
        {
            var tempList = _openPaymentDialogErrorCallbacks.Select(c => c).ToList();
            _openPaymentDialogErrorCallbacks.Clear();
            tempList.ForEach(c => c(msg));
            _JogosSDK.DebugLog("JSLibCallback_OpenBuyGameItemsDialogError:" + msg);
        }


        #endregion

        #region gameItem change

        private readonly List<Action<GameItem[]>> _getUserGameItemsCallbacks = new List<Action<GameItem[]>>();
        private readonly List<Action<string>> _getUserGameItemsErrorCallbacks = new List<Action<string>>();

        private readonly List<Action<bool>> _addGameItemCallbacks = new List<Action<bool>>();
        private readonly List<Action<bool>> _subtractGameItemCallbacks = new List<Action<bool>>();

        private List<Action<GameItem[]>> _subscribeGameItemChangeCallbacks = new List<Action<GameItem[]>>();
        private List<Action<string>> _subscribeGameItemChangeErrorCallbacks = new List<Action<string>>();


        /// <summary>
        /// Retrieve the player’s inventory items
        /// </summary>
        public void GetUserGameItems(Action<GameItem[]> action, Action<string> errorCallback = null)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _getUserGameItemsCallbacks.Add(action);
                    if (errorCallback != null)
                        _getUserGameItemsErrorCallbacks.Add(errorCallback);
                    JogosSDK_GetUserGameItems();
                },
                () =>
                {

                }
            );
        }

        public void JSLibCallback_GetUserGameItems(string json)
        {
            var gameItems = JsonUtility.FromJson<GameItemList>("{\"gameItemList\":" + json + "}");
            if (gameItems != null)
            {
                var tempList = _getUserGameItemsCallbacks.Select(c => c).ToList();
                _getUserGameItemsCallbacks.Clear();
                tempList.ForEach(c => c(gameItems.gameItemList));
                _JogosSDK.DebugLog("JSLibCallback_GetUserGameItems sucess: " + json);
            }
            else
            {
                _JogosSDK.DebugLog("JSLibCallback_GetUserGameItems error:" + json);
            }
        }

        public void JSLibCallback_GetUserGameItemsError(string msg)
        {
            var tempList = _getUserGameItemsErrorCallbacks.Select(c => c).ToList();
            _getUserGameItemsErrorCallbacks.Clear();
            tempList.ForEach(c => c(msg));
            _JogosSDK.DebugLog("JSLibCallback_GetUserGameItemsError:" + msg);
        }

        /// <summary>
        /// / Add items to the player’s inventory
        /// </summary>
        /// <param name="id"></param>  item id
        /// <param name="amount"></param> item amount
        /// <param name="action"></param>
        public void AddGameItem(string id, int amount, Action<bool> action)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _addGameItemCallbacks.Add(action);
                    JogosSDK_AddGameItem(id, amount);
                },
                () =>
                {

                }
            );
        }

        public void JSLibCallback_AddGameItem()
        {
            var tempList = _addGameItemCallbacks.Select(c => c).ToList();
            _addGameItemCallbacks.Clear();
            tempList.ForEach(c => c(true));

            _JogosSDK.DebugLog("JSLibCallback_AddGameItem success");
        }


        public void JSLibCallback_AddGameItemError(string msg)
        {
            var tempList = _addGameItemCallbacks.Select(c => c).ToList();
            _addGameItemCallbacks.Clear();
            tempList.ForEach(c => c(false));
            _JogosSDK.DebugLog("JSLibCallback_AddGameItemError:" + msg);
        }


        /// <summary>
        /// Decrease the amount of items in the player’s inventory
        /// </summary>
        /// <param name="id"></param>  item id
        /// <param name="amount"></param> item amount
        /// <param name="action"></param>
        public void SubtractGameItem(string id, int amount, Action<bool> action)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _subtractGameItemCallbacks.Add(action);
                    JogosSDK_SubtractGameItem(id, amount);
                },
                () =>
                {

                }
            );
        }

        public void JSLibCallback_SubtractGameItem()
        {
            var tempList = _subtractGameItemCallbacks.Select(c => c).ToList();
            _subtractGameItemCallbacks.Clear();
            tempList.ForEach(c => c(true));

            _JogosSDK.DebugLog("JSLibCallback_SubtractGameItem:");
        }


        public void JSLibCallback_SubtractGameItemError(string msg)
        {
            var tempList = _subtractGameItemCallbacks.Select(c => c).ToList();
            _subtractGameItemCallbacks.Clear();
            tempList.ForEach(c => c(false));
            _JogosSDK.DebugLog("JSLibCallback_SubtractGameItemError:" + msg);
        }

        /// <summary>
        /// Subscribe to inventory change events
        /// </summary>
        /// <param name="callBack"></param> 
        /// <param name="errorCallback"></param> 
        public void SubscribeGameItemChange(Action<GameItem[]> callBack, Action<string> errorCallback = null)
        {
            _subscribeGameItemChangeCallbacks.Add(callBack);
            if (errorCallback != null)
                _subscribeGameItemChangeErrorCallbacks.Add(errorCallback);

            _JogosSDK.WrapSDKAction(
                () =>
                {
                    JogosSDK_SubscribeGameItemChange();
                },
                () =>
                {
                    
                }
            );
        }


        public void JSLibCallback_SubscribeGameItemChange(string json)
        {
            var gameItems = JsonUtility.FromJson<GameItemList>("{\"gameItemList\":" + json + "}");
            if (gameItems != null)
            {
                var tempList = _subscribeGameItemChangeCallbacks.Select(c => c).ToList();
                //_subscribeGameItemChangeCallbacks.Clear();
                tempList.ForEach(c => c(gameItems.gameItemList));
                _JogosSDK.DebugLog("JSLibCallback_SubscribeGameItemChange sucess:" + json);
            }
            else
            {
                _JogosSDK.DebugLog("JSLibCallback_SubscribeGameItemChange error:" + json);
            }
        }



        public void JSLibCallback_SubscribeGameItemChangeError(string msg)
        {
            var tempList = _subscribeGameItemChangeErrorCallbacks.Select(c => c).ToList();
            tempList.ForEach(c => c(msg));
            _JogosSDK.DebugLog("JSLibCallback_SubscribeGameItemChangeError:" + msg);
        }


        #endregion


        #endregion




#if UNITY_WEBGL
        [DllImport("__Internal")]
        private static extern void JogosSDK_BuyOut();

        [DllImport("__Internal")]
        private static extern void JogosSDK_BuyGoods(string goodsId);

        [DllImport("__Internal")]
        private static extern void JogosSDK_GetOrderDetail(string orderId);

        [DllImport("__Internal")]
        private static extern void JogosSDK_GetOrderList(string status, int pageNo, int pageSize);

        [DllImport("__Internal")]
        private static extern void JogosSDK_SubscribeOrderPaid();

        [DllImport("__Internal")]
        private static extern void JogosSDK_DeliverGoods(string orderId);

        [DllImport("__Internal")]
        private static extern void JogosSDK_OpenBuyGameItemsDialog(int level);

        [DllImport("__Internal")]
        private static extern void JogosSDK_GetUserGameItems();

        [DllImport("__Internal")]
        private static extern void JogosSDK_AddGameItem(string id, int amount);

        [DllImport("__Internal")]
        private static extern void JogosSDK_SubtractGameItem(string id, int amount);

        [DllImport("__Internal")]
        private static extern void JogosSDK_SubscribeGameItemChange();
#else
        private string JogosSDK_BuyOut() { return ""; }

        private string JogosSDK_BuyGoods(string goodsId) { return ""; }

        private void JogosSDK_GetOrderDetail(string orderId) { }

        private void JogosSDK_SubscribeOrderPaid() { }

        private void JogosSDK_GetOrderList(string status, int pageNo, int pageSize) { }

        private void JogosSDK_DeliverGoods(string orderId) { }

        private void JogosSDK_OpenBuyGameItemsDialog(int level) { }

        private void JogosSDK_GetUserGameItems() { }

        private void JogosSDK_AddGameItem(string id, int amount) { }

        private void JogosSDK_SubtractGameItem(string id, int amount) { }

        private void JogosSDK_SubscribeGameItemChange() { }
#endif
    }

    [Serializable]
    public class GameItem
    {
        public string id;
        public int amount;
        public int difference; 
    }

    public class GameItemList
    {
        public GameItem[] gameItemList;
    }

    [Serializable]
    public class BuyGoodsResult
    {
        public string orderNo;
        public string goodsId;
    }

    [Serializable]
    public class Goods
    {
        public string id;
        public string name;
        public string imageURL;
        public string description;
    }

    [Serializable]
    public class PaymentOrder
    {
        public int gameId;
        public string gameName;
        public int userId;
        public string account;
        public string orderNo;
        public string goodsId;
        public string goodsName;
        public string currency;
        public string country;
        public int discount;
        public int calorcoin;
        public int paid;
        public string channel;
        public string paymentType;
        public string paymentNo;
        public string status; //'pending' | 'fail' | 'cancel' | 'expire' | 'success' | 'refunding' | 'refunded' | 'refund-fail';
        public string createTime;
        public string refundNo;
        public string refundDescription;
        public string refundTime;
        public string refundedTime;
    }

    public class PaymentOrderList
    {
        public PaymentOrder[] paymentOrderList;
    }


}
