using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using UnityEngine;

namespace JogosGames.Engine.SDK
{
    public class GameModule : MonoBehaviour
    {
        private JogosSDK _JogosSDK;


        public void Init(JogosSDK JogosSDK)
        {
            _JogosSDK = JogosSDK;
        }

        #region HappyTime

        public void HappyTime()
        {
            _JogosSDK.DebugLog("Happy time!");
            _JogosSDK.WrapSDKAction(JogosSDK_HappyTime, () => { });
        }

        public void JSLibCallback_HappyTime()
        {
            _JogosSDK.DebugLog("JSLibCallback_HappyTime:");
        }
        public void JSLibCallback_HappyTimeError(string msg)
        {
            _JogosSDK.DebugLog("JogosSDK_HappyTime error:" + msg);
        }

        #endregion

        #region GameplayContinue

        public void GameplayContinue()
        {
            _JogosSDK.DebugLog("Gameplay start called");
            _JogosSDK.WrapSDKAction(JogosSDK_GameContinue, () => { });
        }

        public void JSLibCallback_GameContinue()
        {
            _JogosSDK.DebugLog("JSLibCallback_GameContinue:");
        }
        public void JSLibCallback_GameContinueError(string msg)
        {
            _JogosSDK.DebugLog(" JogosSDK_GameContinue error:" + msg);
        }

        #endregion

        #region GameplayPause

        public void GameplayPause()
        {
            _JogosSDK.DebugLog("Gameplay stop called");
            _JogosSDK.WrapSDKAction(JogosSDK_GamePause, () => { });
        }


        public void JSLibCallback_GamePause()
        {
            _JogosSDK.DebugLog("JSLibCallback_GamePause");
        }
        public void JSLibCallback_GamePauseError(string msg)
        {
            _JogosSDK.DebugLog("JSLibCallback_GamePauseError" + msg);
        }

        #endregion

        #region Share

        private readonly List<Action<bool>> _shareCallbacks = new List<Action<bool>>();

        /// <summary>
        /// ShareGame
        /// </summary>
        /// <param name="shareInfo"></param>
        /// <param name="action"></param>
        public void ShareGame(ShareInfo shareInfo, Action<bool> action)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _shareCallbacks.Add(action);
                    var response = JsonUtility.ToJson(shareInfo);
                    JogosSDK_Share(response);
                },
                () =>
                {

                }
            );
        }

        public void JSLibCallback_Share()
        {
            var tempList = _shareCallbacks.Select(c => c).ToList();
            _shareCallbacks.Clear();
            tempList.ForEach(c => c(true));

            _JogosSDK.DebugLog("JSLibCallback_Share:");
        }
        public void JSLibCallback_ShareError(string msg)
        {
            var tempList = _shareCallbacks.Select(c => c).ToList();
            _shareCallbacks.Clear();
            tempList.ForEach(c => c(false));

            _JogosSDK.DebugLog("JSLibCallback_ShareError:" + msg);
        }

        #endregion

        #region Achievements

        private readonly List<Action<bool>> _achievementCallbacks = new List<Action<bool>>();
        private readonly List<Action<bool>> _openAchievementDialogCallbacks = new List<Action<bool>>();

        /// <summary>
        /// CommitAchievementData
        /// </summary>
        /// <param name="shareInfo"></param>
        /// <param name="action"></param>
        public void CommitAchievementData(string name, int progress, bool hidden, Action<bool> action)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _achievementCallbacks.Add(action);
                    JogosSDK_CommitAchievementsData(name, progress, hidden);
                },
                () =>
                {

                }
            );
        }

        public void JSLibCallback_CommitAchievementsData()
        {
            var tempList = _achievementCallbacks.Select(c => c).ToList();
            _achievementCallbacks.Clear();
            tempList.ForEach(c => c(true));

            _JogosSDK.DebugLog("JSLibCallback_CommitAchievementsData:");
        }
        public void JSLibCallback_CommitAchievementsDataError(string msg)
        {
            var tempList = _achievementCallbacks.Select(c => c).ToList();
            _achievementCallbacks.Clear();
            tempList.ForEach(c => c(false));

            _JogosSDK.DebugLog("JSLibCallback_CommitAchievementsDataError:" + msg);
        }

        /// <summary>
        /// OpenAchievementsDialog
        /// </summary>
        public void OpenAchievementsDialog(Action<bool> action)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _openAchievementDialogCallbacks.Add(action);
                    JogosSDK_OpenAchievementsDialog();
                },
                () =>
                {

                }
            );
        }
        public void JSLibCallback_OpenAchievementsDialog()
        {
            var tempList = _openAchievementDialogCallbacks.Select(c => c).ToList();
            _openAchievementDialogCallbacks.Clear();
            tempList.ForEach(c => c(true));

            _JogosSDK.DebugLog("JSLibCallback_OpenAchievementsDialog:");
        }
        public void JSLibCallback_OpenAchievementsDialogError(string msg)
        {
            var tempList = _openAchievementDialogCallbacks.Select(c => c).ToList();
            _openAchievementDialogCallbacks.Clear();
            tempList.ForEach(c => c(false));

            _JogosSDK.DebugLog("JSLibCallback_OpenAchievementsDialogError:" + msg);
        }

        #endregion

        #region Ranking

        private readonly List<Action<bool>> _rankingCallbacks = new List<Action<bool>>();
        private readonly List<Action<bool>> _openRankingDialogCallbacks = new List<Action<bool>>();


        /// <summary>
        /// CommitRankingData
        /// </summary>
        /// <param name="rankingName"></param>
        /// <param name="randDataList"></param>
        /// <param name="action"></param>
        public void CommitRankingData(string rankingName, string rankingData, Action<bool> action)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    if (action != null)
                    {
                        _rankingCallbacks.Add(action);
                    }
                    JogosSDK_CommitRankingData(rankingName, rankingData);
                },
                () =>
                {

                }
            );
        }

        public void JSLibCallback_CommitRankingData()
        {
            var tempList = _rankingCallbacks.Select(c => c).ToList();
            _rankingCallbacks.Clear();
            tempList.ForEach(c => c(true));

            _JogosSDK.DebugLog("JSLibCallback_CommitRankingData:");
        }

        public void JSLibCallback_CommitRankingDataError(string msg)
        {
            var tempList = _rankingCallbacks.Select(c => c).ToList();
            _rankingCallbacks.Clear();
            tempList.ForEach(c => c(false));

            _JogosSDK.DebugLog("JSLibCallback_CommitRankingDataError:" + msg);
        }

        /// <summary>
        /// OpenRankingDialog
        /// </summary>
        /// <param name="action"></param>
        public void OpenRankingDialog(string rankingName, Action<bool> action)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _openRankingDialogCallbacks.Add(action);
                    JogosSDK_OpenRankingDialog(rankingName);
                },
                () =>
                {

                }
            );
        }
        public void JSLibCallback_OpenRankingDialog()
        {
            var tempList = _openRankingDialogCallbacks.Select(c => c).ToList();
            _openRankingDialogCallbacks.Clear();
            tempList.ForEach(c => c(true));

            _JogosSDK.DebugLog("JSLibCallback_OpenRankingDialog:");
        }
        public void JSLibCallback_OpenRankingDialogError(string msg)
        {
            var tempList = _openRankingDialogCallbacks.Select(c => c).ToList();
            _openRankingDialogCallbacks.Clear();
            tempList.ForEach(c => c(false));

            _JogosSDK.DebugLog("JSLibCallback_OpenRankingDialogError:" + msg);
        }

        #endregion

        #region ExchangePrize

        public class ExchangeVoucher
        {
            public int gameId;
            public string gameName;
            public int userId;
            public string cdkey;
            public string status; //'unused' | 'used' | 'expire';
            public string exchangeTime;
        }

        private Action<string> _ExchangePrizeSuccess;
        private Action<string> _ExchangePrizeError;

        public void ExchangePrize(string cdkey, Action<string> successCb, Action<string> failCb)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _ExchangePrizeSuccess = successCb;
                    _ExchangePrizeError = failCb;
                    JogosSDK_ExchangePrizes(cdkey);
                },
                () =>
                {
                    successCb.Invoke(cdkey);
                }
            );
        }

        public void JSLibCallback_ExchangePrizes(string prizeId)
        {
            _ExchangePrizeSuccess.Invoke(prizeId);
            _JogosSDK.DebugLog("JSLibCallback_ExchangePrizes:" + prizeId);
        }

        public void JSLibCallback_ExchangePrizesError(string msg)
        {
            if(_ExchangePrizeError != null)
                _ExchangePrizeError.Invoke(msg);

            _JogosSDK.DebugLog("JSLibCallback_ExchangePrizesError:" + msg);
        }

        #endregion

#if UNITY_WEBGL
        [DllImport("__Internal")]
        private static extern void JogosSDK_HappyTime();

        [DllImport("__Internal")]
        private static extern void JogosSDK_GameContinue();

        [DllImport("__Internal")]
        private static extern void JogosSDK_GamePause();

        [DllImport("__Internal")]
        private static extern void JogosSDK_Share(string jsonData);

        [DllImport("__Internal")]
        private static extern void JogosSDK_CommitAchievementsData(string name, int progress, bool hidden);

        [DllImport("__Internal")]
        private static extern void JogosSDK_OpenAchievementsDialog();

        [DllImport("__Internal")]
        private static extern void JogosSDK_CommitRankingData(string rankingName, string data);

        [DllImport("__Internal")]
        private static extern void JogosSDK_OpenRankingDialog(string rankingName);

        [DllImport("__Internal")]
        private static extern void JogosSDK_ExchangePrizes(string cdkey);

#else
        private void JogosSDK_HappyTime() { }

        private void JogosSDK_GameContinue() { }

        private void JogosSDK_GamePause() { }
        
        private void JogosSDK_Share(string jsonData) { }

        private void JogosSDK_CommitAchievementsData(string name, int progress, bool hidden) {}

        private void JogosSDK_OpenAchievementsDialog() {}

        private void JogosSDK_CommitRankingData(string rankingName, string data) {}

        private void JogosSDK_OpenRankingDialog(string rankingName) {}

        private void JogosSDK_ExchangePrizes(string cdkey) {}
#endif
    }
}
