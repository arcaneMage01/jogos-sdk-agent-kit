using UnityEngine;

namespace JogosDemo.IAA
{
    /// <summary>
    /// 让 Label 做呼吸动画（缩放 + 透明度）。
    /// 用 unscaledTime，保证 SDK 因失焦把 timeScale 置 0 时动画仍然在动。
    /// </summary>
    [RequireComponent(typeof(CanvasGroup))]
    public class Breathing : MonoBehaviour
    {
        [SerializeField] private float scaleAmplitude = 0.05f;
        [SerializeField] private float speed = 2f;
        [SerializeField, Range(0f, 1f)] private float minAlpha = 0.55f;

        private Vector3 _baseScale;
        private CanvasGroup _group;

        private void Awake()
        {
            _baseScale = transform.localScale;
            _group = GetComponent<CanvasGroup>();
        }

        private void Update()
        {
            // 0..1 的正弦波
            float t = (Mathf.Sin(Time.unscaledTime * speed) + 1f) * 0.5f;

            transform.localScale = _baseScale * (1f + scaleAmplitude * (t * 2f - 1f));

            if (_group != null)
            {
                _group.alpha = Mathf.Lerp(minAlpha, 1f, t);
            }
        }
    }
}
