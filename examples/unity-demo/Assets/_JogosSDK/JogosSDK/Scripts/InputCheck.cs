using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace JogosGames.Engine.SDK
{
    public class InputCheck : MonoBehaviour
    {
        #region static

        public static void InitCheck(Action<int> inputCallback)
        {
            var go = new GameObject("InputCheck");
            var check = go.AddComponent<InputCheck>();
            check.inputCallback = inputCallback;
            Input.simulateMouseWithTouches = false;
        }

        #endregion

        public Action<int> inputCallback;
        
        void Start()
        {
            DontDestroyOnLoad(this.gameObject);
        }

        void Update()
        {
            if (JogosSDK.MouseOrTouch < 0)
            {
                if (Input.touchCount > 0)
                {
                    OnInputCallback(1);
                }
                else if (Input.GetMouseButton(0) || Input.GetMouseButton(1))
                {
                    OnInputCallback(0);
                }
            }
        }

        void OnInputCallback(int type)
        {
            inputCallback?.Invoke(type);
            GameObject.Destroy(this.gameObject);
            Input.simulateMouseWithTouches = true;
        }
    }
}
