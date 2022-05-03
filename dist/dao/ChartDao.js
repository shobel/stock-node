"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseDao_1 = require("./BaseDao");
class ChartDao extends BaseDao_1.default {
    constructor() {
        super();
        //top level collections
        this.stockCollection = 'stocks';
        this.intradayPriceDataCollection = 'intradayPriceData';
        //subcollections of stocks
        this.dailyPriceDataCollection = 'dailyPriceData';
    }
    static getChartDaoInstance() {
        return this.chartDaoInstance;
    }
    getDailyPriceDataCollectionName() {
        return this.dailyPriceDataCollection;
    }
    getPriceData(symbol, collection) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(collection).get()
            .then(snapshot => {
            return snapshot.docs.map(doc => doc.data());
        });
    }
    getPriceDataWithLimit(symbol, collection, limit) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(collection)
            .limit(limit).orderBy('date', 'desc').get().then(snapshot => {
            return snapshot.docs.map(doc => doc.data());
        }).catch();
    }
    setPriceData(symbol, priceData, collection) {
        return this.batchSaveMultipleDocsInCollectionRefWithFieldIds(this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(collection), "date", priceData, true);
    }
    saveChartEntry(symbol, chartEntry, collection) {
        const chartRef = this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(collection).doc(chartEntry.date);
        return chartRef.set(chartEntry).then(result => {
            // console.log(`${symbol} date: ${chartEntry.date} earnings: ${chartEntry.earnings}`)
            return result;
        });
    }
    deleteChartEntry(symbol, chartEntry, collection) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(collection).doc(chartEntry.date)
            .delete().then(result => result).catch(error => error);
    }
    addEarningsToChartEntry(symbol, collection, date) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(collection)
            .where("date", ">=", date).limit(1).get().then(snapshot => {
            const docs = snapshot.docs;
            if (docs.length > 0) {
                const docRef = docs[0];
                const docData = docRef.data();
                docData.earnings = true;
                // console.log(`setting earnings to true for ${collection} chart item for ${symbol} with date ${docData.date}`)
                return docRef.ref.set(docData, { merge: true }).then(result => result).catch(err => console.error(err));
            }
            return null;
        }).catch(err => console.error(err));
    }
    createNewStockDocuments(symbols) {
        return new Promise((resolve, reject) => {
            const batchItems = [];
            const collectionRef = this.db.collection(this.intradayPriceDataCollection);
            for (const symbol of symbols) {
                const stockRef = collectionRef.doc(symbol.toUpperCase());
                const batchItem = {
                    documentRef: stockRef,
                    data: {
                        numMinutes: 0,
                        intradayPrices: [],
                        fetchedFullDataset: false
                    }
                };
                batchItems.push(batchItem);
            }
            if (batchItems.length > 0) {
                return this.batchSet(batchItems, false).then(result => resolve()).catch();
            }
            else {
                return Promise.resolve();
            }
        });
    }
    getIntradayPriceObject(symbol) {
        return this.db.collection(this.intradayPriceDataCollection).doc(symbol.toUpperCase()).get()
            .then(doc => {
            const data = doc.data();
            return data;
        });
    }
    saveIntradayPriceObjectForSymbol(symbol, intradayPriceObject) {
        return this.db.collection(this.intradayPriceDataCollection).doc(symbol.toUpperCase())
            .set(intradayPriceObject).then(() => intradayPriceObject.intradayPrices);
    }
    resetAllIntradayCharts() {
        return this.db.collection(this.intradayPriceDataCollection).where('numMinutes', '>', 0)
            .get().then(snapshot => {
            const batchItems = [];
            const docs = snapshot.docs;
            for (const doc of docs) {
                const data = doc.data();
                data.numMinutes = 0;
                data.intradayPrices = [];
                data.fetchedFullDataset = false;
                const batchItem = {
                    documentRef: doc.ref,
                    data: data
                };
                batchItems.push(batchItem);
            }
            if (batchItems.length > 0) {
                return this.batchUpdate(batchItems);
            }
            else {
                return null;
            }
        });
    }
    batchSaveDocuments(symbol, subCollection, docDatas) {
        return new Promise((resolve, reject) => {
            const batchItems = [];
            const collectionRef = this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(subCollection);
            for (const docData of docDatas) {
                const stockRef = collectionRef.doc(docData.date);
                const batchItem = {
                    documentRef: stockRef,
                    data: docData
                };
                batchItems.push(batchItem);
            }
            this.batchSet(batchItems, false).then(result => resolve()).catch();
        });
    }
}
exports.default = ChartDao;
ChartDao.chartDaoInstance = new ChartDao();
//# sourceMappingURL=ChartDao.js.map