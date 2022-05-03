"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseDao_1 = require("./BaseDao");
const Utilities_1 = require("../utils/Utilities");
class MarketDao extends BaseDao_1.default {
    constructor() {
        super();
        //main market collection
        this.marketCollection = 'market';
        //market docs
        this.economyDoc = 'economy';
        this.newsDoc = 'news';
        this.sectorPerformanceDoc = 'sectorPerformance';
        this.generalDoc = "general";
        this.top10Doc = "top10";
        //top10 fields
        this.gainersField = "gainers";
        this.losersField = "losers";
        this.activeField = "mostactive";
        this.holidaysDoc = "holidays";
        this.lastUpdatedTipranksAnalysts = "lastUpdatedTipranksAnalysts";
        //economy collections (top-level)
        this.economicDataCollectionWeekly = 'economicDataWeekly';
        this.economicDataCollectionMonthly = 'economicDataMonthly';
        this.economicDataCollectionQuarterly = 'economicDataQuarterly';
        //stocktwits collection (top-level)
        this.stocktwitsTrendingCollection = "stocktwitsTrending";
        //tipranks collection (top-leve)
        this.tipranksTopAnalystsCollection = "tipranksAnalysts";
        //tipranks docs
        this.tipranksTopSymbolsCollection = "tipranksSymbols";
    }
    static getMarketDaoInstance() {
        return this.marketDaoInstance;
    }
    getSectorPerformances() {
        return this.db.collection(this.marketCollection).doc(this.sectorPerformanceDoc).get()
            .then(snapshot => {
            return snapshot.data();
        });
    }
    // data should be a list of IEX performance objects
    saveSectorPerformances(data) {
        const savedObject = {};
        for (const p of data) {
            savedObject[p.name] = p;
        }
        return this.db.collection(this.marketCollection).doc(this.sectorPerformanceDoc).set(savedObject)
            .then(result => result);
    }
    getFearGreed() {
        return this.db.collection(this.marketCollection).doc(this.generalDoc).get().then(doc => {
            const data = doc.data();
            return data ? data.fearGreed : null;
        });
    }
    setFearGreed(fearGreed) {
        return this.db.collection(this.marketCollection).doc(this.generalDoc).set({
            fearGreed: fearGreed
        }, { merge: true });
    }
    isAnyEconomicData(subCollection) {
        return this.db.collection(subCollection).limit(1).get().then(snapshot => {
            if (!snapshot || !snapshot.docs || !snapshot.docs.length) {
                return false;
            }
            return true;
        });
    }
    getLatestEconomicData(subCollection) {
        return this.db.collection(subCollection)
            .limit(1).orderBy('id', 'desc').get().then(snapshot => {
            const docs = snapshot.docs;
            if (docs && docs.length > 0) {
                const data = docs[0].data();
                return data;
            }
            return null;
        });
    }
    getEconomicData(subCollection, numDocs) {
        return this.db.collection(subCollection)
            .limit(numDocs).orderBy('id', 'desc').get().then(snapshot => {
            const docs = snapshot.docs;
            const ret = [];
            if (docs && docs.length > 0) {
                for (const doc of docs) {
                    ret.push(doc.data());
                }
                return ret;
            }
            return ret;
        });
    }
    saveEconomicData(collection, datekey, data) {
        data.id = datekey;
        return this.db.collection(collection).doc(datekey).set(data).then(result => result)
            .catch(err => {
            console.log(err);
        });
    }
    setTodayWasATradingDay(todayWasATradingDay) {
        return this.db.collection(this.marketCollection).doc(this.generalDoc).set({
            todayWasATradingDay: todayWasATradingDay,
            date: Utilities_1.default.convertUnixTimestampToDateString(Date.now())
        }, { merge: true }).catch(er => {
            console.log(`could not set todayWasATradingDay because -- ${er}`);
        });
    }
    getTodayWasATradingDay() {
        return this.db.collection(this.marketCollection).doc(this.generalDoc).get()
            .then(snapshot => {
            const data = snapshot.get('todayWasATradingDay');
            return data != null && data;
        });
    }
    setLastUpdatedTipranksAnalysts(timestamp) {
        return this.db.collection(this.marketCollection).doc(this.generalDoc).set({
            lastUpdatedTipranksAnalysts: timestamp,
        }, { merge: true }).catch(er => {
            console.log(`could not set todayWasATradingDay because -- ${er}`);
        });
    }
    getLastUpdatedTipranksAnalysts() {
        return this.db.collection(this.marketCollection).doc(this.generalDoc).get()
            .then(snapshot => {
            return snapshot.get(this.lastUpdatedTipranksAnalysts);
        });
    }
    getMarketNews() {
        return this.db.collection(this.marketCollection).doc(this.newsDoc).get()
            .then((result) => {
            const data = result.data();
            if (data.news) {
                return data.news;
            }
            return null;
        });
    }
    getAllTop10() {
        return this.db.collection(this.marketCollection).doc(this.top10Doc).get()
            .then(result => result.data()).catch();
    }
    getTop10Field(field) {
        return this.db.collection(this.marketCollection).doc(this.top10Doc).get()
            .then(result => result ? result[field] : result).catch();
    }
    saveTop10Field(field, data) {
        return this.db.collection(this.marketCollection).doc(this.top10Doc).set({
            [field]: data
        }, { merge: true }).then(result => result).catch();
    }
    getStocktwitsTrending() {
        return this.db.collection(this.stocktwitsTrendingCollection).get()
            .then(snapshot => {
            return snapshot.docs.map(doc => doc.data());
        }).catch();
    }
    saveStocktwitsTrending(trendingData) {
        const messages = trendingData;
        for (const m of messages) {
            m.timestamp = new Date(m.created_at).getTime();
        }
        const sorted = Utilities_1.default.sortArrayOfObjectsByNumericalFieldDesc("timestamp", messages);
        return this.batchSaveMultipleDocsInCollectionWithNumberedDocumentIds(this.stocktwitsTrendingCollection, sorted);
    }
    saveTipranksAnalystsDocuments(analysts) {
        return this.batchSaveMultipleDocsInCollectionWithFieldIds(this.tipranksTopAnalystsCollection, "name", analysts, false);
    }
    saveTipranksSymbolsDocuments(symbols) {
        return this.batchSaveMultipleDocsInCollectionWithFieldIds(this.tipranksTopSymbolsCollection, "symbol", symbols, false);
    }
    getTipranksTopAnalysts() {
        return this.getAllDocsInCollection(this.tipranksTopAnalystsCollection);
    }
    getTipranksTopAnalystsNames() {
        return this.getAllDocIdsInCollection(this.tipranksTopAnalystsCollection);
    }
    getTipranksTopSymbols() {
        return this.getAllDocSnapshotsInCollection(this.tipranksTopSymbolsCollection);
    }
    deleteTipranksTopAnalystCollection() {
        return this.deleteAllDocumentsInCollection(this.tipranksTopAnalystsCollection);
    }
    deleteTipranksTopSymbolsCollection() {
        return this.deleteAllDocumentsInCollection(this.tipranksTopSymbolsCollection);
    }
}
exports.default = MarketDao;
MarketDao.marketDaoInstance = new MarketDao();
//# sourceMappingURL=MarketDao.js.map