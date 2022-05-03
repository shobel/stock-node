import StockMarketUtility from "../utils/StockMarketUtility";
import FMPService from "./FMPService";
import IexDataService from "./IexDataService";
import Utilities from "../utils/Utilities";

export default class QuoteService {

    private static updateInterval:number = 120000 //1 min
    private static simplifiedChartInterval:number = 600000 //every 10min
    public static quoteCache:{ [key: string]: any }  = {} // { symbol:string -> { latestQuote:FMPQuote, simplifiedChart: number[]} }
    public static extendedQuoteCache:any = {} //{symbol:string -> { price:number, priceTime:number, updated:number }
    public static extendedQuoteUpdateInterval:number = 600000*3 //30min

    public static fetching:boolean = false //to make sure we don't have 2 "threads" continuously fetching

    constructor() {}

    //will fetch latestQuotes every updateInterval until stockmarket closes
    public static async fetchLatestQuotesUntilMarketCloses(fromInit:boolean){
        if (QuoteService.fetching){
            return
        }
        if (!fromInit){
            for (let key of Object.keys(QuoteService.quoteCache)) {
                QuoteService.quoteCache[key].simplifiedChart = []
            }
        }

        let iteration:number = 0
        var intervalID = setInterval(async function() {
            let isMarketOpen = await FMPService.getIsMarketOpen()
            StockMarketUtility.getStockMarketUtility().isMarketOpen = isMarketOpen
            if (isMarketOpen) {
                QuoteService.fetchLatestQuotesForAllSymbolsAndWriteToCache(iteration)
            } else {
                clearInterval(intervalID)
                QuoteService.fetching = false
            }
            iteration += 1
        }, QuoteService.updateInterval)

    }

    //fetches quotes, writes quotes to cache, also builds simplified chart every simplifiedChartInterval (10min)
    public static fetchLatestQuotesForAllSymbolsAndWriteToCache(iteration:number){
        console.log(`fetching all quotes iteration ${iteration}`)

        return FMPService.getQuoteForAllSymbols().then(quotes => {
            for (let q of quotes){
                q.symbol = q.symbol.replace("-", ".")
                if (!this.quoteCache[q.symbol]){
                    this.quoteCache[q.symbol] = {}
                }
                this.quoteCache[q.symbol].latestQuote = q
                if (!this.quoteCache[q.symbol].simplifiedChart) {
                    this.quoteCache[q.symbol].simplifiedChart = []
                }
                if ((this.updateInterval*iteration) % this.simplifiedChartInterval == 0) {
                    this.quoteCache[q.symbol].simplifiedChart.push({
                        minute: (this.quoteCache[q.symbol].simplifiedChart.length + 1).toString(),
                        close: q.price
                    })
                }
            }
            return
        })
    }

    //called from stockrouter
    public static async getLatestQuotes(symbols:string[], alsoGetSimplifiedChart:boolean) {
        if (!symbols || !symbols.length){
            return null
        }

        let su = StockMarketUtility.getStockMarketUtility()

        let quoteMap:any = {}
        let symbolsNeedExtendedPrice:string[] = []
        for (let s of symbols) {
            if (QuoteService.quoteCache.hasOwnProperty(s)){
                quoteMap[s] = {}
                if (alsoGetSimplifiedChart){
                    quoteMap[s].simplifiedChart = QuoteService.quoteCache[s].simplifiedChart
                    quoteMap[s].latestQuote = QuoteService.quoteCache[s].latestQuote
                } else {
                    quoteMap[s] = QuoteService.quoteCache[s].latestQuote
                }

                if (quoteMap[s].latestQuote && isNaN(quoteMap[s].latestQuote.earningsAnnouncement)){
                    let daysToEarnings = Utilities.countDaysBetweenDateStringsOrderMatters(quoteMap[s].latestQuote.earningsAnnouncement, new Date().toISOString())
                    quoteMap[s].latestQuote.daysToEarnings = daysToEarnings
                }
                if (!su.isMarketOpen){
                    let extendedCachedPrice = QuoteService.extendedQuoteCache[s]
                    if (!extendedCachedPrice) {
                        symbolsNeedExtendedPrice.push(s)
                    } else {
                        let price = extendedCachedPrice.price
                        let priceTime = extendedCachedPrice.priceTime
                        let changePercent = extendedCachedPrice.changePercent
                        let updated = extendedCachedPrice.updated
                        if ((Date.now() - updated) >= QuoteService.extendedQuoteUpdateInterval){
                            symbolsNeedExtendedPrice.push(s)
                        } else {
                            if (alsoGetSimplifiedChart){
                                quoteMap[s].latestQuote.extendedPrice = price
                                quoteMap[s].latestQuote.extendedPriceTime = priceTime
                                quoteMap[s].latestQuote.extendedChangePercent = changePercent
                            } else {
                                quoteMap[s].extendedPrice = price
                                quoteMap[s].extendedPriceTime = priceTime
                                quoteMap[s].extendedChangePercent = changePercent
                            }
                        }
                    }
                }
            } 
        }

        if (symbolsNeedExtendedPrice.length){
            let latestQuotes = await IexDataService.getIexDataServiceInstance().getJustLatestQuoteForSymbols(symbolsNeedExtendedPrice)
            for (let lq of latestQuotes) {
                QuoteService.extendedQuoteCache[lq.symbol] = {
                    price: lq.extendedPrice,
                    priceTime: lq.extendedPriceTime,
                    changePercent: lq.extendedChangePercent,
                    updated: Date.now()
                }
                if (alsoGetSimplifiedChart){
                    quoteMap[lq.symbol].latestQuote.extendedPrice = lq.extendedPrice
                    quoteMap[lq.symbol].latestQuote.extendedPriceTime = lq.extendedPriceTime
                    quoteMap[lq.symbol].latestQuote.extendedChangePercent = lq.extendedChangePercent
                } else {
                    if (quoteMap[lq.symbol]) {
                        quoteMap[lq.symbol].extendedPrice = lq.extendedPrice
                        quoteMap[lq.symbol].extendedPriceTime = lq.extendedPriceTime
                        quoteMap[lq.symbol].extendedChangePercent = lq.extendedChangePercent
                    }
                }
            }
        }
        quoteMap["isUSMarketOpen"] = su.isMarketOpen
    return quoteMap
    }

    public static saveSimplifiedChartsToCache(simplifiedCharts:any){
        for (let [key,value] of Object.entries(simplifiedCharts)){
            if (QuoteService.quoteCache.hasOwnProperty(key)){
                QuoteService.quoteCache[key].simplifiedChart = value
            }
        }
        console.log()
    }

    // //includes simplified charts
    // public getQuotesFromIexForSymbols(symbols: string[]) {
    //     return this.iexDataService.getLatestQuoteForSymbols(symbols).then((data: any) => {
    //         const dataToSave = {}
    //         for (const symbol of Object.keys(data)){
    //             dataToSave[symbol] = {}
    //             const simpleQuote:SimpleQuote = this.convertIexQuoteToSimpleQuote(data[symbol]["quote"])
    //             let simplifiedChartValues:any[] = data[symbol]["intraday-prices"].map(v => {
    //                 return { 
    //                     "minute": v.minute,
    //                     "close": v.close
    //                 }
    //             })
    //             simplifiedChartValues = simplifiedChartValues.filter(v => v && v.minute && v.close)
    //             dataToSave[symbol]["latestQuote"] = simpleQuote
    //             dataToSave[symbol]["simplifiedChart"] = simplifiedChartValues
    //         }
    //         return this.stockDao.batchSaveLatestQuotes(dataToSave, true).then(() => {
    //             return dataToSave
    //         })
    //     })
    // }

    // public getLatestQuotes(symbols:string[], alsoGetSimplifiedChart:boolean) {
    //     return new Promise((resolve, reject) => {
    //         const symbolsUpper = symbols.map(s => s.toUpperCase())
    //         const freshQuotes = this.getValidQuotesFromCacheForSymbols(symbolsUpper, alsoGetSimplifiedChart)
    //         const symbolsToUpdate:string[] = []
    //         for (const s of symbolsUpper){
    //             if (!Object.keys(freshQuotes).includes(s)){
    //                 symbolsToUpdate.push(s)
    //             }
    //         }
    //         if (!symbolsToUpdate.length){
    //             //console.log(`getting all ${symbolsUpper.length} from cache`)
    //             resolve(freshQuotes)
    //         }
    //         this.stockDao.getLatestQuotes(symbolsToUpdate).then(async (response: any) => {
    //             let isHoliday = this.stockMarketUtility.isHoliday(new Date())
    //             let isDateBetweenPreAndAfterMarket = this.stockMarketUtility.isDateBetweenPreAndAfterMarket(new Date())
    //             let isMarketOpen = this.stockMarketUtility.getIsMarketOpen()
    //             const now = Date.now()
    //             const needNewQuoteArrayIEX: string[] = []
    //             const needNewQuoteArrayFMP: string[] = []
    //             for (const key in response) {
    //                 const data = response[key]
    //                 if (isHoliday) {
    //                     if (data == null || !data.latestQuote.timestampIex || (now - data.latestQuote.timestampIex > this.updateIntervalIEX)) {
    //                         needNewQuoteArrayFMP.push(key)
    //                     }
    //                 } else if (isMarketOpen) {
    //                     //console.log(`${now}: market is open`)
    //                     if (data == null || !data.latestQuote.timestampIex || (now - data.latestQuote.timestampIex > this.updateIntervalIEX)) {
    //                         //console.log(`${now}: ${now - data.latestQuote.timestampIex} since last iex update so fetching from iex`)
    //                         needNewQuoteArrayIEX.push(key)
    //                     } else if (!data.latestQuote.timestamp || (now - data.latestQuote.timestamp > this.updateIntervalFMP)) {
    //                         //console.log(`${now}: ${now - data.latestQuote.timestamp} since last update, so fetching from fmp`)
    //                         needNewQuoteArrayFMP.push(key)
    //                     } else {
    //                         //console.log(`${now}: current quotes are fresh`)
    //                         freshQuotes[key] = response[key]
    //                     }
    //                 } else if (isDateBetweenPreAndAfterMarket) {
    //                     //console.log(`${now}: market is in extended hours`)
    //                     if (data == null || (now - data.latestQuote.timestampIex > this.updateIntervalIEX)) {
    //                         //console.log(`${now}: ${now - data.latestQuote.timestampIex} since last iex update so fetching from iex`)
    //                         needNewQuoteArrayIEX.push(key)
    //                     } else {
    //                         //console.log(`${now}: ${now - data.latestQuote.timestampIex} since last iex update so no need to fetch from iex`)
    //                         freshQuotes[key] = {
    //                             latestQuote: data.latestQuote.quote,
    //                             simplifiedChart: data.simplifiedChart
    //                         }
    //                         if (!alsoGetSimplifiedChart){
    //                             freshQuotes[key] = data.latestQuote.quote
    //                         }
    //                         this.quoteCache[key] = {
    //                             latestQuote: data.latestQuote.quote,
    //                             simplifiedChart: data.simplifiedChart,
    //                             lastDbFetch: Date.now()
    //                         }
    //                     }
    //                 } else {
    //                     // console.log(`${now}: market is not open and not extended hours`)
    //                     //if the quote we have is from when the market was open (or extended hours) or it's at least a day old, get a new one
    //                     if (data == null || data.latestQuote.quote.isUSMarketOpen || 
    //                         (now - data.latestQuote.timestamp) > 86000000 || 
    //                         this.stockMarketUtility.isDateBetweenPreAndAfterMarket(new Date(data.latestQuote.timestamp))) {
    //                             //console.log(`${now}: latest saved quote is old, fetching from iex`)
    //                             needNewQuoteArrayIEX.push(key)
    //                     } else {
    //                         freshQuotes[key] = {
    //                             latestQuote: data.latestQuote.quote,
    //                         }
    //                         if (alsoGetSimplifiedChart){
    //                             freshQuotes[key].simplifiedChart = data.simplifiedChart
    //                         }
    //                         this.quoteCache[key] = {
    //                             latestQuote: data.latestQuote.quote,
    //                             simplifiedChart: data.simplifiedChart,
    //                             lastDbFetch: Date.now()
    //                         }
    //                     }
    //                 }
    //             }
    //             //if some of our quotes are expired or missing, we need to get fresh ones to return
    //             if (needNewQuoteArrayIEX.length > 0) {
    //                 console.log(`need new iex quote for ${needNewQuoteArrayIEX.length} stocks`)
    //                 this.getQuotesFromIexForSymbols(needNewQuoteArrayIEX).then((symbolData: any) => {
    //                     for (const symbol in symbolData) {
    //                         freshQuotes[symbol] = alsoGetSimplifiedChart ? symbolData[symbol] : symbolData[symbol].latestQuote
    //                         this.quoteCache[symbol] = {
    //                             latestQuote: symbolData[symbol].latestQuote,
    //                             simplifiedChart: symbolData[symbol].simplifiedChart,
    //                             lastDbFetch: Date.now()
    //                         }
    //                     }
    //                     if (Object.keys(freshQuotes).length >= symbolsToUpdate.length) {
    //                         resolve(freshQuotes)
    //                     }
    //                 }).catch()
    //             } 
    //             if (needNewQuoteArrayFMP.length > 0) {
    //                 console.log(`need new fmp quote for ${needNewQuoteArrayFMP.length} stocks`)
    //                 this.getQuotesFromFMPForSymbols(symbolsToUpdate, !isHoliday).then((symbolData:any) => {
    //                     for (const symbol in symbolData) {
    //                         freshQuotes[symbol] = alsoGetSimplifiedChart ? 
    //                             { 
    //                                 latestQuote: symbolData[symbol].latestQuote, 
    //                                 simplifiedChart: response[symbol].simplifiedChart 
    //                             } 
    //                             : symbolData[symbol].latestQuote
    //                     }
    //                     if (Object.keys(freshQuotes).length >= symbolsToUpdate.length) {
    //                         resolve(freshQuotes)
    //                     }
    //                 }).catch()
    //             }
    //             if (!needNewQuoteArrayFMP.length && !needNewQuoteArrayIEX.length){
    //                 resolve(freshQuotes)
    //             }
    //         }).catch()
    //     })
    // }

    // private convertIexQuoteToSimpleQuote(iexQuote: any) {
    //     const simpleQuote: SimpleQuote = {
    //         symbol: iexQuote.symbol,
    //         open: iexQuote.open,
    //         openTime: iexQuote.openTime,
    //         close: iexQuote.close,
    //         closeTime: iexQuote.closeTime,
    //         high: iexQuote.high,
    //         low: iexQuote.low,
    //         latestPrice: iexQuote.latestPrice,
    //         latestSource: iexQuote.latestSource,
    //         latestTime: iexQuote.latestTime,
    //         latestUpdate: iexQuote.latestUpdate,
    //         latestVolume: iexQuote.latestVolume,
    //         extendedPrice: iexQuote.extendedPrice,
    //         extendedChange: iexQuote.extendedChange,
    //         extendedChangePercent: iexQuote.extendedChangePercent,
    //         extendedPriceTime: iexQuote.extendedPriceTime,
    //         previousClose: iexQuote.previousClose,
    //         previousVolume: iexQuote.previousVolume,
    //         change: iexQuote.change,
    //         changePercent: iexQuote.changePercent,
    //         avgTotalVolume: iexQuote.avgTotalVolume,
    //         week52High: iexQuote.week52High,
    //         week52Low: iexQuote.week52Low,
    //         peRatio: iexQuote.peRatio,
    //         isUSMarketOpen: iexQuote.isUSMarketOpen
    //     }
    //     return simpleQuote
    // }
}