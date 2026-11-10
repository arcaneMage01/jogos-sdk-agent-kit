using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Serialization;

namespace JogosGames.Engine.SDK
{
    public class JogosSettings : ScriptableObject
    {
        public bool pauseGameDuringAd = true;

        public bool pauseGameLostFocus = true;

        public bool disableSdkLogs;

        public bool showErrorTips = true;
    }
}
