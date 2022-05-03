import BaseDao from './BaseDao';
import ChartEntry from '../models/ChartEntry';
import BatchItem from './BatchItem';

export default class ChartDao extends BaseDao {

    //top level collections
    private stockCollection = 'stocks'
    private intradayPriceDataCollection = 'intradayPriceData'

    //subcollections of stocks
    private dailyPriceDataCollection = 'dailyPriceData'

    private static chartDaoInstance:ChartDao = new ChartDao()

    constructor() {
        super()
    }

    public static getChartDaoInstance(){
        return this.chartDaoInstance
    }

    public getDailyPriceDataCollectionName(){
        return this.dailyPriceDataCollection
    }

    public getPriceData(symbol: string, collection: string) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(collection).get()
            .then(snapshot => {
                return snapshot.docs.map(doc => doc.data())
            })
    }

    public getPriceDataWithLimit(symbol: string, collection: string, limit: number) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(collection)
        .limit(limit).orderBy('date', 'desc').get().then(snapshot => {
                return snapshot.docs.map(doc => doc.data())
        }).catch()
    }

    public setPriceData(symbol: string, priceData: any, collection: string) {
        return this.batchSaveMultipleDocsInCollectionRefWithFieldIds(this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(collection),
            "date", priceData, true)
    }

    public saveChartEntry(symbol: string, chartEntry: ChartEntry, collection: string) {
        const chartRef = this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(collection).doc(chartEntry.date)
        return chartRef.set(chartEntry).then(result => {
            // console.log(`${symbol} date: ${chartEntry.date} earnings: ${chartEntry.earnings}`)
            return result
        })
    }

    public deleteChartEntry(symbol:string, chartEntry:ChartEntry, collection:string){
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(collection).doc(chartEntry.date)
        .delete().then(result => result).catch(error => error)
    }

    public addEarningsToChartEntry(symbol:string, collection:string, date:string) {
        return this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(collection)
        .where("date", ">=", date).limit(1).get().then(snapshot => {
            const docs = snapshot.docs
            if (docs.length > 0){
                const docRef = docs[0]
                const docData = docRef.data()
                docData.earnings = true
                // console.log(`setting earnings to true for ${collection} chart item for ${symbol} with date ${docData.date}`)
                return docRef.ref.set(docData, {merge:true}).then(result => result).catch(err => console.error(err))
            }
            return null
        }).catch(err => console.error(err))
    }
    
    public createNewStockDocuments(symbols: string[]) {
        return new Promise((resolve, reject) => {
            const batchItems: BatchItem[] = []
            const collectionRef = this.db.collection(this.intradayPriceDataCollection)
            for (const symbol of symbols) {
                const stockRef = collectionRef.doc(symbol.toUpperCase())
                const batchItem: BatchItem = {
                    documentRef: stockRef,
                    data: {
                        numMinutes: 0,
                        intradayPrices: [],
                        fetchedFullDataset: false
                    }
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

    public getIntradayPriceObject(symbol:string){
        return this.db.collection(this.intradayPriceDataCollection).doc(symbol.toUpperCase()).get()
        .then(doc => {
            const data:any = doc.data()
            return data
        })
    }

    public saveIntradayPriceObjectForSymbol(symbol:string, intradayPriceObject:any){
        return this.db.collection(this.intradayPriceDataCollection).doc(symbol.toUpperCase())
        .set(intradayPriceObject).then(() => intradayPriceObject.intradayPrices)
    }

    public resetAllIntradayCharts(){
        return this.db.collection(this.intradayPriceDataCollection).where('numMinutes', '>', 0)
        .get().then(snapshot => {
            const batchItems:BatchItem[] = []
            const docs = snapshot.docs
            for (const doc of docs){
                const data = doc.data()
                data.numMinutes = 0
                data.intradayPrices = []
                data.fetchedFullDataset = false
                const batchItem:BatchItem = {
                    documentRef: doc.ref,
                    data: data
                }
                batchItems.push(batchItem)
            }
            if (batchItems.length > 0){ 
                return this.batchUpdate(batchItems)
            } else {
                return null
            }
        })
    }


    public batchSaveDocuments(symbol:string, subCollection: string, docDatas: any){        
        return new Promise((resolve, reject) => {
            const batchItems:BatchItem[] = []
            const collectionRef = this.db.collection(this.stockCollection).doc(symbol.toUpperCase()).collection(subCollection)
            for (const docData of docDatas) {
                const stockRef = collectionRef.doc(docData.date)
                const batchItem:BatchItem = {
                    documentRef: stockRef,
                    data: docData
                }
                batchItems.push(batchItem)
            }
            this.batchSet(batchItems, false).then(result => resolve()).catch()
        })
    }
}