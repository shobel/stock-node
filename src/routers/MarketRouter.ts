import { Request, Response, Router } from 'express';
import MarketDataManager from '../managers/MarketDataManager';
import MarketDao from '../dao/MarketDao';
import FidelityService from '../services/FidelityService';
import ScheduledUpdateService from '../services/ScheduledUpdateService';

const marketRouter = Router();
const marketDao = MarketDao.getMarketDaoInstance()

async function doInit(){
    const anyWeeklyData = await marketDao.isAnyEconomicData(marketDao.economicDataCollectionWeekly)
    let updated = ""
    if (!anyWeeklyData) {
        await MarketDataManager.initWeeklyEconomicData()
        updated += "weekly "
    }
    const anyMonthlylyData = await marketDao.isAnyEconomicData(marketDao.economicDataCollectionMonthly)
    if (!anyMonthlylyData) {
        await MarketDataManager.initMonthlyEconomicData()
        updated += "monthly "
    }
    const anyQuarterlyData = await marketDao.isAnyEconomicData(marketDao.economicDataCollectionQuarterly)
    if (!anyQuarterlyData) {
        await MarketDataManager.initQuarterlyEconomicData()
        updated += "quarterly"
    }
    return updated
}
doInit().then(updated => {
    if (updated != ""){
        console.log(`${updated} market data init done`)
    } 
}).catch(() => console.log("market data init error"))

// ALL ROUTES TESTED

/* get sector performances */
// tested
marketRouter.get('/sector-performances', async (req: Request, res: Response) => {
    MarketDataManager.getSectorPerformances().then(performances => {
        res.send(performances)
    }).catch()
})

/* economic data */
// tested
marketRouter.get('/economic', async (req: Request, res: Response) => {
    MarketDataManager.getLatestEconomicData().then(data => {
        res.send(data)
    }).catch()
})

/* top 10: gainers losers and mostactive */
// tested
marketRouter.get('/top10', async (req: Request, res: Response) => {
    MarketDataManager.getAllTop10().then(data => {
        res.send(data)
    }).catch()
})
marketRouter.get('/socials', async (req: Request, res: Response) => {
    MarketDataManager.getAllMarketSocialSentiments().then(data => {
        res.send(data)
    }).catch()
})

/* returns array of stocktwits trending symbols */
// tested
marketRouter.get('/stocktwits-trending-symbols/:symbolsOnly', async (req: Request, res: Response) => {
    const symbolsOnly = req.params.symbolsOnly === "true" ? true : false
    MarketDataManager.getStocktwitsTrending(symbolsOnly).then(data => {
        res.send(data)
    }).catch()
})

/* returns array of news objects */
// tested
marketRouter.get('/news', async (req: Request, res: Response) => {
    let marketNews = ScheduledUpdateService.marketNews
    res.send(marketNews)
})

//tested
marketRouter.get('/tipranks/top-analysts', async (req: Request, res: Response) => {
    MarketDataManager.getTipranksTopAnalysts().then(data => {
        res.send(data)
    }).catch()
})

marketRouter.get('/tipranks/analysts', async (req: Request, res: Response) => {
    MarketDataManager.getTipranksTopAnalysts().then(data => {
        res.send(data)
    }).catch()
})

marketRouter.get('/fidelity/scores', async (req: Request, res:Response) => {
    FidelityService.getFidelityAnalystData().then(data => {
        res.send(data)
    })
})

marketRouter.get('/market-economy', async (req: Request, res: Response) => {
    MarketDataManager.getMarketAndEconomyData().then(data => {
        res.send(data)
    }).catch()
})

export default marketRouter;
