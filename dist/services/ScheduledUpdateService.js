"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cron = require("cron");
const Utilities_1 = require("../utils/Utilities");
const ChartService_1 = require("./ChartService");
const IexDataService_1 = require("./IexDataService");
const StockDao_1 = require("../dao/StockDao");
const MarketDao_1 = require("../dao/MarketDao");
const TipranksService_1 = require("./TipranksService");
const ChartDao_1 = require("../dao/ChartDao");
const AnalysisService_1 = require("./AnalysisService");
const FMPService_1 = require("./FMPService");
const StockMarketUtility_1 = require("../utils/StockMarketUtility");
const FearGreedService_1 = require("./FearGreedService");
const QuoteService_1 = require("./QuoteService");
const TwitterApiService_1 = require("./TwitterApiService");
const UserDao_1 = require("../dao/UserDao");
const MarketDataManager_1 = require("../managers/MarketDataManager");
const PlaidService_1 = require("./PlaidService");
class ScheduledUpdateService {
    constructor() {
        this.quarterlyCollectionMap = {};
        this.stockDao = StockDao_1.default.getStockDaoInstance();
        this.marketDao = MarketDao_1.default.getMarketDaoInstance();
        this.chartDao = ChartDao_1.default.getChartDaoInstance();
        this.chartService = ChartService_1.default.getChartServiceInstance();
        this.iexDataService = IexDataService_1.default.getIexDataServiceInstance();
        this.quarterlyCollectionMap = {
            [this.iexDataService.earningsEndpoint]: this.stockDao.earningsCollection,
            [this.iexDataService.advancedStatsEndpoint]: this.stockDao.advancedStatsCollection,
            [this.iexDataService.incomeEndpoint]: this.stockDao.incomeCollection,
            [this.iexDataService.cashFlowEndpoint]: this.stockDao.cashFlowCollection,
        };
        this.initSnapShots();
        //cron tests:
        //testing every 10 minutes: 0 */10 * * * *
        //testing every minute 0 * * * * *
        //runs every 30 minutes on trading days //TODO change back
        this.min30Updater = new cron.CronJob('0 */30 * * * *', this.scheduled30MinUpdate.bind(this), null, true, 'America/Los_Angeles', null, false, undefined, undefined);
        //runs at 6:30am PST every day (0 30 6 * * *)
        this.morningUpdater = new cron.CronJob('0 31 6 * * *', this.scheduledMorningUpdate.bind(this), null, true, 'America/Los_Angeles', null, false, undefined, undefined);
        //runs at 1:05pm PST every trading day (0 5 13 * * *)
        this.marketCloseUpdater = new cron.CronJob('0 5 13 * * *', this.scheduledAfternoonUpdate.bind(this), null, true, 'America/Los_Angeles', null, false, undefined, undefined);
        //runs at 5:05pm PST every trading day (0 5 17 * * *)
        this.priceEarningsStatsUpdater = new cron.CronJob('0 5 17 * * *', this.scheduledEveningUpdate.bind(this), null, true, 'America/Los_Angeles', null, false, undefined, undefined);
        //runs at 1:05am PST (4:05am est) every day (0 0 1 * * *)
        this.midnightUpdater = new cron.CronJob('0 5 1 * * *', this.scheduledMidnightUpdate.bind(this), null, true, 'America/Los_Angeles', null, false, undefined, undefined);
        this.monthlyUpdater = new cron.CronJob('0 0 0 1 * *', this.scheduledMonthlyUpdate.bind(this), null, true, 'America/Los_Angeles', null, false, undefined, undefined);
    }
    async initSnapShots() {
        console.log("init dao caches");
        //for testing, comment next line and call this.initRest() manually
        //await this.stockDao.initStockSnapshotCaches(this)
        this.initRest(); //dont need this call unless testing
    }
    async initRest() {
        console.log("deleting empty documents");
        await this.stockDao.deleteEmptySymbolDocs();
        await UserDao_1.default.getUserDaoInstance().initUserSnapshotCache();
        let smu = StockMarketUtility_1.default.getStockMarketUtility();
        await FMPService_1.default.getHolidaysUsMarket().then(holidays => {
            StockMarketUtility_1.default.setHolidays(holidays);
        });
        smu.isMarketOpen = await FMPService_1.default.getIsMarketOpen();
        smu.isExtendedHours = smu.isDateBetweenPreAndAfterMarket(new Date());
        await QuoteService_1.default.fetchLatestQuotesForAllSymbolsAndWriteToCache(0);
        //get all simplified charts
        let maxDataPoints = 40;
        if (smu.isMarketOpen) {
            maxDataPoints = Math.round(smu.getMinutesIntoTradingDay() / 10);
            console.log(`getting ${maxDataPoints} from iex for simplified charts`);
        }
        let symbols = Object.keys(QuoteService_1.default.quoteCache);
        if (maxDataPoints > 0) {
            let simplifiedCharts = await IexDataService_1.default.getIexDataServiceInstance().getSimplifiedChartForSymbols(symbols, maxDataPoints);
            console.log("saving simplified charts to cache");
            QuoteService_1.default.saveSimplifiedChartsToCache(simplifiedCharts);
        }
        if (smu.isMarketOpen) {
            QuoteService_1.default.fetchLatestQuotesUntilMarketCloses(true);
        }
        //since market news is not being saved in db, it should be fetched once on init
        ScheduledUpdateService.marketNews = await FMPService_1.default.getMarketNews(30);
        this.populateEmptyDb();
        console.log("init process complete");
    }
    async populateEmptyDb() {
        /* initializes the stock collection with 200 symbols for development */
        let stocksnaps = StockDao_1.default.getStockDaoInstance().snapshotCache;
        if (!stocksnaps || stocksnaps.length) {
            let allSymbols = await FMPService_1.default.getQuoteForAllSymbols();
            allSymbols = allSymbols.map(s => s.symbol);
            console.log(`Initiatilizing all stock documents`);
            await this.stockDao.createNewStockDocuments(allSymbols);
        }
        let popped = [];
        let notPopped = [];
        for (let snap of Object.values(stocksnaps)) {
            if (snap && snap.get("company")) {
                popped.push(snap.id);
            }
            else {
                notPopped.push(snap.id);
            }
        }
        console.log(`${popped.length} stocks already populated`);
        console.log(`${notPopped.length} stocks not yet populated`);
        if (notPopped.length) {
            console.log(`populating ${notPopped.length} stocks`);
            for (const symbol of notPopped) {
                await FMPService_1.default.populateAllHistoryForSymbol(symbol);
                //-- no need to populate IEX stuff like price targets, and recs, or anything that is scheduled to happen rarely
                //because they will be populated daily when they don't exist. So the scores won't be complete until 1 day after
                //init
            }
            await FMPService_1.default.updateAnnualEarningsEstimates(notPopped);
        }
        else {
        }
    }
    startSchedules() {
        this.marketCloseUpdater.start();
        this.morningUpdater.start();
        this.min30Updater.start();
        this.midnightUpdater.start();
    }
    stopSchedules() {
        this.marketCloseUpdater.stop();
        this.priceEarningsStatsUpdater.stop();
        this.morningUpdater.stop();
        this.min30Updater.stop();
        this.midnightUpdater.stop();
        this.monthlyUpdater.stop();
    }
    //top 10 (gainers, losers, active)
    // - using IEX because its very cheap (30 points), could easily use FMP which is free
    //also fetches market news using FMP, regardless of whether today is trading day
    scheduled30MinUpdate() {
        console.log("market news update");
        //since im getting market news so often and it replaces itself, there is no need to save to db
        FMPService_1.default.getMarketNews(30).then((newsArray) => {
            ScheduledUpdateService.marketNews = newsArray;
        });
        this.marketDao.getTodayWasATradingDay().then(async (marketWasOpenToday) => {
            if (marketWasOpenToday && StockMarketUtility_1.default.getStockMarketUtility().isMarketOpen) {
                console.log(`${Utilities_1.default.convertUnixTimestampToTimeString12(Date.now())} saving top10s`);
                const top10Endpoints = [
                    FMPService_1.default.gainersEndpoint,
                    FMPService_1.default.losersEndpoint,
                    FMPService_1.default.activeEndpoint
                    // this.iexDataService.gainersEndpoint,
                    // this.iexDataService.losersEndpoint,
                    // this.iexDataService.mostActiveEndpoint
                ];
                for (const endpoint of top10Endpoints) {
                    FMPService_1.default.getListType(endpoint).then(result => {
                        if (result) {
                            //result is an array of quotes
                            const filteredQuotes = result.map(quote => {
                                return {
                                    symbol: quote.symbol,
                                    companyName: quote.name,
                                    latestPrice: quote.price || 0,
                                    latestVolume: quote.latestVolume || 0,
                                    latestUpdate: quote.latestUpdate || 0,
                                    change: quote.change || 0,
                                    changePercent: quote.changesPercentage || 0.0,
                                };
                            });
                            let dbKey = endpoint == FMPService_1.default.gainersEndpoint ? "gainers" : endpoint == FMPService_1.default.losersEndpoint ? "losers" : endpoint == FMPService_1.default.activeEndpoint ? "mostactive" : "uknown";
                            this.marketDao.saveTop10Field(dbKey, filteredQuotes).then().catch();
                        }
                    }).catch();
                }
                let trendingSocials = await FMPService_1.default.getTrendingBySocialSentiment();
                let socialChangeTwitter = await FMPService_1.default.getSocialSentimentChanges("twitter");
                let socialChangeStocktwits = await FMPService_1.default.getSocialSentimentChanges("stocktwits");
                this.marketDao.saveSocialSentimentData({
                    trending: trendingSocials,
                    twitterChange: socialChangeTwitter,
                    stocktwitsChange: socialChangeStocktwits
                });
            }
        }).catch();
    }
    // market-wide news and the start of real-time quotes
    async scheduledMorningUpdate() {
        let smu = StockMarketUtility_1.default.getStockMarketUtility();
        console.log(`${Utilities_1.default.convertUnixTimestampToTimeString12(Date.now())}: 635am pst update`);
        //in case fmp says market isnt open when it really is (due to some error), we should check a bunch of times 
        smu.isMarketOpen = await FMPService_1.default.getIsMarketOpen();
        if (smu.isMarketOpen) {
            console.log("starting real-time quote fetcher");
            QuoteService_1.default.fetchLatestQuotesUntilMarketCloses(false);
            this.scheduled30MinUpdate();
        }
        let delay = 1000 * 60 * 10; //10min
        if (!smu.isMarketOpen) {
            setTimeout(async function () {
                smu.isMarketOpen = await FMPService_1.default.getIsMarketOpen();
                if (smu.isMarketOpen) {
                    console.log("starting real-time quote fetcher");
                    QuoteService_1.default.fetchLatestQuotesUntilMarketCloses(false);
                    this.scheduled30MinUpdate();
                }
            }, delay);
        }
    }
    // sector performance and economic data
    scheduledAfternoonUpdate() {
        this.marketDao.getTodayWasATradingDay().then(marketWasOpenToday => {
            if (marketWasOpenToday) {
                console.log(`${Utilities_1.default.convertUnixTimestampToTimeString12(Date.now())}: 1pm PST market close update`);
                return this.iexDataService.getSectorPerformance().then(result => {
                    return this.marketDao.saveSectorPerformances(result);
                }).catch();
            }
            return null;
        }).then(() => {
            //weekly economy
            return FMPService_1.default.getWeeklyEconomicData().then(data => {
                for (let d of data) {
                    this.marketDao.saveEconomicData(this.marketDao.economicDataCollectionWeekly, d.id, d).then().catch();
                }
                return null;
            });
        }).then(() => {
            //monthly economy
            return FMPService_1.default.getMonthlyEconomicData().then(data => {
                for (let d of data) {
                    this.marketDao.saveEconomicData(this.marketDao.economicDataCollectionMonthly, d.id, d).then().catch();
                }
                return null;
            });
        }).then(() => {
            //quarterly economy, but we actually need to update this every day because the quarterly schedule changes every year
            return FMPService_1.default.getQuarterlyEconomicData().then(data => {
                for (let d of data) {
                    this.marketDao.saveEconomicData(this.marketDao.economicDataCollectionQuarterly, d.id, d).then().catch();
                }
                return null;
            });
        }).then(() => {
            return FearGreedService_1.default.getFearAndGreedIndicators();
        }).catch();
    }
    /* updates latest prices, earnings, and keystats */
    scheduledEveningUpdate(justFinancials = false) {
        console.log(`${Utilities_1.default.convertUnixTimestampToTimeString12(Date.now())}: 5pm PST update`);
        this.marketDao.getTodayWasATradingDay().then(async (marketWasOpenToday) => {
            if (marketWasOpenToday) {
                const todayString = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
                const symbolsWhosEarningsWereToday = [];
                //algorithm for updating financials for stocks who recently had earnings
                await this.stockDao.getAllSymbolsByDaysSinceLastEarnings(80).then(async (symbolMap) => {
                    var _a, _b;
                    console.log(Object.keys(symbolMap).length + " symbols are 80 days since last earnings");
                    for (const [symbol, lastEarningsDate] of Object.entries(symbolMap)) {
                        let nextEarningsDate = (_b = (_a = QuoteService_1.default.quoteCache[symbol]) === null || _a === void 0 ? void 0 : _a.latestQuote) === null || _b === void 0 ? void 0 : _b.earningsAnnouncement;
                        //console.log(`symbol quotecache: ${JSON.stringify(QuoteService.quoteCache[symbol])}`)
                        if (nextEarningsDate) {
                            if (nextEarningsDate.includes("T")) {
                                nextEarningsDate = nextEarningsDate.split("T")[0]; //FMP adds the time, gotta get rid of it
                            }
                            let fetch = false;
                            if (nextEarningsDate.startsWith(todayString) || lastEarningsDate.startsWith(todayString)) {
                                symbolsWhosEarningsWereToday.push(symbol);
                                fetch = true;
                            }
                            else {
                                let diff = Utilities_1.default.countDaysBetweenDateStrings(nextEarningsDate, lastEarningsDate);
                                console.log(symbol + ": " + diff + " days between next and last earnings");
                                if (diff >= 130 ||
                                    (Utilities_1.default.isDatestringBeforeAnotherDatestring(nextEarningsDate, todayString) && lastEarningsDate != nextEarningsDate)) {
                                    fetch = true;
                                }
                            }
                            if (fetch) {
                                console.log("updating all financials for " + symbol);
                                await FMPService_1.default.updateAllFinancialDataSingleEndpoint(symbol);
                            }
                        }
                    }
                });
                let allSymbols = Object.values(QuoteService_1.default.quoteCache).map(q => q.latestQuote.symbol);
                this.initNewSymbols(allSymbols);
            }
            if (!justFinancials) {
                await TipranksService_1.default.fetchTopAnalysts().then(res => res).catch(err => err);
                await TipranksService_1.default.computeTopAnalystSymbolScores();
                await MarketDataManager_1.default.updateTopAnalystPortfolio();
            }
            //just doesn't work reliably, not worth it
            // await FidelityService.scrape()
        }).catch();
    }
    async scheduledMidnightUpdate() {
        //updates some information every single day regardless of whether its a trading day or not
        console.log("1:05am PST update (PTs, Recs, Estimates, Analysis, Tweets)");
        //every day we need to store the 5 years ago date to use to fetch price history for the past 5 years
        ScheduledUpdateService.fiveYearsAgoDateString = Utilities_1.default.getFiveYearsAgoDateString();
        //its annoying to figure out when the new year holiday information will come out, 
        //its easier to just check for holidays every single day
        await FMPService_1.default.getHolidaysUsMarket().then(async (holidays) => {
            StockMarketUtility_1.default.setHolidays(holidays);
            await StockMarketUtility_1.default.getStockMarketUtility().checkAndSetIfMarketIsOpenToday();
        });
        let symbols = this.stockDao.getAllSymbols();
        const todayString = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        if (symbols.length > 0) {
            const firstSymbol = symbols[0];
            //get price targets every 60 days (once per 2 months)
            await this.stockDao.getMostRecentDocFromSubCollectionForSymbol(firstSymbol, this.stockDao.priceTargetCollection).then(pt => {
                if (!pt || Utilities_1.default.countDaysBetweenDates(Date.now(), pt.id) > 60) {
                    console.log("Midnight update: price targets (bi-monthly)");
                    this.iexDataService.getPriceTargetsForSymbols(symbols).then(async (priceTargets) => {
                        await this.stockDao.batchSaveFieldsInMultipleStockDocs(this.stockDao.stockCollection, this.stockDao.latestPriceTarget, priceTargets, true);
                        await this.stockDao.batchSaveDocInSubcollectionForSymbols(this.stockDao.stockCollection, this.stockDao.priceTargetCollection, todayString, priceTargets);
                    });
                }
            });
            //get recommendations every 90 days (once per 3 months)
            await this.stockDao.getMostRecentDocFromSubCollectionForSymbol(firstSymbol, this.stockDao.recommendationCollection).then(rec => {
                if (!rec || Utilities_1.default.countDaysBetweenDates(Date.now(), rec.id) >= 90) {
                    console.log("Midnight update: recommendations (tri-monthly)");
                    this.iexDataService.getRecommendationsForSymbols(symbols).then(async (recs) => {
                        await this.stockDao.batchSaveFieldsInMultipleStockDocs(this.stockDao.stockCollection, this.stockDao.latestRecommendations, recs, true);
                        await this.stockDao.batchSaveDocInSubcollectionForSymbols(this.stockDao.stockCollection, this.stockDao.recommendationCollection, todayString, recs);
                    });
                }
            });
            if (Utilities_1.default.isMonday(new Date())) {
                console.log("Midnight update: estimates (weekly)");
                //nonbatch FMP endpoint (basically all of them) take about an hour to get 10k stocks 
                //so the below 2 calls will take about 2 hours to finish. We don't need these to be super accurate so once a week is good
                let start = Date.now();
                await FMPService_1.default.updateEarningsForSymbols(symbols); //for next quarter eps estimates
                let end = Date.now();
                console.log(`EPS Estimates done in ${(end - start) / 1000.0}s`);
                start = Date.now();
                await FMPService_1.default.updateAnnualEarningsEstimates(symbols); //for annual eps estimate which is for forward pe calculation, these are not accurate from what i can tell
                end = Date.now();
                console.log(`Annual Earnings Estimates done in ${(end - start) / 1000.0}s`);
            }
            //analysis
            await AnalysisService_1.default.doAnalysis();
            //get all tweets
            await TwitterApiService_1.default.getDailyTweetsForAllFollowedAccounts();
            //update linked portfolio balances
            await PlaidService_1.default.getPlaidService().updateHoldingsForAllUsers();
        }
    }
    //no longer saving latest prices or charts, so the only thing i might want to do here is 
    //init new stocks, but theres probably a better way, like using some IPO calendar to fetch info for new stocks
    async initNewSymbols(allSymbols) {
        // console.log("updating prices and charts")
        let existing = [];
        let newStocks = [];
        let allSymbolsInDb = StockDao_1.default.getStockDaoInstance().getAllSymbols();
        for (let s of allSymbols) {
            if (allSymbolsInDb.includes(s)) {
                existing.push(s);
            }
            else {
                newStocks.push(s);
            }
        }
        console.log(`checked ${allSymbols.length} stocks against database of ${allSymbolsInDb.length} symbols - found ${newStocks.length} new stocks`);
        for (let n of newStocks) {
            //might need need to init more than just financials, new companies will have no scores and general info etc
            await FMPService_1.default.populateAllHistoryForSymbol(n);
        }
    }
    async scheduledMonthlyUpdate() {
        console.log("resetting twitter monthly counters");
        TwitterApiService_1.default.resetMonthlyCounters();
    }
}
exports.default = ScheduledUpdateService;
ScheduledUpdateService.marketNews = [];
ScheduledUpdateService.fiveYearsAgoDateString = Utilities_1.default.getFiveYearsAgoDateString();
//# sourceMappingURL=ScheduledUpdateService.js.map