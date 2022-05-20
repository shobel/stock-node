import IexDataService from "../services/IexDataService";
import IexEarnings from "../models/IexEarnings";
import StockDataService from "../services/StockDataService";
import Utilities from "../utils/Utilities";
import QuoteService from "../services/QuoteService";
import StockDao from "../dao/StockDao";
import Company from "../models/Company";
import SimplifiedEarnings from "../models/SimplifiedEarnings";
import FMPService from "../services/FMPService";
import UserManager from "./UserManager";
import StocktwitsService from "../services/StocktwitsService";
import TipranksService from "../services/TipranksService";
import StockMarketUtility from "../utils/StockMarketUtility";

export default class StockDataManager {
    public static stockDao: StockDao = StockDao.getStockDaoInstance()
    private static iexDataService: IexDataService = IexDataService.getIexDataServiceInstance()

    private static freeDataCache:any = {}
    private static freeDataCacheExpirey:number = 43200000 //12 hours

    private static allCompaniesCache:any[] = []
    private static allCompaniesCacheValidity:number = 86400000 //24hours
    private static allCompaniesCacheLastUpdate:number = 0

    private static firstCache:any = {} //company logo peers
    //"second cache" is technically the socialsentiment and news caches because the numbers refer to UI tabs
    private static thirdCache:any = {} //financials
    private static fourthCache:any = {} //analysts
    private static groupedCacheValidity:number = 43200000 //12 hours

    private static socialSentimentCache:any = {}
    private static socialSentimentCacheValidity:number = 3600000 //1hour
    private static newsCache:any = {}
    private static newsCacheValidity:number = 3600000 //1hour
    private static newsSentimentCache:any = {}
    private static newsSentimentCacheValidity:number = 3600000 //1hour

    private static isCacheItemValid(symbol:string, cache:any, validity:number){
        if (cache.hasOwnProperty(symbol)){
            const cacheItem = cache[symbol]
            if (Date.now() - cacheItem.lastDbFetch < validity) {
                return cacheItem.data
            }
        } else {
            cache[symbol] = {
                data: null,
                lastDbFetch: 0
            }
        }
        return null
    }

    //stockdetailsvc info
    //first tab
    //no longer using cache because all the info in here is from the base stock doc which is snapshotted
    //the other tabs have data from different collections or subcollections where the snapshotting is more complicated and may not exist
    public static async statsPeersInsidersAndCompany(symbol:string){
        const combinedData:any = {}
        // let cacheData:any = StockDataManager.isCacheItemValid(symbol, StockDataManager.firstCache, StockDataManager.groupedCacheValidity)
        // if (cacheData){
        //     if (StockMarketUtility.getStockMarketUtility().isMarketOpen && cacheData.companyLogoPeers?.peers?.length) {
        //         return StockDataManager.getLatestQuotesForSymbols(cacheData.companyLogoPeers.peers, false).then(peerQuotes => {
        //             cacheData.peerQuotes = peerQuotes
        //             StockDataManager.firstCache[symbol] = {
        //                 data: cacheData,
        //                 lastDbFetch: Date.now()
        //             }
        //             return cacheData
        //         })
        //     }
        //     return Promise.resolve(cacheData)           
        // } else {
            let snap = StockDataManager.stockDao.getStockDocumentSnapshotForSymbol(symbol)
            if (snap) {
                combinedData["advanced"] = snap.get(StockDataManager.stockDao.latestAdvancedStats)
                await StockDataManager.getCompanyFieldForSymbol(symbol).then(data => {
                    combinedData["companyLogoPeers"] =data
                })
                // combinedData["keystats"] = snap.get(StockDataManager.stockDao.latestKeyStatsField)
                combinedData["insiders"] = await StockDataManager.getInsidersForSymbol(symbol)
                combinedData["estimates"] = snap.get(StockDataManager.stockDao.latestAnnualEstimates) //for pefwd
                let peers = []
                let companyField = combinedData["companyLogoPeers"]
                if (companyField && companyField.peers) {
                    peers = companyField.peers
                }
                if (peers.length) {
                    return StockDataManager.getLatestQuotesForSymbols(peers, false).then(peerQuotes => {
                        combinedData["peerQuotes"] = peerQuotes
                        // StockDataManager.firstCache[symbol] = {
                        //     data: combinedData,
                        //     lastDbFetch: Date.now()
                        // }
                        return combinedData
                    })
                } else {
                    return combinedData
                }
            }
            return null
        //}
    }

    //second tab - these have their own special caches because validity is much shorter, 1hr
    public static async newsAndSocial(symbol:string){
        const combinedData:any = {}
        combinedData["socialSentiment"] = await StockDataManager.getSocialSentimentForSymbol(symbol)
        combinedData["news"] = await StockDataManager.getNewsForSymbol(symbol)
        combinedData["newsSentiment"] = await StockDataManager.getNewsSentimentForSymbol(symbol)
        return combinedData
    }
    //third tab
    public static async financials(symbol:string){
        const combinedData:any = {}
        let cacheData = StockDataManager.isCacheItemValid(symbol, StockDataManager.thirdCache, StockDataManager.groupedCacheValidity)
        if (cacheData){
            return Promise.resolve(cacheData)           
        } else {
            return StockDataManager.getEarningsForSymbol(symbol, 8)
            .then(earnings => {
                combinedData["earnings"] = earnings
                return StockDataManager.getLatestFinancialDataForSymbol(symbol, StockDataManager.stockDao.incomeCollection, FMPService.incomeEndpoint, "quarter", 4)
            }).then(incomes => {
                combinedData["incomes"] = incomes
                return StockDataManager.getLatestFinancialDataForSymbol(symbol, StockDataManager.stockDao.annualIncomeCollection, FMPService.incomeEndpoint, "annual", 4)
            }).then(annualincomes => {
                combinedData["incomesAnnual"] = annualincomes
                return StockDataManager.getLatestFinancialDataForSymbol(symbol, StockDataManager.stockDao.cashFlowCollection, FMPService.cashFlowEndpoint, "quarter", 4)
            }).then(cashflow => {
                combinedData["cashflows"] = cashflow
                return StockDataManager.getLatestFinancialDataForSymbol(symbol, StockDataManager.stockDao.annualCashFlowCollection, FMPService.cashFlowEndpoint, "annual", 4)
            }).then(cashflowAnnual => {
                combinedData["cashflowsAnnual"] = cashflowAnnual                
                return StockDataManager.getLatestFinancialDataForSymbol(symbol, StockDataManager.stockDao.balanceSheetCollection, FMPService.balanceSheetEndpoint, "quarter", 4)
            }).then(balanceSheets => {
                combinedData["balanceSheets"] = balanceSheets
                return StockDataManager.getLatestFinancialDataForSymbol(symbol, StockDataManager.stockDao.annualBalanceSheetCollection, FMPService.balanceSheetEndpoint, "annual", 4)
            }).then(balanceSheetsAnnual => {
                combinedData["balanceSheetsAnnual"] = balanceSheetsAnnual
                StockDataManager.thirdCache[symbol] = {
                    data: combinedData,
                    lastDbFetch: Date.now()
                }
                return combinedData
            })
        }
    }
    //fourth tab
    public static async analysts(symbol:string){
        const combinedData:any = {}
        let cacheData = StockDataManager.isCacheItemValid(symbol, StockDataManager.fourthCache, StockDataManager.groupedCacheValidity)
        if (cacheData){
            return Promise.resolve(cacheData)           
        } else {
            let tipranksData = await StockDataManager.getTipranksDataForSymbol(symbol)
            if (tipranksData) {
                combinedData["tipranksAnalystsAll"] = tipranksData.experts;
            }
            let ptot = tipranksData?.priceTargetsOverTime
            if (ptot && ptot.length && ptot[0].date && ptot[0].date.includes("/")) {
                for (let p of ptot){
                    if ( p.date instanceof Date && !isNaN(p.date)){
                        let newDate = p.date.toLocaleDateString("en-US", { year: 'numeric' })              
                        + "-"+ p.date.toLocaleDateString("en-US", { month: '2-digit' })             
                        + "-" + p.date.toLocaleDateString("en-US", { day: '2-digit' })
                        p.date = newDate    
                    } 
                }
            }
            let bptot = tipranksData?.bestPriceTargetsOverTime
            if (bptot && bptot.length && bptot[0].date && bptot[0].date.includes("/")) {
                for (let p of bptot){
                    if ( p.date instanceof Date && !isNaN(p.date)){
                        let newDate = p.date.toLocaleDateString("en-US", { year: 'numeric' })              
                        + "-"+ p.date.toLocaleDateString("en-US", { month: '2-digit' })             
                        + "-" + p.date.toLocaleDateString("en-US", { day: '2-digit' })
                        p.date = newDate    
                    } 
                }
            }
            combinedData["priceTargetsOverTime"] = tipranksData?.priceTargetsOverTime
            combinedData["bestPriceTargetsOverTime"] = tipranksData?.bestPriceTargetsOverTime
            let snap = StockDataManager.stockDao.getStockDocumentSnapshotForSymbol(symbol)
            if (snap) {
                combinedData["priceTarget"] = snap.get(StockDataManager.stockDao.latestPriceTarget)
                combinedData["recommendations"] = snap.get(StockDataManager.stockDao.latestRecommendations)
            }
            return StockDataManager.getTipranksTopAnalystsForSymbol(symbol)
                .then(tipranksAnalysts => {
                    combinedData["tipranksAnalysts"] = tipranksAnalysts
                    StockDataManager.fourthCache[symbol] = {
                        data: combinedData,
                        lastDbFetch: Date.now()
                    }
                    return combinedData
                })
        }
    }

    public static async getAllFreeDataForSymbol(symbol:string){
        let cacheData = StockDataManager.isCacheItemValid(symbol, StockDataManager.freeDataCache, StockDataManager.freeDataCacheExpirey)
        if (cacheData) {
            //on demand data
            let tipranksData = await StockDataManager.getTipranksDataForSymbol(symbol)
            cacheData["tipranksAnalystsAll"] = tipranksData.experts
            cacheData["priceTargetsOverTime"] = tipranksData.priceTargetsOverTime
            cacheData["bestPriceTargetsOverTime"] = tipranksData.bestPriceTargetsOverTime
            return Promise.resolve(cacheData)
        } else {
            const combinedData: any = {}
            let snap = StockDataManager.stockDao.getStockDocumentSnapshotForSymbol(symbol)
            if (snap) {
                combinedData["companyLogoPeers"] = snap.get(StockDataManager.stockDao.companyField)
                // combinedData["keystats"] = snap.get(StockDataManager.stockDao.latestKeyStatsField)
                combinedData["advanced"] = snap.get(StockDataManager.stockDao.latestAdvancedStats)
                combinedData["priceTarget"] = snap.get(StockDataManager.stockDao.latestPriceTarget)
                combinedData["recommendations"] = snap.get(StockDataManager.stockDao.latestRecommendations)
                combinedData["estimates"] = snap.get(StockDataManager.stockDao.latestAnnualEstimates)
                let insiders = await StockDataManager.getInsidersForSymbol(symbol)
                if (insiders != null) {
                    combinedData["insiders"] = insiders
                }
                combinedData["institutions"] = snap.get(StockDataManager.stockDao.institutionalOwnership)

                let peers = []
                let companyField = snap.get(StockDataManager.stockDao.companyField)
                if (companyField && companyField.peers) {
                    peers = companyField.peers
                }
                if (peers.length) {
                    let peerQuotes = await StockDataManager.getLatestQuotesForSymbols(peers, false)
                    combinedData["peerQuotes"] = peerQuotes
                }
            }
            return StockDataManager.getNewsForSymbol(symbol)
                .then(news => {
                    combinedData["news"] = news
                    return StockDataManager.getTipranksTopAnalystsForSymbol(symbol)
                }).then(tipranksAnalysts => {
                    combinedData["tipranksAnalysts"] = tipranksAnalysts
                    return StockDataManager.getTipranksDataForSymbol(symbol)
                }).then(tipranksData => {
                    if (tipranksData) {
                        combinedData["tipranksAnalystsAll"] = tipranksData.experts
                        combinedData["priceTargetsOverTime"] = tipranksData.priceTargetsOverTime
                        combinedData["bestPriceTargetsOverTime"] = tipranksData.bestPriceTargetsOverTime
                    }
                    return StockDataManager.getEarningsForSymbol(symbol, 8)
                }).then(earnings => {
                    combinedData["earnings"] = earnings
                    return StockDataManager.getLatestFinancialDataForSymbol(symbol, StockDataManager.stockDao.incomeCollection, FMPService.incomeEndpoint, "quarter", 4)
                }).then(incomes => {
                    combinedData["incomes"] = incomes
                    return StockDataManager.getLatestFinancialDataForSymbol(symbol, StockDataManager.stockDao.annualIncomeCollection, FMPService.incomeEndpoint, "annual", 4)
                }).then(annualincomes => {
                    combinedData["incomesAnnual"] = annualincomes
                    return StockDataManager.getLatestFinancialDataForSymbol(symbol, StockDataManager.stockDao.cashFlowCollection, FMPService.cashFlowEndpoint, "quarter", 4)
                }).then(cashflow => {
                    combinedData["cashflows"] = cashflow
                    return StockDataManager.getLatestFinancialDataForSymbol(symbol, StockDataManager.stockDao.annualCashFlowCollection, FMPService.cashFlowEndpoint, "annual", 4)
                }).then(cashflowAnnual => {
                    combinedData["cashflowsAnnual"] = cashflowAnnual
                    return StockDataManager.getLatestFinancialDataForSymbol(symbol, StockDataManager.stockDao.balanceSheetCollection, FMPService.balanceSheetEndpoint, "quarter", 4)
                }).then(balanceSheets => {
                    combinedData["balanceSheets"] = balanceSheets
                    return StockDataManager.getLatestFinancialDataForSymbol(symbol, StockDataManager.stockDao.annualBalanceSheetCollection, FMPService.balanceSheetEndpoint, "annual", 4)
                }).then(balanceSheetsAnnual => {
                    combinedData["balanceSheetsAnnual"] = balanceSheetsAnnual
                    StockDataManager.freeDataCache[symbol] = {
                        data: combinedData,
                        lastDbFetch: Date.now()
                    }
                    return combinedData
                }).catch()
        }
    }

    // Fetches and saves ARRAY type fundamental stock info. Returns most recent 4 array items for symbol.
    // Uses the earnings report date to figure out if the data is the most recent, therefore this function only fetches new data maximum of once per quarter 
    // Works for CASH-FLOWS, BALANCE SHEETS, INCOME STATEMENTS (any array type data with reportDate field that can be compared to earnings EPSReportDate)
    // 3 logic branches:
    // 1. If we have the most recent data in the database already, just return that
    // 2. If we have some data in the database but not the most recent, we will get the latest sheet from iex, save it and return it
    // 3. If we have no data in the database, try to get the last 12, save them and return the latest one [0]
    public static getLatestFinancialDataForSymbol(symbol: string, collection: string, endpoint: string, period:string, limit:number) {
        let needToFetch: boolean = false
        return StockDataManager.stockDao.getMostRecentDocsFromSubCollectionForSymbol(symbol, collection, 16)
            .then(fundamentalDataDb => {
                //if theres no data in db, fetch some more
                if (!fundamentalDataDb || fundamentalDataDb.length === 0) {
                    needToFetch = true
                    return FMPService.getFinancialDataForSymbol(symbol, period, endpoint, 16)
                }
                return fundamentalDataDb
            }).then((fundamentalData: any[]) => {
                if (needToFetch) {
                    const simplifiedData: any[] = []
                    for (let fd of fundamentalData) {
                        if (collection === StockDataManager.stockDao.cashFlowCollection) {
                            fd = FMPService.convertCashFlowToSimple(fd)
                        } else if (collection === StockDataManager.stockDao.incomeCollection) {
                            fd = FMPService.convertIncomeStatementToSimple(fd)
                        } else if (collection === StockDataManager.stockDao.balanceSheetCollection) {
                            fd = FMPService.convertBalanceSheetToSimple(fd)
                        }
                        simplifiedData.push(fd)
                        StockDataManager.stockDao.saveDocInSubcollectionForSymbol(symbol, collection, fd.reportDate, fd).then().catch()
                    }
                    if (simplifiedData.length > 0) {
                        return simplifiedData.slice(0, limit)
                    } else {
                        return simplifiedData
                    }
                } else {
                    return fundamentalData.slice(0, limit)
                }
            }).then(newFundamentalDataDb => newFundamentalDataDb)
            .catch()
    }

    // Earnings are scheduled to update every time there is new earnings avaiable
    // When user requests earnings, we get them from database, but if there isn't any, we get from source first
    public static getEarningsForSymbol(symbol: string, limit:any) {
        let needToFetch = false
        return StockDataManager.stockDao.getMostRecentDocsFromSubCollectionForSymbol(symbol, StockDataManager.stockDao.earningsCollection, limit).then((earningsDB:IexEarnings[]) => {
            if (!earningsDB || earningsDB.length === 0) {
                needToFetch = true
                return FMPService.getEarningsForSymbol(symbol, limit).then((earnings: SimplifiedEarnings[]) => {
                    return StockDataManager.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(this.stockDao.stockCollection,
                        this.stockDao.earningsCollection, 'EPSReportDate', {
                        [symbol]: earnings
                    })
                })
            } else {
                return earningsDB.slice(0, limit)
            }
        }).then(result => {
            if (needToFetch){
                return StockDataManager.stockDao.getMostRecentDocsFromSubCollectionForSymbol(symbol, StockDataManager.stockDao.earningsCollection, limit).then((earningsDB:SimplifiedEarnings[]) => {
                    return earningsDB.slice(0, limit)
                })
            } else {
                return result
            }
        })
    }
    /* Company, logo and peers - refreshes every 2 days on demand (not scheduled) */
    public static getCompanyFieldForSymbol(symbol: string) {
        let data = StockDataManager.stockDao.getStockDocumentFieldForSymbol(symbol, StockDataManager.stockDao.companyField)
        if (!data || !data.lastUpdated || ((Date.now() - data.lastUpdated) >  172800000)) { //48hr
            return FMPService.getCompanyProfileAndPeers(symbol).then(data => {
                StockDataManager.stockDao.saveStockDocumentFieldForSymbol(symbol, StockDataManager.stockDao.companyField, data).catch()
                return data
            })
        }
        return Promise.resolve(data)
    }

    public static async getSocialSentimentForSymbol(symbol:string) {
        let cacheItem = StockDataManager.socialSentimentCache[symbol]
        if (cacheItem && cacheItem.lastUpdated && (Date.now() - cacheItem.lastUpdated) <= StockDataManager.socialSentimentCacheValidity) {
            return cacheItem
        } else {
            let ss:any = await FMPService.getSocialSentiment(symbol)
            ss.lastUpdated = Date.now()
            StockDataManager.socialSentimentCache[symbol] = ss
            return ss
        }
    }
    public static async getNewsForSymbol(symbol:string) {
        let cacheItem = StockDataManager.newsCache[symbol]
        if (cacheItem && cacheItem.lastUpdated && (Date.now() - cacheItem.lastUpdated) <= StockDataManager.newsCacheValidity) {
            return cacheItem
        } else {
            let news:any = await FMPService.getNewsForSymbol(symbol, 20);
            news.lastUpdated = Date.now()
            StockDataManager.newsCache[symbol] = news
            return news
        }
    }
    public static async getNewsSentimentForSymbol(symbol:string) {
        let cacheItem = StockDataManager.newsSentimentCache[symbol]
        if (cacheItem && cacheItem.lastUpdated && (Date.now() - cacheItem.lastUpdated) <= StockDataManager.newsSentimentCacheValidity) {
            return cacheItem
        } else {
            let news:any = await TipranksService.getNewsSentiment(symbol);
            if (news){
                news.lastUpdated = Date.now()
                StockDataManager.newsSentimentCache[symbol] = news
            }
            return news
        }
    }

    //FMP
    /* we can only fetch if advstats is null, because this datatype is scheduled */
    public static getAdvancedStatsForSymbol(symbol:string){
        return StockDataManager.stockDao.getMostRecentDocFromSubCollectionForSymbol(symbol, StockDataManager.stockDao.advancedStatsCollection)
        .then(advancedStats => {
            if (!advancedStats){
                return FMPService.getAdvancedStatsForSymbol(symbol, "annual", 1).then(advancedStatsFMP => {
                    if (advancedStatsFMP.length > 0){
                        StockDataManager.stockDao.saveDocInSubcollectionForSymbol(symbol, StockDataManager.stockDao.advancedStatsCollection, 
                            advancedStatsFMP[0].date, advancedStatsFMP[0]).then().catch()
                        return
                    }
                })
            }
            return advancedStats
        }) 
    }   
    
    //IEX
    /* setting expirey at 999999 basically means we can only fetch from iex if price target is null, because this datatype is scheduled */
    public static getPriceTargetForSymbol(symbol:string){
        return StockDataManager.getLatestDataFromCollectionForSymbol(symbol, 
            StockDataManager.stockDao.priceTargetCollection, StockDataManager.iexDataService.priceTargetEndpoint, 30, false, false)
    }

    //IEX
    /* setting expirey at 999999 basically means we can only fetch from iex if recommendations is null, because this datatype is scheduled */
    public static getRecommendationsForSymbol(symbol:string){
        return StockDataManager.getLatestDataFromCollectionForSymbol(symbol, StockDataManager.stockDao.recommendationCollection,
            StockDataManager.iexDataService.recommendationsEndpoint, 999999, true, false)
    }

    //FMP on demand, no more than once every 1 week
    public static async getInsidersForSymbol(symbol: string) {
        let needToFetch: boolean = false
        let result = StockDataManager.stockDao.getStockDocumentFieldForSymbol(symbol, StockDataManager.stockDao.insidersField)
        if (!result || Utilities.countDaysBetweenDates(Date.now(), result.lastUpdated) > 7) {
            needToFetch = true
            result = await FMPService.getInsiderSummaryForSymbol(symbol)
        }
        if (needToFetch) {
            result.lastUpdated = Date.now()
            StockDataManager.stockDao.saveStockDocumentFieldForSymbol(symbol, StockDataManager.stockDao.insidersField, result).then().catch()
        }
        return result

    }

    /* will only fetch from iex if keystats is null, because this is scheduled */
    // public static async getKeyStatsForSymbol(symbol: string) {
    //     let needToFetch: boolean = false
    //     let result = StockDataManager.stockDao.getStockDocumentFieldForSymbol(symbol, StockDataManager.stockDao.latestKeyStatsField)
    //     if (!result) {
    //         needToFetch = true
    //         result = await StockDataManager.iexDataService.getSimpleDatatypeForSymbol(symbol, StockDataManager.iexDataService.keyStatsEndpoint)
    //     }

    //     if (!result) {
    //         return result
    //     }
    //     const simplifiedData = StockDataService.convertIexKeystatsToSimplifiedKeystats(result)
    //     if (needToFetch) {
    //         StockDataManager.stockDao.saveStockDocumentFieldForSymbol(symbol, StockDataManager.stockDao.latestKeyStatsField, simplifiedData).then().catch()
    //     }
    //     return simplifiedData
    // }

    private static getLatestDataFromCollectionForSymbol(symbol:string, collection:string, endpoint:string, expireyInDays:number, isIexArray:boolean, isIexBatch:boolean) {
        let needToFetch:boolean = false
        return StockDataManager.stockDao.getMostRecentDocFromSubCollectionForSymbol(symbol, collection)
        .then(result => {
            if (!result || Utilities.countDaysBetweenDates(Date.now(), result.id) > expireyInDays) {
                needToFetch = true
                if (isIexBatch){
                    return StockDataManager.iexDataService.getStockInfoForArrayTypeEndpoints(symbol, endpoint, 1)
                } else {
                    return StockDataManager.iexDataService.getSimpleDatatypeForSymbol(symbol, endpoint)
                }
            }
            return result
        }).then(data => {
            let dataToSave = data
            const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
            if (needToFetch){
                if (isIexArray) {
                    if (data && data.length > 0) {
                        dataToSave = data[0]
                        StockDataManager.stockDao.saveDocInSubcollectionForSymbol(symbol, collection, todayString, dataToSave).then().catch()
                    }
                } else if (data) {
                    StockDataManager.stockDao.saveDocInSubcollectionForSymbol(symbol, collection, todayString, dataToSave).then().catch()
                }
            }
            return dataToSave
        })
    }

    public static getLatestQuotesForSymbols(symbols:string[], alsoGetSimplifiedCharts:boolean){
        return QuoteService.getLatestQuotes(symbols, alsoGetSimplifiedCharts)
    }

    public static async getCompanyInfoForAllSymbols() {
        if (!StockDataManager.allCompaniesCache || !StockDataManager.allCompaniesCache.length ||
            Date.now() - StockDataManager.allCompaniesCacheLastUpdate > StockDataManager.allCompaniesCacheValidity) {
            let companies:any = StockDataManager.stockDao.getStockDocumentFieldForAllSymbols(StockDataManager.stockDao.companyField)
            let companiesSimped:any = []
            for (let c of companies){
                const companySimped: Company = {
                    symbol: c.symbol,
                    companyName: c.companyName
                }
                companiesSimped.push(companySimped)
            }
            
            StockDataManager.allCompaniesCache = companiesSimped
            StockDataManager.allCompaniesCacheLastUpdate = Date.now()
            return companiesSimped
        } else {
            return StockDataManager.allCompaniesCache
        }
    }

    //this endpoint was down for a while but now back up (3/7/22), might not be available in the future 
    public static getTipranksDataForSymbol(symbol:string) {
        let data = StockDataManager.stockDao.getTipranksDataForSymbol(symbol)
        if (!data || !data.hasOwnProperty("data") || !data["data"] || Object.keys(data.data).length <= 1 || (Date.now() - data.updated > Utilities.oneWeekMs)) {
            //data was missing or more than 1 week old
            return TipranksService.fetchTipranksApiDataForStock(symbol).then(tipranksData => {
                StockDataManager.stockDao.setTipranksDataForSymbol(symbol, tipranksData).then(res => res).catch(err => err)
                    return tipranksData
                })
        } else {
            //data is present and up to date
            return Promise.resolve(data.data)  
        }
    }

    public static getTipranksTopAnalystsForSymbol(symbol:string) {
        return StockDataManager.stockDao.getTipranksTopAnalystsForSymbol(symbol)
    }

    //TODO-SAM: save to database and update every ~10 minutes instead of always fetching from stocktwits
    //and relying on clients to limit fetches
    public static getStocktwitsPostsForSymbol(symbol:string){
        return StocktwitsService.getPostsForSymbol(symbol).then(result => {
            const results:any[] = []
            if (result && result.length) {
                for (const r of result){
                    const post:any = {}
                    post.id = r.id
                    post.body = r.body
                    post.symbols = r.symbols.map(s => s.symbol)
                    post.username = r.user.username
                    if (r.entities && r.entities.sentiment && r.entities.sentiment.basic){
                        post.sentiment = r.entities.sentiment.basic
                    }
                    post.createdAt = r.created_at
                    post.timestamp = r.timestamp
                    results.push(post)
                }
            }
            return results
        })
    }
    
    public static getScoresForSymbols(symbols: string[] = []) {
        let fields: string[] = ["company", "scores"]
        let docs = StockDataManager.stockDao.getStockDocumentFieldsForSymbols(fields, symbols)
        const filtered = docs.filter(doc => doc.company && doc.company.isCompany && doc.scores)
        return filtered.map(obj => {
            return {
                symbol: obj.company.symbol,
                companyName: obj.company.companyName,
                industry: obj.company.industry,
                scores: obj.scores
            }
        })
    }

    public static applyUserScoreSettingsForSymbol(userid: string, symbol: string) {
        let settings:any = {}
        let areSettingsDefault = false
        return UserManager.getUserScoreSettings(userid).then(s => {
            settings = s
            if (StockDataManager.areSettingsDefault(settings)){
                areSettingsDefault = true
                return StockDataManager.getScoresForSymbols([symbol])
            }
            return StockDataManager.getScoresForSymbols()
        }).then((scoreObjs:any[]) => {
            if (areSettingsDefault && scoreObjs.length){
                return {
                    scores: scoreObjs[0].scores,
                    userSettings: settings
                }
            }
            if (settings && (settings.disabled.length || Object.keys(settings.weightings).length)) {
                const overallScores:number[] = []
                for (const scoreObj of scoreObjs) {
                    //adjust overall score for each category
                    for (const categoryKey of Object.keys(scoreObj.scores.categories)) {
                        const categoryValuesMap:any = scoreObj.scores.categories[categoryKey]
                        let sum:number = 0.0
                        let numMetrics:number = 0
                        for (const metricKey of Object.keys(categoryValuesMap)) {
                            const metricValue:number = categoryValuesMap[metricKey]
                            if (!settings.disabled.includes(metricKey) && metricKey !== "overall") {
                                sum += metricValue
                                numMetrics += 1
                            }
                        }
                        categoryValuesMap.overall = isNaN(sum / numMetrics) ? 0 : (sum / numMetrics)
                    }
                    let overallScore = 0.0
                    for (const categoryKey of Object.keys(scoreObj.scores.categories)) {
                        if (settings.weightings && settings.weightings.hasOwnProperty(categoryKey)) {
                            overallScore += (scoreObj.scores.categories[categoryKey].overall * (settings.weightings[categoryKey] / 100.0))
                        }
                    }
                    overallScores.push(overallScore)
                    scoreObj.scores.overallScore = overallScore
                }
                const maxOverall = Math.max(...overallScores)
                const industryMap = {}
                scoreObjs.sort((a, b) => b.scores.overallScore - a.scores.overallScore);
                for (let i = 0; i < scoreObjs.length; i++) {
                    const industry = scoreObjs[i].industry
                    scoreObjs[i].scores.rank = i + 1
                    scoreObjs[i].scores.percentile = scoreObjs[i].scores.overallScore / maxOverall
                    if (industryMap.hasOwnProperty(industry)) {
                        industryMap[industry] = industryMap[industry] + 1
                    } else {
                        industryMap[industry] = 1
                    }
                    scoreObjs[i].scores.industryRank = industryMap[industry]
                }
            }
            for (const scoreObj of scoreObjs){
                if (scoreObj.symbol === symbol) {
                    return {
                        scores: scoreObj.scores,
                        userSettings: settings
                    }
                }
            }
            return null
        })
    }

    private static areSettingsDefault(settings:any){
        if (!settings){
            return true
        }
        for (let w of Object.values(settings.weightings)){
            if (w != 25){
                return false
            }
        }
        if (settings.disabled.length) {
            return false
        }
        return true
    }

    public static applyUserScoreSettings(userid: string, symbols:string[] = []) {
        let settings:any = {}
        let areSettingsDefault = false
        return UserManager.getUserScoreSettings(userid).then(s => {
            settings = s
            if (StockDataManager.areSettingsDefault(settings)){
                areSettingsDefault = true
                return StockDataManager.getScoresForSymbols(symbols)
            }
            return StockDataManager.getScoresForSymbols()
        }).then((scoreObjs:any[]) => {
            if (areSettingsDefault && scoreObjs.length){
                let returnObj:any[] = []
                for (const so of scoreObjs){
                    if (!symbols.length || symbols.includes(so.symbol)) {
                        let o = {
                            symbol: so.symbol,
                            companyName: so.companyName,
                            industry: so.industry,
                            rank: so.scores.rank,
                            industryRank: so.scores.industryRank,
                            percentile: so.scores.percentile
                        }
                        returnObj.push(o)
                    }
                }
                return returnObj
            }
            if (settings && (settings.disabled.length || Object.keys(settings.weightings).length)) {
                const overallScores:number[] = []
                for (const scoreObj of scoreObjs) {
                    //adjust overall score for each category
                    for (const categoryKey of Object.keys(scoreObj.scores.categories)) {
                        const categoryValuesMap:any = scoreObj.scores.categories[categoryKey]
                        let sum:number = 0.0
                        let numMetrics:number = 0
                        for (const metricKey of Object.keys(categoryValuesMap)) {
                            const metricValue:number = categoryValuesMap[metricKey]
                            if (!settings.disabled.includes(metricKey) && metricKey !== "overall") {
                                sum += metricValue
                                numMetrics += 1
                            }
                        }
                        categoryValuesMap.overall = isNaN(sum / numMetrics) ? 0 : (sum / numMetrics)
                    }
                    let overallScore = 0.0
                    for (const categoryKey of Object.keys(scoreObj.scores.categories)) {
                        if (settings.weightings && settings.weightings.hasOwnProperty(categoryKey)) {
                            overallScore += (scoreObj.scores.categories[categoryKey].overall * (settings.weightings[categoryKey] / 100.0))
                        }
                    }
                    overallScores.push(overallScore)
                    scoreObj.scores.overallScore = overallScore
                }
                const maxOverall = Math.max(...overallScores)
                const industryMap = {}
                scoreObjs.sort((a, b) => b.scores.overallScore - a.scores.overallScore);
                for (let i = 0; i < scoreObjs.length; i++) {
                    const so = scoreObjs[i]
                    const industry = so.industry
                    so.scores.rank = i + 1
                    so.scores.percentile = so.scores.overallScore / maxOverall
                    if (industryMap.hasOwnProperty(industry)) {
                        industryMap[industry] = industryMap[industry] + 1
                    } else {
                        industryMap[industry] = 1
                    }
                    so.scores.industryRank = industryMap[industry]
                }
            }
            let returnObj:any[] = []
            for (const so of scoreObjs){
                if (!symbols.length || symbols.includes(so.symbol)) {
                    let o = {
                        symbol: so.symbol,
                        companyName: so.companyName,
                        industry: so.industry,
                        rank: so.scores.rank,
                        industryRank: so.scores.industryRank,
                        percentile: so.scores.percentile
                    }
                    returnObj.push(o)
                }
            }
            return returnObj
        })
    }

}