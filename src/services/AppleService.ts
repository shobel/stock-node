import Config from "../config/config";

const fetch = require('node-fetch');

export default class AppleService {

    private verifyReceiptSandboxUrl:string = "https://sandbox.itunes.apple.com/verifyReceipt"
    private verifyReceiptProdUrl:string = "https://buy.itunes.apple.com/verifyReceipt"
    private verifyReceiptUrl:string

    constructor(){
        this.verifyReceiptUrl = this.verifyReceiptSandboxUrl
        if (Config.production) {
            this.verifyReceiptUrl = this.verifyReceiptProdUrl
        }
    }

    public verifyReceipt(receipt:string) {
        return fetch(this.verifyReceiptUrl, {
            method: 'post',
            body: JSON.stringify({
                "receipt-data": receipt,
                password: process.env.APP_STORE_SECRET
            }),
            headers: { 'Content-Type': 'application/json' }
        })
        .then((res: { json: () => any; }) => res.json())
        .then((response: any) => {
            return response
        }).catch()
    }

    public getTransactionIdFromReceiptForProduct(receipt:any, productid:string){
        if (receipt.receipt?.in_app?.length){
            let inappArray = receipt.receipt?.in_app
            for (let t of inappArray){
                if (t.product_id == productid) {
                    return t.transaction_id
                }
            }
        }
        return null
    }
}