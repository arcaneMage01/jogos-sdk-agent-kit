using System;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace JogosGames.Engine.Optimization
{
    public class AudioTreeItem : TreeElement
    {
        public string AudioPath { get; }
        public string AudioName { get; }

        public string LoadType
        {
            get
            {
                switch (_platformSettings.loadType)
                {
                    case AudioClipLoadType.DecompressOnLoad:
                        return "Decompress on load";
                    case AudioClipLoadType.CompressedInMemory:
                        return "Compressed in memory";
                    case AudioClipLoadType.Streaming:
                        return "Streaming";
                    default:
                        throw new ArgumentOutOfRangeException();
                }
            }
        }

        public int Quality => Mathf.RoundToInt(_platformSettings.quality * 100);
        public bool ForceToMono => _audioImporter.forceToMono;

        private AudioImporter _audioImporter;
        private AudioImporterSampleSettings _platformSettings;

        public bool IsQualityOK()
        {
            return Quality < 50;
        }

        public bool IsMonoOK()
        {
            return _audioImporter.forceToMono;
        }

        public void SetFix()
        {
            if (!IsQualityOK())
            {
                _platformSettings.quality = 0;
                _audioImporter.SetOverrideSampleSettings("WebGL", _platformSettings);
            }

            if (!IsMonoOK())
            {
                _audioImporter.forceToMono = true;
            }

            AssetDatabase.ImportAsset(AudioPath);
        }

        public AudioTreeItem(string name, int depth, int id, string audioPath, AudioImporter audioImporter) : base(name, depth, id)
        {
            if (depth == -1)
                return;

            AudioPath = audioPath;
            AudioName = Path.GetFileName(audioPath);

            _audioImporter = audioImporter;
            _platformSettings = _audioImporter.GetOverrideSampleSettings("WebGL");
        }
    }
}