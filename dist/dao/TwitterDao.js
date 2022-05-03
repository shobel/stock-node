"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseDao_1 = require("./BaseDao");
class TwitterDao extends BaseDao_1.default {
    constructor() {
        super();
    }
    getDocSnapshot(docid) {
        return this.db.collection(TwitterDao.twitterCollection).doc(docid).get().then(snapshot => {
            return snapshot;
        }).catch(err => null);
    }
    getTweetsForDoc(docid) {
        return this.db.collection(TwitterDao.twitterCollection).doc(docid).collection(TwitterDao.tweetSubCollection).get().then(snapshot => {
            return snapshot === null || snapshot === void 0 ? void 0 : snapshot.docs;
        }).catch(err => null);
    }
    getLatestTweetForDoc(docid) {
        return this.db.collection(TwitterDao.twitterCollection).doc(docid).collection(TwitterDao.tweetSubCollection).limit(1).orderBy("id", "desc").get().then(snap => {
            let docs = snap.docs;
            if (docs && docs.length) {
                return docs[0].data();
            }
            return null;
        }).catch(err => null);
    }
    getTweetsForDocAndSymbol(docid, symbol) {
        return this.db.collection(TwitterDao.twitterCollection).doc(docid).collection(TwitterDao.tweetSubCollection).where("cashtags", "array-contains", symbol).get().then(snapshot => {
            return snapshot === null || snapshot === void 0 ? void 0 : snapshot.docs;
        }).catch(err => null);
    }
    getAllTweetsForTwitterUser(docid) {
        return this.db.collection(TwitterDao.twitterCollection).doc(docid).collection(TwitterDao.tweetSubCollection).get().then(snapshot => {
            return snapshot === null || snapshot === void 0 ? void 0 : snapshot.docs;
        }).catch(err => null);
    }
    updateOrCreateTwitterDoc(docid, data, tweets) {
        return this.db.collection(TwitterDao.twitterCollection).doc(docid).set(data, { merge: true }).then(() => {
            this.batchSaveMultipleDocsInCollectionRefWithFieldIds(this.db.collection(TwitterDao.twitterCollection).doc(docid).collection(TwitterDao.tweetSubCollection), "id", tweets, false);
        });
    }
}
exports.default = TwitterDao;
TwitterDao.twitterCollection = "twitter";
TwitterDao.tweetSubCollection = "tweets";
TwitterDao.twitterDao = new TwitterDao();
//# sourceMappingURL=TwitterDao.js.map