"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UserDao_1 = require("../dao/UserDao");
const ReceiptDao_1 = require("../dao/ReceiptDao");
const AppleService_1 = require("../services/AppleService");
const AppDao_1 = require("../dao/AppDao");
class UserManager {
    static createNewUser(userid, email) {
        return UserDao_1.default.getUserDaoInstance().createUserDocument(userid, email).then(result => result).catch();
    }
    static getWatchlistForUser(userid) {
        return UserDao_1.default.getUserDaoInstance().getWatchlistForUser(userid);
    }
    static async addToWatchlist(userid, symbol) {
        let newWatchlist = [];
        let watchlist = UserDao_1.default.getUserDaoInstance().getWatchlistForUser(userid);
        newWatchlist = watchlist ? watchlist : [];
        if (!newWatchlist.includes(symbol)) {
            newWatchlist.push(symbol);
            return await UserDao_1.default.getUserDaoInstance().saveWatchlistForUser(userid, newWatchlist);
        }
        return null;
    }
    static async removeFromWatchlist(userid, symbol) {
        let watchlist = UserDao_1.default.getUserDaoInstance().getWatchlistForUser(userid);
        if (watchlist && watchlist.includes(symbol)) {
            const newWatchlist = watchlist.filter(s => s !== symbol);
            return await UserDao_1.default.getUserDaoInstance().saveWatchlistForUser(userid, newWatchlist);
        }
        return null;
    }
    static setUserScoreSettings(userId, settings) {
        return UserDao_1.default.getUserDaoInstance().setUserScoreSettings(userId, settings);
    }
    static getUserScoreSettings(userid) {
        return UserDao_1.default.getUserDaoInstance().getUserScoreSettings(userid).then(s => {
            let settings = s;
            if (!settings) {
                settings = {};
            }
            if (!settings.disabled) {
                settings.disabled = [];
            }
            if (!settings.weightings) {
                settings.weightings = {
                    valuation: 20,
                    future: 20,
                    past: 20,
                    health: 20,
                };
            }
            return settings;
        });
    }
    static handlePurchase(receiptCode, userid, productid) {
        return UserManager.appleService.verifyReceipt(receiptCode).then(result1 => {
            return UserManager.appleService.getTransactionIdFromReceiptForProduct(result1, productid);
        }).then(tid => {
            if (tid) {
                return ReceiptDao_1.default.getReceiptDaoInstance().getReceiptByTransactionId(tid).then(foundTid => {
                    if (foundTid) {
                        //error: the transaction has been already serviced
                        return null;
                    }
                    else {
                        let receipt = {
                            transactionid: tid,
                            userid: userid,
                            productid: productid,
                            status: "complete",
                            timestamp: Date.now()
                        };
                        return ReceiptDao_1.default.getReceiptDaoInstance().addReceipt(receipt);
                    }
                });
            }
            //error: the receipt provided does not contain any transaction
            return null;
        }).then(addReceiptResult => {
            if (addReceiptResult) {
                return AppDao_1.default.getAppDaoInstance().getProductById(productid);
            }
            return null;
        }).then(res => {
            if (res) {
                return UserManager.giveOrTakeCreditsToUser(userid, res.credits);
            }
            return null;
        }).then(write => {
            if (write) {
                return UserManager.getCreditsForUser(userid);
            }
            return null;
        }).catch();
    }
    static giveOrTakeCreditsToUser(userid, credits) {
        return UserDao_1.default.getUserDaoInstance().incrementCreditsForUser(userid, credits);
    }
    static getCreditsForUser(userid) {
        return UserDao_1.default.getUserDaoInstance().getCreditsForUser(userid);
    }
    static async getReceiptsForUser(userid) {
        let receipts = await ReceiptDao_1.default.getReceiptDaoInstance().getReceiptsForUser(userid);
        let products = await AppDao_1.default.getAppDaoInstance().getProducts();
        for (let receipt of receipts) {
            for (let product of products) {
                if (receipt.productid == product.id) {
                    receipt.product = product;
                    break;
                }
            }
        }
        return receipts;
    }
}
exports.default = UserManager;
UserManager.appleService = new AppleService_1.default();
//# sourceMappingURL=UserManager.js.map