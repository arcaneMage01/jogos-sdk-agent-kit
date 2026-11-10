using System.Globalization;
using System.Runtime.InteropServices;
using UnityEngine;

namespace JogosGames.Engine.SDK
{
    public class DataModule : MonoBehaviour
    {
        private JogosSDK _JogosSDK;

        public void Init(JogosSDK JogosSDK)
        {
            _JogosSDK = JogosSDK;
        }

        public void SynchronizeToCloud()
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    JogosSDK_SynchronizeToCloud();
                },
                () =>
                {
                    
                }
            );
        }

        public void JSLibCallback_SynchronizeToCloud()
        {
            _JogosSDK.DebugLog("JSLibCallback_SynchronizeToCloud:");
        }

        public void JSLibCallback_SynchronizeToCloudError(string msg)
        {
            _JogosSDK.DebugLog("JSLibCallback_SynchronizeToCloudError:" + msg);
        }

#if UNITY_WEBGL


        [DllImport("__Internal")]
        private static extern void JogosSDK_SynchronizeToCloud();

#else
        private static void JogosSDK_SynchronizeToCloud() { }

#endif
    }
}
