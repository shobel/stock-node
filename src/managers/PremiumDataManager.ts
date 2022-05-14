import StockDao from "../dao/StockDao";
import IexDataService from "../services/IexDataService";
import Utilities from "../utils/Utilities";
import UserDao from "../dao/UserDao";
import AppDao from "../dao/AppDao";
import UserManager from "./UserManager";
import PremiumTransactionHistoryDao from "../dao/PremiumTransactionHistoryDao";
import PremiumTransactionItem from "../models/PremiumTransactionItem";
import StockDataManager from "./StockDataManager";
import MarketDataManager from "./MarketDataManager";

export default class PremiumDataManager {
    private static premiumTransactionHistoryDao = PremiumTransactionHistoryDao.getPremiumTransactionHistoryDaoInstance()

    private static PREMIUM_KAVOUT_KSCORE:string = "PREMIUM_KAVOUT_KSCORE"
    private static PREMIUM_BRAIN_SENTIMENT_30_DAYS:string = "PREMIUM_BRAIN_SENTIMENT_30_DAYS"
    private static PREMIUM_BRAIN_RANKING_21_DAYS:string = "PREMIUM_BRAIN_RANKING_21_DAYS"
    private static PREMIUM_BRAIN_LANGUAGE_METRICS_ALL:string = "PREMIUM_BRAIN_LANGUAGE_METRICS_ALL"
    private static STOCKTWITS_SENTIMENT:string = "STOCKTWITS_SENTIMENT"
    public static TOP_ANALYSTS_PACKAGE_ID:string = "TOP_ANALYSTS_SCORES"
    public static PREMIUM_PRECISION_ALPHA_PRICE_DYNAMICS:string = "PREMIUM_PRECISION_ALPHA_PRICE_DYNAMICS"
    public static EXTRACT_ALPHA_CROSS_ASSET_MODEL:string = "EXTRACT_ALPHA_CROSS_ASSET_MODEL"
    public static EXTRACT_ALPHA_TACTICAL_MODEL:string = "EXTRACT_ALPHA_TACTICAL_MODEL"

    public static TOP_ANALYSTS_DOC_ID:string = "analysts"
    private static TOP_ANALYSTS_SUB_EXPIREY_MS:number = 2600000000

    //nonpremium data, why are they here? dont ask
    public static USER_CUSTOMIZED = "USER_CUSTOMIZED"
    public static ANALYST_RECOMMENDATIONS = "ANALYST_RECOMMENDATIONS"
    public static ANALYST_PRICE_TARGET_UPSIDE = "ANALYST_PRICE_TARGET_UPSIDE"

    public static getPremiumPackages() {
        return AppDao.getAppDaoInstance().getPremiumPackages()
    }

    public static isNonPremium(packageId:string){
        return packageId == PremiumDataManager.USER_CUSTOMIZED || packageId == PremiumDataManager.ANALYST_PRICE_TARGET_UPSIDE || packageId == PremiumDataManager.ANALYST_RECOMMENDATIONS
    }

    public static spendCreditsForTopAnalysts(userid:string, symbol:string, packageId:string) {
        let error:any = null
        let timestamp:any = Date.now()
        return AppDao.getAppDaoInstance().getPremiumPackageById(packageId).then(p => {
            return UserManager.getCreditsForUser(userid).then(oldCredits => {
                if (oldCredits >= p.credits) {
                    return true
                }
                return false
            })
        }).then(canAfford => {
            if (canAfford) {
                return UserDao.getUserDaoInstance().setSavedPremiumDataInfoForUser(symbol, userid, packageId, timestamp)  
            }
            error = "Not enough credits."
            timestamp = null
            return null
        }).then(write => {
            if (write){
                return AppDao.getAppDaoInstance().getPremiumPackageById(packageId)
            } else {
                timestamp = null
            }
            if (!error && !write){
                error = "You already have the most recent version this data."
            }
            return null
        }).then(pkg => {
            if (pkg) {
                let credits = pkg.credits
                let premiumTransaction: PremiumTransactionItem = {
                    userid: userid,
                    packageid: packageId,
                    symbol: symbol,
                    timestamp: timestamp,
                    credits: credits
                }
                PremiumDataManager.savePremiumTransaction(premiumTransaction).then(res => res).catch(err => err)
                return UserManager.giveOrTakeCreditsToUser(userid, -credits)
            }
            if (!error && !pkg) {
                error = "Package doesn't exist."
            }
            return null
        }).then(write => {
            if (!error && !write) {
                error = "Error modifying user's credit balance."
            }
            return UserManager.getCreditsForUser(userid)
        }).then(newCredits => {
            //at this point, if the error has a value (not null) then a failure has prevented us from carrying out
            //the process of getting new data, saving it, and reducing the user's credit balance. Thus, if the phone
            //receives a not null error, we can safely say that the user's credit balance has not been reduced
            return {
                data: timestamp,
                credits: newCredits,
                error: error
            }
        }).catch(err => err)
    }

    public static spendCreditsForPremiumData(userid:string, symbol:string, packageId:string) {
        let todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        let premiumData:any = null
        let error:any = null
        return AppDao.getAppDaoInstance().getPremiumPackageById(packageId).then(p => {
            return UserManager.getCreditsForUser(userid).then(oldCredits => {
                if (oldCredits >= p.credits) {
                    return true
                }
                return false
            })
        }).then(canAfford => {
            if (canAfford) {
                //fetch premium data from database or iex 
                return PremiumDataManager.getPremiumDataDocFromPackageIdAndDate(symbol, packageId)
            }
            error = "Not enough credits."
            return null
        }).then(result => {
            if (result) {
                premiumData = result
                return UserDao.getUserDaoInstance().setSavedPremiumDataInfoForUser(symbol, userid, packageId, todayString)
            }    
            if (!error && !result){
                error = "Data is unavailable for this stock."
            }
            return null 
        }).then(write => {
            if (write) {
                return AppDao.getAppDaoInstance().getPremiumPackageById(packageId)
            }
            if (!error && !write){
                error = "You already have the most recent version this data."
            }
            return null
        }).then(pkg => {
            if (pkg) {
                let credits = pkg.credits
                let timestamp = Date.now()
                let premiumTransaction:PremiumTransactionItem = {
                    userid: userid,
                    packageid: packageId,
                    symbol: symbol,
                    timestamp: timestamp,
                    credits: credits
                }
                PremiumDataManager.savePremiumTransaction(premiumTransaction).then(res => res).catch(err => err)
                return UserManager.giveOrTakeCreditsToUser(userid, -credits)
            }
            if (!error && !pkg){
                error = "Package doesn't exist."
            }
            return null
        }).then(write => {
            if (!error && !write) {
                error = "Error modifying user's credit balance."
            }
            return UserManager.getCreditsForUser(userid)
        }).then(newCredits => {
            //at this point, if the error has a value (not null) then a failure has prevented us from carrying out
            //the process of getting new data, saving it, and reducing the user's credit balance. Thus, if the phone
            //receives a not null error, we can safely say that the user's credit balance has not been reduced
            return {
                data: premiumData,
                credits: newCredits,
                error: error
            } 
        }).catch(err => err)
    }

    public static getPremiumDataForUserAndStock(symbol:string, userid:string) {
        let combinedPremiumData:any = {}
        return UserDao.getUserDaoInstance().getSavedPremiumDataInfoForUser(symbol, userid).then(async packages => {
            if (packages){
                for (const [pid, date] of Object.entries(packages)) {
                    let dateString:string = date as string
                    let data = await this.getPremiumDataDocFromPackageIdAndDate(symbol, pid, dateString) 
                    combinedPremiumData[pid] = data
                }
            }
            return combinedPremiumData
        })
    }

    public static getPremiumDataTransactionHistoryForUser(userid:string){
        return PremiumDataManager.premiumTransactionHistoryDao.getTransactionsForUser(userid)
    }

    public static savePremiumTransaction(premiumTransaction:PremiumTransactionItem){
        return PremiumDataManager.premiumTransactionHistoryDao.addTransaction(premiumTransaction)
    }

    public static async getLatestPremiumDataTypeForSymbols(symbols:string[], packageId, userid){
        if (!symbols || !symbols.length) {
            return null
        }
        let combinedData:any = {}
        if (PremiumDataManager.isNonPremium(packageId)){
            switch (packageId){
                case PremiumDataManager.USER_CUSTOMIZED:
                    return await StockDataManager.applyUserScoreSettings(userid, symbols)
                case PremiumDataManager.ANALYST_RECOMMENDATIONS:
                    for (let symbol of symbols){
                        let snap = StockDataManager.stockDao.getStockDocumentSnapshotForSymbol(symbol)
                        if (snap) {
                            combinedData[symbol] = snap.get(StockDataManager.stockDao.latestRecommendations)
                        }
                    }
                    return combinedData
                case PremiumDataManager.ANALYST_PRICE_TARGET_UPSIDE:
                    for (let symbol of symbols){
                        let snap = StockDataManager.stockDao.getStockDocumentSnapshotForSymbol(symbol)
                        if (snap) {
                            combinedData[symbol] = snap.get(StockDataManager.stockDao.latestPriceTarget)
                        }
                    }
                    return combinedData    
            }
            return null
        } else if (packageId == PremiumDataManager.TOP_ANALYSTS_PACKAGE_ID) {
            let subscribed = await PremiumDataManager.getTopAnalystsSubscription(userid)
            if (!subscribed){
                return null
            }
            if (!MarketDataManager.tipranksSymbolCache || Date.now() - MarketDataManager.tipranksSymbolCacheLastUpdate > MarketDataManager.tipranksSymbolCacheUpdateIntervalMs) {
                let collectionRef = await StockDao.getStockDaoInstance().getTipranksTopAnalystsSymbolsCollectionRef()
                let docMap:any = {}
                for (let doc of collectionRef.docs){
                    docMap[doc.id] = doc
                }
                for (let symbol of symbols) {
                    if (docMap[symbol]){
                        combinedData[symbol] = docMap[symbol].data()
                    }                    
                }
                return combinedData   
            } else {
                let cache = MarketDataManager.tipranksSymbolCache
                for (let item of cache){
                    if (symbols.includes(item.symbol)){
                        combinedData[item.symbol] = item 
                    }
                }
                return combinedData 
            }
        } else {
            let packageIdToDateMap:any = {}
            for (let symbol of symbols){
                let savedPackageIds = await UserDao.getUserDaoInstance().getSavedPremiumDataInfoForUser(symbol, userid)
                if (!savedPackageIds){
                    continue
                }
                for (let [pkg, date] of Object.entries(savedPackageIds)){
                    if (pkg == packageId){
                        packageIdToDateMap[symbol] = date
                        break
                    }
                }
            }
            for (let [symbol, date] of Object.entries(packageIdToDateMap)) {
                let d = await PremiumDataManager.getPremiumDataDocFromPackageIdAndDate(symbol, packageId, date as any)
                combinedData[symbol] = d
            }
            return combinedData
        }
    }

    //- if a date is not supplied (empty string), then the purpose is to fetch from IEX 
    //  or just get from our database if we already have the most up-to-date data (today's data)
    //- if a date is supplied then the purpose is to get data from a specific date, in which case
    //  we would not and could not fetch from iex, so should exist
    public static getPremiumDataDocFromPackageIdAndDate(symbol:string, packageId:string, date:string = "") {
        let subCollection = ""
        let endpoint = ""
        switch (packageId) {
            case PremiumDataManager.PREMIUM_KAVOUT_KSCORE:
                subCollection = StockDao.getStockDaoInstance().kScoreCollection
                endpoint = IexDataService.getIexDataServiceInstance().kscoreEndpoint
                break
            case PremiumDataManager.PREMIUM_BRAIN_SENTIMENT_30_DAYS:
                subCollection = StockDao.getStockDaoInstance().brain30SentimentCollection
                endpoint = IexDataService.getIexDataServiceInstance().brain30SentimentEndpoint
                break
            case PremiumDataManager.PREMIUM_BRAIN_RANKING_21_DAYS:
                subCollection = StockDao.getStockDaoInstance().brain21RankingCollection
                endpoint = IexDataService.getIexDataServiceInstance().brain21RankingEndpoint
                break
            case PremiumDataManager.PREMIUM_BRAIN_LANGUAGE_METRICS_ALL:
                subCollection = StockDao.getStockDaoInstance().brainLanguageCollection
                endpoint = IexDataService.getIexDataServiceInstance().brainLanguageEndpoint
                break
            case PremiumDataManager.STOCKTWITS_SENTIMENT:
                subCollection = StockDao.getStockDaoInstance().stocktwitsSentimentCollection
                endpoint = IexDataService.getIexDataServiceInstance().stocktwitsSentimentEndpoint
                break
            case PremiumDataManager.PREMIUM_PRECISION_ALPHA_PRICE_DYNAMICS:
                subCollection = StockDao.getStockDaoInstance().precisionAlphaCollection
                endpoint = IexDataService.getIexDataServiceInstance().precisionAlpha
                break
            case PremiumDataManager.EXTRACT_ALPHA_CROSS_ASSET_MODEL:
                subCollection = StockDao.getStockDaoInstance().crossAssetCollection
                endpoint = IexDataService.getIexDataServiceInstance().crossAsset
                break
            case PremiumDataManager.EXTRACT_ALPHA_TACTICAL_MODEL:
                subCollection = StockDao.getStockDaoInstance().tacticalModelCollection
                endpoint = IexDataService.getIexDataServiceInstance().tacticalModel
                break
        }
        if (date == ""){
            return PremiumDataManager.getLatestPremiumDataForSymbol(symbol, subCollection, endpoint, true)
        } else {
            return StockDao.getStockDaoInstance().getDocFromSubCollectionForSymbol(symbol, subCollection, date)        
        }
    }

    //fetches from iex if there is no data at all in the collection or if the latest data we have is not the most up to date
    //therefore we can only call this function if we will or already have taken credits away from the user
    private static getLatestPremiumDataForSymbol(symbol:string, collection:string, endpoint:string, isIexArray:boolean) {
        let todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        let needToFetch:boolean = false
        return StockDao.getStockDaoInstance().getMostRecentDocFromSubCollectionForSymbol(symbol, collection)
        .then(result => {
            if (!result || result.id != todayString) {
                needToFetch = true
                return IexDataService.getIexDataServiceInstance().getPremiumDatatypeForSymbol(symbol, endpoint)
            }
            return result
        }).then(data => {
            let dataToSave = data
            if (needToFetch && data){
                if (isIexArray && data && data.length > 0) {
                    dataToSave = data[0]
                }
                if (Array.isArray(dataToSave) && !dataToSave.length) {
                    return null
                }
                const todayStringNew = Utilities.convertUnixTimestampToDateString(Date.now())
                StockDao.getStockDaoInstance().saveDocInSubcollectionForSymbol(symbol, collection, todayStringNew, dataToSave).then(()=> {}).catch(err => {})
            }
            return dataToSave
        })
    }

    public static getTopAnalystsSubscription(userid:string){
        return UserDao.getUserDaoInstance().getTopAnalystsSubscription(userid).then(result => {
            if (result) {
                if (Date.now() - result < PremiumDataManager.TOP_ANALYSTS_SUB_EXPIREY_MS){
                    return result
                }
            }
            return null
        })
    }
}