import { _decorator, Component, Node, Label, clamp, Widget, UITransform, JsonAsset } from 'cc';

import JogosSDK, {RequestAdCallbacks} from './jogos/JogosSDK';
import { PreOrderMgr } from './jogos/PreOrderMgr';

const { ccclass, property } = _decorator;
@ccclass('JogosSDKDemo')
export class JogosSDKDemo extends Component {
    @property({ type: Label })
    initLabel: Label;
    @property({ type: Node })
    contentPanel: Node;
    @property({ type: Node })
    banner: Node;

    private _loadProgress: number = 0;


    async onLoad() {
        this.contentPanel.active = false
        this.initLabel.string = 'JogosSDK.init must be called before using any other methods';

        /**
         * =======================
         * @zh 特别注意：以下3个步骤(step1:init, step3:loadingStart, step4:loadingEnd ) 必须按照顺序执行且【不可遗漏 】(调用位置没有要求，但是必须按照顺序调用)
         * @en warning: step 1,3,4 must be called in order and cannot be omitted
         * ========================
         */
        /**
         * @zh 步骤 1:（必须在游戏在其他步骤前调用，尤其是在访问存档前）
         * @en step 1：waiting sdk init, especially before accessing game save datas
         */
        let systemInfo = await JogosSDK.init();
        if(!systemInfo){
            return
        }
        this.initLabel.string = 'JogosSDK.init complete';

        /**         
         * @zh 步骤 2: 通知平台-游戏开始加载
         * @en step 2: loading start
         */
        await JogosSDK.loadingStart()
        console.log(`loading start`)

        /**         
         * @zh 步骤 3: 等待游戏资源加载完成(这是你自己游戏的资源加载逻辑，等待加载完成后，调用loadingEnd)
         * @en step 3: waiting assets loaded
         */
        await this.mockAsssetsOrSceneLoad();
        //or loading Scene

        this.contentPanel.active = true        
        /**         
         * @zh 步骤 4: 通知平台-游戏加载结束，可以正常玩了
         * @en step 4: loading end(notify sdk loading end, game can play now)
         */
        JogosSDK.loadingEnd().then(()=>{
            this.initLabel.string = 'loadingEnd';
            console.log(`loadingEnd`)
        })  

        //step next 
        //enter game .....

        //step next if needs: init order mgr if you need( 如果需要处理订单购买相关 可以继续做其他逻辑)
        //this.initOrderMgr();

        // any other methods call if needed
        if(false){
            // game pause 
            this.pause();
            // game resume
            this.continuePlay();
            //Interstitial Ad
            this.requestAd();
            //Rewared Ad
            this.requestRewardedAd();
            //banner Ad
            this.showBanner();
            //clear banner if needed
            this.clearAllBanners()
        }        
    }   
    
    /**
     * mock assets or scene loading
     */
    async mockAsssetsOrSceneLoad(){
        this.initLabel.string = 'loading...'          
        await new Promise((resolve, reject) => {
            const onLoadProgress = ()=>{            
            this._loadProgress =  clamp(this._loadProgress + 0.01, 0, 1);
            this.initLabel.string = `loading...${Math.floor(this._loadProgress * 100)}%`;
            if(this._loadProgress >= 1){                
                resolve(true);
            }
        }
            this.schedule(onLoadProgress);
        })        
    }

    async getUser(){
        const result = await JogosSDK.getUser();
        console.log(`getUser: ${JSON.stringify(result)}`);
    }
    async getUserToken(){
        const result = await JogosSDK.getUserToken();
        console.log(`getUserToken: ${JSON.stringify(result)}`);
    }

    async getPublicKey(){
        const result = await JogosSDK.getPublicKey();
        console.log(`getPublicKey: ${JSON.stringify(result)}`);
    }

    async loadingStart(){
        const result = await JogosSDK.loadingStart();
        console.log(`loadingStart: ${JSON.stringify(result)}`);
    }
    async loadingEnd(){
        const result = await JogosSDK.loadingEnd();
        console.log(`loadingEnd: ${JSON.stringify(result)}`);
    }
    async pause(){
        const result = await JogosSDK.pause();
        console.log(`pause: ${JSON.stringify(result)}`);
    }
    async continuePlay(){
        const result = await JogosSDK.continuePlay();
        console.log(`continuePlay: ${JSON.stringify(result)}`);
    }
    async happytime(){
        const result = await JogosSDK.happytime();
        console.log(`happytime: ${JSON.stringify(result)}`);
    }
    async share(){        
        const shareData: any = {};
        JogosSDK.sdk.game.share(shareData)
    }

    async synchronizeToCloud(){
        const result = await JogosSDK.synchronizeToCloud();
        console.log(`synchronizeToCloud: ${JSON.stringify(result)}`);
    }

    async commitAchievementsData(){
        const name = 'maxLevel'
        const progress = 20
        const hidden = false
        const result = await JogosSDK.commitAchievementsData(name, progress, hidden);
        console.log(`commitAchievementsData: ${JSON.stringify(result)}`);
    }

    async openAchievementsDialog(){
        const result = await JogosSDK.openAchievementsDialog();
        console.log(`openAchievementsDialog: ${JSON.stringify(result)}`);
    }

    async commitRankingData(){
        const rankingType = 'dailyRank'
        const data = {number: 1000}
        const result = await JogosSDK.commitRankingData(rankingType, data);
        console.log(`commitRankingData: ${JSON.stringify(result)}`);
    }

    async openRankingDialog(){
        const rankingType = 'dailyRank'
        const result = await JogosSDK.openRankingDialog(rankingType);
        console.log(`openRankingDialog: ${JSON.stringify(result)}`);
    }

    showBanner(){
        let bannerNode = this.banner;
        bannerNode.active = false
        bannerNode.active = true
    }

    clearBanner(){
        this.banner.active = false
        // JogosSDK.clearBanner('jogos123456')
    }

    clearAllBanners(){
        JogosSDK.clearAllBanners()
    }

    hasAdblock(){
        JogosSDK.hasAdblock()
    }

    getRewardAdCount(){
        JogosSDK.getRewardAdCount()
    }

    //Interstitial Ad   
    requestAd(){
        let cb = <RequestAdCallbacks>{
            onstarted: () => {
                console.log("onstarted");
            },
            onfinished: () => {
                console.log("onfinished");
            },
            onerror: (error) => {
                console.log("onerror", error);
            }
        } 
        JogosSDK.requestAd("midgame", cb)
    }

    //Rewared Ad
    requestRewardedAd(){
        let cb = <RequestAdCallbacks>{
            onstarted: () => {
                console.log("onstarted");
            },
            onfinished: () => {
                console.log("onfinished");
            },
            onerror: (error) => {
                console.log("onerror", error);
            }
        } 
        JogosSDK.requestAd("rewarded",cb)
    }

    // payment
    buyOut(){
        JogosSDK.buyOut()
    }

    //init order mgr
    initOrderMgr(){
        PreOrderMgr.ins.init();
        //game logic deliver puchased item
        PreOrderMgr.ins.setOrderDeliverHandler((order)=>{
            //order pay finished
            //...game logic to add order item
            return true
        });

    }


    buyGoods(){        
        //ensure order mgr init when game start
        
        //then buy googs
        let goodsId = 'good1123456789'
        //JogosSDK.buyGoods(goodsId)
        PreOrderMgr.ins.buyGoods(goodsId);

    }

    async getOrderDetail(){
        let orderId = 'order1123456789'
        const result = await JogosSDK.getOrderDetail(orderId)
        console.log(`getOrderDetail: ${JSON.stringify(result)}`);
    }

    async getOrderList(){        
        const result = await JogosSDK.getOrderList('success', 0, 20)
        console.log(`getOrderList: ${JSON.stringify(result)}`);
    }

    async subscribeOrderPaid(){
        const handleOrderPaid = (order) => {
            console.log(`getOrderList: ${JSON.stringify(order)}`);
        };
        JogosSDK.subscribeOrderPaid(handleOrderPaid)
    }

    //get items from sdk remote
    getGameItems(){      
        //init game items, and subscribe game items change, user must login first
        JogosSDK.sdk.user.getUser().then(user => {
            console.log('getUser: ', user);
        })
        JogosSDK.sdk.user.getUserToken().then(token => {
            JogosSDK.sdk.gameItem.getUserGameItems().then(items => {
                for (let item of items) {
                    //update local item count 
                    console.log('getUserGameItems: ', item.id, item.amount);
                }                
            })
            //subscribe game items change
            JogosSDK.sdk.gameItem.subscribeGameItemChange((items)=>{                
            for (let item of items) {
                console.log('sdk notify game item chagnes', item.id, item.amount, item.difference)
                //update local item count 
            }
        })
        }).catch((error) => {
            console.log('user not login error: ', error);
        })
    }

    //add item count
    addItemCount(itemId: number, delta: number){
        JogosSDK.sdk.gameItem.addGameItem(String(itemId), delta) 
    }

    //subtract item count
    subtractItemCount(itemId: number, delta: number){
        JogosSDK.sdk.gameItem.subtractGameItem(String(itemId), -delta) 
    }
}


