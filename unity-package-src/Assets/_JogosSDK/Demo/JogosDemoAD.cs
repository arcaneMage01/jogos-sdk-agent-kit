using JogosGames.Engine.SDK;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class JogosDemoAD : MonoBehaviour
{
    public Text info;

    public void OnBtnADVideo()
    {
        JogosSDK.Ad.RequestAd(JogosAdType.Rewarded, () =>
        {
            Debug.Log("ADVideo started");
            info.text = "ADVideo started";
        }, (error) =>
        {
            Debug.Log("ADVideo error");
            info.text = "ADVideo error";
        }, () =>
        {
            Debug.Log("ADVideo finished");
            info.text = "ADVideo finished";
        });
    }

    public void OnBtnADMiddle()
    {
        JogosSDK.Ad.RequestAd(JogosAdType.Midgame, () =>
        {
            Debug.Log("ADMidgame started");
            info.text = "ADMidgame started";
        }, (error) =>
        {
            Debug.Log("ADMidgame error");
            info.text = "ADMidgame error";
        }, () =>
        {
            Debug.Log("ADMidgame finished");
            info.text = "ADMidgame finished";
        });
    }

    public void HasAdblock()
    {
        JogosSDK.Ad.HasAdblock((hasAdLock)=>
        {
            Debug.Log("HasAdblock " + hasAdLock);
            info.text = "HasAdblock " + hasAdLock;
        });
    }

    public void GetAdCount()
    {
        JogosSDK.Ad.GetRewardAdCount((count) =>
        {
            Debug.Log("GetAdCount " + count);
            info.text = "GetAdCount " + count;
        });
    }
}
