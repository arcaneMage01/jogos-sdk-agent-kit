using JogosGames.Engine.SDK;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class JogosDemoUser : MonoBehaviour
{
    public Text info;
    

    public void OnBtnGetUser()
    {
        JogosSDK.User.GetUser(
            (user) =>
            {
                if (user != null)
                {
                    Debug.Log("Get user result: " + user);
                    info.text = "Get user result: " + user;
                }
                else
                {
                    Debug.Log("User is not signed in");
                    info.text = "User is not signed in";
                }
            }
        );
    }

    public void OnBtnGetToken()
    {
        JogosSDK.User.GetUserToken(
            (token) =>
            {
                if (token != null)
                {
                    Debug.Log("User token: " + token);
                    info.text = "User token: " + token;
                }
                else
                {
                    Debug.Log("get token error");
                    info.text = "get token error";
                }
            }
        );
    }

    public void OnBtnGetPublicKey()
    {
        JogosSDK.User.GetPublicKey(
            (key) =>
            {
                if (key != null)
                {
                    Debug.Log("Public key: " + key);
                    info.text = "Public key: " + key;
                }
                else
                {
                    Debug.Log("get Public key error");
                    info.text = "get Public key error";
                }
            }
        );
    }

}
