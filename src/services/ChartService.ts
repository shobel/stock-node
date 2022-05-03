import ChartDao from "../dao/ChartDao"
import StockMarketUtility from "../utils/StockMarketUtility"
import Utilities from "../utils/Utilities"
import FMPService from "./FMPService"
import FMPDailyChartItem from "../models/FMPDailyChartItem"
import IexDataService from "./IexDataService"
import ScheduledUpdateService from "./ScheduledUpdateService"

export default class ChartService {

    //caches
    //intraday -> doc, lastDbFetch
    //daily, weekly, and monthly -> values, lastDbFetch
    private chartCache:any = {
        //symbol A: {intradayCache: {}, dailyCache: {}},
        //symbol B: {intradayCache: {}, dailyCache: {}}
    }
    private intradayCacheValidityMarketOpen:number = 60000 //1min
    private intradayCacheValidityMarketClosed:number = 7200000 //2hr
    private intradayCacheKey:string = "intradayCache"
    private dailyCacheKey:string = "dailyCache"

    private static chartServiceInstance:ChartService = new ChartService()


    constructor(){}

    public static getChartServiceInstance(){
        return ChartService.chartServiceInstance
    }

    public getDailyChartForSymbol(symbol:string) {
        if (this.isChartCacheValid(symbol, this.dailyCacheKey)){
            let cachedChart:FMPDailyChartItem[] = this.getCacheItem(symbol, this.dailyCacheKey).values
            return Promise.resolve(cachedChart)
        }
        let chart = FMPService.getFullPriceHistoryForSymbol(symbol)
        this.setCache(symbol, this.dailyCacheKey, chart)
        return chart
    }

    //The following 3 cache methods cannot be used for intraday chart
    //if the current time is before 5pm, we can return a cached value from the previous day
    //if the current time is after 5pm, we can return a cached value after 5pm
    private isChartCacheValid(symbol, cacheKey){
        if (!this.chartCache[symbol]){
            this.chartCache[symbol] = {}
        }
        const chartCacheItem = this.chartCache[symbol][cacheKey]
        if (chartCacheItem && chartCacheItem.lastDbFetch){
            const currentDate = new Date()
            if (Utilities.isAfter510pmOfCurrentDay(currentDate)){
                if (Utilities.isAfter510pmOfCurrentDay(chartCacheItem.lastDbFetch)){
                    return true
                }
            } else if (Utilities.isAfter510pmOfPreviousDay(chartCacheItem.lastDbFetch)){
                return true
            }
        }
        return false
    }

    private getCacheItem(symbol, cacheKey) {
        return this.chartCache[symbol][cacheKey]
    }

    private setCache(symbol, cacheKey, data){
        this.chartCache[symbol] = {}
        this.chartCache[symbol][cacheKey] = {
            values: data,
            lastDbFetch: new Date()
        }
    }

    //TODO test the case where you check a stock around 2:30pm and then check again after market closes
    //see whether we fetch the full chart
    private isIntradayCacheItemValid(symbol:string){
        if (!this.chartCache[symbol]) {
            this.chartCache[symbol] = {}
            return false
        }
        if (!this.chartCache[symbol][this.intradayCacheKey]){
            return false
        }
        let lastUpdateIsBeforeMarketOpen = StockMarketUtility.getStockMarketUtility().isMarketNormallyOpen(new Date())
        if (lastUpdateIsBeforeMarketOpen && StockMarketUtility.getStockMarketUtility().isMarketOpen){
            //special case where last update was before market open and the market is currently open, which means 
            //our cached data is for sure wrong
            return false
        }
        const intradayChartCache = this.chartCache[symbol][this.intradayCacheKey]
        if (intradayChartCache && intradayChartCache.intradayPrices && intradayChartCache.lastDbFetch) {
            const marketIsOpen = StockMarketUtility.getStockMarketUtility().isMarketOpen
            const validTime = marketIsOpen || !intradayChartCache.fetchedFullDataset ? this.intradayCacheValidityMarketOpen : this.intradayCacheValidityMarketClosed
            if ((Date.now() - intradayChartCache.lastDbFetch) < validTime) {
                return true
            }
        }
        return false
    }

    private setIntradayCacheItem(symbol, data){
        this.chartCache[symbol][this.intradayCacheKey] = {
            intradayPrices: data,
            lastDbFetch: Date.now()
        }
    }

    public getIntradayChartForSymbol(symbol: string) {
        if (this.isIntradayCacheItemValid(symbol)) {
            const intradayChartCache = this.chartCache[symbol][this.intradayCacheKey]
            return Promise.resolve(intradayChartCache.intradayPrices)
        }

        return IexDataService.getIexDataServiceInstance().getIntradayPricesForSymbol(symbol, null).then(result => {
            let processed:any[] = []
            let latestNonNullValues:any = {}
            for (let i = 0; i < result.length; i++){
                let r = result[i]
                if (!r.close){
                    processed.push(latestNonNullValues)
                } else {
                    latestNonNullValues = r
                    processed.push(r)
                }
            }
            this.setIntradayCacheItem(symbol, processed)
            return processed
        })
    }

}