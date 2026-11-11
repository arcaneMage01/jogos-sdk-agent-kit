using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using UnityEngine;

namespace JogosGames.Engine.SDK
{
    public class BannerModule : MonoBehaviour
    {
        private JogosSDK _JogosSDK;
        private readonly List<JogosBanner> _banners = new List<JogosBanner>();

        public List<JogosBanner> Banners => _banners;

        public void Init(JogosSDK JogosSDK)
        {
            _JogosSDK = JogosSDK;
        }

        public void RefreshBanners(bool update = false)
        {
            var visibleBanners = _banners.Where(b => b.IsVisible()).ToList();
            _JogosSDK.DebugLog($"Refreshing {visibleBanners.Count} banners");
            _JogosSDK.WrapSDKAction(
                () =>
                {
                    var bannerToRefresh = visibleBanners
                        .Select(
                            (JogosBanner) =>
                            {
                                Vector2Int size;
                                switch (JogosBanner.Size)
                                {
                                    case JogosBanner.BannerSize.Leaderboard_728x90:
                                        size = new Vector2Int(728, 90);
                                        break;
                                    case JogosBanner.BannerSize.Medium_300x250:
                                        size = new Vector2Int(300, 250);
                                        break;
                                    case JogosBanner.BannerSize.Mobile_320x50:
                                        size = new Vector2Int(320, 50);
                                        break;
                                    case JogosBanner.BannerSize.Large_Mobile_320x100:
                                        size = new Vector2Int(320, 100);
                                        break;
                                    case JogosBanner.BannerSize.Main_Banner_468x60:
                                        size = new Vector2Int(468, 60);
                                        break;
                                    default:
                                        throw new ArgumentOutOfRangeException();
                                }

                                var bannerTransform = (RectTransform)JogosBanner.transform.Find("Banner");
                                var anchor = new Vector2(
                                    (bannerTransform.anchorMin.x + bannerTransform.anchorMax.x) / 2,
                                    (bannerTransform.anchorMin.y + bannerTransform.anchorMax.y) / 2
                                );
                                return (JogosBanner.id, new BannerLayout(bannerTransform, update));
                            }
                        )
                        .ToArray();

                    foreach (var banner in bannerToRefresh)
                    {

                        string layoutJson = JsonUtility.ToJson(banner.Item2);
                        Debug.Log(banner.id + ":" +  layoutJson);
                        JogosSDK_RequestBanner(banner.id, layoutJson);
                    }
                },
                () =>
                {
                    visibleBanners.ForEach(b => b.SimulateRefresh());
                }
            );
        }

        public void RegisterBanner(JogosBanner banner)
        {
            if (!_banners.Contains(banner))
                _banners.Add(banner);
        }

        public void UnregisterBanner(JogosBanner banner)
        {
            _banners.Remove(banner);

            _JogosSDK.WrapSDKAction(
                () =>
                {
                    JogosSDK_ClearBanner(banner.id);
                },
                () =>
                { }
                );
            
        }

        public void HideAll()
        {
            foreach (var banner in _banners)
            {
                banner.gameObject.SetActive(false);
            }

            _JogosSDK.WrapSDKAction(
                () =>
                {
                    JogosSDK_ClearAllBanners();
                },
                () =>
                { }
                );
            
        }

        public void ShowAll()
        {
            foreach (var banner in _banners)
            {
                banner.gameObject.SetActive(true);
            }
            RefreshBanners();
        }

        #region callback

        public void JSLibCallback_RequestBanner()
        {
            _JogosSDK.DebugLog("JSLibCallback_RequestBanner:");
        }

        public void JSLibCallback_RequestBannerError(string msg)
        {
            _JogosSDK.DebugLog("JSLibCallback_RequestBannerError:" + msg);
        }

        public void JSLibCallback_ClearBanner()
        {
            _JogosSDK.DebugLog("JSLibCallback_ClearBanner:");
        }

        public void JSLibCallback_ClearBannerError(string msg)
        {
            _JogosSDK.DebugLog("JSLibCallback_ClearBannerError:" + msg);
        }

        public void JSLibCallback_ClearAllBanners()
        {
            _JogosSDK.DebugLog("JSLibCallback_ClearAllBanners:");
        }

        public void JSLibCallback_ClearAllBannersError(string msg)
        {
            _JogosSDK.DebugLog("JSLibCallback_ClearAllBannersError:" + msg);
        }

        public void JSLibCallback_WindowResize()
        {
            _JogosSDK.DebugLog("JSLibCallback_WindowResize:");
            RefreshBanners(true);
        }

        #endregion

#if UNITY_WEBGL

        [DllImport("__Internal")]
        private static extern void JogosSDK_RequestBanner(string id, string layout);

        [DllImport("__Internal")]
        private static extern void JogosSDK_ClearBanner(string id);

        [DllImport("__Internal")]
        private static extern void JogosSDK_ClearAllBanners();

#else
        
        private static void JogosSDK_RequestBanner(string id, string layout) { }

        private static void JogosSDK_ClearBanner(string id) {  }

        private static void JogosSDK_ClearAllBanners() { }
#endif


    }

    [Serializable]
    public class Anchor
    {
        public Vector2 min;
        public Vector2 max;
    }

    [Serializable]
    public class BannerLayout
    {
        public float x;
        public float y;
        public float width;
        public float height;
        public bool update;

        public BannerLayout(RectTransform rect, bool isUpdate)
        {
            var (pos, size) = GetScreenPos(rect);
            this.x = pos.x;
            this.y = pos.y;
            width = size.x;
            height = size.y;
            update = isUpdate;
        }

        public static (Vector2, Vector2) GetScreenPos(RectTransform _rt)
        {
            var _canvas = _rt.GetComponentInParent<Canvas>();
            {
                Vector3[] corners = new Vector3[4];
                _rt.GetWorldCorners(corners);

                // 坐标转换
                for (int i = 0; i < 4; i++)
                {
                    corners[i] = RectTransformUtility.WorldToScreenPoint(
                        _canvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : _canvas.worldCamera,
                        corners[i]
                    );
                }

                // 计算位置和尺寸
                Vector2 screenCenter = new Vector2(corners[1].x, Screen.height - corners[1].y);
                Vector2 screenSize = new Vector2(
                    Mathf.Abs(corners[3].x - corners[0].x),
                    Mathf.Abs(corners[1].y - corners[0].y)
                );

                return (screenCenter, screenSize);
            }
        }
    }
}
