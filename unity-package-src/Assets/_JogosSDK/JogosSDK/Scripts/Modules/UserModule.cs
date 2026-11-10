using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using UnityEngine;

namespace JogosGames.Engine.SDK
{
    public class UserModule : MonoBehaviour
    {
        private JogosSDK _JogosSDK;

        public void Init(JogosSDK JogosSDK)
        {
            _JogosSDK = JogosSDK;
        }


        #region Get User Info

        private readonly List<Action<UserInfo>> _getUserCallbacks = new List<Action<UserInfo>>();
        /// <summary>
        /// Get User Info
        /// </summary>
        /// <param name="callback"></param>
        public void GetUser(Action<UserInfo> callback)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _getUserCallbacks.Add(callback);
                    if (_getUserCallbacks.Count == 1)
                    {
                        JogosSDK_GetUser();
                    }
                },
                () =>
                {
                    
                }
            );
        }

        public void JSLibCallback_GetUser(string responseStr)
        {
            var response = JsonUtility.FromJson<UserInfo>(responseStr);

            var tempList = _getUserCallbacks.Select(c => c).ToList();
            _getUserCallbacks.Clear();
            tempList.ForEach(c => c(response));
        }
        public void JSLibCallback_GetUserError(string msg)
        {
            var tempList = _getUserCallbacks.Select(c => c).ToList();
            _getUserCallbacks.Clear();
            tempList.ForEach(c => c(null));

            _JogosSDK.DebugLog("JogosSDK_GetUser error:" + msg);
        }
        #endregion

        #region Get Token
        private readonly List<Action<string>> _getUserTokenCallbacks = new List<Action<string>>();
        /// <summary>
        /// Get Token
        /// </summary>
        /// <param name="callback"></param>
        public void GetUserToken(Action<string> callback)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _getUserTokenCallbacks.Add(callback);
                    if (_getUserTokenCallbacks.Count == 1)
                    {
                        JogosSDK_GetUserToken();
                    }
                },
                () =>
                {
                    
                }
            );
        }
        public void JSLibCallback_GetUserToken(string responseStr)
        {

            var tempList = _getUserTokenCallbacks.Select(c => c).ToList();
            _getUserTokenCallbacks.Clear();
            tempList.ForEach(c => c(responseStr));
        }
        public void JSLibCallback_GetUserTokenError(string msg)
        {
            var tempList = _getUserTokenCallbacks.Select(c => c).ToList();
            _getUserTokenCallbacks.Clear();
            tempList.ForEach(c => c(null));

            _JogosSDK.DebugLog("JogosSDK_GetUserToken error:" + msg);
        }
        #endregion

        #region Get Public Key

        private readonly List<Action<string>> _getPublicKeyCallbacks = new List<Action<string>>();

        /// <summary>
        /// Get Public Key
        /// </summary>
        /// <param name="callback"></param>
        public void GetPublicKey(Action<string> callback)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _getPublicKeyCallbacks.Add(callback);
                    if (_getPublicKeyCallbacks.Count == 1)
                    {
                        JogosSDK_getPublicKey();
                    }
                },
                () =>
                {
                    
                }
            );
        }

        public void JSLibCallback_GetPublicKey(string responseStr)
        {
            var tempList = _getPublicKeyCallbacks.Select(c => c).ToList();
            _getPublicKeyCallbacks.Clear();
            tempList.ForEach(c => c(responseStr));
        }
        public void JSLibCallback_GetPublicKeyError(string msg)
        {
            var tempList = _getPublicKeyCallbacks.Select(c => c).ToList();
            _getPublicKeyCallbacks.Clear();
            tempList.ForEach(c => c(null));

            _JogosSDK.DebugLog("JSLibCallback_GetPublicKey error:" + msg);
        }
        #endregion

        

#if UNITY_WEBGL

        [DllImport("__Internal")]
        private static extern string JogosSDK_GetUser();

        [DllImport("__Internal")]
        private static extern string JogosSDK_GetUserToken();

        [DllImport("__Internal")]
        private static extern string JogosSDK_getPublicKey();

        

#else
        private string JogosSDK_GetUser() {return ""; }

        private string JogosSDK_GetUserToken() {return ""; }

        private string JogosSDK_getPublicKey() { return "";}


#endif

    }

    [Serializable]
    public class UserInfo
    {
        public string userId; 
        public string username;
        public string profilePictureUrl;
        public int gameId;

        public override string ToString()
        {
            return base.ToString() + "Username = " + username + ", profile picture url = " + profilePictureUrl;
        }
    }

    [Serializable]
    public class ShareInfo
    {
        public string userName;
        public string userRoleId;
        public string serverId;
        public string shareType;
        public string gameName;
        public string shareImage;
        public string dynamicContent;
        public string targetPlatform;

    }
}
