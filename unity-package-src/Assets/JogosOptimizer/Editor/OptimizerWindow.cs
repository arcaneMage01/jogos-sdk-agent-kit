using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;

namespace JogosGames.Engine.Optimization
{
    public class OptimizerWindow : EditorWindow
    {
        

        internal static OptimizerWindow instance = null;
        public static OptimizerWindow Instance
        {
            get
            {
                if (instance == null)
                    instance = GetWindow<OptimizerWindow>();
                return instance;
            }
        }

        [MenuItem("Tools/WebGL Optimizer")]
        public static void ShowWindow()
        {
            instance = null;
            Instance.titleContent = new GUIContent("OptimizerWindow");
            Instance.Show();
        }

        void OnGUI()
        {
            DrawTags();

            scrollPos = GUILayout.BeginScrollView(scrollPos);
            switch (mode)
            {
                case Mode.Global:
                    GlobalOptimizations.RenderGUI();
                    break;
                case Mode.Texture:
                    TextureOptimization.RenderGUI();
                    break;
                case Mode.Audio:
                    AudioOptimization.RenderGUI();
                    break;
            }

            GUILayout.EndScrollView();
        }

        private void OnEnable()
        {
            okStyle = new GUIStyle
            {
                fontStyle = FontStyle.Bold,
                normal =
                {
                    textColor = Color.green
                }
            };

            failStyle = new GUIStyle
            {
                fontStyle = FontStyle.Bold,
                normal =
                {
                    textColor = Color.red
                }
            };

            warningStyle = new GUIStyle
            {
                fontStyle = FontStyle.Bold,
                normal =
                {
                    textColor = Color.yellow
                }
            };

            labelStyle = new GUIStyle
            {
                normal =
                {
                    textColor = EditorStyles.label.normal.textColor
                }
            };
            additionalInfoStyle = new GUIStyle
            {
                fontSize = 11,
                wordWrap = true,
                normal =
                {
                    textColor = EditorStyles.label.normal.textColor
                }
            };
        }

        private void OnDestroy()
        {
            instance = null;
        }

        Vector2 scrollPos = Vector2.zero;

        public static GUIStyle okStyle;

        public static GUIStyle failStyle;

        public static GUIStyle warningStyle;

        public static GUIStyle labelStyle;
        public static GUIStyle additionalInfoStyle;

        #region draw tags

        const float toolbarPadding = 15;
        const float menubarPadding = 32;

        public enum Mode
        {
            Global,
            Texture,
            Audio,
        }

        private Mode mode = 0;
        static GUIContent[] modeLabels = new GUIContent[3]
        {
            new GUIContent("Gloabl"),
            new GUIContent("Texture"),
            new GUIContent("Audio")
        };

        private void DrawTags()
        {
            GUILayout.BeginHorizontal();
            GUILayout.Space(toolbarPadding);
            float toolbarWidth = position.width - toolbarPadding * 4;
            var newMode = (Mode)GUILayout.Toolbar((int)mode, modeLabels, "LargeButton", GUILayout.Width(toolbarWidth));
            if (newMode != mode)
            {
                mode = newMode;
                scrollPos = Vector2.zero;
            }
            GUILayout.FlexibleSpace();
            GUILayout.EndHorizontal();

            
        }

        #endregion

        #region draw Analyze Assets

        public enum AnalyzeAssetType
        {
            Texture,
            Audio,
        }

        private bool isFoldAssetSelect = false;
        private bool isIncludeScene = true;
        private bool isIncludeResourceFold = true;
        private List<DefaultAsset> selectTargetPathes = new List<DefaultAsset>();

        public HashSet<string> AnalyzedTextures { get; private set; }
        public HashSet<string> AnalyzedAudios { get; private set; }


        public bool DrawAssetSelect(AnalyzeAssetType analyzeAssetType)
        {
            EditorGUILayout.BeginVertical();
            isFoldAssetSelect = EditorGUILayout.Foldout(isFoldAssetSelect, "Analyze Assets Select");
            if (isFoldAssetSelect)
            {
                isIncludeScene = EditorGUILayout.ToggleLeft("In Scene", isIncludeScene);
                isIncludeResourceFold = EditorGUILayout.ToggleLeft("In Resource Fold", isIncludeResourceFold);
                EditorGUILayout.BeginVertical();
                for (int i = 0; i < selectTargetPathes.Count; i++)
                {
                    selectTargetPathes[i] = (DefaultAsset)EditorGUILayout.ObjectField(selectTargetPathes[i], typeof(DefaultAsset), false);
                }

                var newTarget = (DefaultAsset)EditorGUILayout.ObjectField(null, typeof(DefaultAsset), false);
                if (newTarget != null)
                {
                    selectTargetPathes.Add(newTarget);
                }

                EditorGUILayout.EndVertical();
            }

            bool isClick = false;
            //EditorGUILayout.BeginHorizontal();
            //GUILayout.FlexibleSpace();
            if (GUILayout.Button("Analyze Assets", GUILayout.Width(200)))
            {
                AnalyzeAssets(analyzeAssetType);
                isClick = true;
            }
            //EditorGUILayout.EndHorizontal();

            EditorGUILayout.EndVertical();
            return isClick;
        }

        private void AnalyzeAssets(AnalyzeAssetType analyzeAssetType)
        {
            EditorUtility.DisplayProgressBar("AnalyzeAssets", "", 0);

            var usedAssetsPaths = new HashSet<string>();

            EditorUtility.DisplayProgressBar("AnalyzeAssets", "InBuildScenes", 0);
            GetUsedAssetsInBuildScenes(analyzeAssetType).ForEach(path => usedAssetsPaths.Add(path));
            EditorUtility.DisplayProgressBar("AnalyzeAssets", "InResources", 0.3f);
            GetUsedAssetsInResources(analyzeAssetType).ForEach(path => usedAssetsPaths.Add(path));
            EditorUtility.DisplayProgressBar("AnalyzeAssets", "InDirects", 0.6f);
            GetUsedAssetsInDirects(analyzeAssetType).ForEach(path => usedAssetsPaths.Add(path));

            switch (analyzeAssetType)
            {
                case AnalyzeAssetType.Texture:
                    AnalyzedTextures = usedAssetsPaths;
                    break;
                case AnalyzeAssetType.Audio:
                    AnalyzedAudios = usedAssetsPaths;
                    break;
            }

            EditorUtility.ClearProgressBar();
        }

        bool IsAssetType(string assetPath, AnalyzeAssetType analyzeAssetType)
        {
            var assetType = AssetDatabase.GetMainAssetTypeAtPath(assetPath);
            switch (analyzeAssetType)
            {
                case AnalyzeAssetType.Texture:
                    return assetType == typeof(Texture2D);
                case AnalyzeAssetType.Audio:
                    return assetType == typeof(AudioClip);
            }

            return false;
        }

        string GetAssetSearchStr(AnalyzeAssetType analyzeAssetType)
        {
            switch (analyzeAssetType)
            {
                case AnalyzeAssetType.Texture:
                    return "t:texture";
                case AnalyzeAssetType.Audio:
                    return "t:audioclip";
            }

            return "";
        }

        List<string> GetUsedAssetsInBuildScenes(AnalyzeAssetType analyzeAssetType)
        {
            var usedAssets = new HashSet<string>();

            int maxCount = EditorBuildSettings.scenes.Length;
            float curCnt = 0;

            foreach (var scene in EditorBuildSettings.scenes)
            {
                if(!scene.enabled)
                    continue;

                var scenePath = scene.path;
                var assetDependencies = AssetDatabase.GetDependencies(scenePath, true);
                foreach (var assetDependency in assetDependencies)
                {
                    if (IsAssetType(assetDependency, analyzeAssetType))
                    {
                        usedAssets.Add(assetDependency);
                    }
                }

                ++curCnt;
                EditorUtility.DisplayProgressBar("AnalyzeAssets-InScene", scenePath, (curCnt / maxCount) * 0.3f);
            }

            return usedAssets.ToList();
        }

        
        List<string> GetUsedAssetsInResources(AnalyzeAssetType analyzeAssetType)
        {
            var usedTexturePaths = new HashSet<string>();
            var allAssetPaths = AssetDatabase.FindAssets("", new[] { "Assets" }).Select(AssetDatabase.GUIDToAssetPath).ToList();

            // keep only the assets inside a Resources folder, that is not inside an Editor folder
            var rx = new Regex(@"\w*(?<!Editor\/)Resources\/", RegexOptions.Compiled | RegexOptions.IgnoreCase);
            allAssetPaths = allAssetPaths.Where(assetPath => (rx.IsMatch(assetPath))).ToList();

            int maxCount = allAssetPaths.Count;
            float curCnt = 0;

            foreach (var assetPath in allAssetPaths)
            {
                var assetDependencies = AssetDatabase.GetDependencies(assetPath, true);
                foreach (var assetDependency in assetDependencies)
                {
                    if (IsAssetType(assetDependency, analyzeAssetType))
                    {
                        usedTexturePaths.Add(assetDependency);
                    }
                }

                ++curCnt;
                EditorUtility.DisplayProgressBar("AnalyzeAssets-InResources", assetPath, 0.3f + (curCnt / maxCount) * 0.3f);
            }

            return usedTexturePaths.ToList();
        }

        List<string> GetUsedAssetsInDirects(AnalyzeAssetType analyzeAssetType)
        {
            List<string> directs = new List<string>();
            foreach (var dirObj in selectTargetPathes)
            {
                string dirPath = AssetDatabase.GetAssetPath(dirObj);
                if(!string.IsNullOrEmpty(dirPath))
                    directs.Add(dirPath);
            }
            
            var usedTexturePaths = new HashSet<string>();
            if (directs.Count == 0)
                return usedTexturePaths.ToList();

            var allAssetPaths = AssetDatabase.FindAssets("", directs.ToArray()).Select(AssetDatabase.GUIDToAssetPath).ToList();

            int maxCount = allAssetPaths.Count;
            float curCnt = 0;
            
            foreach (var assetPath in allAssetPaths)
            {
                var assetDependencies = AssetDatabase.GetDependencies(assetPath, true);
                foreach (var assetDependency in assetDependencies)
                {
                    if (IsAssetType(assetDependency, analyzeAssetType))
                    {
                        usedTexturePaths.Add(assetDependency);
                    }
                }

                ++curCnt;
                EditorUtility.DisplayProgressBar("AnalyzeAssets-InDirects", assetPath, 0.6f + (curCnt / maxCount)*0.4f);
            }

            return usedTexturePaths.ToList();
        }

        #endregion

    }
}