using JogosGames.Engine.SDK;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class JogosDemoMain : MonoBehaviour
{
    public GameObject NoInitPanel;
    public GameObject InitedPanel;

    public GameObject AdMoudlePanel;
    public GameObject BannerMoudlePanel;
    public GameObject UserMoudlePanel;
    public GameObject DataMoudlePanel;
    public GameObject GameMoudlePanel;
    public GameObject GameMoudle2Panel;
    public GameObject GameMoudle3Panel;
    public GameObject GoodsMoudlePanel;
    public GameObject GoodsMoudle2Panel;
    public GameObject FriendMoudlePanel;

    public GameObject PauseTestPanel;

    private void Start()
    {
        HideAll();
        NoInitPanel.SetActive(true);

        // 1. 先 Init，2. 再通知平台开始加载（内部会等待 init 完成）
        JogosSDK.Init(() =>
        {
            HideAll();
            InitedPanel.SetActive(true);

            // 示例没有真实资源加载，初始化完成即视为可玩；
            // 实际项目请在“玩家真正可以操作”的时机调用。
            JogosSDK.LoadingEnd();
        });
        JogosSDK.LoadingStart();
    }

    private void HideAll()
    {
        NoInitPanel.SetActive(false);
        InitedPanel.SetActive(false);

        AdMoudlePanel.SetActive(false);
        BannerMoudlePanel.SetActive(false);
        UserMoudlePanel.SetActive(false);
        DataMoudlePanel.SetActive(false);
        GameMoudlePanel.SetActive(false);
        GameMoudle2Panel.SetActive(false);
        GameMoudle3Panel.SetActive(false);
        GoodsMoudlePanel.SetActive(false);
        GoodsMoudle2Panel.SetActive(false);
        FriendMoudlePanel.SetActive(false);
    }

    public void OnBtnBack()
    {
        HideAll();
        InitedPanel.SetActive(true);
    }

    public void OnBtnAdMoudle()
    {
        HideAll();
        AdMoudlePanel.SetActive(true);
    }

    public void OnBtnBannerMoudle()
    {
        HideAll();
        BannerMoudlePanel.SetActive(true);
    }

    public void OnBtnUserMoudle()
    {
        HideAll();
        UserMoudlePanel.SetActive(true);
    }

    public void OnBtnDataMoudle()
    {
        HideAll();
        DataMoudlePanel.SetActive(true);
    }

    public void OnBtnGameMoudle()
    {
        HideAll();
        GameMoudlePanel.SetActive(true);
    }

    public void OnBtnGameMoudle2()
    {
        HideAll();
        GameMoudle2Panel.SetActive(true);
    }

    public void OnBtnGameMoudle3()
    {
        HideAll();
        GameMoudle3Panel.SetActive(true);
    }

    public void OnBtnGoodsMoudle()
    {
        HideAll();
        GoodsMoudlePanel.SetActive(true);
    }

    public void OnBtnGoodsMoudle2()
    {
        HideAll();
        GoodsMoudle2Panel.SetActive(true);
    }

    public void OnBtnFriendMoudle()
    {
        HideAll();
        FriendMoudlePanel.SetActive(true);
    }
}
