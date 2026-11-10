using JogosGames.Engine.SDK;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

public class JogosDemoFriend : MonoBehaviour
{
    public Text info;

    public InputField id_Input;

    public InputField ids_Input;

    public InputField inviteArgs_Input;


    public void Start()
    {
      
    }

    public void OnBtnOpenChatDialog()
    {
        int userId = int.Parse(id_Input.text);
        JogosSDK.Friend.OpenChatDialog(userId, (result) =>
        {
            info.text = result;
        },
        (errorMsg) =>
        {
            info.text = errorMsg;
        });
    }

    public void OpenInviteDialog()
    {
        string inviteArgs = inviteArgs_Input.text;
        JogosSDK.Friend.OpenInviteDialog(inviteArgs, (result) =>
        {
            info.text = result;
        },
        (errorMsg) =>
        {
            info.text = errorMsg;
        });
    }

    public void OnBtnCheckIsMyFriends()
    {
        string[] userIdsStr = ids_Input.text.Split(",");
        int[] userIds = new int[userIdsStr.Length];
        for (int i = 0;i < userIdsStr.Length ;i++)
        {
            userIds[i] = int.Parse(userIdsStr[i]);
        }
        JogosSDK.Friend.CheckIsMyFriends(userIds, (result) =>
        {
            info.text = result;
        },
        (errorMsg) =>
        {
            info.text = errorMsg;
        });
    }

    public void OnBtnSendFirendRequset()
    {
        int userId = int.Parse(id_Input.text);
        JogosSDK.Friend.SendFirendRequset(userId, (result) =>
        {
            info.text = result;
        },
        (errorMsg) =>
        {
            info.text = errorMsg;
        });
    }
   
}
