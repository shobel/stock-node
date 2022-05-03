import BaseDao from "./BaseDao"
import Receipt from "../models/Receipt"
import PremiumTransactionItem from "../models/PremiumTransactionItem"

export default class PremiumTransactionHistoryDao extends BaseDao {

    private premiumTransactionHistoryCollection:string = "premiumTransactionHistory"
    private static premiumTransactionHistoryDaoInstance:PremiumTransactionHistoryDao = new PremiumTransactionHistoryDao()

    constructor() {
        super()
    }

    public static getPremiumTransactionHistoryDaoInstance(){
        return this.premiumTransactionHistoryDaoInstance
    }

    public getTransactionsForUser(userid:string){
        return this.db.collection(this.premiumTransactionHistoryCollection).where("userid", "==", userid).get()
        .then(snapshot => {
            const docs = snapshot.docs
            if (docs.length > 0){
                return docs.map(d => d.data())
            }
            return []
        })
    } 

    public addTransaction(transaction:PremiumTransactionItem){
        return this.db.collection(this.premiumTransactionHistoryCollection).doc(transaction.timestamp.toString()).set(transaction)
        .then(res => res).catch()
    }

}