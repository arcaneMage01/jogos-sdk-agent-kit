using JogosGames.Engine.SDK;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

public class JogosDemoGoods : MonoBehaviour
{
    public Text info;
    public InputField goodIdInput;

    public InputField statusInput;
    public InputField pageNoInput;
    public InputField pageSizeInput;

    public InputField orderNoInput;

    public InputField deliverOrderInput;
    public Toggle autoDeliverToggle;


    public void Start()
    {
        Debug.Log("SubscribeOrderPaid On Start");
        JogosSDK.Goods.SubscribeOrderPaid((orderInfo) =>
        {
            var jsonStr = JsonUtility.ToJson(orderInfo);
            Debug.Log("OrderResult " + jsonStr);
            info.text = "OrderResult " + jsonStr;
        }, (errorMsg)=>
        {
            
        });

    }

    public void OnBtnBuyOut()
    {
        JogosSDK.Goods.BuyOut((orderId, goodsId)=>
        {
            Debug.Log("OnBtnBuyOut " + orderId);
            info.text = "OnBtnBuyOut " + orderId;
            orderNoInput.text = orderId;
            deliverOrderInput.text = orderId;
        });
    }

    public void OnBtnBuyGoods()
    {
        JogosSDK.Goods.BuyGoods(goodIdInput.text, (orderId, goodsId) =>
        {
            Debug.Log("OnBtnBuyGoods " + orderId + "," + goodsId);
            info.text = "OnBtnBuyGoods " + orderId + "," + goodsId;
            orderNoInput.text = orderId;
            deliverOrderInput.text = orderId;
        });
    }

    public void OnBtnGetList()
    {
        JogosSDK.Goods.GetOrderList(statusInput.text, int.Parse(pageNoInput.text), int.Parse(pageSizeInput.text), (orderList) =>
        {
            StringBuilder sb = new StringBuilder();
            foreach (var orderInfo in orderList)
            {
                sb.Append(JsonUtility.ToJson(orderInfo));
            }
            Debug.Log("GetOrderList " + sb.ToString());
            info.text = "GetOrderList " + sb.ToString();
        });
    }

    public void OnBtnGetOrderInfo()
    {
        JogosSDK.Goods.GetOrderInfo(orderNoInput.text, (orderInfo)=>
        {
            var jsonStr = JsonUtility.ToJson(orderInfo);
            Debug.Log("GetOrderInfo " + jsonStr);
            info.text = "GetOrderInfo " + jsonStr;
        });
    }

    public void OnBtnDeliverGood()
    {
        JogosSDK.Goods.DeliverGoods(deliverOrderInput.text);
    }

    public void OnToggleAutoDeliver(bool isAuto)
    {
        JogosSDK.Goods.IsAutoDeliver = isAuto;
    }
}
