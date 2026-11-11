using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.IMGUI.Controls;
using UnityEngine;

namespace JogosGames.Engine.Optimization
{
    public class TextureOptimization : EditorWindow
    {
        private static MultiColumnHeaderState _multiColumnHeaderState;
        private static TextureTree _textureCompressionTree;

        private static bool _isAnalyzing;
        private static bool _includeFilesFromPackages;

        public static void RenderGUI()
        {
            var rect = EditorGUILayout.BeginVertical(GUILayout.MinHeight(300));
            GUILayout.FlexibleSpace();
            EditorGUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();
            EditorGUILayout.BeginVertical();
            GUILayout.Label("Press \"Analyze textures\" button to load the table.");
            GUILayout.Label("Press it again when you need to refresh the data.");
            EditorGUILayout.EndVertical();
            GUILayout.FlexibleSpace();
            EditorGUILayout.EndHorizontal();
            GUILayout.FlexibleSpace();
            _textureCompressionTree?.OnGUI(rect);
            EditorGUILayout.EndVertical();

            EditorGUILayout.Space(5);

            EditorGUILayout.BeginHorizontal();

            if (OptimizerWindow.Instance.DrawAssetSelect( OptimizerWindow.AnalyzeAssetType.Texture))
            {
                AnalyzeTextures();
            }

            var originalValue = EditorGUIUtility.labelWidth;
            EditorGUIUtility.labelWidth = 160;
            //_includeFilesFromPackages = EditorGUILayout.Toggle("Include files from Packages", _includeFilesFromPackages);
            EditorGUIUtility.labelWidth = originalValue;

            EditorGUILayout.EndHorizontal();
            EditorGUILayout.Space(5);

            if (GUILayout.Button("SetAllTexture", GUILayout.Width(200)))
            {
                SetAllTextures();
            }

            GUILayout.Label(
                "This utility gives you an overview of the textures used in your project. By optimizing various settings, you will be able to considerably decrease your final build size. You can click on a texture to select it in the Project view. To find out more about how the tool finds the textures, please check our GitHub repo.",
                EditorStyles.wordWrappedLabel);


            BuildExplanation("Max size",
                "Decrease the max size as much as possible while the texture still looks good in game. You most likely don't need the default 2048 set by Unity.");
            BuildExplanation("Compression", "Lower quality will decrease the final build size.");
            BuildExplanation("Crunch compression",
                "All the textures with crunch compression enabled will be compressed together, decreasing the final build size.");
            BuildExplanation("Crunch comp. quality", "A higher compression quality means larger textures and longer compression times.");
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

        static void AnalyzeTextures()
        {
            HashSet<string> usedTexturePaths = OptimizerWindow.Instance.AnalyzedTextures;

            var treeElements = new List<TextureTreeItem>();
            var idIncrement = 0;
            var root = new TextureTreeItem("Root", -1, idIncrement, null, null);
            treeElements.Add(root);

            foreach (var texturePath in usedTexturePaths)
            {
                if (texturePath.StartsWith("Packages/") && !_includeFilesFromPackages)
                {
                    continue;
                }

                idIncrement++;
                try
                {
                    var textureImporter = (TextureImporter) AssetImporter.GetAtPath(texturePath);
                    treeElements.Add(new TextureTreeItem("Texture2D", 0, idIncrement, texturePath, textureImporter));
                }
                catch (Exception)
                {
                    Debug.LogWarning("Failed to analyze texture at path: " + texturePath);
                }
            }

            var treeModel = new TreeModel<TextureTreeItem>(treeElements);
            var treeViewState = new TreeViewState();
            if (_multiColumnHeaderState == null)
                _multiColumnHeaderState = new MultiColumnHeaderState(new[]
                {
                    // when adding a new column don't forget to check the sorting method, and the CellGUI method
                    new MultiColumnHeaderState.Column() {headerContent = new GUIContent() {text = "Texture"}, width = 150, minWidth = 150, canSort = true},
                    new MultiColumnHeaderState.Column() {headerContent = new GUIContent() {text = "Type"}, width = 60, minWidth = 60, canSort = true},
                    new MultiColumnHeaderState.Column() {headerContent = new GUIContent() {text = "Max size"}, width = 60, minWidth = 60, canSort = true},
                    new MultiColumnHeaderState.Column() {headerContent = new GUIContent() {text = "Format"}, width = 150, minWidth = 150, canSort = true},
                    new MultiColumnHeaderState.Column()
                        {headerContent = new GUIContent() {text = "Action"}, width = 120, minWidth = 120, canSort = true},
                    //new MultiColumnHeaderState.Column()
                    //    {headerContent = new GUIContent() {text = "Crunch comp. quality"}, width = 128, minWidth = 128, canSort = true},
                });
            _textureCompressionTree = new TextureTree(treeViewState, new MultiColumnHeader(_multiColumnHeaderState), treeModel);
            _isAnalyzing = false;
            if (OptimizerWindow.Instance != null)
            {
                OptimizerWindow.Instance.Repaint();
            }
        }

        static void SetAllTextures()
        {
            HashSet<string> usedTexturePaths = OptimizerWindow.Instance.AnalyzedTextures;
            if (usedTexturePaths == null || usedTexturePaths.Count == 0)
                return;

            EditorUtility.DisplayProgressBar("SetAllTextures", "", 0);
            float totalCnt = usedTexturePaths.Count;
            float finishNum = 0;
            foreach (string texturePath in usedTexturePaths)
            {
                var importer = AssetImporter.GetAtPath(texturePath);
                if (!(importer is TextureImporter textureImporter))
                {
                    Debug.Log("TextureImporter error:" + texturePath);
                    continue;
                }
                var platformSettings = textureImporter.GetPlatformTextureSettings("WebGL");

                ++finishNum;
                EditorUtility.DisplayProgressBar("SetAllTextures", texturePath, finishNum / totalCnt);

                if (!IsFormatOK(platformSettings.format))
                {
                    platformSettings.overridden = true;
                    platformSettings.format = TextureImporterFormat.ASTC_8x8;
                    textureImporter.SetPlatformTextureSettings(platformSettings);

                    AssetDatabase.ImportAsset(texturePath);
                }
            }
            _textureCompressionTree.Repaint();
            EditorUtility.ClearProgressBar();
        }

        public static bool IsFormatOK(TextureImporterFormat format)
        {
            if (format == TextureImporterFormat.ASTC_10x10
                || format == TextureImporterFormat.ASTC_12x12
                || format == TextureImporterFormat.ASTC_4x4
                || format == TextureImporterFormat.ASTC_5x5
                || format == TextureImporterFormat.ASTC_6x6
                || format == TextureImporterFormat.ASTC_8x8
                || format == TextureImporterFormat.ASTC_HDR_10x10
                || format == TextureImporterFormat.ASTC_HDR_12x12
                || format == TextureImporterFormat.ASTC_HDR_4x4
                || format == TextureImporterFormat.ASTC_HDR_5x5
                || format == TextureImporterFormat.ASTC_HDR_6x6
                || format == TextureImporterFormat.ASTC_HDR_8x8
                )
                return true;
            return false;
        }
    }
}