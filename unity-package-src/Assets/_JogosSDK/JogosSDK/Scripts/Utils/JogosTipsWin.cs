using UnityEngine;
using UnityEngine.UI;

public class JogosTipsWin : MonoBehaviour
{
    public Animator anim;
    public Text text;

    public void ShowTips(string tips)
    {
        gameObject.SetActive(true);
        text.text = tips;
        anim.Play("PushTips",0,0);

        CancelInvoke();
        Invoke("Hide", 3);
    }

    public void Hide()
    {
        gameObject.SetActive(false);
    }
}
