using JogosGames.Engine.SDK;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace JogosDemo.IAA
{
    /// <summary>
    /// Loading 场景入口。
    /// 主流程：init -> loadingStart -> 加载首个场景 -> 场景就绪 -> loadingEnd。
    ///
    /// 说明（IAA 接入方 99% 只需要这一段）：
    /// - init 是硬约束，必须最先完成；
    /// - loadingStart / loadingEnd 是推荐上报，不是强制项；
    /// - loadingEnd 用"场景已就绪"作为信号，不要用首帧渲染。
    /// </summary>
    public class StartLoad : MonoBehaviour
    {
        [SerializeField] private string nextScene = "Game";

        private void Start()
        {
            Debug.Log("[JogosDemo] Init JogosSDK");

            // 1. 初始化 SDK（必须最先完成，其它接口在 init 之前调用会报 460）
            JogosSDK.Init(() =>
            {
                // 2. 通知平台：开始加载（内部会等待 init 完成）
                JogosSDK.LoadingStart();
                Debug.Log("[JogosDemo] LoadingStart");

                if (string.IsNullOrEmpty(nextScene))
                {
                    JogosSDK.LoadingEnd();
                    return;
                }

                // 3. 首个场景加载完成后通知平台可以玩了
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
