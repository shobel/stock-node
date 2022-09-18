"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StockDao_1 = require("../dao/StockDao");
const IexDataService_1 = require("../services/IexDataService");
const Utilities_1 = require("../utils/Utilities");
const UserDao_1 = require("../dao/UserDao");
const AppDao_1 = require("../dao/AppDao");
const UserManager_1 = require("./UserManager");
const PremiumTransactionHistoryDao_1 = require("../dao/PremiumTransactionHistoryDao");
const StockDataManager_1 = require("./StockDataManager");
const MarketDataManager_1 = require("./MarketDataManager");
class PremiumDataManager {
    static getPremiumPackages() {
        return AppDao_1.default.getAppDaoInstance().getPremiumPackages();
    }
    static isNonPremium(packageId) {
        return packageId == PremiumDataManager.USER_CUSTOMIZED || packageId == PremiumDataManager.ANALYST_PRICE_TARGET_UPSIDE || packageId == PremiumDataManager.ANALYST_RECOMMENDATIONS;
    }
    static spendCreditsForTopAnalysts(userid, symbol, packageId) {
        let error = null;
        let timestamp = Date.now();
        return AppDao_1.default.getAppDaoInstance().getPremiumPackageById(packageId).then(p => {
            return UserManager_1.default.getCreditsForUser(userid).then(oldCredits => {
                if (oldCredits >= p.credits) {
                    return true;
                }
                return false;
            });
        }).then(canAfford => {
            if (canAfford) {
                return UserDao_1.default.getUserDaoInstance().setSavedPremiumDataInfoForUser(symbol, userid, packageId, timestamp);
            }
            error = "Not enough credits.";
            timestamp = null;
            return null;
        }).then(write => {
            if (write) {
                return AppDao_1.default.getAppDaoInstance().getPremiumPackageById(packageId);
            }
            else {
                timestamp = null;
            }
            if (!error && !write) {
                error = "You already have the most recent version this data.";
            }
            return null;
        }).then(pkg => {
            if (pkg) {
                let credits = pkg.credits;
                let premiumTransaction = {
                    userid: userid,
                    packageid: packageId,
                    symbol: symbol,
                    timestamp: timestamp,
                    credits: credits
                };
                PremiumDataManager.savePremiumTransaction(premiumTransaction).then(res => res).catch(err => err);
                return UserManager_1.default.giveOrTakeCreditsToUser(userid, -credits);
            }
            if (!error && !pkg) {
                error = "Package doesn't exist.";
            }
            return null;
        }).then(write => {
            if (!error && !write) {
                error = "Error modifying user's credit balance.";
            }
            return UserManager_1.default.getCreditsForUser(userid);
        }).then(newCredits => {
            //at this point, if the error has a value (not null) then a failure has prevented us from carrying out
            //the process of getting new data, saving it, and reducing the user's credit balance. Thus, if the phone
            //receives a not null error, we can safely say that the user's credit balance has not been reduced
            return {
                data: timestamp,
                credits: newCredits,
                error: error
            };
        }).catch(err => err);
    }
    static spendCreditsForPremiumData(userid, symbol, packageId) {
        let todayString = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        let premiumData = null;
        let error = null;
        return AppDao_1.default.getAppDaoInstance().getPremiumPackageById(packageId).then(p => {
            return UserManager_1.default.getCreditsForUser(userid).then(oldCredits => {
                if (oldCredits >= p.credits) {
                    return true;
                }
                return false;
            });
        }).then(canAfford => {
            if (canAfford) {
                //fetch premium data from database or iex 
                return PremiumDataManager.getPremiumDataDocFromPackageIdAndDate(symbol, packageId);
            }
            error = "Not enough credits.";
            return null;
        }).then(result => {
            if (result) {
                premiumData = result;
                return UserDao_1.default.getUserDaoInstance().setSavedPremiumDataInfoForUser(symbol, userid, packageId, todayString);
            }
            if (!error && !result) {
                error = "Data is unavailable for this stock.";
            }
            return null;
        }).then(write => {
            if (write) {
                return AppDao_1.default.getAppDaoInstance().getPremiumPackageById(packageId);
            }
            if (!error && !write) {
                error = "You already have the most recent version this data.";
            }
            return null;
        }).then(pkg => {
            if (pkg) {
                let credits = pkg.credits;
                let timestamp = Date.now();
                let premiumTransaction = {
                    userid: userid,
                    packageid: packageId,
                    symbol: symbol,
                    timestamp: timestamp,
                    credits: credits
                };
                PremiumDataManager.savePremiumTransaction(premiumTransaction).then(res => res).catch(err => err);
                return UserManager_1.default.giveOrTakeCreditsToUser(userid, -credits);
            }
            if (!error && !pkg) {
                error = "Package doesn't exist.";
            }
            return null;
        }).then(write => {
            if (!error && !write) {
                error = "Error modifying user's credit balance.";
            }
            return UserManager_1.default.getCreditsForUser(userid);
        }).then(newCredits => {
            //at this point, if the error has a value (not null) then a failure has prevented us from carrying out
            //the process of getting new data, saving it, and reducing the user's credit balance. Thus, if the phone
            //receives a not null error, we can safely say that the user's credit balance has not been reduced
            return {
                data: premiumData,
                credits: newCredits,
                error: error
            };
        }).catch(err => err);
    }
    static getPremiumDataForUserAndStock(symbol, userid) {
        let combinedPremiumData = {};
        return UserDao_1.default.getUserDaoInstance().getSavedPremiumDataInfoForUser(symbol, userid).then(async (packages) => {
            if (packages) {
                for (const [pid, date] of Object.entries(packages)) {
                    let dateString = date;
                    let data = await this.getPremiumDataDocFromPackageIdAndDate(symbol, pid, dateString);
                    combinedPremiumData[pid] = data;
                }
            }
            return combinedPremiumData;
        });
    }
    static getPremiumDataTransactionHistoryForUser(userid) {
        return PremiumDataManager.premiumTransactionHistoryDao.getTransactionsForUser(userid);
    }
    static savePremiumTransaction(premiumTransaction) {
        return PremiumDataManager.premiumTransactionHistoryDao.addTransaction(premiumTransaction);
    }
    static async getLatestPremiumDataTypeForSymbols(symbols, packageId, userid) {
        if (!symbols || !symbols.length) {
            return null;
        }
        let combinedData = {};
        if (PremiumDataManager.isNonPremium(packageId)) {
            switch (packageId) {
                case PremiumDataManager.USER_CUSTOMIZED:
                    return await StockDataManager_1.default.applyUserScoreSettings(userid, symbols);
                case PremiumDataManager.ANALYST_RECOMMENDATIONS:
                    for (let symbol of symbols) {
                        let snap = StockDataManager_1.default.stockDao.getStockDocumentSnapshotForSymbol(symbol);
                        if (snap) {
                            combinedData[symbol] = snap.get(StockDataManager_1.default.stockDao.latestRecommendations);
                        }
                    }
                    return combinedData;
                case PremiumDataManager.ANALYST_PRICE_TARGET_UPSIDE:
                    for (let symbol of symbols) {
                        let snap = StockDataManager_1.default.stockDao.getStockDocumentSnapshotForSymbol(symbol);
                        if (snap) {
                            combinedData[symbol] = snap.get(StockDataManager_1.default.stockDao.latestPriceTarget);
                        }
                    }
                    return combinedData;
            }
            return null;
        }
        else if (packageId == PremiumDataManager.TOP_ANALYSTS_PACKAGE_ID) {
            let subscribed = await PremiumDataManager.getTopAnalystsSubscription(userid);
            if (!subscribed) {
                return null;
            }
            if (!MarketDataManager_1.default.tipranksSymbolCache || Date.now() - MarketDataManager_1.default.tipranksSymbolCacheLastUpdate > MarketDataManager_1.default.tipranksSymbolCacheUpdateIntervalMs) {
                let collectionRef = await StockDao_1.default.getStockDaoInstance().getTipranksTopAnalystsSymbolsCollectionRef();
                let docMap = {};
                for (let doc of collectionRef.docs) {
                    docMap[doc.id] = doc;
                }
                for (let symbol of symbols) {
                    if (docMap[symbol]) {
                        combinedData[symbol] = docMap[symbol].data();
                    }
                }
                return combinedData;
            }
            else {
                let cache = MarketDataManager_1.default.tipranksSymbolCache;
                for (let item of cache) {
                    if (symbols.includes(item.symbol)) {
                        combinedData[item.symbol] = item;
                    }
                }
                return combinedData;
            }
        }
        else {
            let packageIdToDateMap = {};
            for (let symbol of symbols) {
                let savedPackageIds = await UserDao_1.default.getUserDaoInstance().getSavedPremiumDataInfoForUser(symbol, userid);
                if (!savedPackageIds) {
                    continue;
                }
                for (let [pkg, date] of Object.entries(savedPackageIds)) {
                    if (pkg == packageId) {
                        packageIdToDateMap[symbol] = date;
                        break;
                    }
                }
            }
            for (let [symbol, date] of Object.entries(packageIdToDateMap)) {
                let d = await PremiumDataManager.getPremiumDataDocFromPackageIdAndDate(symbol, packageId, date);
                combinedData[symbol] = d;
            }
            return combinedData;
        }
    }
    //- if a date is not supplied (empty string), then the purpose is to fetch from IEX 
    //  or just get from our database if we already have the most up-to-date data (today's data)
    //- if a date is supplied then the purpose is to get data from a specific date, in which case
    //  we would not and could not fetch from iex, so should exist
    static getPremiumDataDocFromPackageIdAndDate(symbol, packageId, date = "") {
        let subCollection = "";
        let endpoint = "";
        switch (packageId) {
            case PremiumDataManager.PREMIUM_KAVOUT_KSCORE:
                subCollection = StockDao_1.default.getStockDaoInstance().kScoreCollection;
                endpoint = IexDataService_1.default.getIexDataServiceInstance().kscoreEndpoint;
                break;
            case PremiumDataManager.PREMIUM_BRAIN_SENTIMENT_30_DAYS:
                subCollection = StockDao_1.default.getStockDaoInstance().brain30SentimentCollection;
                endpoint = IexDataService_1.default.getIexDataServiceInstance().brain30SentimentEndpoint;
                break;
            case PremiumDataManager.PREMIUM_BRAIN_RANKING_21_DAYS:
                subCollection = StockDao_1.default.getStockDaoInstance().brain21RankingCollection;
                endpoint = IexDataService_1.default.getIexDataServiceInstance().brain21RankingEndpoint;
                break;
            case PremiumDataManager.PREMIUM_BRAIN_LANGUAGE_METRICS_ALL:
                subCollection = StockDao_1.default.getStockDaoInstance().brainLanguageCollection;
                endpoint = IexDataService_1.default.getIexDataServiceInstance().brainLanguageEndpoint;
                break;
            case PremiumDataManager.STOCKTWITS_SENTIMENT:
                subCollection = StockDao_1.default.getStockDaoInstance().stocktwitsSentimentCollection;
                endpoint = IexDataService_1.default.getIexDataServiceInstance().stocktwitsSentimentEndpoint;
                break;
            case PremiumDataManager.PREMIUM_PRECISION_ALPHA_PRICE_DYNAMICS:
                subCollection = StockDao_1.default.getStockDaoInstance().precisionAlphaCollection;
                endpoint = IexDataService_1.default.getIexDataServiceInstance().precisionAlpha;
                break;
            case PremiumDataManager.EXTRACT_ALPHA_CROSS_ASSET_MODEL:
                subCollection = StockDao_1.default.getStockDaoInstance().crossAssetCollection;
                endpoint = IexDataService_1.default.getIexDataServiceInstance().crossAsset;
                break;
            case PremiumDataManager.EXTRACT_ALPHA_TACTICAL_MODEL:
                subCollection = StockDao_1.default.getStockDaoInstance().tacticalModelCollection;
                endpoint = IexDataService_1.default.getIexDataServiceInstance().tacticalModel;
                break;
        }
        if (date == "") {
            return PremiumDataManager.getLatestPremiumDataForSymbol(symbol, subCollection, endpoint, true);
        }
        else {
            return StockDao_1.default.getStockDaoInstance().getDocFromSubCollectionForSymbol(symbol, subCollection, date);
        }
    }
    //fetches from iex if there is no data at all in the collection or if the latest data we have is not the most up to date
    //therefore we can only call this function if we will or already have taken credits away from the user
    static getLatestPremiumDataForSymbol(symbol, collection, endpoint, isIexArray) {
        let todayString = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        let needToFetch = false;
        return StockDao_1.default.getStockDaoInstance().getMostRecentDocFromSubCollectionForSymbol(symbol, collection)
            .then(result => {
            if (!result || result.id != todayString) {
                needToFetch = true;
                return IexDataService_1.default.getIexDataServiceInstance().getPremiumDatatypeForSymbol(symbol, endpoint);
            }
            return result;
        }).then(data => {
            let dataToSave = data;
            if (needToFetch && data) {
                if (isIexArray && data && data.length > 0) {
                    dataToSave = data[0];
                }
                if (Array.isArray(dataToSave) && !dataToSave.length) {
                    return null;
                }
                const todayStringNew = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
                StockDao_1.default.getStockDaoInstance().saveDocInSubcollectionForSymbol(symbol, collection, todayStringNew, dataToSave).then(() => { }).catch(err => { });
            }
            return dataToSave;
        });
    }
    static getTopAnalystsSubscription(userid) {
        return UserDao_1.default.getUserDaoInstance().getTopAnalystsSubscription(userid).then(result => {
            if (result) {
                if (Date.now() - result < PremiumDataManager.TOP_ANALYSTS_SUB_EXPIREY_MS) {
                    return result;
                }
            }
            return null;
        });
    }
}
exports.default = PremiumDataManager;
PremiumDataManager.premiumTransactionHistoryDao = PremiumTransactionHistoryDao_1.default.getPremiumTransactionHistoryDaoInstance();
PremiumDataManager.PREMIUM_KAVOUT_KSCORE = "PREMIUM_KAVOUT_KSCORE";
PremiumDataManager.PREMIUM_BRAIN_SENTIMENT_30_DAYS = "PREMIUM_BRAIN_SENTIMENT_30_DAYS";
PremiumDataManager.PREMIUM_BRAIN_RANKING_21_DAYS = "PREMIUM_BRAIN_RANKING_21_DAYS";
PremiumDataManager.PREMIUM_BRAIN_LANGUAGE_METRICS_ALL = "PREMIUM_BRAIN_LANGUAGE_METRICS_ALL";
PremiumDataManager.STOCKTWITS_SENTIMENT = "STOCKTWITS_SENTIMENT";
PremiumDataManager.TOP_ANALYSTS_PACKAGE_ID = "TOP_ANALYSTS_SCORES";
PremiumDataManager.PREMIUM_PRECISION_ALPHA_PRICE_DYNAMICS = "PREMIUM_PRECISION_ALPHA_PRICE_DYNAMICS";
PremiumDataManager.EXTRACT_ALPHA_CROSS_ASSET_MODEL = "EXTRACT_ALPHA_CROSS_ASSET_MODEL";
PremiumDataManager.EXTRACT_ALPHA_TACTICAL_MODEL = "EXTRACT_ALPHA_TACTICAL_MODEL";
PremiumDataManager.TOP_ANALYSTS_DOC_ID = "analysts";
PremiumDataManager.TOP_ANALYSTS_SUB_EXPIREY_MS = 2600000000;
//nonpremium data, why are they here? dont ask
PremiumDataManager.USER_CUSTOMIZED = "USER_CUSTOMIZED";
PremiumDataManager.ANALYST_RECOMMENDATIONS = "ANALYST_RECOMMENDATIONS";
PremiumDataManager.ANALYST_PRICE_TARGET_UPSIDE = "ANALYST_PRICE_TARGET_UPSIDE";
//# sourceMappingURL=PremiumDataManager.js.map