using JogosGames.Engine.SDK;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class JogosDemoPauseTest : MonoBehaviour
{
    public Text testTimer;
    public RectTransform testTrans;

    private float time;
    public void Update()
    {
        time += Time.deltaTime;
        testTimer.text = time.ToString();
        testTrans.anchoredPosition = testTrans.anchoredPosition + Time.deltaTime * new Vector2(10, 0);
        if (testTrans.anchoredPosition.x > 1000)
        {
            testTrans.anchoredPosition = new Vector2(0, testTrans.anchoredPosition.y);
        }
    }


    public void OnBtnADVideo()
    {
        JogosSDK.Ad.RequestAd(JogosAdType.Rewarded, ()=>
        {
            Debug.Log("ADVideo started");
        }, (error) =>
        {
            Debug.Log("ADVideo error");
        }, () =>
        {
            Debug.Log("ADVideo finished");
        });
    }

    public void OnBtnADMiddle()
    {
        JogosSDK.Ad.RequestAd(JogosAdType.Midgame, () =>
        {
            Debug.Log("ADMidgame started");
        }, (error) =>
        {
            Debug.Log("ADMidgame error");
        }, () =>
        {
            Debug.Log("ADMidgame finished");
        });
    }

    public void OnBtnShowBanner()
    {
        JogosSDK.Banner.ShowAll();
    }

    public void OnClearAll()
    {
        JogosSDK.Banner.HideAll();
    }
}
