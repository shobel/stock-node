"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseDao_1 = require("./BaseDao");
const StockDataService_1 = require("../services/StockDataService");
const Utilities_1 = require("../utils/Utilities");
const process_1 = require("process");
class StockDao extends BaseDao_1.default {
    constructor() {
        super();
        /* fields */
        this.companyField = 'company';
        this.newsMetadataField = 'newsMetadata';
        this.newsField = 'news';
        this.scoresField = 'scores';
        // public latestKeyStatsField = 'latestKeyStats'
        this.latestAdvancedStats = 'latestAdvancedStats';
        this.latestAnnualAdvancedStats = 'latestAnnualAdvancedStats';
        this.latestEarnings = 'latestEarnings';
        this.latestAnnualBalanceSheet = 'latestAnnualBalanceSheet';
        this.latestQuarterlyBalanceSheet = 'latestQuarterlyBalanceSheet';
        this.latestAnnualCashFlow = 'latestAnnualCashFlow';
        this.latestQuarterlyCashFlow = 'latestQuarterlyCashFlow';
        this.latestAnnualIncome = 'latestAnnualIncome';
        this.latestQuarterlyIncome = 'latestQuarterlyIncome';
        this.latestPriceTarget = 'latestPriceTarget';
        this.latestRecommendations = 'latestRecommendations';
        this.latestAnnualEstimates = 'latestAnnualEstimates';
        this.institutionalOwnership = 'institutionalOwnership';
        this.insidersField = 'insiders';
        this.latestQuoteField = 'latestQuote';
        this.simplifiedChartField = 'simplifiedChart';
        this.lastEarningsDate = 'lastEarningsDate';
        this.tipranksDataField = 'tipranksAnalysts';
        /* collections */
        this.stockCollection = 'stocks'; //main collection
        this.keyStatsCollection = 'keyStats';
        this.earningsCollection = 'earnings';
        this.advancedStatsCollection = 'advancedStats';
        this.balanceSheetCollection = 'balanceSheets';
        this.cashFlowCollection = 'cashFlows';
        this.incomeCollection = 'incomeStatements';
        this.annualAdvancedStatsCollection = 'annualAdvancedStats';
        this.annualBalanceSheetCollection = 'annualBalanceSheets';
        this.annualCashFlowCollection = 'annualCashFlows';
        this.annualIncomeCollection = 'annualIncomeStatements';
        this.recommendationCollection = 'recommendations';
        // public estimatesCollection = 'estimates'
        this.priceTargetCollection = 'priceTargets';
        this.allCollectionsForStock = ["keyStats", "earnings", "advancedStats", "balanceSheets", "cashFlows", "incomeStatements",
            "annualAdvancedStats", "annualBalanceSheets", "annualCashFlows", "annualIncomeStatements", "recommendations", "priceTargets"];
        //premium collections
        this.brain30SentimentCollection = 'brain30Sentiment';
        this.kScoreCollection = 'kScores';
        this.stocktwitsSentimentCollection = 'stocktwitsSentiment';
        this.brain21RankingCollection = "brain21Ranking";
        this.brainLanguageCollection = "brainLanguage";
        this.precisionAlphaCollection = "precisionAlpha";
        this.crossAssetCollection = "crossAssetModel";
        this.tacticalModelCollection = "tacticalModel";
        //other collections
        this.tipranksTopSymbolsCollection = 'tipranksSymbols';
        this.snapshotCache = {};
        this.incomeGroupCache = {};
        // public balanceSheetGroupCache:any = {}
        this.earningsCache = {};
        this.cashFlowGroupCache = {};
        this.advancedGroupCache = {};
        this.queryLimit = 500;
        this.numSnapped = 0;
        this.numToSnap = 5;
        this.snappingDone = false;
        this.initStartTime = Date.now();
        this.totals = {};
        console.log("init stockdao");
    }
    async initStockSnapshotCaches(caller) {
        this.scheduledUpdateService = caller;
        this.totals[this.stockCollection] = 0;
        this.totals[this.incomeCollection] = 0;
        this.totals[this.earningsCollection] = 0;
        this.totals[this.cashFlowCollection] = 0;
        this.totals[this.advancedStatsCollection] = 0;
        const todayString = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        const year = todayString.split("-")[0];
        const month = todayString.split("-")[1];
        const day = todayString.split("-")[2];
        const cutOffYear5 = parseInt(year) - 5;
        // const cutOffYear2 = parseInt(year) - 2
        // const cutOffDate2 = `${cutOffYear2}-${month}-${day}`
        const cutOffDate5 = `${cutOffYear5}-${month}-${day}`;
        let collectionRef = this.db.collection(this.stockCollection);
        let query = collectionRef.limit(this.queryLimit);
        this.setupCollectionListener(query, collectionRef, this.snapshotCache, false, this.stockCollection);
        let incomeColRef = this.db.collectionGroup(this.incomeCollection).where("id", '>', cutOffDate5);
        let earningsColRef = this.db.collectionGroup(this.earningsCollection).where("id", '>', cutOffDate5);
        let cashflowColRef = this.db.collectionGroup(this.cashFlowCollection).where("id", '>', cutOffDate5);
        let advancedColRef = this.db.collectionGroup(this.advancedStatsCollection).where("id", '>', cutOffDate5);
        this.setupCollectionListener(incomeColRef.limit(this.queryLimit), incomeColRef, this.incomeGroupCache, true, this.incomeCollection);
        this.setupCollectionListener(earningsColRef.limit(this.queryLimit), earningsColRef, this.earningsCache, true, this.earningsCollection);
        this.setupCollectionListener(cashflowColRef.limit(this.queryLimit), cashflowColRef, this.cashFlowGroupCache, true, this.cashFlowCollection);
        this.setupCollectionListener(advancedColRef.limit(this.queryLimit), advancedColRef, this.advancedGroupCache, true, this.advancedStatsCollection);
    }
    setupCollectionListener(query, collectionRef, cache, array, collection) {
        query.onSnapshot(snap => {
            if (snap && snap.docChanges() && snap.docChanges().length) {
                let docChanges = snap.docChanges();
                // console.log(`${collection}: ${docChanges.length} docs snapped`)
                this.totals[collection] += docChanges.length;
                for (let docChange of docChanges) {
                    let doc = docChange.doc;
                    if (array) {
                        let symbol = doc.ref.parent.parent.id;
                        if (!cache.hasOwnProperty(symbol)) {
                            cache[symbol] = [];
                        }
                        let found = false;
                        for (let i = 0; i < cache[symbol].length; i++) {
                            let item = cache[symbol][i];
                            if (item.id == doc.id) {
                                cache[symbol][i] = doc;
                                found = true;
                            }
                        }
                        if (!found) {
                            cache[symbol].unshift(doc.data());
                        }
                    }
                    else {
                        cache[doc.id] = doc;
                    }
                }
                if (!this.snappingDone) {
                    let currentDoc = docChanges[docChanges.length - 1].doc;
                    let query = collectionRef.startAfter(currentDoc).limit(this.queryLimit);
                    this.setupCollectionListener(query, collectionRef, cache, array, collection);
                }
            }
            else {
                console.log(`DONE SNAPPING ${collection}: ${this.totals[collection]} docs`);
                console.log(process_1.memoryUsage());
                this.numSnapped += 1;
                if (this.numSnapped >= this.numToSnap) {
                    this.snappingDone = true;
                    console.log(`Done snapping all collections in ${(Date.now() - this.initStartTime) / 60000}mins`);
                    this.scheduledUpdateService.initRest();
                }
            }
        }, (error) => {
            console.log(error);
        });
    }
    async initCollectionCache(cache, collectionRef, array) {
        const todayString = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        const year = todayString.split("-")[0];
        const month = todayString.split("-")[1];
        const day = todayString.split("-")[2];
        const cutOffYear5 = parseInt(year) - 5;
        // const cutOffYear2 = parseInt(year) - 2
        // const cutOffDate2 = `${cutOffYear2}-${month}-${day}`
        const cutOffDate5 = `${cutOffYear5}-${month}-${day}`;
        // await this.db.collection(collection).onSnapshot(snap => {
        //     for (let docSnap of snap.docs) {
        //         if (array) {
        //             if (!cache.hasOwnProperty(docSnap.id)){
        //                 cache[docSnap.id] = []                    
        //             }
        //             cache[docSnap.id].push(docSnap)
        //         } else {
        //             cache[docSnap.id] = docSnap
        //         }
        //     }
        // })
        // const limit = 1000
        // let docSnaps:any[]
        // let querySnapshot:any
        // let query = collectionRef.limit(limit)
        // let docsRetrieved = 0
        // do {
        //     querySnapshot = await query.get()
        //     docSnaps = querySnapshot.docs
        //     docsRetrieved += docSnaps.length
        //     console.log(`got ${docsRetrieved} for ${collection}`)
        //     for (const docSnap of docSnaps) {
        //         if (array) {
        //             let symbol = docSnap.ref.parent.parent.id
        //             if (!cache.hasOwnProperty(symbol)){
        //                 cache[symbol] = []                    
        //             }
        //             let found = false
        //             for (let i = 0; i < cache[symbol].length; i++){
        //                 let item = cache[symbol][i]
        //                 if (item.id == docSnap.id){
        //                     cache[symbol][i] = docSnap
        //                     found = true
        //                 }
        //             }
        //             if (!found){
        //                 cache[symbol].unshift(docSnap.data())
        //             }
        //         } else {
        //             cache[docSnap.id] = docSnap
        //         }
        //     }
        //     if (docSnaps.length > 0) {
        //         // Get the last visible document
        //         query = collectionRef.startAfter(docSnaps[docSnaps.length - 1]).limit(limit);
        //     }
        // } while (docSnaps.length > 0);
        // console.log(`cache for ${collection} populated`)
        // await this.db.collection(collection).get().then(snapshot => {
        //     for (let docSnap of snapshot.docs) {
        //         if (array) {
        //             if (!cache.hasOwnProperty(docSnap.id)){
        //                 cache[docSnap.id] = []                    
        //             }
        //             cache[docSnap.id].push(docSnap)
        //         } else {
        //             cache[docSnap.id] = docSnap
        //         }
        //     }
        //     console.log(`cache for ${collection} populated`)
        // }).catch(err => {
        //     console.log(err)
        // })
    }
    async deleteEmptySymbolDocs() {
        let stockRefsToDelete = [];
        let symbolsToDelete = [];
        for (let [k, v] of Object.entries(this.snapshotCache)) {
            if (v) {
                let value = v;
                let companyField = value.get(this.companyField);
                if (!companyField || !companyField.symbol || companyField.symbol == "") {
                    stockRefsToDelete.push(value.ref);
                    symbolsToDelete.push(value.id);
                }
            }
        }
        for (let s of symbolsToDelete) {
            for (let col of this.allCollectionsForStock) {
                let colRef = await this.db.collection(this.stockCollection).doc(s).collection(col).get();
                for (let doc of colRef.docs) {
                    stockRefsToDelete.push(doc.ref);
                }
            }
        }
        if (stockRefsToDelete.length) {
            console.log(`deleting ${stockRefsToDelete.length} docs for these symbols`);
            await this.batchDelete(stockRefsToDelete);
        }
    }
    static getStockDaoInstance() {
        return this.stockDaoInstance;
    }
    getAllSymbols() {
        return Object.keys(this.snapshotCache);
    }
    createNewStockDocuments(symbols) {
        return new Promise((resolve, reject) => {
            const batchItems = [];
            const collectionRef = this.db.collection(this.stockCollection);
            for (const symbol of symbols) {
                const stockRef = collectionRef.doc(symbol.toUpperCase());
                const batchItem = {
                    documentRef: stockRef,
                    data: {}
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
    editFieldTest(s) {
        return this.db.collection(this.stockCollection).doc("FB").set({
            company: {
                test: s
            }
        }, { merge: true });
    }
    batchSaveCompanyLogoPeers(dataArr) {
        const batchUpdateItems = [];
        const collectionRef = this.db.collection(this.stockCollection);
        for (const item of dataArr) {
            const docRef = collectionRef.doc(item.symbol);
            const batchUpdateItem = {
                documentRef: docRef,
                data: { company: item }
            };
            batchUpdateItems.push(batchUpdateItem);
        }
        if (batchUpdateItems.length > 0) {
            return this.batchSet(batchUpdateItems, true);
        }
        else {
            return true;
        }
    }
    getTopXCompaniesByMarketCap(x) {
        return this.db.collection(this.stockCollection).orderBy("keystats.marketcap", "desc").limit(x).get()
            .then(snapshot => {
            return snapshot.docs.map(doc => doc.id);
        }).catch();
    }
    getBottomXCompaniesByMarketCap(x) {
        return this.db.collection(this.stockCollection).orderBy("keystats.marketcap", "asc").limit(x).get()
            .then(snapshot => {
            return snapshot.docs.map(doc => doc.id);
        }).catch();
    }
    getAllSymbolsByDaysSinceLastEarnings(daysSinceLastEarningsThreshold) {
        const todayString = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        return this.db.collection(this.stockCollection).orderBy(this.lastEarningsDate, 'asc')
            .get().then(snapshot => {
            if (snapshot.empty) {
                return {};
            }
            const symbolsMatch = {};
            for (const doc of snapshot.docs) {
                const lastEarningsDate = doc.get(StockDao.getStockDaoInstance().lastEarningsDate);
                const daysSinceLastEarnings = Utilities_1.default.countDaysBetweenDateStrings(todayString, lastEarningsDate);
                if (daysSinceLastEarnings > daysSinceLastEarningsThreshold) {
                    symbolsMatch[doc.id] = lastEarningsDate;
                }
                else {
                    break;
                }
            }
            return symbolsMatch;
        });
    }
    // public getAllSymbolsThatReportEarningsOnDate(datestring:string){
    //     return this.db.collection(this.stockCollection).where(`${this.latestKeyStatsField}.nextEarningsDate`, '==', datestring)
    //         .get().then(snapshot => {
    //             if (snapshot.empty) {
    //                 return [];
    //             }
    //             return snapshot.docs.map(doc => doc.id)
    //         })
    // }
    batchSaveKeyStats(keystats, dateKey) {
        return new Promise((resolve, reject) => {
            const batchUpdateItems = [];
            const collectionRef = this.db.collection(this.stockCollection);
            for (const symbol of Object.keys(keystats)) {
                if (!keystats.hasOwnProperty(symbol) || !keystats[symbol]) {
                    continue;
                }
                const stockRef = collectionRef.doc(symbol.toUpperCase());
                const keystatsRef = stockRef.collection(this.keyStatsCollection).doc(dateKey);
                const batchUpdateItem1 = {
                    documentRef: stockRef,
                    data: { "latestKeyStats": StockDataService_1.default.convertIexKeystatsToSimplifiedKeystats(keystats[symbol]) }
                };
                const batchUpdateItem2 = {
                    documentRef: keystatsRef,
                    data: StockDataService_1.default.convertIexKeystatsToSimplifiedKeystats(keystats[symbol])
                };
                batchUpdateItems.push(batchUpdateItem1);
                batchUpdateItems.push(batchUpdateItem2);
            }
            this.batchSet(batchUpdateItems, true).then(result => {
                console.log("finished batch saving key stats");
                resolve();
            }).catch();
        });
    }
    setTipranksDataForSymbol(symbol, tipranksData) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).update({
            [this.tipranksDataField]: {
                "updated": Date.now(),
                "data": tipranksData
            }
        }).then(snapshot => {
            return snapshot;
        }).catch();
    }
    getTipranksDataForSymbol(symbol) {
        let doc = this.snapshotCache[symbol.toUpperCase()];
        return doc === null || doc === void 0 ? void 0 : doc.get(this.tipranksDataField);
    }
    getTipranksTopAnalystsForSymbol(symbol) {
        return this.db.collection(this.tipranksTopSymbolsCollection).where('symbol', '==', symbol.toUpperCase()).get()
            .then(snapshot => {
            if (snapshot.docs && snapshot.docs.length > 0) {
                return snapshot.docs[0].data();
            }
            return null;
        });
    }
    getTipranksTopAnalystsSymbolsCollectionRef() {
        return this.db.collection(this.tipranksTopSymbolsCollection).get();
    }
    /*** GENERIC FUNCTIONS ***/
    /******************************/
    /************ GET *************/
    /******************************/
    getDocumentsFromCollectionGroupWithDateCriteria(collectionName, idField, dateCutOff, dateSign) {
        const annualBalanceSheets = this.db.collectionGroup(collectionName).where(idField, dateSign === ">" ? '>' : '<', dateCutOff)
            .orderBy(idField, 'asc');
        return annualBalanceSheets.get().then(snapshot => {
            const returnObj = {};
            for (const doc of snapshot.docs) {
                const ref = doc.ref;
                const symbol = ref.parent.parent.id;
                if (!returnObj.hasOwnProperty(symbol)) {
                    returnObj[symbol] = [];
                }
                returnObj[symbol].push(doc.data());
            }
            console.log();
            return returnObj;
        }).catch();
    }
    getDocFromSubCollectionForSymbol(symbol, subCollection, docId) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(subCollection).doc(docId).get()
            .then(result => {
            return result.data();
        }).catch();
    }
    /* when the document ids are the date string, this returns the most recent doc from a subcollection */
    getMostRecentDocFromSubCollectionForSymbol(symbol, subCollection) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(subCollection)
            .limit(1).orderBy('id', 'desc').get().then(snapshot => {
            const docs = snapshot.docs;
            if (docs && docs.length > 0) {
                const data = docs[0].data();
                return data;
            }
            return null;
        });
    }
    /**
     * when the document ids are the date string or timestamp, this returns the most recent ${limit} docs from a subcollection
     * limit: any number or the string 'all'
     **/
    getMostRecentDocsFromSubCollectionForSymbol(symbol, subCollection, limit) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(subCollection)
            .limit(parseInt(limit)).orderBy('id', 'desc').get().then(snapshot => {
            const docs = snapshot.docs;
            const returnDocs = [];
            if (docs && docs.length > 0) {
                if (limit === "all") {
                    return docs;
                }
                for (let i = 0; i < parseInt(limit); i++) {
                    if (docs[i]) {
                        returnDocs.push(docs[i].data());
                    }
                }
            }
            return returnDocs;
        });
    }
    getStockDocumentSnapshotForSymbol(symbol) {
        return this.snapshotCache[symbol];
    }
    getAllStockDocumentSnapshots() {
        return Object.values(this.snapshotCache);
    }
    getStockDocumentFieldForSymbol(symbol, field) {
        let doc = this.snapshotCache[symbol.toUpperCase()];
        return doc.get(field);
    }
    getStockDocumentFieldForSymbols(symbols, field) {
        const symbolsUpper = symbols.map(s => s.toUpperCase());
        let snapshots = Object.values(this.snapshotCache).filter((o) => symbolsUpper.includes(o.id));
        const returnMap = {};
        let doc;
        for (doc of snapshots) {
            returnMap[doc.id] = doc.get(field);
        }
        return returnMap;
    }
    getStockDocumentFieldForAllSymbols(field) {
        let snapshots = Object.values(this.snapshotCache);
        return snapshots.map((doc) => doc.get(field)).filter(item => item);
    }
    getStockDocumentForAllSymbols() {
        let snapshots = Object.values(this.snapshotCache);
        return Object.values(snapshots).map((doc) => doc.data()).filter(item => item);
    }
    //if no symbols are provided, will get for all symbols
    getStockDocumentFieldsForSymbols(fields, symbols = []) {
        let snapshots = [];
        if (symbols.length) {
            for (let symbol of symbols) {
                if (this.snapshotCache[symbol]) {
                    snapshots.push(this.snapshotCache[symbol]);
                }
            }
        }
        else {
            snapshots = Object.values(this.snapshotCache);
        }
        let returnData = [];
        for (let doc of snapshots) {
            let returnObj = {};
            for (let field of fields) {
                returnObj[field] = doc.get(field);
            }
            returnData.push(returnObj);
        }
        return returnData;
    }
    /******************************/
    /************ SAVE ************/
    /******************************/
    /* adds the lastUpdated timestamp automatically */
    saveStockDocumentFieldForSymbol(symbol, field, data) {
        return new Promise((resolve, reject) => {
            if (field) {
                if (typeof data === 'object' && data !== null) {
                    data.lastUpdated = Date.now();
                }
                this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).update({ [field]: data })
                    .then(result => {
                    resolve(result);
                })
                    .catch(error => {
                    resolve(false);
                });
            }
            else {
                reject(false);
            }
        });
    }
    /* saves a document with id of 'key' and data of 'data' into subcollection */
    /* will add an id field that is the same as the document id (key) */
    saveDocInSubcollectionForSymbol(symbol, subCollection, key, data) {
        data.id = key;
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(subCollection)
            .doc(key).set(data).then(result => {
            return data;
        }).catch(err => {
            return err;
        });
    }
}
exports.default = StockDao;
StockDao.stockDaoInstance = new StockDao();
//# sourceMappingURL=StockDao.js.map