using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using UnityEngine;

namespace JogosGames.Engine.SDK
{
    public class FriendModule : MonoBehaviour
    {
        private JogosSDK _JogosSDK;


        public void Init(JogosSDK JogosSDK)
        {
            _JogosSDK = JogosSDK;
        }


        private readonly List<Action<string>> _checkIsMyFriendsCallbacks = new List<Action<string>>();
        private readonly List<Action<string>> _checkIsMyFriendsErrorCallbacks = new List<Action<string>>();

        private readonly List<Action<string>> _sendFriendRequestCallbacks = new List<Action<string>>();
        private readonly List<Action<string>> _sendFriendRequestErrorCallbacks = new List<Action<string>>();

        private readonly List<Action<string>> _openChatDialogCallbacks = new List<Action<string>>();
        private readonly List<Action<string>> _openChatDialogErrorCallbacks = new List<Action<string>>();

        private readonly List<Action<string>> _openInviteCallbacks = new List<Action<string>>();
        private readonly List<Action<string>> _openInviteErrorCallbacks = new List<Action<string>>();


        public void CheckIsMyFriends(int[] userIds, Action<string> action, Action<string> errorCallback = null)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _checkIsMyFriendsCallbacks.Add(action);
                    if (errorCallback != null)
                        _checkIsMyFriendsErrorCallbacks.Add(errorCallback);
                    string json = "[" + string.Join(",", userIds) + "]";
                    JogosSDK_IsMyFriends(json);
                },
                () =>
                {

                }
            );
        }

        public void JSLibCallback_IsMyFriends(string json)
        {
            var tempList = _checkIsMyFriendsCallbacks.Select(c => c).ToList();
            _checkIsMyFriendsCallbacks.Clear();
            tempList.ForEach(c => c(json));
            _JogosSDK.DebugLog("JSLibCallback_IsMyFriends sucess:"+ json);
        }

        public void JSLibCallback_IsMyFriendsError(string msg)
        {
            var tempList = _checkIsMyFriendsErrorCallbacks.Select(c => c).ToList();
            _checkIsMyFriendsErrorCallbacks.Clear();
            tempList.ForEach(c => c(msg));
            _JogosSDK.DebugLog("JSLibCallback_IsMyFriendsError:" + msg);
        }


        public void SendFirendRequset(int userId, Action<string> action, Action<string> errorCallback = null)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _sendFriendRequestCallbacks.Add(action);
                    if (errorCallback != null)
                        _sendFriendRequestErrorCallbacks.Add(errorCallback);
                    JogosSDK_SendFriendRequest(userId);
                },
                () =>
                {

                }
            );
        }


        public void JSLibCallback_SendFriendRequest(string json)
        {
            var tempList = _sendFriendRequestCallbacks.Select(c => c).ToList();
            _sendFriendRequestCallbacks.Clear();
            tempList.ForEach(c => c(json));
            _JogosSDK.DebugLog("JSLibCallback_SendFriendRequest sucess:"+ json);
        }

        public void JSLibCallback_SendFriendRequestError(string msg)
        {
            var tempList = _sendFriendRequestErrorCallbacks.Select(c => c).ToList();
            _sendFriendRequestErrorCallbacks.Clear();
            tempList.ForEach(c => c(msg));
            _JogosSDK.DebugLog("_sendFriendRequestErrorCallbacks:" + msg);
        }


        public void OpenChatDialog(int userId, Action<string> action, Action<string> errorCallback)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _openChatDialogCallbacks.Add(action);
                    if (_openChatDialogErrorCallbacks != null)
                        _openChatDialogErrorCallbacks.Add(errorCallback);
                    JogosSDK_OpenChatDialog(userId);
                },
                () =>
                {

                }
            );
        }

        public void JSLibCallback_OpenChatDialog(string json)
        {
            var tempList = _openChatDialogCallbacks.Select(c => c).ToList();
            _openChatDialogCallbacks.Clear();
            tempList.ForEach(c => c(json));
            _JogosSDK.DebugLog("JSLibCallback_OpenChatDialog sucess:"+ json);
        }

        public void JSLibCallback_OpenChatDialogError(string msg)
        {
            var tempList = _openChatDialogErrorCallbacks.Select(c => c).ToList();
            _openChatDialogErrorCallbacks.Clear();
            tempList.ForEach(c => c(msg));
            _JogosSDK.DebugLog("JSLibCallback_OpenChatDialogError:" + msg);
        }


        public void OpenInviteDialog(string inviteArgs, Action<string> action, Action<string> errorCallback = null)
        {
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    _openInviteCallbacks.Add(action);
                    if (_openInviteErrorCallbacks != null)
                        _openInviteErrorCallbacks.Add(errorCallback);
                    JogosSDK_OpenInviteDialog(inviteArgs);
                },
                () =>
                {

                }
            );
        }

        public void JSLibCallback_OpenInviteDialog(string json)
        {
            var tempList = _openInviteCallbacks.Select(c => c).ToList();
            _openInviteCallbacks.Clear();
            tempList.ForEach(c => c(json));
            _JogosSDK.DebugLog("JSLibCallback_OpenInviteDialog sucess:"+ json);
        }

        public void JSLibCallback_OpenInviteDialogError(string msg)
        {
            var tempList = _openInviteErrorCallbacks.Select(c => c).ToList();
            _openInviteErrorCallbacks.Clear();
            tempList.ForEach(c => c(msg));
            _JogosSDK.DebugLog("JSLibCallback_OpenInviteDialogError:" + msg);
        }


#if UNITY_WEBGL
        [DllImport("__Internal")]
        private static extern void JogosSDK_IsMyFriends(string userIds);

        [DllImport("__Internal")]
        private static extern void JogosSDK_SendFriendRequest(int userId);

        [DllImport("__Internal")]
        private static extern void JogosSDK_OpenChatDialog(int userId);

        [DllImport("__Internal")]
        private static extern void JogosSDK_OpenInviteDialog(string inviteArgs);
#else
        private void JogosSDK_IsMyFriends(string userIds) { }

        private void JogosSDK_SendFriendRequest(int userId) { }

        private void JogosSDK_OpenChatDialog(int userId) { }

        private void JogosSDK_OpenInviteDialog(string inviteArgs) { }
       
#endif
    }
}
