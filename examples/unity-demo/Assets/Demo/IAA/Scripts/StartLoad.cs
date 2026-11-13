using JogosGames.Engine.SDK;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace JogosDemo.IAA
{
    /// <summary>
    /// Loading scene entry.
    /// Flow: init -> load the first scene -> the gameplay scene reports loadingEnd.
    ///
    /// Notes (99% of IAA integrators only need this part):
    /// - init is a hard requirement and must complete first;
    /// - loadingStart is reported by the page boot script before Unity boots,
    ///   so the platform sees the wasm/data download and engine boot as loading time;
    /// - C# does not call loadingStart again; it only waits for init and loads the scene;
    /// - loadingEnd is called by the gameplay scene once it is playable.
    /// </summary>
    public class StartLoad : MonoBehaviour
    {
        [SerializeField] private string nextScene = "Game";

        private void Start()
        {
            Debug.Log("[JogosDemo] Init JogosSDK");

            // 1. Initialize the SDK (must complete first; calling other APIs before init throws 460).
            //    loadingStart was already reported by the page boot script.
            JogosSDK.Init(() =>
            {
                // 2. The gameplay scene reports loadingEnd once it is actually playable.
                SceneManager.LoadScene(nextScene);
            });
        }
    }
}
