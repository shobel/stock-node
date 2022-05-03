import { Request, Response, Router } from 'express';
import StockDataManager from '../managers/StockDataManager';
import ChartService from '../services/ChartService';
import StockMarketUtility from '../utils/StockMarketUtility';
import { memoryUsage } from 'process';

// Init shared
const stockRouter = Router();
const chartService = ChartService.getChartServiceInstance()

stockRouter.use((req, res, next) => {
    console.log(memoryUsage());
    next()
})

/* Returns map of quotes. Keys are symbols and values are quote objects */
// TODO: when a client requests quotes, and the market is in premarket or aftermarket, 
//      we can call IEX quote endpoint for the extended quotes. It costs 1 point per quote.
//      if we have a few hundred symbols to get, and we cache the quotes for like 10 min,
//      we should only be using like (4hours * 6requests/hour * 300 symbols) = 7200 points per day 
// tested
stockRouter.get('/quotes', async (req: Request, res: Response) => {
    const symbols: string = req.query.symbols as string
    if (symbols && symbols.length) {
        const symbolsArray = symbols.split(',')
        console.log(`received request for ${symbolsArray.length} quotes`)
        let latestQuotes = await StockDataManager.getLatestQuotesForSymbols(symbolsArray, false)
        res.send(latestQuotes)
    } else {
        res.send(null)
    }
})

stockRouter.get('/quotes-and-simplified-charts', async (req: Request, res: Response) => {
    const symbols: string = req.query.symbols as string
    if (symbols && symbols.length) {
        const symbolsArray = symbols.split(',')
        let latestQuotes = await StockDataManager.getLatestQuotesForSymbols(symbolsArray, true)
        res.send(latestQuotes)
    } else {
        res.send(null)
    }
})

stockRouter.get('/allfree/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    StockDataManager.getAllFreeDataForSymbol(symbol).then(combinedData => {
        res.send(combinedData)
    }).catch()
})
stockRouter.get('/statsPeersInsidersAndCompany/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    StockDataManager.statsPeersInsidersAndCompany(symbol).then(combinedData => {
        res.send(combinedData)
    }).catch()
})
stockRouter.get('/newsAndSocial/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    StockDataManager.newsAndSocial(symbol).then(combinedData => {
        res.send(combinedData)
    }).catch()
})
stockRouter.get('/financials/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    StockDataManager.financials(symbol).then(combinedData => {
        res.send(combinedData)
    }).catch()
})
stockRouter.get('/analysts/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    StockDataManager.analysts(symbol).then(combinedData => {
        res.send(combinedData)
    }).catch()
})
/* company logo peers - not called currently*/
// tested
stockRouter.get('/company-logo-peers/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    StockDataManager.getCompanyFieldForSymbol(symbol).then(data => {
        res.send(data)
    }).catch()
})

/* basic company info for all stocks, used to search through entire database */
// tested
stockRouter.get('/companies', async (req: Request, res: Response) => {
    StockDataManager.getCompanyInfoForAllSymbols().then(data => {
        res.send(data)
    }).catch()
})

/* gets fresh news from IEX if needed, and then returns 20 of the most recent news items */
// tested
stockRouter.get('/news/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    StockDataManager.getNewsForSymbol(symbol).then(data => {
        res.send(data)
    }).catch()
})

/* gets fresh advanced stats from IEX if needed, and then returns most recent stats */
// tested
stockRouter.get('/advanced/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    StockDataManager.getAdvancedStatsForSymbol(symbol).then(data => {
        res.send(data)
    }).catch()
})

/* gets fresh price target from IEX if needed, and then returns most recent price target */
// tested
stockRouter.get('/price-target/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    StockDataManager.getPriceTargetForSymbol(symbol).then(data => {
        res.send(data)
    }).catch()
})

/* gets fresh recommendations from IEX if needed, and then returns most recent recommendations */
// tested
stockRouter.get('/recommendations/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    StockDataManager.getRecommendationsForSymbol(symbol).then(data => {
        res.send(data)
    }).catch()
})

//chart
stockRouter.get('/charts/quote-and-intraday/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    chartService.getIntradayChartForSymbol(symbol).then(async intradayChart => {
        const symbols = new Array(symbol)
        let quotes = await StockDataManager.getLatestQuotesForSymbols(symbols, false)
        const quote = quotes[symbols[0].toUpperCase()]
        res.send({
            quote: quote,
            intradayChart: intradayChart,
            isUSMarketOpen: StockMarketUtility.getStockMarketUtility().isMarketOpen
        })
    }).catch()
})
stockRouter.get('/charts/intraday/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    const clientMinutes:number = parseInt(req.query.minutes as string)
    chartService.getIntradayChartForSymbol(symbol).then(result => res.send(result)).catch()
})
stockRouter.get('/charts/daily/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    chartService.getDailyChartForSymbol(symbol).then((data: any) => {
        res.send(data)
    }).catch()
})

/* Get latest earnings data for a stock */
// tested
stockRouter.get('/earnings/:symbol/:limit', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    const limit:any = req.params.limit
    StockDataManager.getEarningsForSymbol(symbol, limit).then(result => {
        res.send(result)
    }).catch()
})


/**** ARRAY TYPE ENDPOINTS BELOW *****/

/* returns array of insider transaction summaries */
//tested
stockRouter.get('/insiders/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    StockDataManager.getInsidersForSymbol(symbol).then(data => {
        res.send(data)
    }).catch()
})

export default stockRouter;
