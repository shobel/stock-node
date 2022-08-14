import BaseDao from './BaseDao';
import IexAdjustedDailyBar from '../models/IexAdjustedDailyBar';
import BatchItem from './BatchItem';
import StockDataService from '../services/StockDataService';
import Utilities from '../utils/Utilities';
import SimpleQuote from '../models/SimpleQuote';
import { QueryDocumentSnapshot } from 'firebase-functions/v1/firestore';
import ScheduledUpdateService from '../services/ScheduledUpdateService';
import { memoryUsage } from 'process';

export default class StockDao extends BaseDao {

    /* fields */
    public companyField = 'company'
    public newsMetadataField = 'newsMetadata'
    public newsField = 'news'
    public scoresField = 'scores'

    // public latestKeyStatsField = 'latestKeyStats'
    public latestAdvancedStats = 'latestAdvancedStats'
    public latestAnnualAdvancedStats = 'latestAnnualAdvancedStats'
    public latestEarnings = 'latestEarnings'
    public latestAnnualBalanceSheet = 'latestAnnualBalanceSheet'
    public latestQuarterlyBalanceSheet = 'latestQuarterlyBalanceSheet'
    public latestAnnualCashFlow = 'latestAnnualCashFlow'
    public latestQuarterlyCashFlow = 'latestQuarterlyCashFlow'
    public latestAnnualIncome = 'latestAnnualIncome'
    public latestQuarterlyIncome = 'latestQuarterlyIncome'
    public latestPriceTarget = 'latestPriceTarget'
    public latestRecommendations = 'latestRecommendations'
    public latestAnnualEstimates = 'latestAnnualEstimates'

    public institutionalOwnership  = 'institutionalOwnership'
    public insidersField = 'insiders'
    public latestQuoteField = 'latestQuote'
    public simplifiedChartField = 'simplifiedChart'
    public lastEarningsDate = 'lastEarningsDate'
    public tipranksDataField = 'tipranksAnalysts'

    /* collections */
    public stockCollection = 'stocks' //main collection
    public keyStatsCollection = 'keyStats'
    public earningsCollection = 'earnings'
    public advancedStatsCollection = 'advancedStats'
    public balanceSheetCollection = 'balanceSheets'
    public cashFlowCollection = 'cashFlows'
    public incomeCollection = 'incomeStatements'
    public annualAdvancedStatsCollection = 'annualAdvancedStats'
    public annualBalanceSheetCollection = 'annualBalanceSheets'
    public annualCashFlowCollection = 'annualCashFlows'
    public annualIncomeCollection = 'annualIncomeStatements'

    public recommendationCollection = 'recommendations'
    // public estimatesCollection = 'estimates'
    public priceTargetCollection = 'priceTargets'

    public allCollectionsForStock:string[] = ["keyStats", "earnings", "advancedStats", "balanceSheets", "cashFlows", "incomeStatements",
    "annualAdvancedStats", "annualBalanceSheets", "annualCashFlows", "annualIncomeStatements", "recommendations", "priceTargets"]

    //premium collections
    public brain30SentimentCollection = 'brain30Sentiment'
    public kScoreCollection = 'kScores'
    public stocktwitsSentimentCollection = 'stocktwitsSentiment'
    public brain21RankingCollection = "brain21Ranking"
    public brainLanguageCollection = "brainLanguage"
    public precisionAlphaCollection = "precisionAlpha"
    public crossAssetCollection = "crossAssetModel"
    public tacticalModelCollection = "tacticalModel"
    
    //other collections
    public tipranksTopSymbolsCollection = 'tipranksSymbols'

    private static stockDaoInstance:StockDao = new StockDao()
    
    public snapshotCache:any = {}
    public incomeGroupCache:any = {}
    // public balanceSheetGroupCache:any = {}
    public earningsCache:any = {}
    public cashFlowGroupCache:any = {}
    public advancedGroupCache:any = {}
    private queryLimit = 500
    private numSnapped:number = 0
    private numToSnap:number = 5
    public snappingDone:boolean = false
    public scheduledUpdateService:any
    private initStartTime:any = Date.now()
    private totals:any = {}

    constructor() {
        super()
        console.log("init stockdao")
    }

    public async initStockSnapshotCaches(caller:ScheduledUpdateService) {
        this.scheduledUpdateService = caller
        this.totals[this.stockCollection] = 0
        this.totals[this.incomeCollection] = 0
        this.totals[this.earningsCollection] = 0
        this.totals[this.cashFlowCollection] = 0
        this.totals[this.advancedStatsCollection] = 0

        const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        const year = todayString.split("-")[0]
        const month = todayString.split("-")[1]
        const day = todayString.split("-")[2]
        const cutOffYear5 = parseInt(year) - 5
        // const cutOffYear2 = parseInt(year) - 2
        // const cutOffDate2 = `${cutOffYear2}-${month}-${day}`
        const cutOffDate5 = `${cutOffYear5}-${month}-${day}`

        let collectionRef = this.db.collection(this.stockCollection)
        let query = collectionRef.limit(this.queryLimit)
        this.setupCollectionListener(query, collectionRef, this.snapshotCache, false, this.stockCollection)
    
        let incomeColRef = this.db.collectionGroup(this.incomeCollection).where("id", '>', cutOffDate5)
        let earningsColRef = this.db.collectionGroup(this.earningsCollection).where("id", '>', cutOffDate5)
        let cashflowColRef = this.db.collectionGroup(this.cashFlowCollection).where("id", '>', cutOffDate5)
        let advancedColRef = this.db.collectionGroup(this.advancedStatsCollection).where("id", '>', cutOffDate5)
        this.setupCollectionListener(incomeColRef.limit(this.queryLimit), incomeColRef, this.incomeGroupCache, true, this.incomeCollection)
        this.setupCollectionListener(earningsColRef.limit(this.queryLimit), earningsColRef, this.earningsCache, true, this.earningsCollection)
        this.setupCollectionListener(cashflowColRef.limit(this.queryLimit), cashflowColRef, this.cashFlowGroupCache, true, this.cashFlowCollection)
        this.setupCollectionListener(advancedColRef.limit(this.queryLimit), advancedColRef, this.advancedGroupCache, true, this.advancedStatsCollection)
    }

    private setupCollectionListener(query:any, collectionRef:any, cache:any, array:boolean, collection:string){
        query.onSnapshot(snap => {
            if (snap && snap.docChanges() && snap.docChanges().length){
                let docChanges = snap.docChanges()
                // console.log(`${collection}: ${docChanges.length} docs snapped`)
                this.totals[collection] += docChanges.length
                for (let docChange of docChanges) {
                    let doc = docChange.doc
                    if (array) {
                        let symbol = doc.ref.parent.parent.id
                        if (!cache.hasOwnProperty(symbol)) {
                            cache[symbol] = []
                        }
                        let found = false
                        for (let i = 0; i < cache[symbol].length; i++) {
                            let item = cache[symbol][i]
                            if (item.id == doc.id) {
                                cache[symbol][i] = doc
                                found = true
                            }
                        }
                        if (!found) {
                            cache[symbol].unshift(doc.data())
                        }
                    } else {
                        cache[doc.id] = doc
                    }
                }
                if (!this.snappingDone){
                    let currentDoc = docChanges[docChanges.length - 1].doc
                    let query = collectionRef.startAfter(currentDoc).limit(this.queryLimit)
                    this.setupCollectionListener(query, collectionRef, cache, array, collection)
                }
            } else {
                console.log(`DONE SNAPPING ${collection}: ${this.totals[collection]} docs`)
                console.log(memoryUsage())
                this.numSnapped += 1
                if (this.numSnapped >= this.numToSnap){
                    this.snappingDone = true
                    console.log(`Done snapping all collections in ${(Date.now() - this.initStartTime) / 60000}mins`)
                    this.scheduledUpdateService.initRest()
                }
            }
        }, (error) => {
            console.log(error)
        })
    }

    private async initCollectionCache(cache, collectionRef, array) {
        const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        const year = todayString.split("-")[0]
        const month = todayString.split("-")[1]
        const day = todayString.split("-")[2]
        const cutOffYear5 = parseInt(year) - 5
        // const cutOffYear2 = parseInt(year) - 2
        // const cutOffDate2 = `${cutOffYear2}-${month}-${day}`
        const cutOffDate5 = `${cutOffYear5}-${month}-${day}`

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

    public async deleteEverythingForSymbols(symbolsToDelete:string[]) {
        let stockRefsToDelete:any[] = []
        let count = 0
        for (let s of symbolsToDelete){
            let doc = await this.db.collection(this.stockCollection).doc(s).get()
            stockRefsToDelete.push(doc.ref)
            for (let col of this.allCollectionsForStock){
                let colRef = await this.db.collection(this.stockCollection).doc(s).collection(col).get()
                for (let doc of colRef.docs){
                    stockRefsToDelete.push(doc.ref)
                }
            }
            count+=1
            console.log(`prepared to delete ${s} (${count}/${symbolsToDelete.length})`)
        }
        if (stockRefsToDelete.length){
            console.log(`deleting ${stockRefsToDelete.length} docs for these symbols`)
            await this.batchDelete(stockRefsToDelete)
        }
    }

    public async deleteEmptySymbolDocs(){
        let stockRefsToDelete:any[] = []
        let symbolsToDelete:any[] = []
        for (let [k, v] of Object.entries(this.snapshotCache)) {
            if (v) {
                let value:any = v as any
                let companyField:any = value.get(this.companyField) 
                if (!companyField || !companyField.symbol || companyField.symbol == ""){
                    stockRefsToDelete.push(value.ref)
                    symbolsToDelete.push(value.id)
                }
            }
        }
        for (let s of symbolsToDelete){
            for (let col of this.allCollectionsForStock){
                let colRef = await this.db.collection(this.stockCollection).doc(s).collection(col).get()
                for (let doc of colRef.docs){
                    stockRefsToDelete.push(doc.ref)
                }
            }
        }
        if (stockRefsToDelete.length){
            console.log(`deleting ${stockRefsToDelete.length} docs for these symbols`)
            await this.batchDelete(stockRefsToDelete)
        }
    }

    public static getStockDaoInstance() {
        return this.stockDaoInstance
    }

    public getAllSymbols() {
        return Object.keys(this.snapshotCache)
    }

    public createNewStockDocuments(symbols: string[]) {
        return new Promise((resolve, reject) => {
            const batchItems: BatchItem[] = []
            const collectionRef = this.db.collection(this.stockCollection)
            for (const symbol of symbols) {
                const stockRef = collectionRef.doc(symbol.toUpperCase())
                const batchItem: BatchItem = {
                    documentRef: stockRef,
                    data: {}
                }
                batchItems.push(batchItem)
            }
            if (batchItems.length > 0){
                return this.batchSet(batchItems, false).then(result => resolve()).catch()
            } else {
                return Promise.resolve()
            }
        })
    }

    public editFieldTest(s:string){
        return this.db.collection(this.stockCollection).doc("FB").set({
            company: {
                test: s
            }
        }, {merge:true})
    }

    public batchSaveCompanyLogoPeers(dataArr: any) {
        const batchUpdateItems: BatchItem[] = []
        const collectionRef = this.db.collection(this.stockCollection)
        for (const item of dataArr) {
            const docRef = collectionRef.doc(item.symbol)
            const batchUpdateItem: BatchItem = {
                documentRef: docRef,
                data: { company: item }
            }
            batchUpdateItems.push(batchUpdateItem)
        }
        if (batchUpdateItems.length > 0){
            return this.batchSet(batchUpdateItems, true)
        } else {
            return true
        }
    }

    public getTopXCompaniesByMarketCap(x: number) {
        return this.db.collection(this.stockCollection).orderBy("keystats.marketcap", "desc").limit(x).get()
            .then(snapshot => {
                return snapshot.docs.map(doc => doc.id)
            }).catch()
    }

    public getBottomXCompaniesByMarketCap(x: number) {
        return this.db.collection(this.stockCollection).orderBy("keystats.marketcap", "asc").limit(x).get()
            .then(snapshot => {
                return snapshot.docs.map(doc => doc.id)
            }).catch()
    }

    public getAllSymbolsByDaysSinceLastEarnings(daysSinceLastEarningsThreshold:number){
        const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        return this.db.collection(this.stockCollection).orderBy(this.lastEarningsDate, 'asc')
            .get().then(snapshot => {
                if (snapshot.empty) {
                    return {};
                }
                const symbolsMatch:any = {}
                for (const doc of snapshot.docs) {
                    const lastEarningsDate = doc.get(StockDao.getStockDaoInstance().lastEarningsDate)
                    const daysSinceLastEarnings = Utilities.countDaysBetweenDateStrings(todayString, lastEarningsDate)
                    if (daysSinceLastEarnings > daysSinceLastEarningsThreshold){
                        symbolsMatch[doc.id] = lastEarningsDate
                    } else {
                        break
                    }
                }
                return symbolsMatch
            })
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

    public batchSaveKeyStats(keystats: any[], dateKey: string) {
        return new Promise((resolve, reject) => {
            const batchUpdateItems: BatchItem[] = []
            const collectionRef = this.db.collection(this.stockCollection)
            for (const symbol of Object.keys(keystats)) {
                if (!keystats.hasOwnProperty(symbol) || !keystats[symbol]){
                    continue
                }
                const stockRef = collectionRef.doc(symbol.toUpperCase())
                const keystatsRef = stockRef.collection(this.keyStatsCollection).doc(dateKey)
                const batchUpdateItem1: BatchItem = {
                    documentRef: stockRef,
                    data: { "latestKeyStats": StockDataService.convertIexKeystatsToSimplifiedKeystats(keystats[symbol]) }
                }
                const batchUpdateItem2: BatchItem = {
                    documentRef: keystatsRef,
                    data: StockDataService.convertIexKeystatsToSimplifiedKeystats(keystats[symbol])
                }
                batchUpdateItems.push(batchUpdateItem1)
                batchUpdateItems.push(batchUpdateItem2)
            }
            this.batchSet(batchUpdateItems, true).then(result => {
                console.log("finished batch saving key stats")
                resolve()   
            }).catch()
        })
    }

    public setTipranksDataForSymbol(symbol:string, tipranksData:any){
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).update(
            {
                [this.tipranksDataField]: {
                    "updated": Date.now(),
                    "data": tipranksData
                }
            }
        ).then(snapshot => {
            return snapshot
        }).catch()
    }

    public getTipranksDataForSymbol(symbol:string){
        let doc = this.snapshotCache[symbol.toUpperCase()]
        return doc?.get(this.tipranksDataField)
    }

    public getTipranksTopAnalystsForSymbol(symbol:string){
        return this.db.collection(this.tipranksTopSymbolsCollection).where('symbol', '==', symbol.toUpperCase()).get()
        .then(snapshot => {
            if (snapshot.docs && snapshot.docs.length > 0) {
                return snapshot.docs[0].data()
            }
            return null
        })
    }

    public getTipranksTopAnalystsSymbolsCollectionRef(){
        return this.db.collection(this.tipranksTopSymbolsCollection).get()
    }

    /*** GENERIC FUNCTIONS ***/

    /******************************/
    /************ GET *************/
    /******************************/
    
    public getDocumentsFromCollectionGroupWithDateCriteria(collectionName:string, idField:string, dateCutOff:string, dateSign:string) {
        const annualBalanceSheets = this.db.collectionGroup(collectionName).where(idField, dateSign === ">" ? '>' : '<', dateCutOff)
        .orderBy(idField, 'asc')
        return annualBalanceSheets.get().then(snapshot => {
            const returnObj = {}
            for (const doc of snapshot.docs){
                const ref:any = doc.ref
                const symbol = ref.parent.parent.id
                if (!returnObj.hasOwnProperty(symbol)) {
                    returnObj[symbol] = []
                }
                returnObj[symbol].push(doc.data())
            }
            console.log()
            return returnObj
        }).catch()
    }

    getDocFromSubCollectionForSymbol(symbol:string, subCollection:string, docId:string){
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(subCollection).doc(docId).get()
        .then(result => {
            return result.data()
        }).catch()
    }

    /* when the document ids are the date string, this returns the most recent doc from a subcollection */
    getMostRecentDocFromSubCollectionForSymbol(symbol: string, subCollection: string) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(subCollection)
            .limit(1).orderBy('id', 'desc').get().then(snapshot => {
                const docs: any = snapshot.docs
                if (docs && docs.length > 0) {
                    const data: any = docs[0].data()
                    return data
                }
                return null
            })
    }

    /**
     * when the document ids are the date string or timestamp, this returns the most recent ${limit} docs from a subcollection
     * limit: any number or the string 'all'
     **/
    public getMostRecentDocsFromSubCollectionForSymbol(symbol: string, subCollection: string, limit: any) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(subCollection)
            .limit(parseInt(limit)).orderBy('id', 'desc').get().then(snapshot => {
                const docs: any = snapshot.docs
                const returnDocs: any[] = []
                if (docs && docs.length > 0) {
                    if (limit === "all") {
                        return docs
                    }
                    for (let i = 0; i < parseInt(limit); i++) {
                        if (docs[i]){
                            returnDocs.push(docs[i].data())
                        }
                    }
                }
                return returnDocs
            })
    }

    public getMostRecentDocRefsFromSubCollectionForSymbol(symbol: string, subCollection: string, limit: any) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(subCollection)
            .limit(parseInt(limit)).orderBy('id', 'desc').get().then(snapshot => {
                const docs: any = snapshot.docs
                const returnDocs: any[] = []
                if (docs && docs.length > 0) {
                    if (limit === "all") {
                        return docs
                    }
                    for (let i = 0; i < parseInt(limit); i++) {
                        if (docs[i]){
                            returnDocs.push(docs[i])
                        }
                    }
                }
                return returnDocs
            })
    }

    public getStockDocumentSnapshotForSymbol(symbol:string){
        return this.snapshotCache[symbol]
    }

    public getAllStockDocumentSnapshots(){
        return Object.values(this.snapshotCache)
    }


    public getStockDocumentFieldForSymbol(symbol: string, field: string) {
        let doc:QueryDocumentSnapshot = this.snapshotCache[symbol.toUpperCase()]
        return doc.get(field)
    }

    public getStockDocumentFieldForSymbols(symbols: string[], field: string) {
        const symbolsUpper = symbols.map(s => s.toUpperCase())
        let snapshots = Object.values(this.snapshotCache).filter((o:any) => symbolsUpper.includes(o.id))
        const returnMap: any = {}
        let doc:any
        for (doc of snapshots) {
            returnMap[doc.id] = doc.get(field)
        }
        return returnMap
    }

    public getStockDocumentFieldForAllSymbols(field: string) {
        let snapshots = Object.values(this.snapshotCache)
        return snapshots.map((doc: any) => doc.get(field)).filter(item => item)
    }

    public getStockDocumentForAllSymbols() {
        let snapshots = Object.values(this.snapshotCache)
        return Object.values(snapshots).map((doc:any) => doc.data()).filter(item => item)
    }

    //if no symbols are provided, will get for all symbols
    public getStockDocumentFieldsForSymbols(fields:string[], symbols: string[] = []) {
        let snapshots:any[] = []
        if (symbols.length){
            for (let symbol of symbols){
                if (this.snapshotCache[symbol]){
                    snapshots.push(this.snapshotCache[symbol])
                }
            }
        } else {
            snapshots = Object.values(this.snapshotCache)
        }
        let returnData: any[] = []
        for (let doc of snapshots) {
            let returnObj:any = {}
            for (let field of fields){
                returnObj[field] = doc.get(field)
            }
            returnData.push(returnObj)
        }
        return returnData
    }

    /******************************/
    /************ SAVE ************/
    /******************************/

    /* adds the lastUpdated timestamp automatically */
    public saveStockDocumentFieldForSymbol(symbol: string, field: string, data:any) {
        return new Promise((resolve, reject) => {
            if (field) {
                if (typeof data === 'object' && data !== null) {
                    data.lastUpdated = Date.now()
                }
                this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).update({ [field]: data })
                    .then(result => {
                        resolve(result)
                    })
                    .catch(error => {
                        resolve(false)
                    });
            } else {
                reject(false)
            }
        })
    }

    /* saves a document with id of 'key' and data of 'data' into subcollection */
    /* will add an id field that is the same as the document id (key) */
    saveDocInSubcollectionForSymbol(symbol: string, subCollection: string, key: string, data: any) {
        data.id = key
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(subCollection)
            .doc(key).set(data).then(result => {
                return data
            }).catch(err => {
                return err
            })
    }

    //dead code
    
    // public batchSavePreviousCloses(adjustedCloses: SimpleQuote[]) {
    //     return new Promise((resolve, reject) => {
    //         const batchUpdateItems: BatchItem[] = []
    //         const collectionRef = this.db.collection(this.stockCollection)
    //         for (const adjustedClose of adjustedCloses) {
    //             const stockRef = collectionRef.doc(adjustedClose.symbol.toUpperCase())
    //             const batchUpdateItem: BatchItem = {
    //                 documentRef: stockRef,
    //                 data: { "latestClose": adjustedClose.close }
    //             }
    //             batchUpdateItems.push(batchUpdateItem)
    //         }
    //         this.batchUpdate(batchUpdateItems).then(result => resolve()).catch()
    //     })
    // }

}