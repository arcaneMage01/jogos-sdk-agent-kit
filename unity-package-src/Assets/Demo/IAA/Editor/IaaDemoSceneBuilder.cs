#if UNITY_EDITOR
using System.IO;
using JogosDemo.IAA;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace JogosDemo.IAA.EditorTools
{
    /// <summary>
    /// 一键生成 IAA 最小示例的两个场景：Loading.unity / Game.unity。
    /// 菜单：Jogos/Demo/Rebuild IAA Scenes
    /// 命令行：Unity.exe -batchmode -quit -projectPath <proj> -executeMethod JogosDemo.IAA.EditorTools.IaaDemoSceneBuilder.Build
    /// </summary>
    public static class IaaDemoSceneBuilder
    {
        private const string SceneDir = "Assets/Demo/IAA/Scenes";

        [MenuItem("Jogos/Demo/Rebuild IAA Scenes")]
        public static void Build()
        {
            Directory.CreateDirectory(SceneDir);
            AssetDatabase.Refresh();

            BuildLoading();
            BuildGame();

            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(SceneDir + "/Loading.unity", true),
                new EditorBuildSettingsScene(SceneDir + "/Game.unity", true),
            };

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log("[IAA Demo] scenes rebuilt: Loading.unity -> Game.unity");
        }

        private static void BuildLoading()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            AddCamera(new Color(0.04f, 0.06f, 0.12f));

            var go = new GameObject("StartLoad");
            go.AddComponent<StartLoad>();

            EditorSceneManager.SaveScene(scene, SceneDir + "/Loading.unity");
        }

        private static void BuildGame()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            AddCamera(new Color(0.04f, 0.06f, 0.12f));

            var canvasGo = new GameObject("Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280f, 720f);

            var labelGo = new GameObject("PlayingLabel", typeof(RectTransform), typeof(CanvasGroup));
            labelGo.transform.SetParent(canvasGo.transform, false);

            var text = labelGo.AddComponent<Text>();
            text.text = "Playing...";
            text.font = LoadBuiltinFont();
            text.fontSize = 72;
            text.alignment = TextAnchor.MiddleCenter;
            text.color = Color.white;
            text.raycastTarget = false;

            var rt = labelGo.GetComponent<RectTransform>();
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;

            labelGo.AddComponent<Breathing>();

            new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));

            EditorSceneManager.SaveScene(scene, SceneDir + "/Game.unity");
        }

        private static void AddCamera(Color background)
        {
            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = background;
            cam.orthographic = true;
            camGo.transform.position = new Vector3(0f, 0f, -10f);
        }

        private static Font LoadBuiltinFont()
        {
            var font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            if (font == null)
            {
                font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            }
            return font;
        }
    }
}
#endif
