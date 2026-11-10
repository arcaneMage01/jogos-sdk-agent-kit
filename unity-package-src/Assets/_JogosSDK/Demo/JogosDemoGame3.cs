using JogosGames.Engine.SDK;
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class JogosDemoGame3 : MonoBehaviour
{
    
    public Text info;


    #region achievement

    public InputField cdKey;

    public void OnExchangePrize()
    {
        JogosSDK.Game.ExchangePrize(cdKey.text, (prizeId) =>
        {
            info.text = "ExchangePrize success:" + prizeId;
            Debug.Log("ExchangePrize success:" + prizeId);
        }, (errorMsg) =>
        {
            info.text = "ExchangePrize fail:" + errorMsg;
            Debug.Log("ExchangePrize fail:" + errorMsg);
        });
    }

    #endregion

}
