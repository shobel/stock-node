import UserDao from "../dao/UserDao";
import Receipt from "../models/Receipt";
import ReceiptDao from "../dao/ReceiptDao";
import AppleService from "../services/AppleService";
import AppDao from "../dao/AppDao";

export default class UserManager {
    private static appleService:AppleService = new AppleService()

    public static createNewUser(userid:string, email:string){
        return UserDao.getUserDaoInstance().createUserDocument(userid, email).then(result => result).catch()
    }

    public static getWatchlistForUser(userid:string){
        return UserDao.getUserDaoInstance().getWatchlistForUser(userid)
    }

    public static async addToWatchlist(userid:string, symbol:string){
        let newWatchlist:string[] = []
        let watchlist = UserDao.getUserDaoInstance().getWatchlistForUser(userid)
      
        newWatchlist = watchlist ? watchlist : []
        if (!newWatchlist.includes(symbol)){
            newWatchlist.push(symbol)
            return await UserDao.getUserDaoInstance().saveWatchlistForUser(userid, newWatchlist)
        }
        return null
    }
    
    public static async removeFromWatchlist(userid:string, symbol:string){
        let watchlist = UserDao.getUserDaoInstance().getWatchlistForUser(userid)
        if (watchlist && watchlist.includes(symbol)){
            const newWatchlist = watchlist.filter(s => s !== symbol)
            return await UserDao.getUserDaoInstance().saveWatchlistForUser(userid, newWatchlist)
        }
        return null
    }

    public static setUserScoreSettings(userId:string, settings:any){
        return UserDao.getUserDaoInstance().setUserScoreSettings(userId, settings)
    }

    public static getUserScoreSettings(userid:string){
        return UserDao.getUserDaoInstance().getUserScoreSettings(userid).then(s => {
            let settings = s
            if (!settings) {
                settings = {}
            }
            if (!settings.disabled) {
                settings.disabled = []
            }
            if (!settings.weightings) {
                settings.weightings = {
                    valuation: 25,
                    future: 25,
                    past: 25,
                    health: 25,
                }
            }
            return settings
        })
    }

    public static handlePurchase(receiptCode:string, userid:string, productid:string){
        return UserManager.appleService.verifyReceipt(receiptCode).then(result1 => {
            return UserManager.appleService.getTransactionIdFromReceiptForProduct(result1, productid)
        }).then(tid => {
            if (tid) {
                return ReceiptDao.getReceiptDaoInstance().getReceiptByTransactionId(tid).then(foundTid => {
                    if (foundTid) {
                        //error: the transaction has been already serviced
                        return null
                    } else {
                        let receipt:Receipt = {
                            transactionid: tid, 
                            userid: userid, 
                            productid: productid, 
                            status: "complete",
                            timestamp: Date.now()
                        }
                        return ReceiptDao.getReceiptDaoInstance().addReceipt(receipt)      
                    }
                })
            }
            //error: the receipt provided does not contain any transaction
            return null
        }).then(addReceiptResult => {
            if (addReceiptResult) {
                return AppDao.getAppDaoInstance().getProductById(productid)
            }
            return null
        }).then(res => {
            if (res) {
                return UserManager.giveOrTakeCreditsToUser(userid, res.credits)
            }
            return null
        }).then(write => {
            if (write) {
                return UserManager.getCreditsForUser(userid)
            }
            return null
        }).catch()
    }

    public static giveOrTakeCreditsToUser(userid:string, credits:number){
        return UserDao.getUserDaoInstance().incrementCreditsForUser(userid, credits)
    }

    public static getCreditsForUser(userid:string){
        return UserDao.getUserDaoInstance().getCreditsForUser(userid)
    }

    public static async getReceiptsForUser(userid:string) {
        let receipts = await ReceiptDao.getReceiptDaoInstance().getReceiptsForUser(userid)
        let products = await AppDao.getAppDaoInstance().getProducts()
        for (let receipt of receipts) {
            for (let product of products){
                if (receipt.productid == product.id){
                    receipt.product = product
                    break
                }
            }
        }
        return receipts
    }

}