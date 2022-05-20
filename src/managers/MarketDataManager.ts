import MarketDao from "../dao/MarketDao";
import IexDataService from "../services/IexDataService";
import FMPService from "../services/FMPService";
import QuoteService from "../services/QuoteService";

export default class MarketDataManager {

    private static marketDao:MarketDao = MarketDao.getMarketDaoInstance()
    private static iexDataService:IexDataService = IexDataService.getIexDataServiceInstance()

    public static tipranksSymbolCache:any = null
    public static tipranksSymbolCacheLastUpdate:number = 0
    public static tipranksSymbolCacheUpdateIntervalMs:number = 10800000 //3 hours

    public static initWeeklyEconomicData(){
        return FMPService.getWeeklyEconomicData(true).then(data => {
            return MarketDataManager.marketDao.batchSaveMultipleDocsInCollectionWithFieldIds(MarketDataManager.marketDao.economicDataCollectionWeekly, "id", data, false)
        })
    }
    
    public static initMonthlyEconomicData(){
        return FMPService.getMonthlyEconomicData(true).then(data => {
            return MarketDataManager.marketDao.batchSaveMultipleDocsInCollectionWithFieldIds(MarketDataManager.marketDao.economicDataCollectionMonthly, "id", data, false)
        })
    }

    public static initQuarterlyEconomicData(){
        return FMPService.getQuarterlyEconomicData(true).then(data => {
            return MarketDataManager.marketDao.batchSaveMultipleDocsInCollectionWithFieldIds(MarketDataManager.marketDao.economicDataCollectionQuarterly, "id", data, false)
        })
    }

    public static getStocktwitsTrending(symbolsOnly:boolean){
        return MarketDataManager.marketDao.getStocktwitsTrending().then((result:any) => {
            if (symbolsOnly){
                const symbols:any = {}
                for (const trendingObject of result){
                    if (trendingObject.symbols.length > 0){
                        const symbol = trendingObject.symbols[0].symbol
                        if (!symbols.hasOwnProperty(symbol)){
                            symbols[symbol] = {}
                            symbols[symbol].Bullish = 0
                            symbols[symbol].Bearish = 0
                        }
                        if (trendingObject.entities.sentiment && trendingObject.entities.sentiment.basic){
                            const sentiment = trendingObject.entities.sentiment.basic
                            symbols[symbol][sentiment] += 1
                        }
                    }
                }
                const finalizedSymbols:any[] = []
                for (const symbolKey of Object.keys(symbols)){
                    const symbol = symbols[symbolKey]
                    if (!symbol.Bullish && !symbol.Bearish){
                        finalizedSymbols.push({
                            symbol: symbolKey,
                            sentiment: null
                        })
                    } else {
                        finalizedSymbols.push({
                            symbol: symbolKey,
                            sentiment: symbol.Bullish / (symbol.Bearish + symbol.Bullish)
                        })
                    }
                }
                return finalizedSymbols
            } else {
                const results:any[] = []
                for (const r of result){
                    const post:any = {}
                    post.id = r.id
                    post.body = r.body
                    post.symbols = r.symbols.map(s => s.symbol)
                    post.username = r.user.username
                    if (r.entities && r.entities.sentiment && r.entities.sentiment.basic){
                        post.sentiment = r.entities.sentiment.basic
                    }
                    post.timestamp = r.timestamp
                    post.createdAt = r.created_at
                    results.push(post)
                }
                return results
            }
        }).catch()
    }

    public static getAllTop10(){
        return MarketDataManager.marketDao.getAllTop10().then(result => result).catch()
    }

    public static getMarketNews(){
        return MarketDataManager.marketDao.getMarketNews().then(result => result)
    }

    public static getSectorPerformances() {
        return MarketDataManager.marketDao.getSectorPerformances().then(performances => {
            if (!performances){
                return MarketDataManager.iexDataService.getSectorPerformance().then(iexResult => {
                    return MarketDataManager.marketDao.saveSectorPerformances(iexResult)
                }).then(() => {
                    return MarketDataManager.marketDao.getSectorPerformances()
                }).then(dbResult => dbResult)
            }
            return performances
        }).catch()
    }

    public static getLatestEconomicData(){
        const aggregateData:any = {}
        return MarketDataManager.marketDao.getLatestEconomicData(MarketDataManager.marketDao.economicDataCollectionWeekly)
        .then(data1 => {
            aggregateData.weekly = data1
            return MarketDataManager.marketDao.getLatestEconomicData(MarketDataManager.marketDao.economicDataCollectionMonthly)
        }).then(data2 => {
            aggregateData.monthly = data2
            return MarketDataManager.marketDao.getLatestEconomicData(MarketDataManager.marketDao.economicDataCollectionQuarterly)
        }).then(data3 => {
            aggregateData.quarterly = data3
            return aggregateData
        })
    }

    /* gdp is quarterly, we probably want around 5 years which is 20 quarterly docs */
    public static getEconomicData(numDocs:number){
        const aggregateData:any = {}
        return MarketDataManager.marketDao.getEconomicData(MarketDataManager.marketDao.economicDataCollectionWeekly, numDocs*13)
        .then(data1 => {
            aggregateData.weekly = data1
            return MarketDataManager.marketDao.getEconomicData(MarketDataManager.marketDao.economicDataCollectionMonthly, numDocs*3)
        }).then(data2 => {
            aggregateData.monthly = data2
            return MarketDataManager.marketDao.getEconomicData(MarketDataManager.marketDao.economicDataCollectionQuarterly, numDocs)
        }).then(data3 => {
            aggregateData.quarterly = data3
            return aggregateData
        })
    }

    public static getTipranksTopAnalysts(){
        return MarketDataManager.marketDao.getTipranksTopAnalysts()
    }

    public static async getTipranksSymbols(numAnalystThreshold){
        let docDataList:any[] = []
        if (!MarketDataManager.tipranksSymbolCache || Date.now() - MarketDataManager.tipranksSymbolCacheLastUpdate > MarketDataManager.tipranksSymbolCacheUpdateIntervalMs) {
            //snapshots
            let docSnaps = await MarketDataManager.marketDao.getTipranksTopSymbols()
            let allData:any[] = []
            for (let doc of docSnaps) {
                let numAnalysts = doc.get("numAnalysts")
                let docData = doc.data()
                if (!numAnalystThreshold || numAnalysts >= numAnalystThreshold) {
                    docDataList.push(docData)
                }
                allData.push(docData)
            }
            MarketDataManager.tipranksSymbolCache = allData
            MarketDataManager.tipranksSymbolCacheLastUpdate = Date.now()
        } else {
            for (let ci of MarketDataManager.tipranksSymbolCache) {
                if (!numAnalystThreshold || ci.numAnalysts >= numAnalystThreshold) {
                    docDataList.push(ci)
                }
            }
        }
        return docDataList
    }

    public static getFearGreed(){
        return MarketDataManager.marketDao.getFearGreed()
    }

    public static getMarketAndEconomyData(){
        const combinedData = {}
        return MarketDataManager.getFearGreed().then(fearGreed => {
            combinedData["fearGreed"] = fearGreed
            return
        }).then(() => {
            return MarketDataManager.getSectorPerformances()
        }).then(sectors => {
            combinedData["sectorPerformance"] = Object.values(sectors)
            return MarketDataManager.getEconomicData(20) //5 years
        }).then(economy => {
            combinedData["economy"] = economy
            return combinedData
        })
    }

    public static async updateTopAnalystPortfolio(){
        let md = MarketDao.getMarketDaoInstance()
        let top10 = await md.getTop10Field(md.topAnalysts)
        let portfolio = await md.getTopAnalystsPortfolio()
        if (portfolio && portfolio.currentPositions && portfolio.currentPositions.length) {
            //if we have a portfolio, calculate and save the new value of it
            let currentPositions = portfolio.currentPositions
            let newPortValue = 0
            for (let pos of currentPositions) {
                let currentPrice = await QuoteService.getLatestQuotes([pos.symbol], false)
                let currentPosValue = pos.numShares * currentPrice
                newPortValue += currentPosValue
            }
            md.updateTopAnalystsPortfolioValue(newPortValue)

            //adjust the portfolio poisitions
            let top10symbols:string[] = top10.map(s => s.symbol)
            let dollarsOfEach = newPortValue / top10symbols.length
            let newPortfolio:any[] = []
            for (let s of top10symbols) {
                let quotes = await QuoteService.getLatestQuotes([s], false)
                let latestPrice:number = 0
                if (quotes.hasOwnProperty(s)){
                    latestPrice = quotes[s].price
                }
                let position = {
                    symbol: s,
                    numShares: dollarsOfEach / latestPrice
                }
                newPortfolio.push(position)
            }
            md.updateTopAnalystsPortfolioPositions(newPortfolio)
        } else {
            //create a portfolio
            let newPortfolio:any[] = []
            for (let top of top10){
                let quotes = await QuoteService.getLatestQuotes([top.symbol], false)             
                let latestPrice:number = 0
                if (quotes.hasOwnProperty(top.symbol)){
                    latestPrice = quotes[top.symbol].price
                }
                let numShares = 1.0/latestPrice
                let position = {
                    symbol: top.symbol,
                    numShares: numShares
                }
                newPortfolio.push(position)
            }         
            let newPortValue = 0
            for (let pos of newPortfolio) {
                let quotes = await QuoteService.getLatestQuotes([pos.symbol], false)
                let latestPrice:number = 0
                if (quotes.hasOwnProperty(pos.symbol)){
                    latestPrice = quotes[pos.symbol].price
                }
                let currentPosValue = pos.numShares * latestPrice
                newPortValue += currentPosValue
            }
            md.updateTopAnalystsPortfolioValue(newPortValue)
            md.updateTopAnalystsPortfolioPositions(newPortfolio)
        }

    }
}