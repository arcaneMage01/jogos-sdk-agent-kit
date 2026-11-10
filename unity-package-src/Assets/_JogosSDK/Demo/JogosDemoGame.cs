using JogosGames.Engine.SDK;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class JogosDemoGame : MonoBehaviour
{
    

    public void OnBtnGamePause()
    {
        JogosSDK.Game.GameplayPause();
    }

    public void OnBtnGameContinue()
    {
        JogosSDK.Game.GameplayContinue();
    }

    public void OnBtnHappyTime()
    {
        JogosSDK.Game.HappyTime();
    }


    public InputField ShareInput;
    public void OnBtnShare()
    {
        var shareInfo = new ShareInfo();
        shareInfo.userName = "Player1";
        shareInfo.userRoleId = "0";
        shareInfo.serverId = "0";
        shareInfo.dynamicContent = ShareInput.text;

        JogosSDK.Game.ShareGame(shareInfo,
            (isSucess) =>
            {
                if (isSucess)
                {
                    Debug.Log("ShareGame sucess: ");
                    //info.text = "ShareGame sucess:";
                }
                else
                {
                    Debug.Log("ShareGame error");
                    //info.text = "ShareGame error";
                }
            }
        );
    }

}
