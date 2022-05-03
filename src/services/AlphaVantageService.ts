import StockDao from "../dao/StockDao";
import Utilities from "../utils/Utilities"
import ChartDao from "../dao/ChartDao";
import ChartEntry from "../models/ChartEntry";
const fetch = require('node-fetch');

class AlphaVantageService {

    private alphaVantageBaseUrl:string = "https://www.alphavantage.co/query?function="
    private intradayEndpoint:string = "TIME_SERIES_INTRADAY"
    private dailyEndpoint:string = "TIME_SERIES_DAILY_ADJUSTED"
    private weeklyEndpoint:string = "TIME_SERIES_WEEKLY_ADJUSTED"
    private monthlyEndpoint:string = "TIME_SERIES_MONTHLY_ADJUSTED"
    private smaEndpoint:string = "SMA"
    private rsiEndpoint:string = "RSI"
    
    private apikey:string = "R6DTNYUJKN13ZYN4"
    private stockDao:StockDao
    private chartDao:ChartDao

    constructor(){
        this.stockDao = StockDao.getStockDaoInstance()
        this.chartDao = ChartDao.getChartDaoInstance()
    }

    //15 AV requests per stock * 7000 stocks = 105k total requests
    //$30 (30)-> 58.0hrs with 2s delay  
    //$50 (120)-> 14.6hrs with 0.5s delay
    //$100(300)-> 5.80hrs with 0.2s delay
    // public startUpdate() {
    //     return this.stockDao.getAllSymbols().then(async (symbolList:any) => {
    //         for (const symbol of symbolList) {
    //             const dailyPriceData = await this.fetchPrices(symbol, this.dailyEndpoint, "Time Series (Daily)")
    //             this.computeDailyGaps(symbol, dailyPriceData)
    //             await Utilities.sleep(15000)
    //             const dailyPriceDataWithSmas = await this.addMovingAveragesToSymbol(symbol, "daily", dailyPriceData)
    //             const dailyPriceDataWithRsis = await this.addRsiToSumbol(symbol, "daily", "14", dailyPriceDataWithSmas)
    //             await this.chartDao.setPriceData(symbol, Object.values(dailyPriceDataWithRsis), this.chartDao.getDailyPriceDataCollectionName())
                
    //             const weeklyPriceData = await this.fetchPrices(symbol, this.weeklyEndpoint, "Weekly Adjusted Time Series")
    //             await Utilities.sleep(15000)
    //             const weeklyPriceDataWithSmas = await this.addMovingAveragesToSymbol(symbol, "weekly", weeklyPriceData)
    //             const weeklyPriceDataWithRsis = await this.addRsiToSumbol(symbol, "daily", "14", weeklyPriceDataWithSmas)
    //             const weeklyArray = Object.values(weeklyPriceDataWithRsis).sort((a:any, b:any) => a.date < b.date ? 1 : -1)
    //             const weeklyArrayTrunc = weeklyArray.slice(0, 53)

    //             const monthlyPriceData = await this.fetchPrices(symbol, this.monthlyEndpoint, "Monthly Adjusted Time Series")
    //             await Utilities.sleep(15000)
    //             const monthlyPriceDataWithSmas = await this.addMovingAveragesToSymbol(symbol, "monthly", monthlyPriceData)
    //             const monthlyPriceDataWithRsis = await this.addRsiToSumbol(symbol, "daily", "14", monthlyPriceDataWithSmas)
    //         }
    //         return
    //     }).catch()
    // }

    // private computeDailyGaps(symbol:string, dailyPriceData:any) {
    //     let gapUps:any[] = []
    //     let gapDowns:any[] = []
    //     let values:ChartEntry[] = Object.values(dailyPriceData)
    //     values = values.reverse()
    //     for (let i = 0; i < values.length; i++) {
    //         const priceItem = values[i]

    //         const newGapUps:number[] = []
    //         for (const gapUp of gapUps){
    //             if (((priceItem.low - gapUp.gapClosePrice) / gapUp.gapClosePrice)*100 > 1){
    //                 newGapUps.push(gapUp)
    //             }
    //         }
    //         gapUps = newGapUps
    //         const newGapDowns:number[] = []
    //         for (const gapDown of gapDowns){
    //             if (((gapDown.gapClosePrice - priceItem.high)/gapDown.gapClosePrice)*100 > 1){
    //                 newGapDowns.push(gapDown)
    //             }
    //         }
    //         gapDowns = newGapDowns
    //         if (i > 0) {
    //             const previousPriceItem = values[i-1]
    //             if (priceItem.high < previousPriceItem.low) {
    //                 const gap = previousPriceItem.low - priceItem.high
    //                 const gapPercent = (gap / priceItem.high * 100)
    //                 if (gapPercent > 1){
    //                     gapDowns.push({ 
    //                         date: priceItem.date,
    //                         gapClosePrice: previousPriceItem.low, 
    //                         gapPercent: gapPercent.toFixed(2) 
    //                     })
    //                 }
    //             }
    //             if (priceItem.low > previousPriceItem.high) {
    //                 const gap = priceItem.low - previousPriceItem.high
    //                 const gapPercent = gap / previousPriceItem.high * 100
    //                 if (gapPercent > 1){
    //                     gapUps.push({ 
    //                         date: priceItem.date,
    //                         gapClosePrice: previousPriceItem.high, 
    //                         gapPercent: gapPercent.toFixed(2) 
    //                     })
    //                 }
    //             }
    //         }
    //     }
    //     this.stockDao.saveStockDocumentFieldForSymbol(symbol, "gapUps", gapUps).then(res => res).catch(err => err)
    //     this.stockDao.saveStockDocumentFieldForSymbol(symbol, "gapDowns", gapDowns).then(res => res).catch(err => err)
    // }

    // private async fetchPrices(symbol: string, endPoint: string, jsonKey: string) {
    //     console.log(`${Utilities.convertUnixTimestampToTimeStringWithSeconds(Date.now())} AV: fetching ${endPoint} price data for ${symbol}`)
    //     const url = `${this.alphaVantageBaseUrl}${endPoint}&outputsize=full&symbol=${symbol}&apikey=${this.apikey}`
    //     let priceData = null
    //     await fetch(url)
    //         .then((res: { json: () => any; }) => res.json())
    //         .then((json: any) => {
    //             const obj = json[jsonKey]
    //             priceData = this.convertPriceDataObjectToMap(obj)
    //         });
    //     return priceData
    // }

    // private async addRsiToSumbol(symbol: string, interval: string, timePeriod: string, priceMap: any) {
    //     console.log(`${Utilities.convertUnixTimestampToTimeStringWithSeconds(Date.now())} AV: fetching ${interval} rsi ${timePeriod} for ${symbol}`)
    //     const seriesType: string = "close"
    //     const url = `${this.alphaVantageBaseUrl}${this.rsiEndpoint}&symbol=${symbol}&interval=${interval}&time_period=${timePeriod}&series_type=${seriesType}&apikey=${this.apikey}`
    //     await fetch(url)
    //         .then((res: { json: () => any; }) => res.json())
    //         .then((json: any) => {
    //             if (!json.hasOwnProperty("Technical Analysis: RSI")) {
    //                 console.error(json)
    //             }
    //             const obj = json["Technical Analysis: RSI"]
    //             for (const key of Object.keys(obj)) {
    //                 const rsiValue = obj[key]["RSI"]
    //                 if (priceMap[key]) {
    //                     priceMap[key][`rsi${timePeriod}`] = parseFloat(rsiValue)
    //                 }
    //             }
    //             return
    //         }).then(async () => {
    //             await Utilities.sleep(15000)
    //             return
    //         })
    //     return priceMap
    // }
    
    // private async addMovingAveragesToSymbol(symbol:string, interval:string, priceMap:any){
    //     const timePeriods: string[] = ["20", "50", "100", "200"]
    //     const seriesType: string = "close"
    //     for (const timePeriod of timePeriods) {
    //         console.log(`${Utilities.convertUnixTimestampToTimeStringWithSeconds(Date.now())} AV: fetching ${interval} ${timePeriod} sma for ${symbol}`)
    //         const url = `${this.alphaVantageBaseUrl}${this.smaEndpoint}&symbol=${symbol}&interval=${interval}&time_period=${timePeriod}&series_type=${seriesType}&apikey=${this.apikey}`
    //         await fetch(url)
    //             .then((res: { json: () => any; }) => res.json())
    //             .then((json: any) => {
    //                 if (!json.hasOwnProperty("Technical Analysis: SMA")){
    //                     console.error(json)
    //                 }
    //                 const obj = json["Technical Analysis: SMA"]
    //                 for (const key of Object.keys(obj)) {
    //                     const smaValue = obj[key]["SMA"]
    //                     if (priceMap[key]) {
    //                         priceMap[key][`sma${timePeriod}`] = parseFloat(smaValue)
    //                     }
    //                 }
    //                 return
    //             }).then(async () => {
    //                 await Utilities.sleep(15000)
    //                 return
    //             })
    //     }
    //     return priceMap
    // }

    // private convertPriceDataObjectToMap(obj: any) {
    //     const retArr:any = {}
    //     const shortenedKeyArray = Object.keys(obj).slice(0, Object.keys(obj).length > 300 ? 300 : Object.keys(obj).length)
    //     for (const date of shortenedKeyArray){
    //         const priceData = obj[date]
    //         const close = priceData["4. close"]
    //         const adjClose = priceData["5. adjusted close"]
    //         let multiplier = 1
    //         if (adjClose !== close){
    //             multiplier = adjClose / close
    //         }
    //         const newPriceObj:ChartEntry = {
    //             open: parseFloat(priceData["1. open"]) * multiplier,
    //             high: parseFloat(priceData["2. high"]) * multiplier,
    //             low: parseFloat(priceData["3. low"]) * multiplier,
    //             close: parseFloat(priceData["5. adjusted close"]),
    //             volume: parseFloat(priceData["6. volume"]),
    //             date: date,
    //             earnings: false
    //         }
    //         retArr[date] = newPriceObj
    //     }
    //     return retArr
    // }

}

export default AlphaVantageService