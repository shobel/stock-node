import BaseDao from './BaseDao';

export default class AnalystsDao extends BaseDao {

    /* collections */
    private fidelityAnalystsCollection = "fidelityAnalysts"
    private static analystsDaoInstance:AnalystsDao = new AnalystsDao()

    constructor() {
        super()
    }

    public static getAnalystsDaoInstance() {
        return this.analystsDaoInstance
    }

    //dataArray is array of objects that look like {symbol:string, score:number, change:number }
    public saveFidelityAnalysts(dataArray:any) {
        return this.batchSaveMultipleDocsInCollectionWithFieldIds(this.fidelityAnalystsCollection, "symbol", dataArray, true)
    }

    public getFidelityAnalystsSnapshots() {
        return this.db.collection(this.fidelityAnalystsCollection).get().then(snapshot => {
            if (snapshot && snapshot.docs && snapshot.docs.length){
                return snapshot.docs
            }
            return null
        })
    }

    public getFidelityAnalystsData() {
        return this.db.collection(this.fidelityAnalystsCollection).get().then(snapshot => {
            if (snapshot && snapshot.docs && snapshot.docs.length){
                return snapshot.docs.map(s => s.data())
            }
            return null
        })
    }
}