using JogosGames.Engine.SDK;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace JogosDemo.IAA
{
    /// <summary>
    /// Loading scene entry.
    /// Flow: init -> loadingStart -> load the first scene -> scene ready -> loadingEnd.
    ///
    /// Notes (99% of IAA integrators only need this part):
    /// - init is a hard requirement and must complete first;
    /// - loadingStart / loadingEnd are recommended reports, not mandatory;
    /// - loadingEnd uses "scene is ready" as the signal, never first-frame rendering.
    /// </summary>
    public class StartLoad : MonoBehaviour
    {
        [SerializeField] private string nextScene = "Game";

        private void Start()
        {
            Debug.Log("[JogosDemo] Init JogosSDK");

            // 1. Initialize the SDK (must complete first; calling other APIs before init throws 460)
            JogosSDK.Init(() =>
            {
                // 2. Tell the platform loading started (it waits for init internally)
                JogosSDK.LoadingStart();
                Debug.Log("[JogosDemo] LoadingStart");

                if (string.IsNullOrEmpty(nextScene))
                {
                    JogosSDK.LoadingEnd();
                    return;
                }

                // 3. Report playable once the first scene has loaded
                SceneManager.sceneLoaded += OnFirstSceneLoaded;
                SceneManager.LoadScene(nextScene);
            });
        }

        private void OnFirstSceneLoaded(Scene scene, LoadSceneMode mode)
        {
            SceneManager.sceneLoaded -= OnFirstSceneLoaded;

            JogosSDK.LoadingEnd();
            Debug.Log("[JogosDemo] LoadingEnd");
        }
    }
}
