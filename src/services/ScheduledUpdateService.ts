import * as cron from "cron";
import Utilities from "../utils/Utilities";
import ChartService from "./ChartService";
import IexDataService from "./IexDataService";
import StockDao from "../dao/StockDao";
import MarketDao from "../dao/MarketDao";
import TipranksService from "./TipranksService";
import ChartDao from "../dao/ChartDao";
import AnalysisService from "./AnalysisService";
import FMPService from "./FMPService";
import StockMarketUtility from "../utils/StockMarketUtility";
import FearGreedService from "./FearGreedService";
import QuoteService from "./QuoteService";
import SimpleQuote from "../models/SimpleQuote";
import Config from "../config/config";
import TwitterApiService from "./TwitterApiService";
import UserDao from "../dao/UserDao";
import MarketDataManager from "../managers/MarketDataManager";
import PlaidService from "./PlaidService";

export default class ScheduledUpdateService {

    private priceEarningsStatsUpdater: cron.CronJob
    private marketCloseUpdater: cron.CronJob
    private morningUpdater: cron.CronJob //for the day's market-wide news
    private min30Updater: cron.CronJob
    private monthlyUpdater: cron.CronJob
    private midnightUpdater: cron.CronJob
    private marketDao: MarketDao;
    private stockDao: StockDao;
    private chartDao: ChartDao;
    private iexDataService: IexDataService;
    private chartService: ChartService;

    private quarterlyCollectionMap = {}

    public static marketNews:any[] = []
    public static fiveYearsAgoDateString:string = Utilities.getFiveYearsAgoDateString()

    constructor() {
        this.stockDao = StockDao.getStockDaoInstance()
        this.marketDao = MarketDao.getMarketDaoInstance()
        this.chartDao = ChartDao.getChartDaoInstance()
        this.chartService = ChartService.getChartServiceInstance()
        this.iexDataService = IexDataService.getIexDataServiceInstance()
        
        this.quarterlyCollectionMap = {
            [this.iexDataService.earningsEndpoint]: this.stockDao.earningsCollection,
            [this.iexDataService.advancedStatsEndpoint]: this.stockDao.advancedStatsCollection,
            [this.iexDataService.incomeEndpoint]: this.stockDao.incomeCollection,
            [this.iexDataService.cashFlowEndpoint]: this.stockDao.cashFlowCollection,
        }

        this.initSnapShots()

        //cron tests:
        //testing every 10 minutes: 0 */10 * * * *
        //testing every minute 0 * * * * *

        //runs every 30 minutes on trading days //TODO change back
        this.min30Updater = new cron.CronJob('0 */30 * * * *', this.scheduled30MinUpdate.bind(this), null, true, 'America/Los_Angeles', null, false, undefined, undefined)

        //runs at 6:30am PST every day (0 30 6 * * *)
        this.morningUpdater = new cron.CronJob('0 31 6 * * *', this.scheduledMorningUpdate.bind(this), null, true, 'America/Los_Angeles', null, false, undefined, undefined)

        //runs at 1:05pm PST every trading day (0 5 13 * * *)
        this.marketCloseUpdater = new cron.CronJob('0 5 13 * * *', this.scheduledAfternoonUpdate.bind(this), null, true, 'America/Los_Angeles', null, false, undefined, undefined)

        //runs at 5:05pm PST every trading day (0 5 17 * * *)
        this.priceEarningsStatsUpdater = new cron.CronJob('0 5 17 * * *', this.scheduledEveningUpdate.bind(this), null, true, 'America/Los_Angeles', null, false, undefined, undefined)
    
        //runs at 1:05am PST (4:05am est) every day (0 0 1 * * *)
        this.midnightUpdater = new cron.CronJob('0 5 1 * * *', this.scheduledMidnightUpdate.bind(this), null, true, 'America/Los_Angeles', null, false, undefined, undefined)

        this.monthlyUpdater = new cron.CronJob('0 0 0 1 * *', this.scheduledMonthlyUpdate.bind(this), null, true, 'America/Los_Angeles', null, false, undefined, undefined)
    }

    private async initSnapShots(){
        console.log("init dao caches")
        
        //for testing, comment next line and call this.initRest() manually
        await this.stockDao.initStockSnapshotCaches(this)
        //this.initRest() //dont need this call unless testing
    }

    public async initRest(){
        console.log("deleting empty documents")
        await this.stockDao.deleteEmptySymbolDocs()

        await UserDao.getUserDaoInstance().initUserSnapshotCache()        

        let smu = StockMarketUtility.getStockMarketUtility()
        await FMPService.getHolidaysUsMarket().then(holidays => {
            StockMarketUtility.setHolidays(holidays)
        })
        smu.isMarketOpen = await FMPService.getIsMarketOpen()
        smu.isExtendedHours = smu.isDateBetweenPreAndAfterMarket(new Date())

        await QuoteService.fetchLatestQuotesForAllSymbolsAndWriteToCache(0)

        //get all simplified charts
        let maxDataPoints:any = 40
        if (smu.isMarketOpen) {
            maxDataPoints = Math.round(smu.getMinutesIntoTradingDay() / 10)
            console.log(`getting ${maxDataPoints} from iex for simplified charts`)
        }
        let symbols = Object.keys(QuoteService.quoteCache)
        if (maxDataPoints > 0){
            let simplifiedCharts = await IexDataService.getIexDataServiceInstance().getSimplifiedChartForSymbols(symbols, maxDataPoints)
            console.log("saving simplified charts to cache")
            QuoteService.saveSimplifiedChartsToCache(simplifiedCharts)
        }

        if (smu.isMarketOpen) {
            QuoteService.fetchLatestQuotesUntilMarketCloses(true)
        }

        //since market news is not being saved in db, it should be fetched once on init
        ScheduledUpdateService.marketNews = await FMPService.getMarketNews(30)

        this.populateEmptyDb()
        console.log("init process complete")
    }

    public async populateEmptyDb() {
        /* initializes the stock collection with 200 symbols for development */
        let stocksnaps = StockDao.getStockDaoInstance().snapshotCache
        if (!stocksnaps || stocksnaps.length) {
            let allSymbols = await FMPService.getQuoteForAllSymbols()
            allSymbols = allSymbols.map(s => s.symbol)
            console.log(`Initiatilizing all stock documents`)
            await this.stockDao.createNewStockDocuments(allSymbols)
        }
        let popped:string[] = []
        let notPopped:string[] = []
        for (let snap of Object.values(stocksnaps)) {
            if (snap && (snap as any).get("company")) {
                popped.push((snap as any).id)
            } else {
                notPopped.push((snap as any).id)
            }
        }
        console.log(`${popped.length} stocks already populated`)
        console.log(`${notPopped.length} stocks not yet populated`)
        if (notPopped.length) {
            console.log(`populating ${notPopped.length} stocks`)
            for (const symbol of notPopped) {
                await FMPService.populateAllHistoryForSymbol(symbol)
                //-- no need to populate IEX stuff like price targets, and recs, or anything that is scheduled to happen rarely
                //because they will be populated daily when they don't exist. So the scores won't be complete until 1 day after
                //init
            }
            await FMPService.updateAnnualEarningsEstimates(notPopped)
        } else {
        }
    }

    public startSchedules(){
        this.marketCloseUpdater.start()
        this.morningUpdater.start()
        this.min30Updater.start()
        this.midnightUpdater.start()
    }

    public stopSchedules(){
        this.marketCloseUpdater.stop()
        this.priceEarningsStatsUpdater.stop()
        this.morningUpdater.stop()
        this.min30Updater.stop()
        this.midnightUpdater.stop()
        this.monthlyUpdater.stop()
    }

    //top 10 (gainers, losers, active)
    // - using IEX because its very cheap (30 points), could easily use FMP which is free
    //also fetches market news using FMP, regardless of whether today is trading day
    private scheduled30MinUpdate(){
        console.log("market news update")
        //since im getting market news so often and it replaces itself, there is no need to save to db
        FMPService.getMarketNews(30).then((newsArray:any) => {
            ScheduledUpdateService.marketNews = newsArray
        })
        this.marketDao.getTodayWasATradingDay().then(async marketWasOpenToday => {
            if (marketWasOpenToday && StockMarketUtility.getStockMarketUtility().isMarketOpen){
                console.log(`${Utilities.convertUnixTimestampToTimeString12(Date.now())} saving top10s`)
                const top10Endpoints = [
                    FMPService.gainersEndpoint,
                    FMPService.losersEndpoint,
                    FMPService.activeEndpoint
                    // this.iexDataService.gainersEndpoint,
                    // this.iexDataService.losersEndpoint,
                    // this.iexDataService.mostActiveEndpoint
                ]
                for (const endpoint of top10Endpoints){
                    FMPService.getListType(endpoint).then(result => {
                        if (result){
                            //result is an array of quotes
                            const filteredQuotes = result.map(quote => {
                                return {
                                    symbol: quote.symbol,
                                    companyName: quote.name, //IEX: quote.companyName,
                                    latestPrice: quote.price || 0, //IEX: quote.latestPrice || 0,
                                    latestVolume: quote.latestVolume || 0,
                                    latestUpdate: quote.latestUpdate || 0,
                                    change: quote.change || 0,
                                    changePercent: quote.changesPercentage || 0.0, //IEX: quote.changePercent * 100 || 0
                                }
                            })
                            let dbKey = endpoint == FMPService.gainersEndpoint ? "gainers" : endpoint == FMPService.losersEndpoint ? "losers" : endpoint == FMPService.activeEndpoint ? "mostactive" : "uknown"
                            this.marketDao.saveTop10Field(dbKey, filteredQuotes).then().catch()
                        }
                    }).catch()
                }
                let trendingSocials = await FMPService.getTrendingBySocialSentiment()
                let socialChangeTwitter = await FMPService.getSocialSentimentChanges("twitter")
                let socialChangeStocktwits = await FMPService.getSocialSentimentChanges("stocktwits")
                this.marketDao.saveSocialSentimentData({
                    trending: trendingSocials,
                    twitterChange: socialChangeTwitter, 
                    stocktwitsChange: socialChangeStocktwits
                })
            }
        }).catch()
    }

    // market-wide news and the start of real-time quotes
    public async scheduledMorningUpdate(){
        let smu = StockMarketUtility.getStockMarketUtility()
        console.log(`${Utilities.convertUnixTimestampToTimeString12(Date.now())}: 635am pst update`)
        //in case fmp says market isnt open when it really is (due to some error), we should check a bunch of times 
        smu.isMarketOpen = await FMPService.getIsMarketOpen()
        if (smu.isMarketOpen) {
            console.log("starting real-time quote fetcher")
            QuoteService.fetchLatestQuotesUntilMarketCloses(false)
            this.scheduled30MinUpdate()
        }  

        let delay = 1000*60*10 //10min
        if (!smu.isMarketOpen) {
            setTimeout(async function(this: ScheduledUpdateService) {
                smu.isMarketOpen = await FMPService.getIsMarketOpen()
                if (smu.isMarketOpen) {
                    console.log("starting real-time quote fetcher")
                    QuoteService.fetchLatestQuotesUntilMarketCloses(false)
                    this.scheduled30MinUpdate()
                }
            }, delay) 
        }  
    }

    // sector performance and economic data
    public scheduledAfternoonUpdate() {
        this.marketDao.getTodayWasATradingDay().then(marketWasOpenToday => {
            if (marketWasOpenToday){
                console.log(`${Utilities.convertUnixTimestampToTimeString12(Date.now())}: 1pm PST market close update`)
                return this.iexDataService.getSectorPerformance().then(result => {
                    return this.marketDao.saveSectorPerformances(result)
                }).catch()
            }
            return null
        }).then(() => {
            //weekly economy
            return FMPService.getWeeklyEconomicData().then(data => {
                for (let d of data){
                    this.marketDao.saveEconomicData(this.marketDao.economicDataCollectionWeekly, d.id, d).then().catch()
                }
                return null
            })
        }).then(() => {
            //monthly economy
            return FMPService.getMonthlyEconomicData().then(data => {
                for (let d of data){
                    this.marketDao.saveEconomicData(this.marketDao.economicDataCollectionMonthly, d.id, d).then().catch()
                }
                return null            
            })
        }).then(() => {
            //quarterly economy, but we actually need to update this every day because the quarterly schedule changes every year
            return FMPService.getQuarterlyEconomicData().then(data => {
                for (let d of data){
                    this.marketDao.saveEconomicData(this.marketDao.economicDataCollectionQuarterly, d.id, d).then().catch()
                }
                return null            
            })
        }).then(() => {
            return FearGreedService.getFearAndGreedIndicators()
        }).catch()
    }

    /* updates latest prices, earnings, and keystats */
    public scheduledEveningUpdate(justFinancials = false) {
        console.log(`${Utilities.convertUnixTimestampToTimeString12(Date.now())}: 5pm PST update`)
        this.marketDao.getTodayWasATradingDay().then(async marketWasOpenToday => {
            if (marketWasOpenToday) {
                const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
                const symbolsWhosEarningsWereToday: any[] = []

                //algorithm for updating financials for stocks who recently had earnings
                await this.stockDao.getAllSymbolsByDaysSinceLastEarnings(80).then(async symbolMap => {
                    console.log(Object.keys(symbolMap).length + " symbols are 80 days since last earnings")
                    for (const [symbol, lastEarningsDate] of Object.entries(symbolMap)) {
                        let nextEarningsDate = QuoteService.quoteCache[symbol]?.latestQuote?.earningsAnnouncement
                        //console.log(`symbol quotecache: ${JSON.stringify(QuoteService.quoteCache[symbol])}`)
                        if (nextEarningsDate) {
                            if (nextEarningsDate.includes("T")) {
                                nextEarningsDate = nextEarningsDate.split("T")[0] //FMP adds the time, gotta get rid of it
                            }
                            let fetch = false
                            if (nextEarningsDate.startsWith(todayString) || (lastEarningsDate as any).startsWith(todayString)) {
                                symbolsWhosEarningsWereToday.push(symbol)
                                fetch = true
                            } else {
                                let diff = Utilities.countDaysBetweenDateStrings(nextEarningsDate, (lastEarningsDate as any))
                                console.log(symbol + ": " + diff + " days between next and last earnings")
                                if (diff >= 130 || 
                                    (Utilities.isDatestringBeforeAnotherDatestring(nextEarningsDate, todayString) && lastEarningsDate != nextEarningsDate)) {
                                    fetch = true
                                }
                            }
                            if (fetch){
                                console.log("updating all financials for " + symbol)
                                await FMPService.updateAllFinancialDataSingleEndpoint(symbol)
                            }
                        }
                    }
                })

                let allSymbols = Object.values(QuoteService.quoteCache).map(q => q.latestQuote.symbol)
                this.initNewSymbols(allSymbols)
            }
            if (!justFinancials){
                await TipranksService.fetchTopAnalysts().then(res => res).catch(err => err)
                await TipranksService.computeTopAnalystSymbolScores()
                await MarketDataManager.updateTopAnalystPortfolio()
            }
            //just doesn't work reliably, not worth it
            // await FidelityService.scrape()
        }).catch()
    }

    public async scheduledMidnightUpdate(){
        //updates some information every single day regardless of whether its a trading day or not
        console.log("1:05am PST update (PTs, Recs, Estimates, Analysis, Tweets)")

        //every day we need to store the 5 years ago date to use to fetch price history for the past 5 years
        ScheduledUpdateService.fiveYearsAgoDateString = Utilities.getFiveYearsAgoDateString()
        
        //its annoying to figure out when the new year holiday information will come out, 
        //its easier to just check for holidays every single day
        await FMPService.getHolidaysUsMarket().then(async holidays => {
            StockMarketUtility.setHolidays(holidays)
            await StockMarketUtility.getStockMarketUtility().checkAndSetIfMarketIsOpenToday()
        })

        let symbols = this.stockDao.getAllSymbols()
        const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        if (symbols.length > 0) {
            const firstSymbol = symbols[0]
            //get price targets every 60 days (once per 2 months)
            await this.stockDao.getMostRecentDocFromSubCollectionForSymbol(firstSymbol, this.stockDao.priceTargetCollection).then(pt => {
                if (!pt || Utilities.countDaysBetweenDates(Date.now(), pt.id) > 60) {
                    console.log("Midnight update: price targets (bi-monthly)")
                    this.iexDataService.getPriceTargetsForSymbols(symbols).then(async priceTargets => {
                        await this.stockDao.batchSaveFieldsInMultipleStockDocs(this.stockDao.stockCollection, this.stockDao.latestPriceTarget, priceTargets, true)
                        await this.stockDao.batchSaveDocInSubcollectionForSymbols(this.stockDao.stockCollection,
                            this.stockDao.priceTargetCollection, todayString, priceTargets)
                    })
                }
            })
            //get recommendations every 90 days (once per 3 months)
            await this.stockDao.getMostRecentDocFromSubCollectionForSymbol(firstSymbol, this.stockDao.recommendationCollection).then(rec => {
                if (!rec || Utilities.countDaysBetweenDates(Date.now(), rec.id) >= 90) {
                    console.log("Midnight update: recommendations (tri-monthly)")
                    this.iexDataService.getRecommendationsForSymbols(symbols).then(async recs => {
                        await this.stockDao.batchSaveFieldsInMultipleStockDocs(this.stockDao.stockCollection, this.stockDao.latestRecommendations, recs, true)
                        await this.stockDao.batchSaveDocInSubcollectionForSymbols(this.stockDao.stockCollection,
                            this.stockDao.recommendationCollection, todayString, recs)
                    })
                }
            })

            if (Utilities.isMonday(new Date())) {
                console.log("Midnight update: estimates (weekly)")

                //nonbatch FMP endpoint (basically all of them) take about an hour to get 10k stocks 
                //so the below 2 calls will take about 2 hours to finish. We don't need these to be super accurate so once a week is good
                let start = Date.now()
                await FMPService.updateEarningsForSymbols(symbols) //for next quarter eps estimates
                let end = Date.now()
                console.log(`EPS Estimates done in ${(end - start) / 1000.0}s`)
                start = Date.now()
                await FMPService.updateAnnualEarningsEstimates(symbols) //for annual eps estimate which is for forward pe calculation, these are not accurate from what i can tell
                end = Date.now()
                console.log(`Annual Earnings Estimates done in ${(end - start) / 1000.0}s`)
            }

            //analysis
            await AnalysisService.doAnalysis()

            //get all tweets
            await TwitterApiService.getDailyTweetsForAllFollowedAccounts()

            //update linked portfolio balances
            await PlaidService.getPlaidService().updateAccountBalancesForAllUsers()
        }
    }

    //no longer saving latest prices or charts, so the only thing i might want to do here is 
    //init new stocks, but theres probably a better way, like using some IPO calendar to fetch info for new stocks
    private async initNewSymbols(allSymbols: string[]) {
        // console.log("updating prices and charts")
        let existing:string[] = []
        let newStocks:string[] = []
        let allSymbolsInDb = StockDao.getStockDaoInstance().getAllSymbols()
        for (let s of allSymbols) {
            if (allSymbolsInDb.includes(s)){
                existing.push(s)
            } else {
                newStocks.push(s)
            }
        }
        for (let n of newStocks){
            //might need need to init more than just financials, new companies will have no scores and general info etc
            await FMPService.populateAllHistoryForSymbol(n)
        }
    }

    public async scheduledMonthlyUpdate(){
        console.log("resetting twitter monthly counters")
        TwitterApiService.resetMonthlyCounters()
    }


    //dead stuff, keeping code in case

    // private updateKeyStatsForSymbols(symbols: string[]) {
    //     console.log("updating key stats for all stocks")
    //     return this.iexDataService.getKeyStatsForSymbols(symbols).then((data: any) => {
    //         const dateKey = Utilities.convertUnixTimestampToDateString(Date.now())
    //         return this.stockDao.batchSaveKeyStats(data, dateKey).then().catch()
    //     }).catch()
    // }

    // stocktwits updater, stocktwits seems dead, they havent re-opened their api in a long time
    // private scheduledStocktwitsUpdate() {
    //     StocktwitsService.getTrendingMessages().then(result => {
    //         if (result) {
    //             this.marketDao.saveStocktwitsTrending(result).then().catch()
    //         }
    //     }).catch()
    // }
}
