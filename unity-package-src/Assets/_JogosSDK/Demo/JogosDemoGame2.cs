using JogosGames.Engine.SDK;
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

[Serializable]
public class  RankDataBase
{
    
}

[Serializable]
public class RankDataStr
{
    [SerializeField]
    private string type = "string";
    public string value;
}

[Serializable]
public class RankDataInt
{
    [SerializeField]
    private string type = "number";
    public int value;
}

[Serializable]
public class RankDataTime
{
    [SerializeField]
    private string type = "date";
    public long value;
}

[Serializable]
public class RankDataList
{
    [SerializeField]
    public RankDataStr selfKey1;
    [SerializeField]
    public RankDataInt selfKey2;
    [SerializeField]
    public RankDataTime selfKey3;
}

public class JogosDemoGame2 : MonoBehaviour
{
    public Text info;

    #region achievement

    public InputField AchevementNameField;
    public InputField AchevementProgressField;
    public Toggle AchevementHidden;

    public void OnCommitAchievement()
    {
        JogosSDK.Game.CommitAchievementData(AchevementNameField.text, int.Parse(AchevementProgressField.text), AchevementHidden.isOn, (sucess)=>
        {
            if (sucess)
            {
                info.text = "CommitAchievementData sucess";
            }
            else
            {
                info.text = "CommitAchievementData fail";
            }
        });
    }

    public void OnOpenAchievementDialog()
    {
        JogosSDK.Game.OpenAchievementsDialog((sucess) =>
        {
            if (sucess)
            {
                info.text = "OpenAchievementsDialog sucess";
            }
            else
            {
                info.text = "OpenAchievementsDialog fail";
            }
        });
    }

    #endregion

    #region ranking

    public InputField RankingName;

    public InputField RankingStrKey;
    public InputField RankingStrValue;

    public InputField RankingIntKey;
    public InputField RankingIntValue;

    public InputField RankingTimeKey;
    public InputField RankingTimeValue;

    public void OnCommitRankingData()
    {
        RankDataList rankData = new RankDataList();
        rankData.selfKey1 = new RankDataStr();
        //rankData.selfKey1.Type = RankingStrKey.text;
        rankData.selfKey1.value = RankingStrValue.text;

        rankData.selfKey2 = new RankDataInt();
        //rankData.selfKey2.Type = RankingIntKey.text;
        rankData.selfKey2.value = int.Parse( RankingIntValue.text);

        rankData.selfKey3 = new RankDataTime();
        //rankData.selfKey3.Type = RankingTimeKey.text;
        rankData.selfKey3.value = System.DateTime.Now.Ticks;

        var json = JsonUtility.ToJson( rankData );

        Debug.Log("To commit ranking data:" + json);
        JogosSDK.Game.CommitRankingData(RankingName.text, json, (sucess) =>
        {
            if (sucess)
            {
                info.text = "CommitRankingData sucess";
            }
            else
            {
                info.text = "CommitRankingData fail";
            }
        });
    }

    public void OnOpenRankingDialog()
    {
        JogosSDK.Game.OpenRankingDialog(RankingName.text, (sucess) =>
        {
            if (sucess)
            {
                info.text = "OpenRankingDialog sucess";
            }
            else
            {
                info.text = "OpenRankingDialog fail";
            }
        });
    }

    #endregion

}
