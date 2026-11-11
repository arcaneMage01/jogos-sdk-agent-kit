using System;
using System.IO;
using UnityEditor;

namespace JogosGames.Engine.Optimization
{
    public class TextureTreeItem : TreeElement
    {
        public string TexturePath { get; }
        public string TextureName { get; }

        public int TextureMaxSize => _platformSettings.maxTextureSize;
        public int CrunchCompressionQuality => _platformSettings.compressionQuality;
        public bool HasCrunchCompression => _textureImporter.crunchedCompression;
        public TextureImporterFormat TextureFormat
        {
            get
            {
                var platformSettings = _textureImporter.GetPlatformTextureSettings("WebGL");
                return platformSettings.format;
            }
        }
        public TextureImporterType TextureType => _textureImporter.textureType;
        public TextureImporterCompression TextureCompression => _textureImporter.textureCompression;

        private readonly TextureImporter _textureImporter;
        private readonly TextureImporterPlatformSettings _platformSettings;

        public bool IsFormatOK()
        {
            return TextureOptimization.IsFormatOK(TextureFormat);
        }

        public void SetFormat()
        {
            if (IsFormatOK())
                return;

            _platformSettings.overridden = true;
            _platformSettings.format = TextureImporterFormat.ASTC_8x8;
            _textureImporter.SetPlatformTextureSettings(_platformSettings);

            AssetDatabase.ImportAsset(TexturePath);
        }

        public TextureTreeItem(string name, int depth, int id, string texturePath, TextureImporter textureImporter) : base(name, depth, id)
        {
            if (depth == -1)
                return;

            TexturePath = texturePath;
            TextureName = Path.GetFileName(texturePath);

            _textureImporter = textureImporter;
            _platformSettings = _textureImporter.GetPlatformTextureSettings("WebGL");
        }
    }
}