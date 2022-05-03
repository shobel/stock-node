import BaseDao from "./BaseDao";

export default class TwitterDao extends BaseDao {

    public static twitterCollection:string = "twitter"
    public static tweetSubCollection:string = "tweets"

    public static twitterDao:TwitterDao = new TwitterDao()

    constructor(){
        super()
    }

    public getDocSnapshot(docid:string){
        return this.db.collection(TwitterDao.twitterCollection).doc(docid).get().then(snapshot => {
            return snapshot
        }).catch(err => null)
    }

    public getTweetsForDoc(docid:string){
        return this.db.collection(TwitterDao.twitterCollection).doc(docid).collection(TwitterDao.tweetSubCollection).get().then(snapshot => {
            return snapshot?.docs
        }).catch(err => null)
    }
    
    public getLatestTweetForDoc(docid:string){
        return this.db.collection(TwitterDao.twitterCollection).doc(docid).collection(TwitterDao.tweetSubCollection).limit(1).orderBy("id", "desc").get().then(snap => {
            let docs = snap.docs
            if (docs && docs.length) {
                return docs[0].data()
            }
            return null
        }).catch(err => null) 
    }

    public getTweetsForDocAndSymbol(docid:string, symbol:string){
        return this.db.collection(TwitterDao.twitterCollection).doc(docid).collection(TwitterDao.tweetSubCollection).where("cashtags", "array-contains", symbol).get().then(snapshot => {
            return snapshot?.docs
        }).catch(err => null)
    }

    public getAllTweetsForTwitterUser(docid:string){
        return this.db.collection(TwitterDao.twitterCollection).doc(docid).collection(TwitterDao.tweetSubCollection).get().then(snapshot => {
            return snapshot?.docs
        }).catch(err => null)
    }

    public updateOrCreateTwitterDoc(docid:string, data:any, tweets:any[]) {
        return this.db.collection(TwitterDao.twitterCollection).doc(docid).set(data, { merge: true }).then(()=> {
            this.batchSaveMultipleDocsInCollectionRefWithFieldIds(
                this.db.collection(TwitterDao.twitterCollection).doc(docid).collection(TwitterDao.tweetSubCollection), "id", tweets, false)
        })
    }
}