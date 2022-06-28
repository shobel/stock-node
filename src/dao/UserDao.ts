import BaseDao from "./BaseDao";
import PremiumDataManager from "../managers/PremiumDataManager";
import Utilities from "../utils/Utilities";

export default class UserDao extends BaseDao {

    public userCollection:string = "users"
    public watchlistField = "watchlist"
    public scoreSettings = "scoreSettings"
    public creditsField = "credits"
    public premiumDataSubcollection = "premiumData"
    public issuesCollection = "issues"
    public selectedScoreField = "selectedScore"

    public twitterAccountsArrayField:string = "twitterAccounts"
    public twitterAccountsMonthlyCounter:string = "twitterAccountsMonthlyCounter"

    private static userDaoInstance:UserDao = new UserDao()
    public snapshotCache:any = {}

    constructor() {
        super()
    }

    public initUserSnapshotCache(){
        this.db.collection(this.userCollection).onSnapshot(snap => {
            for (let docSnap of snap.docs) {
                this.snapshotCache[docSnap.id] = docSnap
            }
        })
        return this.db.collection(this.userCollection).get().then(snapshot => {
            for (let docSnap of snapshot.docs) {
                this.snapshotCache[docSnap.id] = docSnap
            }
            return
        })
    }

    public static getUserDaoInstance(){
        return this.userDaoInstance
    }

    public getUserDocByEmail(email:string){
        return this.snapshotCache[email]
    }

    public getWatchlistForUser(userid:string){
        let watchlist = this.snapshotCache[userid]?.get(this.watchlistField)
        if (!watchlist){
            watchlist = []
        }
        return watchlist
        // return this.db.collection(this.userCollection).doc(userid).get()
        // .then(doc => {
        //     const data: any = doc.data()
        //     if (data){
        //         return data[this.watchlistField]
        //     }
        //     return []
        // })
    }

    public saveWatchlistForUser(userid:string, watchlist:string[]){
        return this.db.collection(this.userCollection).doc(userid).set({
            [this.watchlistField]: watchlist
        }, {merge:true})
        .then(() => watchlist)
    }

    public getCreditsForUser(userid:string) {
        return this.db.collection(this.userCollection).doc(userid).get()
        .then(doc => {
            const data: any = doc.data()
            if (data && data[this.creditsField]){
                return data[this.creditsField]
            }
            return 0
        }).catch()
    }

    public incrementCreditsForUser(userid:string, credits:any){
        const increment = this.admin.firestore.FieldValue.increment(credits)
        return this.db.collection(this.userCollection).doc(userid).update(
            { [this.creditsField]: increment }
        ).then(res => {
            return res
        }).catch()
    }

    public createUserDocument(userid: string, email: string) {
        return this.db.collection(this.userCollection).doc(userid).set(
            {
                userid: userid,
                email: email
            }).then(doc => doc).catch()
    }

    public getUserScoreSettings(userid: string) {
        return this.db.collection(this.userCollection).doc(userid).get().then((doc:any) => {
            const data = doc.data()
            return data[this.scoreSettings]
        }).catch()
    }

    public setUserScoreSettings(userid: string, scoreSettings:any) {
        return this.db.collection(this.userCollection).doc(userid).update(
            { "scoreSettings": scoreSettings }
        ).then(res => res).catch()
    }

    public getSavedPremiumDataInfoForUser(symbol:string, userid: string) {
        return this.db.collection(this.userCollection).doc(userid).collection(this.premiumDataSubcollection).doc(symbol.toUpperCase())
        .get().then((doc:any) => {
            if (doc) {
                return doc.data()
            }
            return null
        })
    }

    //adds a new key/value pair (packageId: date) to the existing premium data object
    public setSavedPremiumDataInfoForUser(symbol:string, userid: string, packageId:string, date:any) {
        return this.db.collection(this.userCollection).doc(userid).collection(this.premiumDataSubcollection).doc(symbol.toUpperCase())
        .get().then((doc:any) => {
            if (doc) {
                let data:any = doc.data()
                if (data && data.hasOwnProperty(packageId) && data[packageId] == date){
                    return null
                }
            }
            return this.db.collection(this.userCollection).doc(userid).collection(this.premiumDataSubcollection).doc(symbol)
            .set({ [packageId]: date }, { merge: true })
        })
    }

    public getTopAnalystsSubscription(userid:string){
        return this.db.collection(this.userCollection).doc(userid).collection(this.premiumDataSubcollection).doc(PremiumDataManager.TOP_ANALYSTS_DOC_ID)
        .get().then(snap => {
            if (!snap) {
                return null
            }
            return snap.get(PremiumDataManager.TOP_ANALYSTS_PACKAGE_ID)
        })
    }

    public getIssueSnapshots(userid:string){
        return this.db.collection(this.userCollection).doc(userid).collection(this.issuesCollection).get().then(colSnap => {
            return colSnap.docs
        })
    }

    public addIssue(userid:string, issue:string, email:string){
        return this.db.collection(this.userCollection).doc(userid).collection(this.issuesCollection)
        .doc(Date.now().toString()).set({
            message: issue,
            email: email
        }).then(()=> {
            return this.db.collection(this.issuesCollection).doc(Date.now().toString()).set({
                userid: userid,
                message: issue,
                email: email
            })
        })
    }

    public addTwitterAccount(userid:string, newTwitterUsernames:string[], newMonthlyCount:number){
        return this.db.collection(this.userCollection).doc(userid).set({
            [this.twitterAccountsArrayField]: newTwitterUsernames,
            [this.twitterAccountsMonthlyCounter]: newMonthlyCount
        }, {merge:true})
    }

    public removeTwitterAccount(userid:string, newTwitterUsernames:string[]){
        return this.db.collection(this.userCollection).doc(userid).set({
            [this.twitterAccountsArrayField]: newTwitterUsernames,
        }, {merge:true})
    }

    public resetTwitterMonthlyCounter(userid:string){
        return this.db.collection(this.userCollection).doc(userid).set({
            [this.twitterAccountsMonthlyCounter]: 0,
        }, {merge:true})
    }

    public getLinkedAccount(userid:string) {
        return this.db.collection(this.userCollection).doc(userid).get().then(snap => {
            return snap.get("linkedAccount")
        }).catch(err => err)
    }

    public saveLinkedAccount(userid:string, account:any){
        return this.db.collection(this.userCollection).doc(userid).set({
            "linkedAccount": account,
        }, {merge:true})
    }

    public async deleteAccountAndHoldings(userid:string){
        let doc = await this.db.collection(this.userCollection).doc(userid).get()
        this.deleteFieldFromDoc(doc, "linkedAccount")
        this.deleteFieldFromDoc(doc, "linkedHoldings")
    }

    public addLinkedAccountBalanceToBalancesCollection(userid:string, balance:any){
        return this.db.collection(this.userCollection).doc(userid).collection("balances").doc(Date.now().toString()).set({
            "balance": balance
        }, {merge:false})
    }

    public getLinkedAccountBalanceHistory(userid:string) {
        return this.db.collection(this.userCollection).doc(userid).collection("balances").get().then(snap => {
            let retArr:any[] = []
            if (!snap) {
                return retArr
            }
            for (let doc of snap.docs){
                let balance = doc.data().balance
                retArr.push({
                    timestamp: Utilities.convertUnixTimestampToDateString(parseInt(doc.id)),
                    balance:balance
                })
            }
            return retArr
        }).catch(err => err)
    }

    public updateLinkedAccountBalanceInDoc(userid:string, balance:any){
        return this.db.collection(this.userCollection).doc(userid).set({
            "linkedAccount": {
                balances: balance
            },
        }, {merge:true})
    }

    public getLinkedHoldings(userid:string){
        return this.db.collection(this.userCollection).doc(userid).get().then(snap => {
            return snap.get("linkedHoldings")
        }).catch(err => err)
    }

    public saveLinkedHoldings(userid:string, holdings){
        return this.db.collection(this.userCollection).doc(userid).set({
            "linkedHoldings": holdings,
        }, {merge:true})
    }
}