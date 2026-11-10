using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

public class JogosPauseWin : MonoBehaviour
{
    private void Update()
    {
        if (!Application.isFocused)
            return;

        if (Input.touchCount > 0 || Input.anyKeyDown)
        {
            JogosGames.Engine.SDK.JogosSDK.SdkSingleton.Resume();
        }
    }

}
