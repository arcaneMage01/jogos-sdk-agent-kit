using System.Collections.Generic;
using JogosGames.Engine.SDK;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Events;
using UnityEngine.UI;

namespace JogosDemo.IAA
{
    /// <summary>
    /// IAA main example: a playable coin collection mini-game.
    ///
    /// The scene only contains a Camera + this script; all UI is created at runtime,
    /// so the SDK integration points are immediately visible without digging through prefabs.
    ///
    /// It covers the whole main flow:
    ///   rewarded video (top-right Watch Ad / revive), interstitial (round end), banner,
    ///   leaderboard and PlayerPrefs cloud save.
    /// </summary>
    public class CoinRushGame : MonoBehaviour
    {
        private const float RoundSeconds = 30f;
        private const float ReviveSeconds = 15f;
        private const float RespawnDelay = 2f;
        private const int CoinValue = 10;
        private const int AdRewardCoins = 100;
        private const int CellCount = 9;
        private const string CoinsKey = "coins";

        [SerializeField] private string rankingName = "HighScore";

        private class Coin
        {
            public int Cell;
            public bool Active;
            public float NextShowAt;
            public RectTransform Rect;
        }

        private readonly List<Coin> _coins = new List<Coin>();
        private readonly bool[] _cellTaken = new bool[CellCount];

        private RectTransform _playArea;
        private Text _coinsText;
        private Text _timeText;
        private Text _finalText;
        private GameObject _overlay;
        private Button _adButton;
        private Button _reviveButton;

        private Font _font;
        private Sprite _circleSprite;
        private Sprite _roundSprite;

        private int _coinsBalance;
        private int _roundScore;
        private float _timeLeft;
        private bool _running;

        private void Start()
        {
            BuildUI();

            // Let the stretch-anchored PlayArea resolve its real size now,
            // otherwise every coin would stack in the center on the first frame
            Canvas.ForceUpdateCanvases();

            LoadCoins();
            ShowBanner();
            StartRound();

            // The page-side boot script already reported loadingStart before Unity booted.
            // The game is playable now, so reporting loadingEnd here is enough.
            JogosSDK.LoadingEnd();
            Debug.Log("[JogosDemo] LoadingEnd (game is playable)");
        }

        private void Update()
        {
            if (!_running)
            {
                return;
            }

            // During ads / focus loss the SDK sets Time.timeScale to 0;
            // using deltaTime here freezes the timer automatically
            _timeLeft -= Time.deltaTime;
            _timeText.text = Mathf.CeilToInt(Mathf.Max(0f, _timeLeft)) + "s";

            for (int i = 0; i < _coins.Count; i++)
            {
                var coin = _coins[i];
                if (!coin.Active && Time.time >= coin.NextShowAt)
                {
                    ReviveCoin(coin);
                }
            }

            if (_timeLeft <= 0f)
            {
                EndRound();
            }
        }

        // ------------------------------------------------------------ game logic

        private void StartRound()
        {
            _roundScore = 0;
            _timeLeft = RoundSeconds;
            _running = true;

            _overlay.SetActive(false);
            _reviveButton.gameObject.SetActive(true);
            _timeText.text = Mathf.CeilToInt(RoundSeconds) + "s";
            _finalText.text = "0";

            for (int i = 0; i < _cellTaken.Length; i++)
            {
                _cellTaken[i] = false;
            }

            for (int i = 0; i < _coins.Count; i++)
            {
                ReviveCoin(_coins[i]);
            }
        }

        private void EndRound()
        {
            if (!_running)
            {
                return;
            }

            _running = false;
            _timeLeft = 0f;
            _timeText.text = "0s";

            for (int i = 0; i < _coins.Count; i++)
            {
                HideCoin(_coins[i]);
            }

            // Ranking: leaderboard name and data type must match the developer console
            JogosSDK.Game.CommitRankingData(rankingName, "{\"number\":" + _roundScore + "}", null);

            // Interstitial only on level end / death / load, never on clicks or during combat
            JogosSDK.Ad.RequestAd(JogosAdType.Midgame, null, null, null);

            _finalText.text = _roundScore.ToString();
            _overlay.SetActive(true);
        }

        private void OnCoinClicked(Coin coin)
        {
            if (!_running || !coin.Active)
            {
                return;
            }

            HideCoin(coin);
            coin.NextShowAt = Time.time + RespawnDelay;

            _roundScore += CoinValue;
            AddCoins(CoinValue);
        }

        private void HideCoin(Coin coin)
        {
            coin.Active = false;
            _cellTaken[coin.Cell] = false;
            coin.Rect.gameObject.SetActive(false);
        }

        private void ReviveCoin(Coin coin)
        {
            int cell = PickFreeCell();
            coin.Cell = cell;
            coin.Active = true;
            _cellTaken[cell] = true;

            var area = _playArea.rect;
            float cellW = area.width / 3f;
            float cellH = area.height / 3f;
            int col = cell % 3;
            int row = cell / 3;

            float x = -area.width * 0.5f + cellW * (col + 0.5f);
            float y = area.height * 0.5f - cellH * (row + 0.5f);

            coin.Rect.anchoredPosition = new Vector2(
                x + Random.Range(-cellW * 0.08f, cellW * 0.08f),
                y + Random.Range(-cellH * 0.08f, cellH * 0.08f));
            coin.Rect.gameObject.SetActive(true);
        }

        private int PickFreeCell()
        {
            var free = new List<int>();
            for (int i = 0; i < _cellTaken.Length; i++)
            {
                if (!_cellTaken[i])
                {
                    free.Add(i);
                }
            }

            return free.Count == 0 ? Random.Range(0, CellCount) : free[Random.Range(0, free.Count)];
        }

        // ------------------------------------------------------------ SDK integration

        /// <summary>Always visible top-right: watch one rewarded ad and earn coins.</summary>
        private void OnWatchAdClicked()
        {
            if (JogosSDK.Ad.AdRequestInProgress)
            {
                return;
            }

            _adButton.interactable = false;

            JogosSDK.Ad.RequestAd(
                JogosAdType.Rewarded,
                null,
                error =>
                {
                    // No fill / blocked: do not grant
                    Debug.LogWarning("[JogosDemo] rewarded failed: " + error);
                    _adButton.interactable = true;
                },
                () =>
                {
                    // Grant only when the ad actually finished
                    _adButton.interactable = true;
                    AddCoins(AdRewardCoins);
                });
        }

        /// <summary>Round-over panel: watch an ad to revive for 15 seconds.</summary>
        private void OnReviveClicked()
        {
            if (JogosSDK.Ad.AdRequestInProgress)
            {
                return;
            }

            _reviveButton.interactable = false;

            JogosSDK.Ad.RequestAd(
                JogosAdType.Rewarded,
                null,
                error =>
                {
                    Debug.LogWarning("[JogosDemo] revive failed: " + error);
                    _reviveButton.interactable = true;
                    _reviveButton.gameObject.SetActive(false);
                },
                () =>
                {
                    _reviveButton.interactable = true;
                    _reviveButton.gameObject.SetActive(true);

                    _running = true;
                    _timeLeft = ReviveSeconds;
                    _overlay.SetActive(false);

                    for (int i = 0; i < _coins.Count; i++)
                    {
                        if (!_coins[i].Active)
                        {
                            ReviveCoin(_coins[i]);
                        }
                    }
                });
        }

        private void AddCoins(int amount)
        {
            _coinsBalance += amount;
            _coinsText.text = "COINS " + _coinsBalance;

            // Cloud save: Unity uses IndexedDB and only the PlayerPrefs key is synced automatically
            PlayerPrefs.SetInt(CoinsKey, _coinsBalance);
            PlayerPrefs.Save();
        }

        private void LoadCoins()
        {
            // Saves may only be read after init succeeded
            _coinsBalance = PlayerPrefs.GetInt(CoinsKey, 0);
            _coinsText.text = "COINS " + _coinsBalance;
        }

        private void ShowBanner()
        {
            // Do not use the H5 banner.requestBanner in Unity; use the platform component
            var prefab = Resources.Load<GameObject>("JogosBanner");
            if (prefab == null)
            {
                Debug.LogWarning("[JogosDemo] JogosBanner.prefab not found");
                return;
            }

            var bannerGo = Instantiate(prefab, _playArea.parent, false);
            var banner = bannerGo.GetComponent<JogosBanner>();
            if (banner != null)
            {
                banner.Size = JogosBanner.BannerSize.Mobile_320x50;
            }

            var rect = (RectTransform)bannerGo.transform;
            rect.anchorMin = new Vector2(0.5f, 0f);
            rect.anchorMax = new Vector2(0.5f, 0f);
            rect.pivot = new Vector2(0.5f, 0f);
            rect.anchoredPosition = new Vector2(0f, 20f);
        }

        // ------------------------------------------------------------ UI

        private void BuildUI()
        {
            _font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            if (_font == null)
            {
                _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            }

            _circleSprite = CreateCircleSprite(128, 0.86f, 0.68f);
            _roundSprite = CreateRoundedSprite(64, 16);

            var canvasGo = new GameObject("Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasGo.transform.SetParent(transform, false);

            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280f, 720f);
            scaler.matchWidthOrHeight = 0.5f;

            if (FindObjectOfType<EventSystem>() == null)
            {
                new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            }

            var background = CreateImage("Background", canvasGo.transform, null, new Color(0.043f, 0.067f, 0.125f, 1f));
            Stretch(background.rectTransform);

            _coinsText = CreateText("CoinsLabel", canvasGo.transform, "COINS 0", 30, TextAnchor.MiddleLeft, Color.white);
            Place(_coinsText.rectTransform, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(28f, -24f), new Vector2(400f, 56f));

            _timeText = CreateText("TimeLabel", canvasGo.transform, Mathf.CeilToInt(RoundSeconds) + "s", 32, TextAnchor.MiddleCenter, new Color(0.81f, 0.88f, 1f));
            Place(_timeText.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -24f), new Vector2(200f, 56f));

            _adButton = CreateButton("WatchAdButton", canvasGo.transform, "Watch Ad +" + AdRewardCoins,
                new Color(1f, 0.67f, 0.24f), new Vector2(250f, 68f), OnWatchAdClicked);
            Place((RectTransform)_adButton.transform, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-24f, -16f), new Vector2(250f, 68f));

            var playArea = CreateRect("PlayArea", canvasGo.transform);
            playArea.anchorMin = Vector2.zero;
            playArea.anchorMax = Vector2.one;
            playArea.offsetMin = new Vector2(40f, 110f);
            playArea.offsetMax = new Vector2(-40f, -110f);
            _playArea = playArea;

            for (int i = 0; i < CellCount; i++)
            {
                var coin = new Coin();
                var rt = CreateRect("Coin" + i, playArea);
                rt.sizeDelta = new Vector2(96f, 96f);

                var image = rt.gameObject.AddComponent<Image>();
                image.sprite = _circleSprite;
                image.color = new Color(1f, 0.79f, 0.24f);
                image.preserveAspect = true;

                var button = rt.gameObject.AddComponent<Button>();
                button.targetGraphic = image;
                button.onClick.AddListener(MakeCoinHandler(coin));

                coin.Rect = rt;
                coin.Active = false;
                _coins.Add(coin);
            }

            BuildOverlay(canvasGo.transform);
        }

        private void BuildOverlay(Transform parent)
        {
            var overlay = CreateRect("RoundOver", parent);
            Stretch(overlay);

            var dim = overlay.gameObject.AddComponent<Image>();
            dim.color = new Color(0f, 0f, 0f, 0.72f);

            var card = CreateImage("Card", overlay, _roundSprite, new Color(0.055f, 0.078f, 0.145f, 0.98f));
            card.type = Image.Type.Sliced;
            Place(card.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(460f, 340f));

            var title = CreateText("Title", card.transform, "Round Over", 40, TextAnchor.MiddleCenter, Color.white);
            Place(title.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, 108f), new Vector2(400f, 60f));

            var hint = CreateText("Hint", card.transform, "Coins this round", 22, TextAnchor.MiddleCenter, new Color(0.56f, 0.66f, 0.85f));
            Place(hint.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, 48f), new Vector2(400f, 36f));

            _finalText = CreateText("Final", card.transform, "0", 34, TextAnchor.MiddleCenter, Color.white);
            Place(_finalText.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, 10f), new Vector2(400f, 48f));

            _reviveButton = CreateButton("ReviveButton", card.transform, "Watch Ad +15s",
                new Color(1f, 0.67f, 0.24f), new Vector2(320f, 68f), OnReviveClicked);
            Place((RectTransform)_reviveButton.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, -72f), new Vector2(320f, 68f));

            var againButton = CreateButton("AgainButton", card.transform, "Play Again",
                new Color(0.25f, 0.49f, 1f), new Vector2(320f, 68f), StartRound);
            Place((RectTransform)againButton.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, -152f), new Vector2(320f, 68f));

            overlay.gameObject.SetActive(false);
            _overlay = overlay.gameObject;
        }

        private UnityAction MakeCoinHandler(Coin coin)
        {
            return () => OnCoinClicked(coin);
        }

        private static RectTransform CreateRect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        private static Image CreateImage(string name, Transform parent, Sprite sprite, Color color)
        {
            var rt = CreateRect(name, parent);
            var image = rt.gameObject.AddComponent<Image>();
            image.sprite = sprite;
            image.color = color;
            image.raycastTarget = false;
            return image;
        }

        private Text CreateText(string name, Transform parent, string value, int size, TextAnchor anchor, Color color)
        {
            var rt = CreateRect(name, parent);
            var text = rt.gameObject.AddComponent<Text>();
            text.font = _font;
            text.text = value;
            text.fontSize = size;
            text.alignment = anchor;
            text.color = color;
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.raycastTarget = false;
            return text;
        }

        private Button CreateButton(string name, Transform parent, string label, Color color, Vector2 size, UnityAction onClick)
        {
            var rt = CreateRect(name, parent);
            rt.sizeDelta = size;

            var image = rt.gameObject.AddComponent<Image>();
            image.sprite = _roundSprite;
            image.type = Image.Type.Sliced;
            image.color = color;

            var button = rt.gameObject.AddComponent<Button>();
            button.targetGraphic = image;
            button.onClick.AddListener(onClick);

            var text = CreateText("Label", rt, label, 26, TextAnchor.MiddleCenter, Color.white);
            Stretch(text.rectTransform);

            return button;
        }

        private static void Place(RectTransform rt, Vector2 anchor, Vector2 pivot, Vector2 position, Vector2 size)
        {
            rt.anchorMin = anchor;
            rt.anchorMax = anchor;
            rt.pivot = pivot;
            rt.anchoredPosition = position;
            rt.sizeDelta = size;
        }

        private static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
        }

        // ------------------------------------------------------------ textures (no extra art assets)

        private static Sprite CreateCircleSprite(int size, float rimStart, float rimDarkness)
        {
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
            texture.wrapMode = TextureWrapMode.Clamp;
            var pixels = new Color32[size * size];
            float radius = size * 0.5f;

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dx = x + 0.5f - radius;
                    float dy = y + 0.5f - radius;
                    float distance = Mathf.Sqrt(dx * dx + dy * dy);
                    float alpha = Mathf.Clamp01(radius - distance);

                    float value = distance > radius * rimStart ? rimDarkness : 1f;
                    byte gray = (byte)(value * 255f);
                    pixels[y * size + x] = new Color32(gray, gray, gray, (byte)(alpha * 255f));
                }
            }

            texture.SetPixels32(pixels);
            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect);
        }

        private static Sprite CreateRoundedSprite(int size, int radius)
        {
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
            texture.wrapMode = TextureWrapMode.Clamp;
            var pixels = new Color32[size * size];
            float half = size * 0.5f;

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dx = Mathf.Max(0f, Mathf.Abs(x + 0.5f - half) - (half - radius));
                    float dy = Mathf.Max(0f, Mathf.Abs(y + 0.5f - half) - (half - radius));
                    float distance = Mathf.Sqrt(dx * dx + dy * dy);
                    float alpha = Mathf.Clamp01(radius - distance);

                    pixels[y * size + x] = new Color32(255, 255, 255, (byte)(alpha * 255f));
                }
            }

            texture.SetPixels32(pixels);
            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f, 0,
                SpriteMeshType.FullRect, new Vector4(radius, radius, radius, radius));
        }
    }
}
