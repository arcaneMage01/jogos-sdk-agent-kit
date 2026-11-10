using JogosGames.Engine.SDK;
using UnityEditor;

namespace JogosGames.Engine.SDKTool
{
    [CustomEditor(typeof(JogosBanner))]
    public class JogosBannerEditor : Editor
    {
        public override void OnInspectorGUI()
        {
            var script = (JogosBanner)target;
            var newValue = EditorGUILayout.EnumPopup("Banner size", script.Size);
            script.Size = (JogosBanner.BannerSize)newValue;
            EditorUtility.SetDirty(target);
        }
    }
}
