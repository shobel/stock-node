"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const FMPService_1 = require("../services/FMPService");
const StockDao_1 = require("../dao/StockDao");
const AnalysisService_1 = require("../services/AnalysisService");
const FidelityService_1 = require("../services/FidelityService");
const IexDataService_1 = require("../services/IexDataService");
const StockDataManager_1 = require("../managers/StockDataManager");
const StocktwitsService_1 = require("../services/StocktwitsService");
const FearGreedService_1 = require("../services/FearGreedService");
const TipranksService_1 = require("../services/TipranksService");
const PremiumDataManager_1 = require("../managers/PremiumDataManager");
const TwitterApiService_1 = require("../services/TwitterApiService");
const MarketDataManager_1 = require("../managers/MarketDataManager");
const MarketDao_1 = require("../dao/MarketDao");
const PlaidService_1 = require("../services/PlaidService");
const ScheduledUpdateService_1 = require("../services/ScheduledUpdateService");
const testRouter = express_1.Router();
/************************************************************/
/********************* TEST ENDPOINTS ***********************/
/************************************************************/
testRouter.get('/score-settings', async (req, res) => {
    const userid = "XcHCGI3CmWXEzaZFMnOzhGQWx2S2";
    StockDataManager_1.default.applyUserScoreSettingsForSymbol(userid, "AAPL").then(result => {
        res.send(result);
    }).catch();
});
testRouter.get('/fear-and-greed', async (req, res) => {
    FearGreedService_1.default.getFearAndGreedIndicators().then(result => {
        res.send(result);
    }).catch();
});
testRouter.get('/stocktwits', async (req, res) => {
    StocktwitsService_1.default.getTrendingSymbols().then(result => {
        res.send(result);
    }).catch();
});
testRouter.get('/test', async (req, res) => {
    // let allSymbols = Object.keys(QuoteService.quoteCache)
    FMPService_1.default.screener({ operation: ">", value: 100000000000 }, null, null, null, null, null, "nasdaq,nyse").then(result => {
        FMPService_1.default.updateAnnualEarningsEstimates(result.map(r => r.symbol));
        res.send("ok");
    }).catch();
});
testRouter.get('/market-cap-screener', async (req, res) => {
    const symbol = req.query.symbol;
    const operation = req.query.operation;
    const value = req.query.value;
    FMPService_1.default.screener({ operation: operation, value: value }, null, null, null, null, null, "nasdaq,nyse").then(result => {
        res.send(result);
    }).catch();
});
testRouter.get('/analysis', async (req, res) => {
    AnalysisService_1.default.doAnalysis().then(result => {
        res.send(result);
    }).catch();
});
testRouter.get('/premium-for-symbols/:userid', async (req, res) => {
    const userid = req.params.userid;
    const symbols = req.query.symbols;
    const premiumId = req.query.premiumId;
    if (!symbols) {
        res.send(null);
        return;
    }
    PremiumDataManager_1.default.getLatestPremiumDataTypeForSymbols(symbols.split(","), premiumId, userid).then(result => {
        res.send(result);
    });
});
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
testRouter.get('/smascore/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
});
testRouter.get('/fidelity', async (req, res) => {
    FidelityService_1.default.scrape().then(result => {
        res.send(result);
    }).catch();
});
testRouter.get('/populate/:symbol/:isCompany', async (req, res) => {
    const symbol = req.params.symbol;
    const isCompany = req.params.isCompany === "true";
    FMPService_1.default.populateAllHistoryForSymbol(symbol).then(result => {
        res.send(result);
    }).catch();
});
testRouter.get('/test1/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    FMPService_1.default.updateAllFinancialDataSingleEndpoint(symbol).then(result => {
        res.send(result);
    }).catch();
});
testRouter.get('/snapshot-listener-test/:test', async (req, res) => {
    let s = req.params.test;
    let test = await StockDao_1.default.getStockDaoInstance().editFieldTest(s);
    res.send(test);
});
testRouter.get('/keystats', async (req, res) => {
});
testRouter.get('/agg', async (req, res) => {
    const arr = await FMPService_1.default.aggregate(["AAPL", "MSFT", "NVDA", "AVGO", "TSLA", "FB", "AMZN", "ATVI", "MTCH", "AMD", "WMT", "V"]);
    res.send(arr);
});
testRouter.get('/tipranks1', async (req, res) => {
    await TipranksService_1.default.fetchTopAnalysts();
});
testRouter.get('/manyquotes', async (req, res) => {
    let r = await FMPService_1.default.screener({ operation: ">", value: "50000000000" }, null, null, null, null, null, null);
    r = r.map(x => x.symbol);
    let x = await StockDataManager_1.default.getLatestQuotesForSymbols(r, false);
    res.send(x);
});
testRouter.get('/twitter', async (req, res) => {
    // let r = await TwitterApiService.fetchTweetsForUser("hedgeyeretail", (new Date(Date.now() - TwitterApiService.dayInMs)).toISOString(), 10)
    // res.send(r)
});
testRouter.post('/sentiment', async (req, res) => {
    let text = req.body.text;
    let r = await TwitterApiService_1.default.getSentiment(text);
    res.send({});
});
testRouter.get('/experiment', async (req, res) => {
    let allSymbols = await FMPService_1.default.getAllSymbols();
    let exchanges = ["amex", "nyse", "nasdaq", "etf"];
    let goodSymbols = [];
    let types = {};
    for (let s of allSymbols) {
        if (exchanges.includes(s.exchangeShortName.toLowerCase())) {
            if (!types[s.type]) {
                types[s.type] = [];
            }
            types[s.type].push(s.symbol);
        }
        goodSymbols.push(s.symbol);
    }
    console.log();
});
testRouter.get('/daily-tweetupdate', async (req, res) => {
    TwitterApiService_1.default.getDailyTweetsForAllFollowedAccounts();
});
testRouter.get('/population-progress', async (req, res) => {
    let stocksnaps = StockDao_1.default.getStockDaoInstance().snapshotCache;
    let popped = [];
    let notPopped = [];
    let poppedButNoData = [];
    let poppedButNoMarketCap = []; //bonds and funds have no market cap
    for (let snap of Object.values(stocksnaps)) {
        if (snap && snap.get("company")) {
            if (snap.get("company").symbol) {
                if (snap.get("company").mktCap) {
                    popped.push(snap.id);
                }
                else {
                    poppedButNoMarketCap.push(snap.id);
                }
            }
            else {
                poppedButNoData.push(snap.id);
            }
        }
        else {
            notPopped.push(snap.id);
        }
    }
    res.send({
        popped: popped,
        notPopped: notPopped
    });
});
testRouter.get('/compare-lists', async (req, res) => {
    let iex = await IexDataService_1.default.getIexDataServiceInstance().getAllSymbolsInIEX();
    let fmp = await FMPService_1.default.getQuoteForAllSymbols();
    let stocksIexHasThatFMPDoesnt = [];
    for (let i of iex) {
        let found = false;
        for (let f of fmp) {
            if (i == f.symbol) {
                found = true;
                break;
            }
        }
        if (!found) {
            stocksIexHasThatFMPDoesnt.push(i);
        }
    }
    let stocksFMPHasThatIexDoesnt = [];
    for (let f of fmp) {
        let found = false;
        for (let i of iex) {
            if (f.symbol == i) {
                found = true;
                break;
            }
        }
        if (!found) {
            stocksFMPHasThatIexDoesnt.push(f.symbol);
        }
    }
    res.send({
        FMPmissing: stocksIexHasThatFMPDoesnt,
        IEXmissing: stocksFMPHasThatIexDoesnt
    });
});
testRouter.get('/removeotc', async (req, res) => {
    let fmp = await FMPService_1.default.getQuoteForAllSymbols();
    let symbols = fmp.map(f => f.symbol);
    let companyInfos = await IexDataService_1.default.getIexDataServiceInstance().getCompanyForSymbols(symbols);
    let symbolsToDelete = [];
    for (let c of Object.values(companyInfos)) {
        let ci = c.company;
        let ex = ci.exchange;
        if (ex && (ex.toLowerCase().includes("otc") || ex.toLowerCase().includes("cboe"))) {
            symbolsToDelete.push(ci.symbol);
        }
    }
    await StockDao_1.default.getStockDaoInstance().deleteEverythingForSymbols(symbolsToDelete);
    res.send();
});
testRouter.get('/compute-top-analysts-scores', async (req, res) => {
    let scores = await TipranksService_1.default.computeTopAnalystSymbolScores();
    res.send(scores);
});
testRouter.get('/update-top-analyst-portfolio', async (req, res) => {
    await MarketDataManager_1.default.updateTopAnalystPortfolio();
    res.send();
});
testRouter.get('/market-socials', async (req, res) => {
    let trendingSocials = await FMPService_1.default.getTrendingBySocialSentiment();
    let socialChangeTwitter = await FMPService_1.default.getSocialSentimentChanges("twitter");
    let socialChangeStocktwits = await FMPService_1.default.getSocialSentimentChanges("stocktwits");
    MarketDao_1.default.getMarketDaoInstance().saveSocialSentimentData({
        trending: trendingSocials,
        twitterChange: socialChangeTwitter,
        stocktwitsChange: socialChangeStocktwits
    });
    res.send();
});
testRouter.get('/plaid-redirect', async (req, res) => {
    console.log();
    res.send();
});
testRouter.get('/plaid-update', async (req, res) => {
    PlaidService_1.default.getPlaidService().updateAccountBalancesForAllUsers();
    res.send();
});
testRouter.get('/evening', async (req, res) => {
    var sus = new ScheduledUpdateService_1.default();
    sus.stopSchedules();
    sus.scheduledEveningUpdate(true);
    res.send();
});
testRouter.get('/earnings', async (req, res) => {
    let symbols = StockDao_1.default.getStockDaoInstance().getAllSymbols();
    let start = Date.now();
    await FMPService_1.default.updateEarningsForSymbols(symbols); //for next quarter eps estimates
    let end = Date.now();
    console.log(`EPS Estimates done in ${(end - start) / 1000.0}s`);
    start = Date.now();
    await FMPService_1.default.updateAnnualEarningsEstimates(symbols); //for annual eps estimate which is for forward pe calculation, these are not accurate from what i can tell
    end = Date.now();
    console.log(`Annual Earnings Estimates done in ${(end - start) / 1000.0}s`);
    res.send();
});
testRouter.get('/update-earnings/:symbol', async (req, res) => {
    let symbol = req.params.symbol;
    let start = Date.now();
    await FMPService_1.default.updateEarningsForSymbols([symbol]); //for next quarter eps estimates
    let end = Date.now();
    console.log(`EPS Estimates done in ${(end - start) / 1000.0}s`);
    start = Date.now();
    await FMPService_1.default.updateAnnualEarningsEstimates([symbol]); //for annual eps estimate which is for forward pe calculation, these are not accurate from what i can tell
    end = Date.now();
    console.log(`Annual Earnings Estimates done in ${(end - start) / 1000.0}s`);
    res.send();
});
testRouter.get('/insider/:symbol', async (req, res) => {
    let symbol = req.params.symbol;
    await FMPService_1.default.getInsiderSummaryForSymbol(symbol);
    res.send();
});
exports.default = testRouter;
//# sourceMappingURL=TestRouter.js.map