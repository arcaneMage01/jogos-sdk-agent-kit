using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Scripting;

namespace JogosGames.Engine.SDK
{
    public class JogosSDK : MonoBehaviour
    {
        
        public static bool IsInitialized { get; private set; }
        public static bool IsShutDown { get; private set; }
        private static bool _initializationRequested;

        public JogosSettings Settings { get; private set; }
        public static JogosSDK SdkSingleton { get; private set; }
        public static UserModule User { get; private set; }
        public static GameModule Game { get; private set; }
        public static AdModule Ad { get; private set; }
        public static BannerModule Banner { get; private set; }
        public static DataModule Data { get; private set; }
        public static PaymentModule Goods { get; private set; }
        public static FriendModule Friend { get; private set; }

        public static SystemInfo SystemInfo { get; set; }

        private static bool _Debug;
        private static readonly List<Action> _InitCallbacks = new List<Action>();

        private static int _MouseOrTouch = -1;
        public static int MouseOrTouch { get { return _MouseOrTouch; } set { _MouseOrTouch = value; } }

        public static bool IsRunInMobile
        {
            get
            {
                if (MouseOrTouch < 0)
                {
                    if (SystemInfo != null)
                        return SystemInfo.deviceType != "pc";
                    //for ipad
                    if (UnityEngine.SystemInfo.deviceModel.Contains("Safari"))
                        return true;
                    return Application.isMobilePlatform;
                }
                else
                {
                    return MouseOrTouch == 1;
                }
            }
        }

        /// <summary>
        /// 初始化SDK
        /// </summary>
        /// <param name="callback"></param>
        /// <exception cref="Exception"></exception>
        public static void Init(Action callback)
        {
#if !UNITY_EDITOR && !UNITY_WEBGL
                return;
#endif

            if (IsInitialized)
            {
                callback?.Invoke();
                return;
            }

            InputCheck.InitCheck((type) => MouseOrTouch = type);
            EnsureSingletonExists();
            Application.runInBackground = true;

            if (Application.isEditor)
            {
                if (!IsInitialized)
                {
                    IsInitialized = true;
                    _Debug = true;
                }

                SystemInfo = new SystemInfo();
                callback?.Invoke();
            }
            else if (Application.platform == RuntimePlatform.WebGLPlayer)
            {
                if (_initializationRequested)
                {
                    _InitCallbacks.Add(callback);
                }
                else
                {
                    _InitCallbacks.Add(callback);
                    _initializationRequested = true;
                    _Debug = Debug.isDebugBuild;
                    JogosSDK_Init();
                }
            }
        }

        private static void EnsureSingletonExists()
        {
            if (SdkSingleton != null)
            {
                return;
            }

            var singletonObject = new GameObject();
            SdkSingleton = singletonObject.AddComponent<JogosSDK>();
            User = singletonObject.AddComponent<UserModule>();
            User.Init(SdkSingleton);
            Game = singletonObject.AddComponent<GameModule>();
            Game.Init(SdkSingleton);
            Ad = singletonObject.AddComponent<AdModule>();
            Ad.Init(SdkSingleton);
            Banner = singletonObject.AddComponent<BannerModule>();
            Banner.Init(SdkSingleton);
            Data = singletonObject.AddComponent<DataModule>();
            Data.Init(SdkSingleton);
            Goods = singletonObject.AddComponent<PaymentModule>();
            Goods.Init(SdkSingleton);
            Friend = singletonObject.AddComponent<FriendModule>();
            Friend.Init(SdkSingleton);

            SdkSingleton.Settings = Resources.Load<JogosSettings>("JogosGamesSettings");
            if (SdkSingleton.Settings == null)
            {
                Debug.LogError("Failed to load JogosSDK/Resources/JogosGamesSettings");
            }

            DontDestroyOnLoad(singletonObject);
            singletonObject.name = "JogosSDKSingleton";
        }

        public void DebugLog(string msg)
        {
            if (Application.isEditor && SdkSingleton.Settings.disableSdkLogs)
            {
                return;
            }

            if (_Debug)
                Debug.Log("[JogosSDK] " + msg);
        }

        public T WrapSDKFunc<T>(Func<T> liveFunc, Func<T> editorFunc)
        {
            if (!IsInitialized)
            {
                throw new Exception("JogosSDK not initialized. Please call JogosSDK.Instance.Init() before using the SDK.");
            }

            if (Application.platform == RuntimePlatform.WebGLPlayer)
            {
                return liveFunc();
            }

            if (Application.isEditor)
            {
                return editorFunc();
            }

            throw new Exception($"JogosSDK unsupported platform {Application.platform}");
        }

        public void WrapSDKAction(Action liveAction, Action editorAction)
        {
            if (!IsInitialized)
            {
                throw new Exception("JogosSDK not initialized. Please call JogosSDK.Instance.Init() before using the SDK.");
            }

            if (Application.platform == RuntimePlatform.WebGLPlayer)
            {
                try
                {
                    liveAction();
                }
                catch (Exception e)
                {
                    throw e;
                }
            }
            else if (Application.isEditor)
            {
                editorAction();
            }
            else
            {
                throw new Exception($"JogosSDK unsupported platform {Application.platform}");
            }
        }

        //public void CopyToClipboard(string text)
        //{
        //    WrapSDKAction(
        //        () => CopyToClipboardSDK(text),
        //        () =>
        //        {
        //            GUIUtility.systemCopyBuffer = text;
        //        }
        //    );
        //}

        private void OnDestroy()
        {
            IsShutDown = true;

            //JogosSDK_load();
            //JogosSDK_wait("", null);
        }

        #region 接收SDK回调

        public void JSLibCallback_Init(string sysStr)
        {
            SystemInfo = JsonUtility.FromJson<SystemInfo>(sysStr);

            IsInitialized = true;
            _InitCallbacks.ForEach(a => a?.Invoke());
            _InitCallbacks.Clear();
            DebugLog("JSLibCallback_Init finish:" + sysStr);
            DebugLog("JSLibCallback_Init gameId:" + SystemInfo.gameId);
        }

        public void JSLibCallback_InitError(string msg)
        {
            DebugLog("JSLibCallback_InitError:" + msg);
        }

        #endregion

#if UNITY_WEBGL
        [DllImport("__Internal")]
        private static extern void JogosSDK_Init();

        [DllImport("__Internal")]
        [Preserve]
        public static extern void JogosSDK_load();

        [DllImport("__Internal")]
        [Preserve]
        public static extern void JogosSDK_wait(string cbName, object param);

#else
        // Preventing build to fail when using another platform than WebGL
        private static void JogosSDK_Init() { }

        private static void JogosSDK_load()
        {
            
        }

        private static void JogosSDK_wait(string cbName, object param)
        {
            
        }
#endif

        #region lost focus

        private GameObject lostFocusWin;
        private float focusTimeScale;
        private float focusAudioVolume;

        private bool _PauseFlag = false;
        public void Pause()
        {
            if (_PauseFlag == true)
                return;

            _PauseFlag = true;
            SetGamePause(true);
        }

        public void Resume()
        {
            _PauseFlag = false;

            SetGamePause(false);
        }

        private void SetGamePause(bool isPause)
        {
            if (lostFocusWin == null)
            {
                var orgGO = Resources.Load<GameObject>("LostFocusWin");
                lostFocusWin = GameObject.Instantiate(orgGO);
            }

            if (!isPause)
            {
                if (focusTimeScale > 0)
                {
                    Time.timeScale = focusTimeScale;
                }
                if (focusAudioVolume > 0)
                {
                    AudioListener.volume = focusAudioVolume;
                }
                if (Game != null && IsInitialized)
                    Game.GameplayContinue();

                Banner.RefreshBanners(true);
            }
            else
            {
                if (Time.timeScale > 0)
                {
                    focusTimeScale = Time.timeScale;
                    Time.timeScale = 0;
                }

                if (AudioListener.volume > 0)
                {
                    focusAudioVolume = AudioListener.volume;
                    AudioListener.volume = 0;
                }
                
                if (Game != null && IsInitialized)
                    Game.GameplayPause();
            }
            lostFocusWin.SetActive(isPause);
        }

        public void OnApplicationFocus(bool focus)
        {
            if (!Settings.pauseGameLostFocus)
                return;

            if (focus)
            {
                Resume();
            }
            else
            {
                Pause();
            }
        }



        #endregion

        #region tips win

        private JogosTipsWin tipsWin;

        public void ShowTips(string tips)
        {
            if (!Settings.showErrorTips)
                return;

            if (tipsWin == null)
            {
                var orgGO = Resources.Load<GameObject>("JogosTipsWin");
                tipsWin = GameObject.Instantiate(orgGO).GetComponent<JogosTipsWin>();
            }

            tipsWin.ShowTips(tips);
        }

        public void ClearTips()
        {
            if (tipsWin != null)
            {
                tipsWin.gameObject.SetActive(false);
            }
        }

        

    #endregion
}

    [Serializable]
    public class SystemInfo
    {

        public int gameId;

        public string deviceType;// 'pc' | 'tablet' | 'mobile';

        public string language;

        public string os;

        public string browser;

        public string hasGameGroup;

        public string serverTime;

        public string bannerIntervalTime;

        public string midgameIntervalTime;

        public string inviteArgs;

        public string gamePrice;
    }
}
