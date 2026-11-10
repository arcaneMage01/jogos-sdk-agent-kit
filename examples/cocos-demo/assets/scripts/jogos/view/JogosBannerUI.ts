//3.x
import * as cc from "cc";
// import { BUILD } from "cc/env";



let {ccclass} = cc._decorator
@ccclass
export class JogosBannerUI extends cc.Component {
    private _resizeHandler!: () => void;
    private _lastCreateTime: number = 0;
    private _bannerId: string = '';

    onLoad(){
        //listen to window resize
        this._resizeHandler = this.onResize.bind(this);
        window.addEventListener('resize', this._resizeHandler);  
        //
        const bannerSprite = this.node.getComponent(cc.Sprite);
        if(bannerSprite){            
            //if domain startswith developer.jogospre.com, then banner is not supported
            if(window.location.hostname.startsWith('developer.jogos')){
                bannerSprite.enabled = true;
                window["curBannerNode"] = this.node;
            }else{
                bannerSprite.enabled = false;
            }
        }
    }

    protected onDestroy(): void {
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
        }
    }

    onEnable() {       
        this.scheduleOnce(()=>{
            if(window.JogosSDK && window.JogosSDK.cachedSystemInfo){
                this.refreshBanner();
            }else{
                this.waitingFor(() => window.JogosSDK && window.JogosSDK.cachedSystemInfo != null, ()=>{
                    this.refreshBanner();
                }, 10);
            }
        }) 
    }    

    waitingFor(checker: () => boolean, callback: ()=>void, timeoutSecs?: number){
        const startTime = Date.now();
        return new Promise((resolve) => {
            const t = setInterval(() => {
                if(checker()){
                    callback();
                    clearInterval(t);
                    resolve(void 0);
                }
                if(Date.now() - startTime > timeoutSecs * 1000){
                    //timeout  nothing to do                    
                    clearInterval(t);
                    resolve(void 0);
                }
            }, 100);
        })
    }

    onDisable() {
        if(this._bannerId && this._bannerId.length > 0){
            window.JogosSDK.clearBanner(this._bannerId);
        } 
    }

    async refreshBanner(update=false){
        const now = Date.now();
        if(!update && CC_BUILD){            
            const minGapSecs = 60;
            if(now - this._lastCreateTime < minGapSecs * 1000){
                console.log('refreshBanner: too early');
                return;
            }            
        }        
        //node: use to get banner rect  
        //update: true to update banner position, false to create banner
        const bannerId = this._bannerId = await window.JogosSDK.requestBannerWithNode(this.node, update);        
        if(!update && bannerId && bannerId.length > 0){
            this._lastCreateTime = now;
        }
    }

    onResize(){
        this.scheduleOnce(()=>{
            this.refreshBanner(true);
        });
    }
}
