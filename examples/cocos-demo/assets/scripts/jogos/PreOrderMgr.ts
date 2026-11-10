
import JogosSDK, { PaymentOrder } from "./JogosSDK";
const STORAGE_KEY_PRE_ORDERS = 'jogosPreOrders';

interface IPreOrder{
    orderNo: string;
    time: number;//order create time(s)
}

let localStorage 
if(window["cc"]){
    localStorage = window["cc"]["localStorage"] || window["cc"]["sys"]?.localStorage;
}else{
    localStorage = window.localStorage;
}

/**
 * @en PreOrderMgr
 * @zh 预订单管理
 * @zh 注意：为了方便移植，本类代码不应该处理游戏具体业务
 * @en attention: this class should not handle game specific business logic
 */
export class PreOrderMgr {
    private static _ins: PreOrderMgr = null;
    public static get ins(): PreOrderMgr{
        if(!this._ins){
            this._ins = new PreOrderMgr();
        }
        return this._ins;
    }

    private _hasInit: boolean = false;
    private _orderDeliverHandler: (order: PaymentOrder) => void;
    private _preOrderMap: { [key: string]: IPreOrder } = {};

    constructor(){
        this._preOrderMap = {};
    }

    init(){
        if(this._hasInit){
            return;
        }
        this._hasInit = true;

        //read preOrders from local storage
        let preOrderMapStr = localStorage.getItem(STORAGE_KEY_PRE_ORDERS);
        if(preOrderMapStr && preOrderMapStr.length > 0){
            this._preOrderMap = JSON.parse(preOrderMapStr);
        }

        //start check preOrder status
        JogosSDK.getOrderList('success',1,10).then((orderList)=>{
            let unDeliverOrderList: PaymentOrder[] = [];
            for(let i = 0; i < orderList.length; i++){
                let order = orderList[i];
                if(order.status === 'success'){                    
                    unDeliverOrderList.push(order);               
                }                
            }
            if(unDeliverOrderList.length > 0){
                if(!this._orderDeliverHandler){
                    JogosSDK.showToast('unDeliverOrderHandler not exists');
                }else{
                    for(let i = 0; i < unDeliverOrderList.length; i++){
                        let order = unDeliverOrderList[i];
                        this._orderDeliverHandler(order);
                    }
                }
            }
        })

        //schedule check order Status
        const checkInterval = 5;        
        setInterval(()=>{
            this.checkOrderStatus();
        }, checkInterval * 1000);

        //register order paid callback
        JogosSDK.subscribeOrderPaid((order)=>{
            console.log('on subscribeOrderPaid notify: ', order);
            //avoid duplicate deliver
            if(!this._preOrderMap[order.orderNo]){
                console.error('on subscribeOrderPaid notify, preOrder not exists: ' + order.orderNo);
                return;
            }
            this._orderDeliverHandler(order)
        })
    }
    
    /**
     * @en buyGoods
     * @zh 购买商品
     * @param itemId
     */
    async buyGoods(itemId: string):Promise<string>{
        //check if there is an existing preOrder for this itemId
        let existsPreOrder = this._preOrderMap[itemId];
        let nowSecs = new Date().getTime()/1000;
        const minInterval = 20;
        if(existsPreOrder && nowSecs - existsPreOrder.time < minInterval){
            //an existing preOrder for this itemId is in progress, cannot buy again within minInterval
            JogosSDK.showToast('Another order for this item is in progress. Please wait and try again.');
            return Promise.reject('');
        }
        return new Promise((resolve, reject)=>{
            JogosSDK.buyGoods(itemId).then((orderNo)=>{                
                //预订单生成
                if(orderNo){
                    this.addPreOrder({
                        orderNo: orderNo,
                        itemId: itemId,
                        time: Math.ceil(nowSecs),
                    })
                    resolve(orderNo);
                }
            }).catch((err)=>{
                reject(err);
            })
        })

    }

    /**
     * @en addPreOrder & save (avoid misssing preOrder info)
     * @zh 本地添加预订单->save (防止丢单)
     * @param preOrder 
     */
    public addPreOrder(preOrder: {orderNo: string, itemId: string,time: number}) {
        console.log('addPreOrder: ', preOrder);
        this._preOrderMap[preOrder.orderNo] = preOrder;
        //save preOrder to local storage
        localStorage.setItem(STORAGE_KEY_PRE_ORDERS, JSON.stringify(this._preOrderMap));
    }

    public getOrder(orderId: string) {
        return this._preOrderMap[orderId];
    }

    private checkOrderStatus(){        
        for(let orderNo in this._preOrderMap){
            JogosSDK.getOrderDetail(orderNo).then((order)=>{
                this._orderDeliverHandler(order);
            }).catch((err)=>{
                console.log('checkOrderStatus err', err);                
            })
        }

        if(Object.keys(this._preOrderMap).length > 0){
            console.log('waiting preOders: ', Object.keys(this._preOrderMap).length);
        }
    }

    /**    
     * @zh 游戏业务必须注册该回调，用于处理订单的发货处理
     * @en game business must register this callback to handle order deliver
     * @param handler 
     */
    setOrderDeliverHandler(handler: (order: PaymentOrder) => boolean){
        this._orderDeliverHandler = (order:PaymentOrder)=>{
            /**
             * @zh 待支付订单不处理
             * @en pending order not handle
             * */
            if(order.status == "pending"){
                return
            }
            if(order.status == "success"){
                const preOrder = this._preOrderMap[order.orderNo];
                console.log(`deliverGoods orderNo: ${order.orderNo}, status: ${order.status}，preOrder: ${JSON.stringify(this._preOrderMap[order.orderNo])}`)
                if(!preOrder ){
                    console.error(`orderNo: ${order.orderNo}, preOrder not exists`);
                    return;
                }
                /**
                 * @zh 业务发货(例如：游戏给玩家增加道具) 
                 * @en game business handle order deliver
                 * */
                if(preOrder){            
                    /**
                     * @zh 确保业务处理成功才删除预订单和更改订单状态
                     * @en make sure deliver item success and then delete delete preOrder info from localstorage
                     * */
                    let isBusinessDeliverSuccess = handler(order)
                    if(isBusinessDeliverSuccess){                    
                        /**
                         * @zh 通知sdk更改订单状态为已发货
                         * @en notify sdk order deliver success
                         * */
                        JogosSDK.deliverGoods(order.orderNo);   
                        //delete preOrder
                        delete this._preOrderMap[order.orderNo];
                        //save                    
                        localStorage.setItem(STORAGE_KEY_PRE_ORDERS, JSON.stringify(this._preOrderMap));
                        JogosSDK.showToast(`purchase shop item sucess`)
                    }else{
                        JogosSDK.showToast(`purchase item: ${order.goodsName} game deliver fail`)
                    }            
                }  
            }                                              
        };
    }

}
