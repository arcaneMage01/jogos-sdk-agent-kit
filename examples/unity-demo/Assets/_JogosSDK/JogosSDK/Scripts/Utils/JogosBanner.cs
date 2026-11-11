using System;
using System.Text;
using UnityEngine;
using UnityEngine.UI;
using Random = UnityEngine.Random;

namespace JogosGames.Engine.SDK
{
    public class JogosBanner : MonoBehaviour
    {
        public enum BannerSize
        {
            Leaderboard_728x90,
            Medium_300x250,
            Mobile_320x50,
            Main_Banner_468x60,
            Large_Mobile_320x100,
        }

        private Image backgroundImage;
        private Text info;

        [HideInInspector]
        public string id;

        [SerializeField]
        private BannerSize size;

        public BannerSize Size
        {
            get => size;
            set
            {
                if (size != value)
                {
                    size = value;
                    var banner = (RectTransform)transform.Find("Banner");
                    switch (value)
                    {
                        case BannerSize.Mobile_320x50:
                            banner.sizeDelta = new Vector2(320, 50);
                            break;
                        case BannerSize.Medium_300x250:
                            banner.sizeDelta = new Vector2(300, 250);
                            break;
                        case BannerSize.Leaderboard_728x90:
                            banner.sizeDelta = new Vector2(728, 90);
                            break;
                        case BannerSize.Main_Banner_468x60:
                            banner.sizeDelta = new Vector2(468, 60);
                            break;
                        case BannerSize.Large_Mobile_320x100:
                            banner.sizeDelta = new Vector2(320, 100);
                            break;
                        default:
                            throw new ArgumentOutOfRangeException(nameof(value), value, null);
                    }
                }
            }
        }

        public Vector2 Position
        {
            get
            {
                var banner = (RectTransform)transform.Find("Banner");
                return banner.anchoredPosition;
            }
            set
            {
                var banner = (RectTransform)transform.Find("Banner");
                banner.anchoredPosition = value;
            }
        }

        private void Awake()
        {
            backgroundImage = transform.GetComponentInChildren<Image>();
            if (Application.platform == RuntimePlatform.WebGLPlayer)
            {
                backgroundImage.color = new Color(0, 0, 0, 0);
            }
            info = transform.GetComponentInChildren<Text>();

#if !UNITY_EDITOR
            info.text = "";
            backgroundImage.gameObject.SetActive(false);
#endif

            RegenerateId();
            JogosSDK.Banner.RegisterBanner(this);
        }

        //private void Update()
        //{
        //    var (pos, size) = BannerLayout.GetScreenPos(backgroundImage.transform as RectTransform);
        //    StringBuilder sb = new StringBuilder();
        //    sb.AppendLine("pos:" + pos.ToString());
        //    sb.AppendLine("size:" + size.ToString());
        //    sb.AppendLine("anchorPos:" + Position.ToString());

        //    info.text = sb.ToString();
        //}

        private void OnDestroy()
        {
            if (!JogosSDK.IsShutDown)
            {
                JogosSDK.Banner.UnregisterBanner(this);
            }
        }

        public void SimulateRefresh()
        {
            backgroundImage.color = new Color(Random.Range(0f, 1f), Random.Range(0f, 1f), Random.Range(0f, 1f));
        }

        public void RegenerateId()
        {
            id = System.Guid.NewGuid().ToString();
        }

        public bool IsVisible() => gameObject.activeInHierarchy;
    }
}
