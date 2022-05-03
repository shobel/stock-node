"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseDao_1 = require("./BaseDao");
const PremiumDataManager_1 = require("../managers/PremiumDataManager");
class UserDao extends BaseDao_1.default {
    constructor() {
        super();
        this.userCollection = "users";
        this.watchlistField = "watchlist";
        this.scoreSettings = "scoreSettings";
        this.creditsField = "credits";
        this.premiumDataSubcollection = "premiumData";
        this.issuesCollection = "issues";
        this.selectedScoreField = "selectedScore";
        this.twitterAccountsArrayField = "twitterAccounts";
        this.twitterAccountsMonthlyCounter = "twitterAccountsMonthlyCounter";
        this.snapshotCache = {};
    }
    initUserSnapshotCache() {
        this.db.collection(this.userCollection).onSnapshot(snap => {
            for (let docSnap of snap.docs) {
                this.snapshotCache[docSnap.id] = docSnap;
            }
        });
        return this.db.collection(this.userCollection).get().then(snapshot => {
            for (let docSnap of snapshot.docs) {
                this.snapshotCache[docSnap.id] = docSnap;
            }
            return;
        });
    }
    static getUserDaoInstance() {
        return this.userDaoInstance;
    }
    getWatchlistForUser(userid) {
        var _a;
        let watchlist = (_a = this.snapshotCache[userid]) === null || _a === void 0 ? void 0 : _a.get(this.watchlistField);
        if (!watchlist) {
            watchlist = [];
        }
        return watchlist;
        // return this.db.collection(this.userCollection).doc(userid).get()
        // .then(doc => {
        //     const data: any = doc.data()
        //     if (data){
        //         return data[this.watchlistField]
        //     }
        //     return []
        // })
    }
    saveWatchlistForUser(userid, watchlist) {
        return this.db.collection(this.userCollection).doc(userid).set({
            [this.watchlistField]: watchlist
        }, { merge: true })
            .then(() => watchlist);
    }
    getCreditsForUser(userid) {
        return this.db.collection(this.userCollection).doc(userid).get()
            .then(doc => {
            const data = doc.data();
            if (data && data[this.creditsField]) {
                return data[this.creditsField];
            }
            return 0;
        }).catch();
    }
    incrementCreditsForUser(userid, credits) {
        const increment = this.admin.firestore.FieldValue.increment(credits);
        return this.db.collection(this.userCollection).doc(userid).update({ [this.creditsField]: increment }).then(res => {
            return res;
        }).catch();
    }
    createUserDocument(userid, email) {
        return this.db.collection(this.userCollection).doc(userid).set({
            userid: userid,
            email: email
        }).then(doc => doc).catch();
    }
    getUserScoreSettings(userid) {
        return this.db.collection(this.userCollection).doc(userid).get().then((doc) => {
            const data = doc.data();
            return data[this.scoreSettings];
        }).catch();
    }
    setUserScoreSettings(userid, scoreSettings) {
        return this.db.collection(this.userCollection).doc(userid).update({ "scoreSettings": scoreSettings }).then(res => res).catch();
    }
    getSavedPremiumDataInfoForUser(symbol, userid) {
        return this.db.collection(this.userCollection).doc(userid).collection(this.premiumDataSubcollection).doc(symbol.toUpperCase())
            .get().then((doc) => {
            if (doc) {
                return doc.data();
            }
            return null;
        });
    }
    //adds a new key/value pair (packageId: date) to the existing premium data object
    setSavedPremiumDataInfoForUser(symbol, userid, packageId, date) {
        return this.db.collection(this.userCollection).doc(userid).collection(this.premiumDataSubcollection).doc(symbol.toUpperCase())
            .get().then((doc) => {
            if (doc) {
                let data = doc.data();
                if (data && data.hasOwnProperty(packageId) && data[packageId] == date) {
                    return null;
                }
            }
            return this.db.collection(this.userCollection).doc(userid).collection(this.premiumDataSubcollection).doc(symbol)
                .set({ [packageId]: date }, { merge: true });
        });
    }
    getTopAnalystsSubscription(userid) {
        return this.db.collection(this.userCollection).doc(userid).collection(this.premiumDataSubcollection).doc(PremiumDataManager_1.default.TOP_ANALYSTS_DOC_ID)
            .get().then(snap => {
            if (!snap) {
                return null;
            }
            return snap.get(PremiumDataManager_1.default.TOP_ANALYSTS_PACKAGE_ID);
        });
    }
    getIssueSnapshots(userid) {
        return this.db.collection(this.userCollection).doc(userid).collection(this.issuesCollection).get().then(colSnap => {
            return colSnap.docs;
        });
    }
    addIssue(userid, issue, email) {
        return this.db.collection(this.userCollection).doc(userid).collection(this.issuesCollection)
            .doc(Date.now().toString()).set({
            message: issue,
            email: email
        });
    }
    addTwitterAccount(userid, newTwitterUsernames, newMonthlyCount) {
        return this.db.collection(this.userCollection).doc(userid).set({
            [this.twitterAccountsArrayField]: newTwitterUsernames,
            [this.twitterAccountsMonthlyCounter]: newMonthlyCount
        }, { merge: true });
    }
    removeTwitterAccount(userid, newTwitterUsernames) {
        return this.db.collection(this.userCollection).doc(userid).set({
            [this.twitterAccountsArrayField]: newTwitterUsernames,
        }, { merge: true });
    }
    resetTwitterMonthlyCounter(userid) {
        return this.db.collection(this.userCollection).doc(userid).set({
            [this.twitterAccountsMonthlyCounter]: 0,
        }, { merge: true });
    }
}
exports.default = UserDao;
UserDao.userDaoInstance = new UserDao();
//# sourceMappingURL=UserDao.js.map