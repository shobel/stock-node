"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseDao_1 = require("./BaseDao");
class ReceiptDao extends BaseDao_1.default {
    constructor() {
        super();
        this.receiptCollection = "receipt";
    }
    static getReceiptDaoInstance() {
        return this.receiptDaoInstance;
    }
    getReceiptsForUser(userid) {
        return this.db.collection(this.receiptCollection).where("userid", "==", userid).get()
            .then(snapshot => {
            const docs = snapshot.docs;
            if (docs.length > 0) {
                return docs.map(d => d.data());
            }
            return [];
        });
    }
    getReceiptByTransactionId(transactionid) {
        return this.db.collection(this.receiptCollection).where("transactionid", "==", transactionid).get()
            .then(snapshot => {
            const docs = snapshot.docs;
            if (docs.length > 0) {
                return docs[0];
            }
            return null;
        });
    }
    addReceipt(receipt) {
        return this.db.collection(this.receiptCollection).doc(receipt.transactionid).set(receipt)
            .then(res => res).catch();
    }
}
exports.default = ReceiptDao;
ReceiptDao.receiptDaoInstance = new ReceiptDao();
//# sourceMappingURL=ReceiptDao.js.map