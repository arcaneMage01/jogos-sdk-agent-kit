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
    /// 一键生成 IAA 示例的两个场景：Loading.unity / Game.unity。
    ///
    /// Game 场景刻意只放 Camera + CoinRush（+ EventSystem），
    /// UI 由 CoinRushGame 在运行时创建，方便直接阅读 SDK 接入代码。
    ///
    /// 菜单：Jogos/Demo/Rebuild IAA Scenes
    /// 命令行：Unity.exe -batchmode -quit -projectPath &lt;proj&gt; -executeMethod JogosDemo.IAA.EditorTools.IaaDemoSceneBuilder.Build
    /// </summary>
    public static class IaaDemoSceneBuilder
    {
        private const string SceneDir = "Assets/Demo/IAA/Scenes";
        private static readonly Color Background = new Color(0.043f, 0.067f, 0.125f);

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

            AddCamera();

            var canvas = CreateCanvas();
            var label = CreateLabel(canvas.transform, "LoadingLabel", "Loading...", 40, TextAnchor.MiddleCenter, Color.white);
            var rect = label.rectTransform;
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;

            var go = new GameObject("StartLoad");
            go.AddComponent<StartLoad>();

            EditorSceneManager.SaveScene(scene, SceneDir + "/Loading.unity");
        }

        private static void BuildGame()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            AddCamera();

            new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));

            var root = new GameObject("CoinRush");
            root.AddComponent<CoinRushGame>();

            EditorSceneManager.SaveScene(scene, SceneDir + "/Game.unity");
        }

        private static GameObject CreateCanvas()
        {
            var canvasGo = new GameObject("Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280f, 720f);
            scaler.matchWidthOrHeight = 0.5f;
            return canvasGo;
        }

        private static Text CreateLabel(Transform parent, string name, string value, int size, TextAnchor anchor, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);

            var text = go.AddComponent<Text>();
            text.font = LoadBuiltinFont();
            text.text = value;
            text.fontSize = size;
            text.alignment = anchor;
            text.color = color;
            text.raycastTarget = false;
            return text;
        }

        private static void AddCamera()
        {
            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Background;
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
