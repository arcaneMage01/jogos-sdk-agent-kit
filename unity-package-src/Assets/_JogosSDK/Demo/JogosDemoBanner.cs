using JogosGames.Engine.SDK;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

public class JogosDemoBanner : MonoBehaviour
{
    public GameObject[] Banners;
    public Text Info;

    private void OnEnable()
    {
        foreach (var banner in Banners)
        {
            banner.SetActive(true);
        }
    }

    private void OnDisable()
    {
        foreach (var banner in Banners)
        {
            banner.SetActive(false);
        }
    }

    private void Update()
    {
        StringBuilder stringBuilder = new StringBuilder();
        stringBuilder.AppendLine("ScreenSize:" + Screen.width + "," + Screen.height);
        Info.text = stringBuilder.ToString();
    }

    public void OnBtnShowBanner()
    {
        JogosSDK.Banner.ShowAll();
    }

    public void OnBtnHideBanner()
    {
        JogosSDK.Banner.HideAll();
    }
}
