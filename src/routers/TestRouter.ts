import { Request, Response, Router } from 'express'
import FMPService from '../services/FMPService'
import StockDao from '../dao/StockDao'
import AnalysisService from '../services/AnalysisService';
import FidelityService from '../services/FidelityService';
import IexDataService from '../services/IexDataService';
import StockDataManager from '../managers/StockDataManager';
import StocktwitsService from '../services/StocktwitsService';
import FearGreedService from '../services/FearGreedService';
import TipranksService from '../services/TipranksService';
import PremiumDataManager from '../managers/PremiumDataManager';
import TwitterApiService from '../services/TwitterApiService';
import MarketDataManager from '../managers/MarketDataManager';
import MarketDao from '../dao/MarketDao';

const testRouter = Router()

/************************************************************/
/********************* TEST ENDPOINTS ***********************/
/************************************************************/
testRouter.get('/score-settings', async (req: Request, res: Response) => {
    const userid = "XcHCGI3CmWXEzaZFMnOzhGQWx2S2"
    StockDataManager.applyUserScoreSettingsForSymbol(userid, "AAPL").then(result => {
        res.send(result)
    }).catch()
})
testRouter.get('/fear-and-greed', async (req: Request, res: Response) => {
    FearGreedService.getFearAndGreedIndicators().then(result => {
        res.send(result)
    }).catch()
})
testRouter.get('/stocktwits', async (req: Request, res: Response) => {
    StocktwitsService.getTrendingSymbols().then(result => {
        res.send(result)
    }).catch()
})
testRouter.get('/test', async (req: Request, res: Response) => {
    // let allSymbols = Object.keys(QuoteService.quoteCache)
    FMPService.screener({ operation: ">", value: 100000000000}, null, null, null, null, null, "nasdaq,nyse").then(result => {
        FMPService.updateAnnualEarningsEstimates(result.map(r => r.symbol))
        res.send("ok")    
    }).catch()

})
testRouter.get('/market-cap-screener', async (req: Request, res: Response) => {
    const symbol:any = req.query.symbol
    const operation = req.query.operation
    const value = req.query.value
    FMPService.screener({ operation: operation, value: value}, null, null, null, null, null, "nasdaq,nyse").then(result => {
        res.send(result)
    }).catch()
})
testRouter.get('/analysis', async (req: Request, res: Response) => {
    AnalysisService.doAnalysis().then(result => {
        res.send(result)
    }).catch()
})
testRouter.get('/premium-for-symbols/:userid', async (req: Request, res: Response) => { 
    const userid = req.params.userid
    const symbols: string = req.query.symbols as string
    const premiumId:string = req.query.premiumId as string
    if (!symbols){
        res.send(null)
        return
    }
    PremiumDataManager.getLatestPremiumDataTypeForSymbols(symbols.split(","), premiumId, userid).then(result => {
        res.send(result)
    })
})
// testRouter.get('/gapscore', async (req: Request, res: Response) => {
//     const gapups = [ 
//         { gapClosePrice: 0, gapPercent: 1.0, date: "2020-02-02"},
//         { gapClosePrice: 0, gapPercent: 1.5, date: "2020-07-02"}
//     ]
//     const gapdowns = [ 
//         { gapClosePrice: 0, gapPercent: 11.7, date: "2020-05-02"}
//     ]
//     res.send(AnalysisService.computeGapScore(gapups, gapdowns))
// })
testRouter.get('/smascore/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol

})
testRouter.get('/fidelity', async (req: Request, res: Response) => {
    FidelityService.scrape().then(result => {
        res.send(result)
    }).catch()
})
testRouter.get('/populate/:symbol/:isCompany', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    const isCompany:boolean = req.params.isCompany === "true"
    FMPService.populateAllHistoryForSymbol(symbol).then(result => {
        res.send(result)
    }).catch()
})
testRouter.get('/test1/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    FMPService.updateAllFinancialDataSingleEndpoint(symbol).then(result => {
        res.send(result)
    }).catch()
})

testRouter.get('/snapshot-listener-test/:test', async (req: Request, res: Response) => {
    let s = req.params.test
    let test = await StockDao.getStockDaoInstance().editFieldTest(s)
    res.send(test)
})
testRouter.get('/keystats', async (req: Request, res: Response) => {

})
testRouter.get('/agg', async (req: Request, res: Response) => {
    const arr = await FMPService.aggregate(["AAPL", "MSFT", "NVDA", "AVGO", "TSLA", "FB", "AMZN", "ATVI", "MTCH", "AMD", "WMT", "V"])
    res.send(arr)
})
testRouter.get('/tipranks1', async (req: Request, res: Response) => {
    await TipranksService.fetchTopAnalysts()
})
testRouter.get('/manyquotes', async (req: Request, res: Response) => {
    let r = await FMPService.screener({operation: ">", value: "50000000000"}, null, null, null, null, null, null)
    r = r.map(x => x.symbol)
    let x = await StockDataManager.getLatestQuotesForSymbols(r, false)
    res.send(x)
})
testRouter.get('/twitter', async (req: Request, res: Response) => {
    // let r = await TwitterApiService.fetchTweetsForUser("hedgeyeretail", (new Date(Date.now() - TwitterApiService.dayInMs)).toISOString(), 10)
    // res.send(r)
})
testRouter.post('/sentiment', async (req: Request, res: Response) => {
    let text = req.body.text
    let r = await TwitterApiService.getSentiment(text)
    res.send({})
})
testRouter.get('/experiment', async (req: Request, res: Response) => {
    let allSymbols = await FMPService.getAllSymbols()
    let exchanges = ["amex", "nyse", "nasdaq", "etf"]
    let goodSymbols:any[] = []
    let types:any = {}
    for (let s of allSymbols){
        if (exchanges.includes(s.exchangeShortName.toLowerCase())){
            if (!types[s.type]){
                types[s.type] = []
            }                
            types[s.type].push(s.symbol)
        }
        goodSymbols.push(s.symbol)
    }
    console.log()
})
testRouter.get('/daily-tweetupdate', async (req: Request, res: Response) => {
    TwitterApiService.getDailyTweetsForAllFollowedAccounts()
})
testRouter.get('/population-progress', async (req: Request, res: Response) => {
    let stocksnaps = StockDao.getStockDaoInstance().snapshotCache
    let popped:string[] = []
    let notPopped:string[] = []
    let poppedButNoData:string[] = []
    let poppedButNoMarketCap:string[] = []  //bonds and funds have no market cap
    for (let snap of Object.values(stocksnaps)) {
        if (snap && (snap as any).get("company")) {
            if ((snap as any).get("company").symbol) {
                if ((snap as any).get("company").mktCap) {
                    popped.push((snap as any).id)
                } else {
                    poppedButNoMarketCap.push((snap as any).id)
                }
            } else {
                poppedButNoData.push((snap as any).id)
            }
        } else {
            notPopped.push((snap as any).id)
        }
    }
    res.send({
        popped: popped,
        notPopped: notPopped
    })
})
testRouter.get('/compare-lists', async (req: Request, res: Response) => {
    let iex = await IexDataService.getIexDataServiceInstance().getAllSymbolsInIEX()
    let fmp = await FMPService.getQuoteForAllSymbols()
    let stocksIexHasThatFMPDoesnt:any[] = []
    for (let i of iex){
        let found = false
        for (let f of fmp){
            if (i == f.symbol) {
                found = true
                break
            }
        }
        if (!found){
            stocksIexHasThatFMPDoesnt.push(i)
        }
    }
    let stocksFMPHasThatIexDoesnt:any[] = []
    for (let f of fmp){
        let found = false
        for (let i of iex){
            if (f.symbol == i) {
                found = true
                break
            }
        }
        if (!found){
            stocksFMPHasThatIexDoesnt.push((f as any).symbol)
        }
    }
    res.send({
        FMPmissing: stocksIexHasThatFMPDoesnt,
        IEXmissing: stocksFMPHasThatIexDoesnt
    })
})
testRouter.get('/removeotc', async (req: Request, res: Response) => {
    let fmp = await FMPService.getQuoteForAllSymbols()
    let symbols = fmp.map(f => f.symbol)
    let companyInfos = await IexDataService.getIexDataServiceInstance().getCompanyForSymbols(symbols)
    let symbolsToDelete:string[] = []
    for (let c of Object.values(companyInfos)){
        let ci = (c as any).company
        let ex = ci.exchange
        if (ex && (ex.toLowerCase().includes("otc") || ex.toLowerCase().includes("cboe"))) {
            symbolsToDelete.push(ci.symbol)
        }
    }
    await StockDao.getStockDaoInstance().deleteEverythingForSymbols(symbolsToDelete)
    res.send()
})
testRouter.get('/compute-top-analysts-scores', async (req: Request, res: Response) => {
    let scores = await TipranksService.computeTopAnalystSymbolScores()
    res.send(scores)
})
testRouter.get('/update-top-analyst-portfolio', async (req: Request, res: Response) => {
    await MarketDataManager.updateTopAnalystPortfolio()
    res.send()
})
testRouter.get('/market-socials', async (req: Request, res: Response) => {
    let trendingSocials = await FMPService.getTrendingBySocialSentiment()
    let socialChangeTwitter = await FMPService.getSocialSentimentChanges("twitter")
    let socialChangeStocktwits = await FMPService.getSocialSentimentChanges("stocktwits")
    MarketDao.getMarketDaoInstance().saveSocialSentimentData({
        trending: trendingSocials,
        twitterChange: socialChangeTwitter, 
        stocktwitsChange: socialChangeStocktwits
    })    
    res.send()
})
export default testRouter
