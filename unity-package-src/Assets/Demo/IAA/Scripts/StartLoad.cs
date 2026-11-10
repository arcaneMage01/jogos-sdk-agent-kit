using JogosGames.Engine.SDK;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace JogosDemo.IAA
{
    /// <summary>
    /// Loading 场景入口。
    /// 主流程：init -> loadingStart -> 首场景就绪 -> loadingEnd -> 进入 Game。
    ///
    /// 说明（IAA 接入方 99% 只需要这一段）：
    /// - init 是硬约束，必须最先完成；
    /// - loadingStart / loadingEnd 是推荐上报，不是强制项；
    /// - 真实项目里 loadingEnd 应放在"玩家真正可以操作"的时刻，
    ///   这里因为 Loading 场景本身没有资源要加载，所以 init 回调里直接进 Game。
    /// </summary>
    public class StartLoad : MonoBehaviour
    {
        [SerializeField] private string nextScene = "Game";

        private void Start()
        {
            // 1. 初始化 SDK（硬约束：必须最先完成）
            JogosSDK.Init(() =>
            {
                // 3. 通知平台：加载结束、可以玩了（推荐上报）
                JogosSDK.LoadingEnd();

                if (!string.IsNullOrEmpty(nextScene))
                {
                    SceneManager.LoadScene(nextScene);
                }
            });

            // 2. 通知平台：开始加载（推荐上报；内部等待 init 完成，不会抛 460）
            JogosSDK.LoadingStart();
        }
    }
}
