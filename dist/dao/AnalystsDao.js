"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseDao_1 = require("./BaseDao");
class AnalystsDao extends BaseDao_1.default {
    constructor() {
        super();
        /* collections */
        this.fidelityAnalystsCollection = "fidelityAnalysts";
    }
    static getAnalystsDaoInstance() {
        return this.analystsDaoInstance;
    }
    //dataArray is array of objects that look like {symbol:string, score:number, change:number }
    saveFidelityAnalysts(dataArray) {
        return this.batchSaveMultipleDocsInCollectionWithFieldIds(this.fidelityAnalystsCollection, "symbol", dataArray, true);
    }
    getFidelityAnalystsSnapshots() {
        return this.db.collection(this.fidelityAnalystsCollection).get().then(snapshot => {
            if (snapshot && snapshot.docs && snapshot.docs.length) {
                return snapshot.docs;
            }
            return null;
        });
    }
    getFidelityAnalystsData() {
        return this.db.collection(this.fidelityAnalystsCollection).get().then(snapshot => {
            if (snapshot && snapshot.docs && snapshot.docs.length) {
                return snapshot.docs.map(s => s.data());
            }
            return null;
        });
    }
}
exports.default = AnalystsDao;
AnalystsDao.analystsDaoInstance = new AnalystsDao();
//# sourceMappingURL=AnalystsDao.js.map