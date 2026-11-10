using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.IMGUI.Controls;
using UnityEngine;

namespace JogosGames.Engine.Optimization
{
    public class AudioOptimization : EditorWindow
    {
        private static MultiColumnHeaderState _multiColumnHeaderState;
        private static AudioTree _audioCompressionTree;

        private static bool _isAnalyzing;
        private static bool _includeFilesFromPackages;

        public static void RenderGUI()
        {
            var rect = EditorGUILayout.BeginVertical(GUILayout.MinHeight(300));
            GUILayout.FlexibleSpace();
            EditorGUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();
            EditorGUILayout.BeginVertical();
            GUILayout.Label("Press \"Analyze audio\" button to load the table.");
            GUILayout.Label("Press it again when you need to refresh the data.");
            EditorGUILayout.EndVertical();
            GUILayout.FlexibleSpace();
            EditorGUILayout.EndHorizontal();
            GUILayout.FlexibleSpace();
            _audioCompressionTree?.OnGUI(rect);
            EditorGUILayout.EndVertical();

            EditorGUILayout.Space(5);
            EditorGUILayout.BeginHorizontal();
            if (OptimizerWindow.Instance.DrawAssetSelect(OptimizerWindow.AnalyzeAssetType.Audio))
            {
                AnalyzeAudio();
            }

            EditorGUILayout.EndHorizontal();
            EditorGUILayout.Space(5);

            if (GUILayout.Button("SetAllAudios", GUILayout.Width(200)))
            {
                SetAllAudios();
            }

            GUILayout.Label(
                "This utility gives you an overview of the audio clips used in your project. By optimizing various settings, you will be able to considerably decrease your final build size and runtime memory usage. You can click on an audio clip to select it in the Project view. To find out more about how the tool finds the audio clips, please check our GitHub repo.",
                EditorStyles.wordWrappedLabel);


            BuildExplanation("Load type",
                "The default option, Decompress On Load, is good for audio clips that require precision when played, for example, audio effects or dialogues. For background audio clips Compressed In Memory is recommended, since it reduces the runtime memory, though audio playback is less precise and may introduce latency.");
            BuildExplanation("Quality",
                "Lowering the quality will reduce the build size. You can experiment with a lower audio quality for background audio.");
        }

        static void BuildExplanation(string label, string explanation)
        {
            EditorGUILayout.BeginHorizontal();
            GUILayout.Label(label, EditorStyles.boldLabel, GUILayout.Width(130));
            GUILayout.Label(
                explanation,
                EditorStyles.wordWrappedLabel);
            GUILayout.FlexibleSpace();
            EditorGUILayout.EndHorizontal();
        }


        static void AnalyzeAudio()
        {
            _isAnalyzing = true;
            if (OptimizerWindow.Instance != null)
            {
                OptimizerWindow.Instance.Repaint();
            }

            var usedAudioPaths = OptimizerWindow.Instance.AnalyzedAudios;

            var treeElements = new List<AudioTreeItem>();
            var idIncrement = 0;
            var root = new AudioTreeItem("Root", -1, idIncrement, null, null);
            treeElements.Add(root);

            foreach (var audioPath in usedAudioPaths)
            {
                if (audioPath.StartsWith("Packages/") && !_includeFilesFromPackages)
                {
                    continue;
                }

                idIncrement++;
                try
                {
                    var audioImporter = (AudioImporter)AssetImporter.GetAtPath(audioPath);
                    treeElements.Add(new AudioTreeItem("AudioClip", 0, idIncrement, audioPath, audioImporter));
                }
                catch (Exception)
                {
                    Debug.LogWarning("Failed to analyze audio clip at path: " + audioPath);
                }
            }

            var treeModel = new TreeModel<AudioTreeItem>(treeElements);
            var treeViewState = new TreeViewState();
            if (_multiColumnHeaderState == null)
                _multiColumnHeaderState = new MultiColumnHeaderState(new[]
                {
                    // when adding a new column don't forget to check the sorting method, and the CellGUI method
                    new MultiColumnHeaderState.Column()
                        { headerContent = new GUIContent() { text = "Audio clip" }, width = 150, minWidth = 150, canSort = true },
                    new MultiColumnHeaderState.Column()
                        { headerContent = new GUIContent() { text = "Load type" }, width = 150, minWidth = 150, canSort = true },
                    new MultiColumnHeaderState.Column() { headerContent = new GUIContent() { text = "Quality" }, width = 60, minWidth = 60, canSort = true },
                    new MultiColumnHeaderState.Column() { headerContent = new GUIContent() { text = "Mono" }, width = 60, minWidth = 60, canSort = true },
                    new MultiColumnHeaderState.Column() { headerContent = new GUIContent() { text = "Opt" }, width = 60, minWidth = 60, canSort = true },
                });
            _audioCompressionTree = new AudioTree(treeViewState, new MultiColumnHeader(_multiColumnHeaderState), treeModel);
            _isAnalyzing = false;
            if (OptimizerWindow.Instance != null)
            {
                OptimizerWindow.Instance.Repaint();
            }
        }

        public static bool IsQualityOK(AudioImporterSampleSettings importSetting)
        {
            return importSetting.quality < 50;
        }

        public static bool IsMonoOK(AudioImporter importSetting)
        {
            return importSetting.forceToMono;
        }

        public static void SetAllAudios()
        {
            HashSet<string> usedAssetPath = OptimizerWindow.Instance.AnalyzedAudios;
            if (usedAssetPath == null || usedAssetPath.Count == 0)
                return;

            EditorUtility.DisplayProgressBar("SetAllAudios", "", 0);
            float totalCnt = usedAssetPath.Count;
            float finishNum = 0;
            foreach (string assetPath in usedAssetPath)
            {
                var importer = AssetImporter.GetAtPath(assetPath);
                if (!(importer is AudioImporter audioImport))
                {
                    Debug.Log("TextureImporter error:" + assetPath);
                    continue;
                }
                var platformSettings = audioImport.GetOverrideSampleSettings("WebGL");

                ++finishNum;
                EditorUtility.DisplayProgressBar("SetAllTextures", assetPath, finishNum / totalCnt);
                bool isDirty = false;
                if (!IsQualityOK(platformSettings))
                {
                    platformSettings.quality = 0;
                    audioImport.SetOverrideSampleSettings("WebGL", platformSettings);
                    isDirty = true;
                }
                if (!IsMonoOK(audioImport))
                {
                    audioImport.forceToMono = true;
                    isDirty = true;
                }

                if (isDirty)
                {
                    AssetDatabase.ImportAsset(assetPath);
                }
            }
            _audioCompressionTree.Repaint();
            EditorUtility.ClearProgressBar();
        }
    }
}