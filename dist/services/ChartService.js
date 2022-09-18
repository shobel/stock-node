"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StockMarketUtility_1 = require("../utils/StockMarketUtility");
const Utilities_1 = require("../utils/Utilities");
const FMPService_1 = require("./FMPService");
class ChartService {
    constructor() {
        //caches
        //intraday -> doc, lastDbFetch
        //daily, weekly, and monthly -> values, lastDbFetch
        this.chartCache = {
        //symbol A: {intradayCache: {}, dailyCache: {}},
        //symbol B: {intradayCache: {}, dailyCache: {}}
        };
        this.intradayCacheValidityMarketOpen = 60000; //1min
        this.intradayCacheValidityMarketClosed = 7200000; //2hr
        this.intradayCacheKey = "intradayCache";
        this.dailyCacheKey = "dailyCache";
    }
    static getChartServiceInstance() {
        return ChartService.chartServiceInstance;
    }
    getDailyChartForSymbol(symbol) {
        if (this.isChartCacheValid(symbol, this.dailyCacheKey)) {
            let cachedChart = this.getCacheItem(symbol, this.dailyCacheKey).values;
            return Promise.resolve(cachedChart);
        }
        let chart = FMPService_1.default.getFullPriceHistoryForSymbol(symbol);
        this.setCache(symbol, this.dailyCacheKey, chart);
        return chart;
    }
    //The following 3 cache methods cannot be used for intraday chart
    //if the current time is before 5pm, we can return a cached value from the previous day
    //if the current time is after 5pm, we can return a cached value after 5pm
    isChartCacheValid(symbol, cacheKey) {
        if (!this.chartCache[symbol]) {
            this.chartCache[symbol] = {};
        }
        const chartCacheItem = this.chartCache[symbol][cacheKey];
        if (chartCacheItem && chartCacheItem.lastDbFetch) {
            const currentDate = new Date();
            if (Utilities_1.default.isAfter510pmOfCurrentDay(currentDate)) {
                if (Utilities_1.default.isAfter510pmOfCurrentDay(chartCacheItem.lastDbFetch)) {
                    return true;
                }
            }
            else if (Utilities_1.default.isAfter510pmOfPreviousDay(chartCacheItem.lastDbFetch)) {
                return true;
            }
        }
        return false;
    }
    getCacheItem(symbol, cacheKey) {
        return this.chartCache[symbol][cacheKey];
    }
    setCache(symbol, cacheKey, data) {
        this.chartCache[symbol] = {};
        this.chartCache[symbol][cacheKey] = {
            values: data,
            lastDbFetch: new Date()
        };
    }
    //TODO test the case where you check a stock around 2:30pm and then check again after market closes
    //see whether we fetch the full chart
    isIntradayCacheItemValid(symbol) {
        if (!this.chartCache[symbol]) {
            this.chartCache[symbol] = {};
            return false;
        }
        if (!this.chartCache[symbol][this.intradayCacheKey]) {
            return false;
        }
        let lastUpdateIsBeforeMarketOpen = StockMarketUtility_1.default.getStockMarketUtility().isMarketNormallyOpen(new Date());
        if (lastUpdateIsBeforeMarketOpen && StockMarketUtility_1.default.getStockMarketUtility().isMarketOpen) {
            //special case where last update was before market open and the market is currently open, which means 
            //our cached data is for sure wrong
            return false;
        }
        const intradayChartCache = this.chartCache[symbol][this.intradayCacheKey];
        if (intradayChartCache && intradayChartCache.intradayPrices && intradayChartCache.lastDbFetch) {
            const marketIsOpen = StockMarketUtility_1.default.getStockMarketUtility().isMarketOpen;
            const validTime = marketIsOpen || !intradayChartCache.fetchedFullDataset ? this.intradayCacheValidityMarketOpen : this.intradayCacheValidityMarketClosed;
            if ((Date.now() - intradayChartCache.lastDbFetch) < validTime) {
                return true;
            }
        }
        return false;
    }
    setIntradayCacheItem(symbol, data) {
        this.chartCache[symbol][this.intradayCacheKey] = {
            intradayPrices: data,
            lastDbFetch: Date.now()
        };
    }
    async getIntradayChartForSymbol(symbol) {
        if (this.isIntradayCacheItemValid(symbol)) {
            const intradayChartCache = this.chartCache[symbol][this.intradayCacheKey];
            return Promise.resolve(intradayChartCache.intradayPrices);
        }
        let result = await FMPService_1.default.getIntradayChartForSymbol(symbol);
        let processed = [];
        let latestNonNullValues = {};
        for (let i = 0; i < result.length; i++) {
            let r = result[i];
            if (!r.close && !r.high && !r.open && !r.low) {
                processed.push(latestNonNullValues);
            }
            else {
                latestNonNullValues = r;
                processed.push(r);
            }
        }
        this.setIntradayCacheItem(symbol, processed);
        return processed;
        // return IexDataService.getIexDataServiceInstance().getIntradayPricesForSymbol(symbol, null).then(async result => {
        //     let countWithoutData:number = 0
        //     for (let i = 0; i < result.length; i++){
        //         let r = result[i]
        //         if (!r.close && !r.high && !r.open && !r.low){
        //             countWithoutData += 1
        //         }
        //     }
        //     if ((countWithoutData / result.length) > 0.5) {
        //         //if more than 50% of the data is missing, fetch non-iex
        //         let intraday = await FMPService.getIntradayChartForSymbol(symbol) 
        //         result = intraday
        //     }
        //     let processed:any[] = []
        //     let latestNonNullValues:any = {}
        //     for (let i = 0; i < result.length; i++){
        //         let r = result[i]
        //         if (!r.close && !r.high && !r.open && !r.low){
        //             processed.push(latestNonNullValues)
        //         } else {
        //             latestNonNullValues = r
        //             processed.push(r)
        //         }
        //     }
        //     this.setIntradayCacheItem(symbol, processed)
        //     return processed
        // })
    }
}
exports.default = ChartService;
ChartService.chartServiceInstance = new ChartService();
//# sourceMappingURL=ChartService.js.map