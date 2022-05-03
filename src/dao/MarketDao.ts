import BaseDao from "./BaseDao";
import Utilities from "../utils/Utilities";

export default class MarketDao extends BaseDao {

    //main market collection
    public marketCollection:string = 'market'    
    //market docs
    public economyDoc:string = 'economy'
    public newsDoc:string = 'news'
    public sectorPerformanceDoc:string = 'sectorPerformance'
    public generalDoc:string = "general"
    public top10Doc:string = "top10"
        //top10 fields
        public gainersField = "gainers"
        public losersField = "losers"
        public activeField = "mostactive"

    public holidaysDoc:string = "holidays"
    public lastUpdatedTipranksAnalysts:string = "lastUpdatedTipranksAnalysts"

    //economy collections (top-level)
    public economicDataCollectionWeekly:string = 'economicDataWeekly'
    public economicDataCollectionMonthly:string = 'economicDataMonthly'
    public economicDataCollectionQuarterly:string = 'economicDataQuarterly'

    //stocktwits collection (top-level)
    public stocktwitsTrendingCollection:string = "stocktwitsTrending"

    //tipranks collection (top-leve)
    public tipranksTopAnalystsCollection:string = "tipranksAnalysts"
    //tipranks docs
    public tipranksTopSymbolsCollection:string = "tipranksSymbols"

    private static marketDaoInstance:MarketDao = new MarketDao()

    constructor() {
        super()
    }

    public static getMarketDaoInstance(){
        return this.marketDaoInstance
    }

    public getSectorPerformances(){
        return this.db.collection(this.marketCollection).doc(this.sectorPerformanceDoc).get()
        .then(snapshot => {
            return snapshot.data()
        })
    }

    // data should be a list of IEX performance objects
    public saveSectorPerformances(data:any){
        const savedObject:any = {}
        for (const p of data){
            savedObject[p.name] = p
        }
        return this.db.collection(this.marketCollection).doc(this.sectorPerformanceDoc).set(savedObject)
        .then(result => result)
    }

    public getFearGreed(){
        return this.db.collection(this.marketCollection).doc(this.generalDoc).get().then(doc => {
            const data = doc.data()
            return data ? data.fearGreed : null
        })
    }

    public setFearGreed(fearGreed:any){
        return this.db.collection(this.marketCollection).doc(this.generalDoc).set({
            fearGreed: fearGreed
        }, {merge: true})
    }

    public isAnyEconomicData(subCollection){
        return this.db.collection(subCollection).limit(1).get().then(snapshot => {
            if (!snapshot || !snapshot.docs || !snapshot.docs.length) {
                return false
            }
            return true
        })
    }

    public getLatestEconomicData(subCollection:string){
        return this.db.collection(subCollection)
        .limit(1).orderBy('id', 'desc').get().then(snapshot => {
            const docs: any = snapshot.docs
            if (docs && docs.length > 0) {
                const data: any = docs[0].data()
                return data
            }
            return null
        })
    }

    public getEconomicData(subCollection:string, numDocs:number){
        return this.db.collection(subCollection)
        .limit(numDocs).orderBy('id', 'desc').get().then(snapshot => {
            const docs: any = snapshot.docs
            const ret:any[] = []
            if (docs && docs.length > 0) {
                for (const doc of docs) {
                    ret.push(doc.data())
                }
                return ret
            }
            return ret
        })
    }

    public saveEconomicData(collection:string, datekey:string, data:any){
        data.id = datekey
        return this.db.collection(collection).doc(datekey).set(data).then(result => result)
        .catch(err => {
            console.log(err)
        })
    }

    public setTodayWasATradingDay(todayWasATradingDay:boolean){
        return this.db.collection(this.marketCollection).doc(this.generalDoc).set({
            todayWasATradingDay: todayWasATradingDay,
            date: Utilities.convertUnixTimestampToDateString(Date.now())
        }, {merge: true}).catch(er => {
            console.log(`could not set todayWasATradingDay because -- ${er}`)
        })
    }

    public getTodayWasATradingDay(){
        return this.db.collection(this.marketCollection).doc(this.generalDoc).get()
        .then(snapshot => {
            const data = snapshot.get('todayWasATradingDay')
            return data != null && data
        })
    }

    public setLastUpdatedTipranksAnalysts(timestamp:number){
        return this.db.collection(this.marketCollection).doc(this.generalDoc).set({
            lastUpdatedTipranksAnalysts: timestamp,
        }, {merge: true}).catch(er => {
            console.log(`could not set todayWasATradingDay because -- ${er}`)
        })
    }

    public getLastUpdatedTipranksAnalysts(){
        return this.db.collection(this.marketCollection).doc(this.generalDoc).get()
        .then(snapshot => {
            return snapshot.get(this.lastUpdatedTipranksAnalysts)
        })
    }

    public getMarketNews(){
        return this.db.collection(this.marketCollection).doc(this.newsDoc).get()
        .then((result:any) => {
            const data = result.data()
            if (data.news){
                return data.news
            }
            return null
        })
    }

    public getAllTop10(){
        return this.db.collection(this.marketCollection).doc(this.top10Doc).get()
        .then(result => result.data()).catch()
    }

    public getTop10Field(field:string){
        return this.db.collection(this.marketCollection).doc(this.top10Doc).get()
        .then(result => result ? result[field] : result).catch()
    }

    public saveTop10Field(field:string, data:any){
        return this.db.collection(this.marketCollection).doc(this.top10Doc).set({
            [field]: data
        }, { merge: true }).then(result => result).catch()
    }

    public getStocktwitsTrending(){
        return this.db.collection(this.stocktwitsTrendingCollection).get()
        .then(snapshot => {
            return snapshot.docs.map(doc => doc.data())
        }).catch()
    }

    public saveStocktwitsTrending(trendingData:any){
        const messages = trendingData
        for (const m of messages){
            m.timestamp = new Date(m.created_at).getTime()
        }
        const sorted = Utilities.sortArrayOfObjectsByNumericalFieldDesc("timestamp", messages)
        return this.batchSaveMultipleDocsInCollectionWithNumberedDocumentIds(this.stocktwitsTrendingCollection, sorted)
    }

    public saveTipranksAnalystsDocuments(analysts:any[]){
        return this.batchSaveMultipleDocsInCollectionWithFieldIds(this.tipranksTopAnalystsCollection, "name", analysts, false)
    }

    public saveTipranksSymbolsDocuments(symbols:any[]){
        return this.batchSaveMultipleDocsInCollectionWithFieldIds(this.tipranksTopSymbolsCollection, "symbol", symbols, false)
    }

    public getTipranksTopAnalysts(){
        return this.getAllDocsInCollection(this.tipranksTopAnalystsCollection)
    }

    public getTipranksTopAnalystsNames(){
        return this.getAllDocIdsInCollection(this.tipranksTopAnalystsCollection)
    }

    public getTipranksTopSymbols(){
        return this.getAllDocSnapshotsInCollection(this.tipranksTopSymbolsCollection)
    }

    public deleteTipranksTopAnalystCollection() {
        return this.deleteAllDocumentsInCollection(this.tipranksTopAnalystsCollection)
    }

    public deleteTipranksTopSymbolsCollection() {
        return this.deleteAllDocumentsInCollection(this.tipranksTopSymbolsCollection)
    }

    // dead code, probably will never need
    // public saveMarketNews(data:any){
    //     return this.db.collection(this.marketCollection).doc(this.newsDoc).set({
    //         news: data
    //     }).then(result => result)
    //     .catch(err => {
    //         console.log(err)
    //     })
    // }

}