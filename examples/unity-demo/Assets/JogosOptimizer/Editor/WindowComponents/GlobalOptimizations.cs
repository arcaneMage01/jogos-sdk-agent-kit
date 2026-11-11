using System;
using UnityEditor;
using UnityEditor.Rendering;
using UnityEngine;
using UnityEngine.Rendering;

namespace JogosGames.Engine.Optimization
{
    public class GlobalOptimizations
    {
        public static void RenderGUI()
        {
            if (typeof(PlayerSettings.WebGL).GetProperty("compressionFormat") != null)
            {
                var compressionOk = PlayerSettings.WebGL.compressionFormat == WebGLCompressionFormat.Brotli;
                Action fixCompression = () => { PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Brotli; };
                RenderFixableItem("Brotli compression", compressionOk, false, fixCompression);
            }

            if (typeof(PlayerSettings.WebGL).GetProperty("nameFilesAsHashes") != null)
            {
                var nameAsHashesOk = PlayerSettings.WebGL.nameFilesAsHashes;
                Action fixNameAsHashes = () => { PlayerSettings.WebGL.nameFilesAsHashes = true; };
                RenderFixableItem("Name file as hashes", nameAsHashesOk, false, fixNameAsHashes);
            }

            if (typeof(PlayerSettings.WebGL).GetProperty("exceptionSupport") != null)
            {
                var exceptionsOk = PlayerSettings.WebGL.exceptionSupport == WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
                Action fixExceptions = () => { PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly; };
                RenderFixableItem("Exception support", exceptionsOk, false, fixExceptions,
                    "The \"Fix\" button sets exception support to \"Explicitly thrown exceptions only\". You can choose \"None\" in Player Settings for better performance, but first of all read about it on our developer documentation.");
            }

            if (typeof(PlayerSettings.WebGL).GetProperty("decompressionFallback") != null)
            {
                var decompressFallback = PlayerSettings.WebGL.decompressionFallback;
                Action fixAPICompatibilityLv = () => { PlayerSettings.WebGL.decompressionFallback = false; };
                RenderFixableItem("Decompression Fallback", !decompressFallback, false, fixAPICompatibilityLv,
                    "To decrease the bundle size even more, you can select Medium or High stripping from Player Settings, but first of all read about them on our developer documentation.");
            }

            if (typeof(PlayerSettings).GetProperty("stripUnusedMeshComponents") != null)
            {
                var stripUnusedMesh = PlayerSettings.stripUnusedMeshComponents;
                Action fixStripUnusedMesh = () => { PlayerSettings.stripUnusedMeshComponents = true; };
                RenderFixableItem("Optimize Mesh Data", stripUnusedMesh, true, fixStripUnusedMesh,
                    "To decrease the bundle size even more, you can select Medium or High stripping from Player Settings, but first of all read about them on our developer documentation.");
            }

            if (typeof(PlayerSettings).GetProperty("mipStripping") != null)
            {
                var stripUnusedMip = PlayerSettings.mipStripping;
                Action fixStripUnusedMip = () => { PlayerSettings.mipStripping = true; };
                RenderFixableItem("Texture MipMap Stripping", stripUnusedMip, true, fixStripUnusedMip,
                    "To decrease the bundle size even more, you can select Medium or High stripping from Player Settings, but first of all read about them on our developer documentation.");
            }

            if (typeof(PlayerSettings).GetProperty("stripEngineCode") != null)
            {
                var stripEngineCodeOk = PlayerSettings.stripEngineCode;
                Action fixStripEngineCode = () => { PlayerSettings.stripEngineCode = true; };
                RenderFixableItem("Strip engine code", stripEngineCodeOk, true, fixStripEngineCode,
                    "To decrease the bundle size even more, you can select Medium or High stripping from Player Settings, but first of all read about them on our developer documentation.");
            }

            if (typeof(PlayerSettings).GetProperty("apiCompatibilityLevel") != null)
            {
                var apiCompatibilityLv = PlayerSettings.GetApiCompatibilityLevel( BuildTargetGroup.WebGL) == ApiCompatibilityLevel.NET_Standard_2_0;
                Action fixAPICompatibilityLv = () => { PlayerSettings.SetApiCompatibilityLevel(BuildTargetGroup.WebGL, ApiCompatibilityLevel.NET_Standard_2_0); };
                RenderFixableItem("Api Compatibility Level", apiCompatibilityLv, true, fixAPICompatibilityLv,
                    "To decrease the bundle size even more, you can select Medium or High stripping from Player Settings, but first of all read about them on our developer documentation.");
            }

            


#if UNITY_2019 || UNITY_2020 || UNITY_2021 || UNITY_2022
            if (UnityEngine.Rendering.GraphicsSettings.renderPipelineAsset != null)
            {
                RenderInfoItem(
                    "If you are using URP but don't use post-processing we recommend disabling them. This will reduce approximately 1mb from your final build size. Check our tips on the link below for more info."
                );
            }
#endif

#if UNITY_2021 || UNITY_2022
            // Unity is currently missing an API for accessing the GraphicsSettings preloaded shaders, so these need to be read from a serialized object
            var serializedGraphicsSettings = new SerializedObject(GraphicsSettings.GetGraphicsSettings());
            var preloadedShadersCount = serializedGraphicsSettings.FindProperty("m_PreloadedShaders").arraySize;
            if (preloadedShadersCount > 0)
            {
                RenderInfoItem(
                    "Your project is preloading " + preloadedShadersCount + " shader(s). On WebGL, preloading shaders may considerably slow down the loading of the game.");
            }
#endif


            EditorGUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("Read more tips on our developer documentation"))
            {
                Application.OpenURL("https://docs.JogosGames.com/sdk/unity/resources/export-tips/");
            }

            GUILayout.FlexibleSpace();
            EditorGUILayout.EndHorizontal();
        }


        /// <summary>
        /// Render OK/FAIL/WARNING, option name, and "Fix" button.
        /// </summary>
        /// <param name="optionName"></param>
        /// <param name="ok">If the export option has the correct value</param>
        /// <param name="isError">Tips as an error or a warning</param>
        /// <param name="fixAction">Is called when the fix button is clicked.</param>
        /// <param name="additionalInfo">If specified, some additional info is displayed below label name</param>
        private static void RenderFixableItem(string optionName, bool ok, bool warning, Action fixAction, string additionalInfo = null)
        {
            

            EditorGUILayout.BeginVertical();
            EditorGUILayout.Space(20);

            EditorGUILayout.BeginHorizontal();
            GUILayout.Space(15);
            if (ok)
                GUILayout.Label("OK", OptimizerWindow.okStyle, GUILayout.Width(40));
            else if(warning)
                GUILayout.Label("WARN", OptimizerWindow.warningStyle, GUILayout.Width(40));
            else
                GUILayout.Label("FAIL", OptimizerWindow.failStyle, GUILayout.Width(40));
            GUILayout.Label(optionName, OptimizerWindow.labelStyle, GUILayout.Width(300));
            //GUILayout.FlexibleSpace();

            if (!ok && GUILayout.Button("Fix"))
            {
                fixAction();
            }

            EditorGUILayout.EndHorizontal();

            if (!string.IsNullOrEmpty(additionalInfo))
            {
                GUILayout.Space(5);
                EditorGUILayout.BeginHorizontal();
                GUILayout.Space(35);
                GUILayout.Label(additionalInfo, OptimizerWindow.additionalInfoStyle);
                EditorGUILayout.EndHorizontal();
            }

            GUILayout.Space(10);
            EditorGUILayout.EndVertical();
        }

        private static void RenderInfoItem(string info)
        {
            var infoStyle = new GUIStyle
            {
                fontStyle = FontStyle.Bold,
                normal =
                {
                    textColor = new Color(0.1618f, 0.5568f, 1)
                }
            };
            var labelStyle = new GUIStyle
            {
                wordWrap = true,
                normal =
                {
                    textColor = EditorStyles.label.normal.textColor,
                }
            };

            EditorGUILayout.BeginVertical();
            GUILayout.Space(10);

            EditorGUILayout.BeginHorizontal();

            GUILayout.Label("INFO", infoStyle, GUILayout.Width(35));

            GUILayout.Label(info, labelStyle);
            GUILayout.FlexibleSpace();


            EditorGUILayout.EndHorizontal();


            GUILayout.Space(10);
            EditorGUILayout.EndVertical();
        }
    }
}