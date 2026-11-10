using JogosGames.Engine.SDK;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class JogosDemoData : MonoBehaviour
{
    public InputField SaveInput;
    public Text LoadText;

    public void OnBtnSave()
    {
        PlayerPrefs.SetString("TestSave", SaveInput.text);
    }

    public void OnBtnLoad()
    {
        var saveStr = PlayerPrefs.GetString("TestSave", "");
        LoadText.text = saveStr;
    }

    public void OnBtnSyncData()
    {
        JogosSDK.Data.SynchronizeToCloud();
    }
}
