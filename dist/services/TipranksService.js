"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Utilities_1 = require("../utils/Utilities");
const MarketDao_1 = require("../dao/MarketDao");
const StockDao_1 = require("../dao/StockDao");
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fetchRetry = require('fetch-retry')(fetch);
class TipranksService {
    //ON DEMAND
    //gets all analyst ratings for a stock, not just top ones
    //they took this endpoint down at one point but now have it protected by validating a cookie with a security key in it
    //rbzid and rbzsessionid are the only parts of the cookie that matter currently
    //checking how long they are valid for
    //worked on mar22, will maybe expire on april 05
    static fetchTipranksApiDataForStock(symbol) {
        return fetch(`${TipranksService.stockDataEndpoint}${symbol}`, {
            method: 'GET',
            headers: {
                'Cookie': 'rbzsessionid=a451be1be5e7119b69322572a9178edc; rbzid=8WIkuRpeT6qVihUF4tXG7d1dbVSsRVKayWl2mzULxPvglnbZ9kUilFPD1NR/1zw/k8p0Vf5geBTtIpmRj04Vd8laVVhrqrBRgngNvLqeBLCDOJwzNBLVNXjsoq1AL1E+312E/MgWhRsofO+WRLPT1YYsRYH7qL7Rp8Ha0uoeT0NSeDKknmfmLhUgC5b//7wXRgVEGE4/S7xlQgf+Q6RC7SmJDPH6WtPTemn+xGpTi6bb/g+nTVofoDTmwmpnDN3MFaZmFqaTieg9osE4wLB1W5TqpE5qJuOSXnOvMxMMx8I=',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36',
            }
        }).then((res) => {
            return res.json();
        })
            .catch(err => {
            return null;
        })
            .then((data) => {
            let tipranksStockData = { symbol: symbol };
            if (data) {
                tipranksStockData.recommendations = TipranksService.getLatestConsensus(data);
                tipranksStockData.experts = TipranksService.getExperts(data);
                tipranksStockData.ptConsensus = TipranksService.getPriceTargetConsensus(data);
                if (data.hasOwnProperty("tipranksStockScore") && data["tipranksStockScore"]) {
                    tipranksStockData.tipranksStockScore = data["tipranksStockScore"].score; //1-10, 1 is bad 10 is good
                }
                tipranksStockData.priceTargetsOverTime = TipranksService.getPriceTargetsOverTime(data, "consensusOverTime");
                tipranksStockData.bestPriceTargetsOverTime = TipranksService.getPriceTargetsOverTime(data, "bestConsensusOverTime");
                tipranksStockData.bloggerSentiment = data["bloggerSentiment"].avg;
                if (data.hasOwnProperty("insiderslast3MonthsSum") && data["insiderslast3MonthsSum"]) {
                    tipranksStockData.insiderNet = data["insiderslast3MonthsSum"]; //past 3 months
                }
                if (data.hasOwnProperty("insidrConfidenceSignal") && data["insidrConfidenceSignal"]) {
                    tipranksStockData.insiderConfidenceSignal = data["insidrConfidenceSignal"].stockScore;
                    tipranksStockData.sectorConfidenceSignal = data["insidrConfidenceSignal"].sectorScore;
                }
                if (data.hasOwnProperty("momentum") && data["momentum"]) {
                    tipranksStockData.momentum = data["momentum"].momentum; //percent increase in popularity in decimal form
                }
            }
            return tipranksStockData;
        }).catch(err => {
            return null;
        });
    }
    //SCHEDULED DAILY
    //TODO: we only have to fetch all the ~300 pages of analysts once in a while (like once every few months or longer)
    //because the top analysts are not going to change that much if ever
    //once we have those (saved in tipranksAnalysts) we can focus our requests on just the analysts details
    //currently fetching top 200, doing 20 a day to be fully updated in 10 days
    static async fetchTopAnalysts() {
        let allExperts = {};
        let topExperts = [];
        let marketDao = MarketDao_1.default.getMarketDaoInstance();
        let lastUpdatedTipranksAnalysts = parseInt(await marketDao.getLastUpdatedTipranksAnalysts());
        let analystNames = await marketDao.getTipranksTopAnalystsNames(); //alphabetical order
        //fetches new analysts ranks every 3 months
        if (!lastUpdatedTipranksAnalysts || Date.now() - lastUpdatedTipranksAnalysts > (Utilities_1.default.oneMonthMs * 3) || !analystNames || !analystNames.length) {
            let continueIterating = true;
            let currentPage = 1;
            while (continueIterating) {
                console.log(`fetching tipranks experts page ${currentPage}`);
                await fetch(`${TipranksService.allExpertsPagedEndpoint}${currentPage}`)
                    .then((res) => res.json())
                    .then(async (data) => {
                    if (!data || !data["Experts"] || !data["Experts"].length) {
                        continueIterating = false;
                    }
                    else {
                        for (let expert of data["Experts"]) {
                            allExperts[expert.Name] = expert;
                            if (expert.Rank && expert.Rank <= 200) {
                                topExperts.push(expert.Name);
                            }
                        }
                    }
                    currentPage += 1;
                });
            }
            await marketDao.setLastUpdatedTipranksAnalysts(Date.now());
            await TipranksService.marketDao.saveTipranksAnalystsDocuments(topExperts.map(e => {
                return { "name": e };
            }));
            topExperts = await marketDao.getTipranksTopAnalystsNames();
        }
        else {
            topExperts = await marketDao.getTipranksTopAnalystsNames();
        }
        if (!topExperts || !topExperts.length) {
            return;
        }
        let startIndex = this.tipranksFetchCounter;
        if (startIndex >= (topExperts.length - 1)) {
            startIndex = 0;
        }
        let endIndex = startIndex + 20;
        this.tipranksFetchCounter = startIndex + 21;
        let isEnd = false;
        if (endIndex >= (topExperts.length - 1)) {
            endIndex = (topExperts.length - 1);
            isEnd = true;
        }
        for (let i = startIndex; i < endIndex; i++) {
            if (topExperts.length <= i) {
                break;
            }
            let e = topExperts[i];
            let expert = {};
            let urlName = e.split(' ').join('-').toLowerCase();
            await fetch(`${TipranksService.expertInfoEndpoint}${urlName}`)
                .then((res) => res.json())
                .then(async (info) => {
                console.log(`${info.name} info`);
                expert.name = info.name;
                expert.firm = info.firm;
                expert.rank = info.globalRank;
                expert.typeRank = info.rank;
                expert.type = info.expertTypeId == 1 ? "analyst" : "blogger";
                expert.avgReturn = info.profit;
                expert.sector = info.sector;
                expert.numRatings = info.numOfAllRcmnds;
                expert.successRate = info.numOfGoodRcmnds / expert.numRatings;
            });
            await fetch(`${TipranksService.expertRatingsEndpoint}${urlName}`)
                .then((res) => res.json())
                .then(async (ratings) => {
                console.log(`${expert.name} ratings`);
                expert.ratings = [];
                for (let r of ratings) {
                    let daysBetween = Utilities_1.default.countDaysBetweenDates(Date.now(), (new Date(r.latestRating.ratingDate)).getTime());
                    if (daysBetween < 90) {
                        let rating = {};
                        rating.symbol = r.ticker;
                        rating.companyName = r.name;
                        rating.numRatings = r.totalRatingsCount;
                        rating.successRate = r.goodRatingsCount / r.totalRatingsCount;
                        rating.averageReturn = r.averageReturn;
                        rating.priceTarget = r.priceTarget;
                        rating.date = new Date(r.latestRating.ratingDate).toLocaleDateString();
                        rating.timestamp = new Date(r.latestRating.ratingDate).getTime();
                        rating.position = r.latestRating.rating;
                        if (!r.ticker.includes("~") && !r.ticker.includes(":") && r.totalRatingsCount > 0) {
                            expert.ratings.push(rating);
                            let expertCopy = TipranksService.copyExpertWithSingleStockRating(expert, rating);
                            if (!TipranksService.symbolMap.hasOwnProperty(rating.symbol)) {
                                TipranksService.symbolMap[rating.symbol] = {};
                                TipranksService.symbolMap[rating.symbol].experts = [];
                                TipranksService.symbolMap[rating.symbol].symbol = rating.symbol;
                            }
                            TipranksService.symbolMap[rating.symbol].experts.push(expertCopy);
                        }
                    }
                }
            });
            TipranksService.experts[expert.name] = expert;
        }
        if (isEnd) {
            let symbolArray = Object.values(TipranksService.symbolMap);
            let symbolKeys = Object.keys(TipranksService.symbolMap);
            for (let symbolObj of symbolArray) {
                let s = symbolObj;
                let analystsRanks = [];
                let analystsReturns = [];
                let analystSuccessRates = [];
                let analystsReturnsThisStock = [];
                let analystsSuccessRatesThisStock = [];
                let priceTargets = [];
                let numAnalysts = 0;
                let numRatings = 0;
                let companyName = "";
                for (let expert of s.experts) {
                    companyName = expert.stockRating.companyName;
                    numAnalysts += 1;
                    numRatings += expert.stockRating.numRatings;
                    analystsRanks.push(expert.rank);
                    analystsReturns.push(expert.avgReturn);
                    analystSuccessRates.push(expert.successRate);
                    analystsReturnsThisStock.push(expert.stockRating.averageReturn);
                    analystsSuccessRatesThisStock.push(expert.stockRating.successRate);
                    if (expert.stockRating.priceTarget) {
                        priceTargets.push(expert.stockRating.priceTarget);
                    }
                }
                s.avgAnalystRank = Utilities_1.default.calculateAverageOfArray(analystsRanks);
                s.avgAnalystReturn = Utilities_1.default.calculateAverageOfArray(analystsReturns);
                s.avgAnalystSuccessRate = Utilities_1.default.calculateAverageOfArray(analystSuccessRates);
                s.avgAnalystReturnThisStock = Utilities_1.default.calculateAverageOfArray(analystsReturnsThisStock);
                s.avgAnalystSuccessRateThisStock = Utilities_1.default.calculateAverageOfArray(analystsSuccessRatesThisStock);
                s.avgPriceTarget = Utilities_1.default.calculateAverageOfArray(priceTargets);
                s.upsidePercent = null; //computed clientside
                s.companyName = companyName;
                s.highPriceTarget = priceTargets.length ? Math.max(...priceTargets) : null;
                s.lowPriceTarget = priceTargets.length ? Math.min(...priceTargets) : null;
                s.numAnalysts = numAnalysts;
                s.numRatings = numRatings;
            }
            await TipranksService.marketDao.deleteTipranksTopAnalystCollection();
            await TipranksService.marketDao.deleteTipranksTopSymbolsCollection();
            await TipranksService.marketDao.saveTipranksAnalystsDocuments(Object.values(TipranksService.experts));
            await TipranksService.marketDao.saveTipranksSymbolsDocuments(Object.values(TipranksService.symbolMap));
            TipranksService.experts = {};
            TipranksService.symbolMap = {};
        }
    }
    static getNewsSentiment(symbol) {
        return fetch(`${TipranksService.newsSentimentEndpoint}${symbol}`, {
            method: 'GET',
            headers: {
                'Cookie': 'rbzsessionid=a451be1be5e7119b69322572a9178edc; rbzid=8WIkuRpeT6qVihUF4tXG7d1dbVSsRVKayWl2mzULxPvglnbZ9kUilFPD1NR/1zw/k8p0Vf5geBTtIpmRj04Vd8laVVhrqrBRgngNvLqeBLCDOJwzNBLVNXjsoq1AL1E+312E/MgWhRsofO+WRLPT1YYsRYH7qL7Rp8Ha0uoeT0NSeDKknmfmLhUgC5b//7wXRgVEGE4/S7xlQgf+Q6RC7SmJDPH6WtPTemn+xGpTi6bb/g+nTVofoDTmwmpnDN3MFaZmFqaTieg9osE4wLB1W5TqpE5qJuOSXnOvMxMMx8I=',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36',
            }
        })
            .then((res) => res.json())
            .catch(err => null)
            .then(async (newsSentiment) => {
            var _a, _b;
            let returnObj = {
                buzz: (_a = newsSentiment === null || newsSentiment === void 0 ? void 0 : newsSentiment.buzz) === null || _a === void 0 ? void 0 : _a.buzz,
                bullishSentiment: (_b = newsSentiment === null || newsSentiment === void 0 ? void 0 : newsSentiment.sentiment) === null || _b === void 0 ? void 0 : _b.bullishPercent,
                sectorAverageBullishSentiment: newsSentiment === null || newsSentiment === void 0 ? void 0 : newsSentiment.sectorAverageBullishSentiment,
                score: newsSentiment.score,
                sectorAverageScore: newsSentiment.sectorAverageNewsScore,
                creationDate: newsSentiment.creationDate
            };
            return returnObj;
        }).catch(err => null);
    }
    static getLatestConsensus(data) {
        if (data && data.hasOwnProperty("consensuses") && data["consensuses"] && data["consensuses"].length) {
            let mostRecentConsensus = data["consensuses"][0];
            let tipranksConsensus = {
                rating: TipranksService.stockRatingCodes[mostRecentConsensus.rating],
                buy: mostRecentConsensus.nB,
                hold: mostRecentConsensus.nH,
                sell: mostRecentConsensus.nS,
                date: mostRecentConsensus.d,
            };
            return tipranksConsensus;
        }
        return null;
    }
    static getExperts(data) {
        let returnExperts = [];
        if (data && data.hasOwnProperty("experts") && data["experts"] && data["experts"].length) {
            let experts = data["experts"];
            for (var e of experts) {
                let expert = {
                    name: e.name,
                    firm: e.firm,
                    type: e.expertType,
                    rank: null,
                    typeRank: null,
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
                };
                if (e.hasOwnProperty("ratings") && e["ratings"] && e["ratings"].length) {
                    expert.stockRating.position = TipranksService.buyHoldSellRatingCodes[e["ratings"][0].ratingId];
                    expert.stockRating.date = new Date(e["ratings"][0].date).toLocaleDateString();
                    expert.stockRating.timestamp = new Date(e["ratings"][0].date).getTime();
                    if (e["ratings"][0].priceTarget && e["ratings"][0].priceTarget != "null") {
                        expert.stockRating.priceTarget = e["ratings"][0].priceTarget;
                    }
                }
                if (e.hasOwnProperty("rankings") && e["rankings"] && e["rankings"].length) {
                    expert.rank = e["rankings"][0].gRank;
                    expert.typeRank = e["rankings"][0].lRank;
                    expert.successRate = e["rankings"][0].gRecs / e["rankings"][0].tRecs;
                    expert.numRatings = e["rankings"][0].tRecs;
                    expert.avgReturn = e["rankings"][0].avgReturn;
                    expert.stars = e["rankings"][0].stars;
                }
                returnExperts.push(expert);
            }
        }
        return returnExperts;
    }
    static getPriceTargetConsensus(data) {
        if (data && data.hasOwnProperty("ptConsensus") && data["ptConsensus"] && data["ptConsensus"].length) {
            let ptConsensus = data["ptConsensus"];
            for (var p of ptConsensus) {
                if (p.period == 0) {
                    return {
                        priceTarget: p.priceTarget,
                        high: p.high,
                        low: p.low
                    };
                }
            }
        }
        return null;
    }
    static getPriceTargetsOverTime(data, consensusField) {
        let returnTimeSeries = [];
        if (data && data.hasOwnProperty(consensusField) && data[consensusField] && data[consensusField].length) {
            let timeSeries = data[consensusField];
            for (let t of timeSeries) {
                if (t.hasOwnProperty("priceTarget") && t["priceTarget"] != null) {
                    let item = {
                        priceTarget: t.priceTarget,
                        date: new Date(t.date).toLocaleDateString(),
                        timestamp: new Date(t.date).getTime()
                    };
                    returnTimeSeries.push(item);
                }
            }
        }
        return returnTimeSeries;
    }
    static copyExpertWithSingleStockRating(expert, rating) {
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
        };
        return expertCopy;
    }
    //scraper
    static async getTipranksCookie() {
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
exports.default = TipranksService;
TipranksService.url = "https://tipranks.com";
TipranksService.stockDataEndpoint = "https://www.tipranks.com/api/stocks/getData?name="; //all ratings info for a stock
TipranksService.mostRecommendedStocksEndpoint = "https://www.tipranks.com/api/stocks/getMostRecommendedStocks"; //self-explanatory
TipranksService.newsSentimentEndpoint = "https://www.tipranks.com/api/stocks/getNewsSentiments/?ticker="; //self-explanatory
TipranksService.getStocksEndpoint = "https://www.tipranks.com/api/screener/GetStocks/"; //screener ?
// private static expertsTop25Endpoint = "https://www.tipranks.com/api/experts/GetTop25Experts?expertType=" //doesn't work anymore, requires cookie
TipranksService.allExpertsPagedEndpoint = "https://www.tipranks.com/api/experts/getExperts?page="; //all experts
TipranksService.expertInfoEndpoint = "https://www.tipranks.com/api/experts/getInfo?name="; //all non-rating for an expert
TipranksService.insiderInfoEndpoint = "https://www.tipranks.com/api/insiders/getInsiderData?name=";
TipranksService.insiderTrending = "https://www.tipranks.com/api/insiders/getTrendingStocks?"; //new
TipranksService.hedgeFundManagerInfoEndpoint = "https://www.tipranks.com/api/hedgeFunds/getInfo?name=";
TipranksService.expertRatingsEndpoint = "https://www.tipranks.com/api/experts/getStocks?name="; //all rating info for an expert
TipranksService.topAnalysts = "/analysts/top";
TipranksService.analysts = "/analysts";
TipranksService.marketDao = MarketDao_1.default.getMarketDaoInstance();
TipranksService.stockDao = StockDao_1.default.getStockDaoInstance();
//not doing insiders because insiders buy/sell randomly and it only related to the company they work for
//not doing insitutionals (hedge fund managers) because they buy/sell kind of randomly sometimes and
//they dont have success rates and returns on individual stocks
TipranksService.expertTypes = ["analyst", "blogger"];
TipranksService.tipranksFetchCounter = 0;
TipranksService.experts = {};
TipranksService.symbolMap = {};
//for individual analyst recommendations
TipranksService.buyHoldSellRatingCodes = {
    1: "buy",
    2: "hold",
    3: "sell"
};
TipranksService.insiderBuySellCodes = {
    1: "sell",
    2: "buy",
    3: "buy",
    4: "sell"
};
TipranksService.hedgeFundActionCodes = {
    1: "buy",
    2: "buy",
    3: "sell",
    4: "sell",
    5: "hold"
};
//for the overall rating of a stock
TipranksService.stockRatingCodes = {
    1: "strong sell",
    2: "moderate sell",
    3: "hold",
    4: "moderate buy",
    5: "strong buy",
};
//# sourceMappingURL=TipranksService.js.map