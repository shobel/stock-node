import BaseDao from "./BaseDao"
import Receipt from "../models/Receipt"

export default class ReceiptDao extends BaseDao {

    private receiptCollection:string = "receipt"

    private static receiptDaoInstance:ReceiptDao = new ReceiptDao()

    constructor() {
        super()
    }

    public static getReceiptDaoInstance(){
        return this.receiptDaoInstance
    }

    public getReceiptsForUser(userid:string){
        return this.db.collection(this.receiptCollection).where("userid", "==", userid).get()
        .then(snapshot => {
            const docs = snapshot.docs
            if (docs.length > 0){
                return docs.map(d => d.data())
            }
            return []
        })
    } 

    public getReceiptByTransactionId(transactionid:string) {
        return this.db.collection(this.receiptCollection).where("transactionid", "==", transactionid).get()
        .then(snapshot => {
            const docs = snapshot.docs
            if (docs.length > 0){
                return docs[0]
            }
            return null
        })
    }

    public addReceipt(receipt:Receipt){
        return this.db.collection(this.receiptCollection).doc(receipt.transactionid).set(receipt)
        .then(res => res).catch()
    }

}