"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseDao_1 = require("./BaseDao");
class PremiumTransactionHistoryDao extends BaseDao_1.default {
    constructor() {
        super();
        this.premiumTransactionHistoryCollection = "premiumTransactionHistory";
    }
    static getPremiumTransactionHistoryDaoInstance() {
        return this.premiumTransactionHistoryDaoInstance;
    }
    getTransactionsForUser(userid) {
        return this.db.collection(this.premiumTransactionHistoryCollection).where("userid", "==", userid).get()
            .then(snapshot => {
            const docs = snapshot.docs;
            if (docs.length > 0) {
                return docs.map(d => d.data());
            }
            return [];
        });
    }
    addTransaction(transaction) {
        return this.db.collection(this.premiumTransactionHistoryCollection).doc(transaction.timestamp.toString()).set(transaction)
            .then(res => res).catch();
    }
}
exports.default = PremiumTransactionHistoryDao;
PremiumTransactionHistoryDao.premiumTransactionHistoryDaoInstance = new PremiumTransactionHistoryDao();
//# sourceMappingURL=PremiumTransactionHistoryDao.js.map