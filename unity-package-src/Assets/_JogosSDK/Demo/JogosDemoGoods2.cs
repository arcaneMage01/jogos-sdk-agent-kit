using JogosGames.Engine.SDK;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

public class JogosDemoGoods2 : MonoBehaviour
{
    public Text info;

    public InputField id_addInput;
    public InputField amount_addInput;
    public InputField id_subInput;
    public InputField amount_subInput;

    public InputField level_Input;


    public void Start()
    {
        Debug.Log("SubscribeGameItemChange On Start");
        JogosSDK.Goods.SubscribeGameItemChange((gameItem) =>
        {
            var jsonStr = JsonUtility.ToJson(gameItem);
            Debug.Log("SubscribeGameItemChange " + jsonStr);
            info.text = "result " + jsonStr;
        }, (errorMsg) =>
        {
        });
    }

    public void OnBtnOpenPaymentDialog()
    {
        JogosSDK.Goods.OpenPaymentDialog(int.Parse(level_Input.text), (gameItems) =>
        {
            if (gameItems != null)
            {
                StringBuilder sb = new StringBuilder("OpenPaymentDialog sucess");
                foreach (var temp in gameItems)
                {
                    sb.Append(" id: " + temp.id);
                }
                info.text = sb.ToString();
            }
            else
            {
                info.text = "OpenPaymentDialog fail";
            }
        },
        (errorMsg) =>
        {

        });
    }

    public void OnBtnAddGameItem()
    {
        JogosSDK.Goods.AddGameItem(id_addInput.text, int.Parse(amount_addInput.text), (success) =>
        {
            if (success)
            {
                info.text = "AddPropItem sucess";
            }
            else
            {
                info.text = "AddPropItem fail";
            }
        });
    }

    public void OnBtnSubtractGameItem()
    {
        JogosSDK.Goods.SubtractGameItem(id_subInput.text, int.Parse(amount_subInput.text), (success) =>
        {
            if (success)
            {
                info.text = "SubtractPropItem sucess";
            }
            else
            {
                info.text = "SubtractPropItem fail";
            }
        });
    }

    public void OnBtnGetUserGameItems()
    {
        JogosSDK.Goods.GetUserGameItems((gameItems) =>
        {
            if (gameItems!=null)
            {
                StringBuilder sb = new StringBuilder("GetUserPropItems sucess");
                foreach(var temp in gameItems)
                {
                    sb.Append(" id: " + temp.id);
                }
                info.text = sb.ToString();
            }
            else
            {
                info.text = "GetUserPropItems fail";
            }
        },
        (errorMsg) =>
        {

        });
    }

   
}
