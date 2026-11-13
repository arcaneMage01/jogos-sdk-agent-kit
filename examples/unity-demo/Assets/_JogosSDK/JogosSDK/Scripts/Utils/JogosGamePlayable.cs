using UnityEngine;

namespace JogosGames.Engine.SDK
{
    /// <summary>
    /// Reports loadingEnd when this GameObject starts.
    /// Attach it to the first playable scene, or call JogosSDK.LoadingEnd() manually.
    /// </summary>
    public class JogosGamePlayable : MonoBehaviour
    {
        private void Start()
        {
            JogosSDK.LoadingEnd();
        }
    }
}
