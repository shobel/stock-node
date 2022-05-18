import Utilities from "../utils/Utilities";
import MarketDao from "../dao/MarketDao";
import StockDao from "../dao/StockDao";
const puppeteer = require('puppeteer');
import * as cron from "cron";

const fetch = require('node-fetch');
const fetchRetry = require('fetch-retry')(fetch);

export default class TipranksService {

    private static url = "https://tipranks.com"
    private static stockDataEndpoint = "https://www.tipranks.com/api/stocks/getData?name=" //all ratings info for a stock
    private static mostRecommendedStocksEndpoint = "https://www.tipranks.com/api/stocks/getMostRecommendedStocks" //self-explanatory
    private static newsSentimentEndpoint = "https://www.tipranks.com/api/stocks/getNewsSentiments/?ticker=" //self-explanatory
    private static getStocksEndpoint = "https://www.tipranks.com/api/screener/GetStocks/" //screener ?
    // private static expertsTop25Endpoint = "https://www.tipranks.com/api/experts/GetTop25Experts?expertType=" //doesn't work anymore, requires cookie
    private static allExpertsPagedEndpoint = "https://www.tipranks.com/api/experts/getExperts?page=" //all experts
    private static expertInfoEndpoint = "https://www.tipranks.com/api/experts/getInfo?name=" //all non-rating for an expert
    private static insiderInfoEndpoint = "https://www.tipranks.com/api/insiders/getInsiderData?name="
    private static insiderTrending = "https://www.tipranks.com/api/insiders/getTrendingStocks?" //new
    private static hedgeFundManagerInfoEndpoint = "https://www.tipranks.com/api/hedgeFunds/getInfo?name="
    private static expertRatingsEndpoint = "https://www.tipranks.com/api/experts/getStocks?name=" //all rating info for an expert
    private static topAnalysts = "/analysts/top"
    private static analysts = "/analysts"
    private static marketDao: MarketDao = MarketDao.getMarketDaoInstance()
    private static stockDao: StockDao = StockDao.getStockDaoInstance()

    // private static cookieGetter = new cron.CronJob('0 0 */12 * * *', TipranksService.getTipranksCookie.bind(TipranksService), null, true, 'America/Los_Angeles', null, true, undefined, undefined)
    private static cookie:string

    //not doing insiders because insiders buy/sell randomly and it only related to the company they work for
    //not doing insitutionals (hedge fund managers) because they buy/sell kind of randomly sometimes and
    //they dont have success rates and returns on individual stocks
    private static expertTypes = ["analyst", "blogger"]

    private static tipranksFetchCounter:number = 0
    private static experts: any = {}
    private static symbolMap: any = {}

    //for individual analyst recommendations
    private static buyHoldSellRatingCodes = {
        1: "buy",
        2: "hold",
        3: "sell"
    }

    private static insiderBuySellCodes = {
        1: "sell",
        2: "buy",
        3: "buy",
        4: "sell"
    }

    private static hedgeFundActionCodes = {
        1: "buy",
        2: "buy",
        3: "sell",
        4: "sell",
        5: "hold"
    }

    //for the overall rating of a stock
    private static stockRatingCodes = {
        1: "strong sell",
        2: "moderate sell",
        3: "hold",
        4: "moderate buy",
        5: "strong buy",
    }

    //ON DEMAND
    //gets all analyst ratings for a stock, not just top ones
    //they took this endpoint down at one point but now have it protected by validating a cookie with a security key in it
    //rbzid and rbzsessionid are the only parts of the cookie that matter currently
    //checking how long they are valid for
    //worked on mar22, will maybe expire on april 05
    public static fetchTipranksApiDataForStock(symbol: string) {
        return fetch(`${TipranksService.stockDataEndpoint}${symbol}`, {
            method: 'GET',
            headers: {
                'Cookie': 'rbzsessionid=a451be1be5e7119b69322572a9178edc; rbzid=8WIkuRpeT6qVihUF4tXG7d1dbVSsRVKayWl2mzULxPvglnbZ9kUilFPD1NR/1zw/k8p0Vf5geBTtIpmRj04Vd8laVVhrqrBRgngNvLqeBLCDOJwzNBLVNXjsoq1AL1E+312E/MgWhRsofO+WRLPT1YYsRYH7qL7Rp8Ha0uoeT0NSeDKknmfmLhUgC5b//7wXRgVEGE4/S7xlQgf+Q6RC7SmJDPH6WtPTemn+xGpTi6bb/g+nTVofoDTmwmpnDN3MFaZmFqaTieg9osE4wLB1W5TqpE5qJuOSXnOvMxMMx8I=',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36',
            }
        }).then((res: { json: () => any; }) => {
            return res.json()
        })
        .catch(err => {
            return null
        })
        .then((data: any) => {
            let tipranksStockData: any = { symbol: symbol }
            if (data) {
                tipranksStockData.recommendations = TipranksService.getLatestConsensus(data)
                tipranksStockData.experts = TipranksService.getExperts(data)
                tipranksStockData.ptConsensus = TipranksService.getPriceTargetConsensus(data)
                if (data.hasOwnProperty("tipranksStockScore") && data["tipranksStockScore"]) {
                    tipranksStockData.tipranksStockScore = data["tipranksStockScore"].score //1-10, 1 is bad 10 is good
                }
                tipranksStockData.priceTargetsOverTime = TipranksService.getPriceTargetsOverTime(data, "consensusOverTime")
                tipranksStockData.bestPriceTargetsOverTime = TipranksService.getPriceTargetsOverTime(data, "bestConsensusOverTime")
                tipranksStockData.bloggerSentiment = data["bloggerSentiment"].avg
                if (data.hasOwnProperty("insiderslast3MonthsSum") && data["insiderslast3MonthsSum"]) {
                    tipranksStockData.insiderNet = data["insiderslast3MonthsSum"] //past 3 months
                }
                if (data.hasOwnProperty("insidrConfidenceSignal") && data["insidrConfidenceSignal"]) {
                    tipranksStockData.insiderConfidenceSignal = data["insidrConfidenceSignal"].stockScore
                    tipranksStockData.sectorConfidenceSignal = data["insidrConfidenceSignal"].sectorScore
                }
                if (data.hasOwnProperty("momentum") && data["momentum"]) {
                    tipranksStockData.momentum = data["momentum"].momentum //percent increase in popularity in decimal form
                }
            }
            return tipranksStockData
        }).catch(err => {
            return null
        })
    }

    //SCHEDULED DAILY
    //TODO: we only have to fetch all the ~300 pages of analysts once in a while (like once every few months or longer)
    //because the top analysts are not going to change that much if ever
    //once we have those (saved in tipranksAnalysts) we can focus our requests on just the analysts details
    //currently fetching top 200, doing 20 a day to be fully updated in 10 days
    public static async fetchTopAnalysts() {
        let allExperts: any = {}
        let topExperts: any = []

        let marketDao:MarketDao = MarketDao.getMarketDaoInstance()
        let lastUpdatedTipranksAnalysts = parseInt(await marketDao.getLastUpdatedTipranksAnalysts())
        let analystNames = await marketDao.getTipranksTopAnalystsNames() //alphabetical order
        //fetches new analysts ranks every 3 months
        if (!lastUpdatedTipranksAnalysts || Date.now() - lastUpdatedTipranksAnalysts > (Utilities.oneMonthMs*3) || !analystNames || !analystNames.length) {
            let continueIterating:boolean = true
            let currentPage:number = 1
            while (continueIterating) {
                console.log(`fetching tipranks experts page ${currentPage}`)
                await fetch(`${TipranksService.allExpertsPagedEndpoint}${currentPage}`)
                    .then((res: { json: () => any; }) => res.json())
                    .then(async (data: any) => {
                        if (!data || !data["Experts"] || !data["Experts"].length) {
                            continueIterating = false
                        } else {
                            for (let expert of data["Experts"]) {
                                allExperts[expert.Name] = expert
                                if (expert.Rank && expert.Rank <= 200) {
                                    topExperts.push(expert.Name)
                                }
                            }
                        }
                        currentPage += 1
                    })
            }
            await marketDao.setLastUpdatedTipranksAnalysts(Date.now())
            await TipranksService.marketDao.saveTipranksAnalystsDocuments(topExperts.map(e => {
                return { "name": e }
            }))
            topExperts = await marketDao.getTipranksTopAnalystsNames()
        } else {
            topExperts = await marketDao.getTipranksTopAnalystsNames()
        }
        if (!topExperts || !topExperts.length) {
            return
        }

        let startIndex = this.tipranksFetchCounter
        if (startIndex >= (topExperts.length - 1)) {
            startIndex = 0
        }
        let endIndex = startIndex + 20
        this.tipranksFetchCounter = startIndex + 21
        let isEnd:boolean = false
        if (endIndex >= (topExperts.length - 1)) {
            endIndex = (topExperts.length - 1)
            isEnd = true
        }

        for (let i = startIndex; i < endIndex; i++) {
            if (topExperts.length <= i) {
                break
            } 
            let e = topExperts[i]
            let expert: any = {}

            let urlName = e.split(' ').join('-').toLowerCase()
            await fetch(`${TipranksService.expertInfoEndpoint}${urlName}`)
                .then((res: { json: () => any; }) => res.json())
                .then(async (info: any) => {
                    console.log(`${info.name} info`)

                    expert.name = info.name
                    expert.firm = info.firm
                    expert.rank = info.globalRank
                    expert.typeRank = info.rank

                    expert.type = info.expertTypeId == 1 ? "analyst" : "blogger"
                    expert.avgReturn = info.profit
                    expert.sector = info.sector
                    expert.numRatings = info.numOfAllRcmnds
                    expert.successRate = info.numOfGoodRcmnds / expert.numRatings
                })

            await fetch(`${TipranksService.expertRatingsEndpoint}${urlName}`)
                .then((res: { json: () => any; }) => res.json())
                .then(async (ratings: any) => {
                    console.log(`${expert.name} ratings`)
                    expert.ratings = []
                    for (let r of ratings) {
                        let daysBetween = Utilities.countDaysBetweenDates(Date.now(), (new Date(r.latestRating.ratingDate)).getTime())
                        if (daysBetween < 90) {
                            let rating: any = {}
                            rating.symbol = r.ticker
                            rating.companyName = r.name
                            rating.numRatings = r.totalRatingsCount
                            rating.successRate = r.goodRatingsCount / r.totalRatingsCount
                            rating.averageReturn = r.averageReturn
                            rating.priceTarget = r.priceTarget
                            rating.date = new Date(r.latestRating.ratingDate).toLocaleDateString()
                            rating.timestamp = new Date(r.latestRating.ratingDate).getTime()
                            rating.position = r.latestRating.rating
                            if (!r.ticker.includes("~") && !r.ticker.includes(":") && r.totalRatingsCount > 0) {
                                expert.ratings.push(rating)

                                let expertCopy = TipranksService.copyExpertWithSingleStockRating(expert, rating)
                                if (!TipranksService.symbolMap.hasOwnProperty(rating.symbol)) {
                                    TipranksService.symbolMap[rating.symbol] = {}
                                    TipranksService.symbolMap[rating.symbol].experts = []
                                    TipranksService.symbolMap[rating.symbol].symbol = rating.symbol
                                }
                                TipranksService.symbolMap[rating.symbol].experts.push(expertCopy)
                            }
                        }
                    }
                })
            TipranksService.experts[expert.name] = expert
        }
        
        if (isEnd){
            let symbolArray = Object.values(TipranksService.symbolMap)
            let symbolKeys = Object.keys(TipranksService.symbolMap)
            for (let symbolObj of symbolArray){
                let s:any = symbolObj
    
                let analystsRanks:number[] = []
                let analystsReturns:number[] = []
                let analystSuccessRates:number[] = []
                let analystsReturnsThisStock:number[] = []
                let analystsSuccessRatesThisStock:number[] = []
                let priceTargets:number[] = []
                let numAnalysts = 0
                let numRatings = 0
                let companyName = ""
                for (let expert of s.experts){
                    companyName = expert.stockRating.companyName
                    numAnalysts += 1
                    numRatings += expert.stockRating.numRatings
                    analystsRanks.push(expert.rank)
                    analystsReturns.push(expert.avgReturn)
                    analystSuccessRates.push(expert.successRate)
                    analystsReturnsThisStock.push(expert.stockRating.averageReturn)
                    analystsSuccessRatesThisStock.push(expert.stockRating.successRate)
                    if (expert.stockRating.priceTarget) {
                        priceTargets.push(expert.stockRating.priceTarget)
                    }
                }
                s.avgAnalystRank = Utilities.calculateAverageOfArray(analystsRanks)
                s.avgAnalystReturn = Utilities.calculateAverageOfArray(analystsReturns)
                s.avgAnalystSuccessRate = Utilities.calculateAverageOfArray(analystSuccessRates)
                s.avgAnalystReturnThisStock = Utilities.calculateAverageOfArray(analystsReturnsThisStock)
                s.avgAnalystSuccessRateThisStock = Utilities.calculateAverageOfArray(analystsSuccessRatesThisStock)
                s.avgPriceTarget = Utilities.calculateAverageOfArray(priceTargets)
                s.upsidePercent = null //computed clientside
                s.companyName = companyName
                s.highPriceTarget = priceTargets.length ? Math.max(...priceTargets) : null
                s.lowPriceTarget = priceTargets.length ? Math.min(...priceTargets) : null
                s.numAnalysts = numAnalysts
                s.numRatings = numRatings
            }
            await TipranksService.marketDao.deleteTipranksTopAnalystCollection()
            await TipranksService.marketDao.deleteTipranksTopSymbolsCollection()
            await TipranksService.marketDao.saveTipranksAnalystsDocuments(Object.values(TipranksService.experts))
            await TipranksService.marketDao.saveTipranksSymbolsDocuments(Object.values(TipranksService.symbolMap))

            TipranksService.experts = {}
            TipranksService.symbolMap = {}
        }
    }
    
    public static getNewsSentiment(symbol:string){
        return fetch(`${TipranksService.newsSentimentEndpoint}${symbol}`, {
            method: 'GET',
            headers: {
                'Cookie': 'rbzsessionid=a451be1be5e7119b69322572a9178edc; rbzid=8WIkuRpeT6qVihUF4tXG7d1dbVSsRVKayWl2mzULxPvglnbZ9kUilFPD1NR/1zw/k8p0Vf5geBTtIpmRj04Vd8laVVhrqrBRgngNvLqeBLCDOJwzNBLVNXjsoq1AL1E+312E/MgWhRsofO+WRLPT1YYsRYH7qL7Rp8Ha0uoeT0NSeDKknmfmLhUgC5b//7wXRgVEGE4/S7xlQgf+Q6RC7SmJDPH6WtPTemn+xGpTi6bb/g+nTVofoDTmwmpnDN3MFaZmFqaTieg9osE4wLB1W5TqpE5qJuOSXnOvMxMMx8I=',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36',
            }
        })
        .then((res: { json: () => any; }) => res.json())
        .catch(err => null)
        .then(async (newsSentiment: any) => {
            let returnObj:any = {
                buzz: newsSentiment?.buzz?.buzz,
                bullishSentiment: newsSentiment?.sentiment?.bullishPercent,
                sectorAverageBullishSentiment: newsSentiment?.sectorAverageBullishSentiment,
                score: newsSentiment.score, //buzz + bullish sentiment
                sectorAverageScore: newsSentiment.sectorAverageNewsScore,
                creationDate: newsSentiment.creationDate
            }
            return returnObj
        }).catch(err => null)
    }

    private static getLatestConsensus(data: any) {
        if (data && data.hasOwnProperty("consensuses") && data["consensuses"] && data["consensuses"].length) {
            let mostRecentConsensus = data["consensuses"][0]
            let tipranksConsensus = {
                rating: TipranksService.stockRatingCodes[mostRecentConsensus.rating],
                buy: mostRecentConsensus.nB,
                hold: mostRecentConsensus.nH,
                sell: mostRecentConsensus.nS,
                date: mostRecentConsensus.d,
            }
            return tipranksConsensus
        }
        return null
    }

    private static getExperts(data: any) {
        let returnExperts: any[] = []
        if (data && data.hasOwnProperty("experts") && data["experts"] && data["experts"].length) {
            let experts = data["experts"]
            for (var e of experts) {
                let expert:any = {
                    name: e.name,
                    firm: e.firm,
                    type: e.expertType,
                    rank: null,
                    typeRank:null,
                    numRatings: null,
                    avgReturn: null,
                    successRate: null,
                    stars: null,
                    stockRating: {
                        symbol: e.ticker,
                        companyName: e.companyName,
                        successRate: e.stockSuccessRate,
                        averageReturn: e.stockAverageReturn,
                        numRatings: e.stockTotalRecommendations,
                        position: null,
                        date: null,
                        priceTarget: null,
                    }
                }
                if (e.hasOwnProperty("ratings") && e["ratings"] && e["ratings"].length) {
                    expert.stockRating.position = TipranksService.buyHoldSellRatingCodes[e["ratings"][0].ratingId]
                    expert.stockRating.date = new Date(e["ratings"][0].date).toLocaleDateString()
                    expert.stockRating.timestamp = new Date(e["ratings"][0].date).getTime()
                    if (e["ratings"][0].priceTarget && e["ratings"][0].priceTarget != "null") {
                        expert.stockRating.priceTarget = e["ratings"][0].priceTarget
                    }
                }
                if (e.hasOwnProperty("rankings") && e["rankings"] && e["rankings"].length) {
                    expert.rank = e["rankings"][0].gRank
                    expert.typeRank = e["rankings"][0].lRank
                    expert.successRate = e["rankings"][0].gRecs / e["rankings"][0].tRecs
                    expert.numRatings = e["rankings"][0].tRecs
                    expert.avgReturn = e["rankings"][0].avgReturn
                    expert.stars = e["rankings"][0].stars
                }
                returnExperts.push(expert)
            }
        }
        return returnExperts
    }

    private static getPriceTargetConsensus(data: any) {
        if (data && data.hasOwnProperty("ptConsensus") && data["ptConsensus"] && data["ptConsensus"].length) {
            let ptConsensus = data["ptConsensus"]
            for (var p of ptConsensus) {
                if (p.period == 0) {
                    return {
                        priceTarget: p.priceTarget,
                        high: p.high,
                        low: p.low
                    }
                }
            }
        }
        return null
    }

    private static getPriceTargetsOverTime(data: any, consensusField: string) {
        let returnTimeSeries: any[] = []
        if (data && data.hasOwnProperty(consensusField) && data[consensusField] && data[consensusField].length) {
            let timeSeries = data[consensusField]
            for (let t of timeSeries) {
                if (t.hasOwnProperty("priceTarget") && t["priceTarget"] != null) {
                    let item = {
                        priceTarget: t.priceTarget,
                        date: new Date(t.date).toLocaleDateString(),
                        timestamp: new Date(t.date).getTime()
                    }
                    returnTimeSeries.push(item)
                }
            }
        }
        return returnTimeSeries
    }

    private static copyExpertWithSingleStockRating(expert:any, rating){
        let expertCopy = {
            type: expert.type,
            avgReturn: expert.avgReturn,
            name: expert.name,
            firm: expert.firm,
            sector: expert.sector,
            typeRank: expert.typeRank,
            rank: expert.rank,
            numRatings: expert.numRatings,
            successRate: expert.successRate,
            stockRating: rating
        }
        return expertCopy
    }

    //scraper
    public static async getTipranksCookie(){
        // const browser = await puppeteer.launch({headless: true})
        // const url = `https://www.tipranks.com`
        // const page = await browser.newPage()

        // await page.setExtraHTTPHeaders({
        //     'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36',
        //     'upgrade-insecure-requests': '1',
        //     'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        //     'accept-encoding': 'gzip, deflate, br',
        //     'accept-language': 'en-US,en;q=0.9',
        //     'cache-control': 'max-age=0',
        //     'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="98", "Google Chrome";v="98"',
        //     'sec-ch-ua-mobile': '?0',
        //     'sec-ch-ua-platform': '"macOS"',
        //     'sec-fetch-dest': 'document',
        //     'sec-fetch-mode': 'navigate',
        //     'sec-fetch-site': 'same-origin',
        //     'sec-fetch-user': '?1',
        //     ':authority': 'www.tipranks.com',
        //     ':method': 'GET',
        //     ':path': '/',
        //     ':scheme': 'https'
        // })

        // await page.setUserAgent("")
        // let go = await page.goto(url, { waitUntil: 'networkidle2' });
        // console.log(go.request().headers())
        // //const client = await page.target().createCDPSession();
        // //const cookies = (await client.send('Network.getAllCookies')).cookies;
        // const cookies = await page._client.send('Network.getAllCookies');
        // //let cookies = await page.cookies()
        // TipranksService.cookie = ""
        // for (let cookie of cookies){
        //     TipranksService.cookie += ` ${cookie.name}=${cookie.value};` 
        // }
        // browser.close()

    }
}