using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using UnityEngine;

namespace JogosGames.Engine.SDK
{
    public class AdModule : MonoBehaviour
    {
        
        public bool AdRequestInProgress { get; private set; }
        private JogosSDK _JogosSDK;

        

        public void Init(JogosSDK JogosSDK)
        {
            _JogosSDK = JogosSDK;

            if (Application.isEditor)
            {
                SetAdblockDetectionStatus(false);
            }
            else
            {
                JogosSDK_HasAdblock();
            }
        }

        #region Adblock

        private bool? _HasAdblock;
        private readonly List<Action<bool>> _AdblockCallbacks = new List<Action<bool>>();

        /// <summary>
        /// HasAdblock
        /// </summary>
        /// <param name="callback"></param>
        public void HasAdblock(Action<bool> callback)
        {
            if (_HasAdblock.HasValue)
            {
                callback?.Invoke(_HasAdblock.Value);
            }
            else
            {
                _AdblockCallbacks.Add(callback);
                JogosSDK_HasAdblock();
            }
        }

        private void SetAdblockDetectionStatus(bool detected)
        {
            _HasAdblock = detected;
            _AdblockCallbacks.ForEach(a => a?.Invoke(detected));
            _AdblockCallbacks.Clear();
        }

        public void JSLibCallback_HasAdblockError(string msg)
        {
            _JogosSDK.DebugLog("JSLibCallback_HasAdblock error:" + msg);
        }

        public void JSLibCallback_HasAdblock(int result)
        {
            var detected = result == 1;
            _JogosSDK.DebugLog($"Adblock present: {result} = {detected}, calling {_AdblockCallbacks.Count} callbacks");
            SetAdblockDetectionStatus(detected);
        }

        #endregion

        #region RequestAd

        private Action _OnAdStarted;
        private Action<string> _OnAdError;
        private Action _OnAdFinished;

        /// <summary>
        /// RequestAd
        /// </summary>
        /// <param name="adType"></param>
        /// <param name="adStarted"></param>
        /// <param name="adError"></param>
        /// <param name="adFinished"></param>
        /// <exception cref="Exception"></exception>
        public void RequestAd(JogosAdType adType, Action adStarted, Action<string> adError, Action adFinished)
        {
            if (!Application.isEditor && Application.platform != RuntimePlatform.WebGLPlayer)
            {
                return;
            }

            if (!JogosSDK.IsInitialized)
            {
                throw new Exception("JogosSDK not initialized. Please call JogosSDK.Instance.Init() before using the SDK.");
            }

            _JogosSDK.DebugLog("Requesting JogosAd Type: " + adType);

            _OnAdStarted = adStarted;
            _OnAdError = adError;
            _OnAdFinished = adFinished;
            AdRequestInProgress = true;

            try
            {
                _JogosSDK.WrapSDKAction(
                    () =>
                    {
                        _JogosSDK.ShowTips("Show AD " + adType.ToString());
                        JogosSDK_RequestAd(adType.ToString().ToLower());
                    },
                    () =>
                    {
                        _JogosSDK.ShowTips("Show AD " + adType.ToString());
                        SimulateAdBreak(adType);
                    }
                );
            }
            catch (Exception e)
            {
                _JogosSDK.ShowTips( "Start AD error:" + e.ToString());
            }

        }

        public void JSLibCallback_RequestAdError(string error)
        {
            CleanupAd();
            _JogosSDK.ShowTips(error);
            _JogosSDK.DebugLog("Ad Error: " + error);
            _OnAdError?.Invoke(error);
        }

        public void JSLibCallback_RequestAdFinished()
        {
            CleanupAd();
            _JogosSDK.DebugLog("Ad Finished");
            _OnAdFinished?.Invoke();
        }

        public void JSLibCallback_RequestAdStarted()
        {
            StartAd();
            _JogosSDK.ClearTips();
            _JogosSDK.DebugLog("Ad Started");
            _OnAdStarted?.Invoke();
        }

        private void StartAd()
        {
            if(_JogosSDK.Settings.pauseGameDuringAd)
                _JogosSDK.Pause();
            Application.runInBackground = true;
        }

        private void CleanupAd()
        {
            if (_JogosSDK.Settings.pauseGameDuringAd)
                _JogosSDK.Resume();
            AdRequestInProgress = false;
        }


        #region SimulateAd

        private IEnumerator InvokeRealtimeCoroutine(Action action, float seconds)
        {
            yield return new WaitForSecondsRealtime(seconds);
            action();
        }

        private void SimulateAdBreak(JogosAdType adType)
        {
            var adTypeStr = adType.ToString();

            if (adType == JogosAdType.Rewarded)
            {
                Debug.Log("JogosAds: Rewarded ad simulation, game will resume in 3 seconds");
                var adPreview = new GameObject("JogosAdPreview").AddComponent<JogosAdPreview>();
                adPreview.labelText = char.ToUpper(adTypeStr[0]) + adTypeStr.Substring(1) + " ad simulation, the game will resume in 3 seconds";

                JSLibCallback_RequestAdStarted();
                StartCoroutine(InvokeRealtimeCoroutine(EndSimulation, 3));
            }
            else
            {
                Debug.Log("JogosAds: Midgame ad simulation, game will resume in 1 seconds");
                var adPreview = new GameObject("JogosAdPreview").AddComponent<JogosAdPreview>();
                adPreview.labelText = char.ToUpper(adTypeStr[0]) + adTypeStr.Substring(1) + " ad simulation, the game will resume in 1 seconds";

                JSLibCallback_RequestAdStarted();
                StartCoroutine(InvokeRealtimeCoroutine(EndSimulation, 1));

            }
        }

        private void EndSimulation()
        {
            DestroyImmediate(GameObject.Find("JogosAdPreview"));
            JSLibCallback_RequestAdFinished();
        }


        #endregion

        #endregion

        #region GetRewardAdCount

        private readonly List<Action<int>> _getAdCountCallbacks = new List<Action<int>>();

        /// <summary>
        /// ShareGame
        /// </summary>
        /// <param name="shareInfo"></param>
        /// <param name="action"></param>
        public void GetRewardAdCount(Action<int> action)
        {
            _getAdCountCallbacks.Clear();
            _getAdCountCallbacks.Add(action);
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    JogosSDK_GetRewardAdCount();
                },
                () =>
                {
                    JSLibCallback_GetRewardAdCount(0);
                }
            );
        }

        public void JSLibCallback_GetRewardAdCount(int count)
        {
            var tempList = _getAdCountCallbacks.Select(c => c).ToList();
            _getAdCountCallbacks.Clear();
            tempList.ForEach(c => c(count));
        }
        public void JSLibCallback_GetRewardAdCountError(string msg)
        {
            var tempList = _getAdCountCallbacks.Select(c => c).ToList();
            _getAdCountCallbacks.Clear();
            tempList.ForEach(c => c(-1));

            _JogosSDK.DebugLog("JogosSDK_GetRewardAdCount error:" + msg);
        }

        #endregion

#if UNITY_WEBGL
        [DllImport("__Internal")]
        private static extern void JogosSDK_RequestAd(string adType);

        [DllImport("__Internal")]
        private static extern void JogosSDK_HasAdblock();

        [DllImport("__Internal")]
        private static extern void JogosSDK_GetRewardAdCount();
#else
        private void JogosSDK_RequestAd(string adType) { }

        private void JogosSDK_HasAdblock() { }

        private void JogosSDK_GetRewardAdCount() { }
#endif
    }

    public enum JogosAdType
    {
        Midgame,
        Rewarded,
    }
}
