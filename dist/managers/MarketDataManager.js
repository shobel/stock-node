"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MarketDao_1 = require("../dao/MarketDao");
const IexDataService_1 = require("../services/IexDataService");
const FMPService_1 = require("../services/FMPService");
const QuoteService_1 = require("../services/QuoteService");
const StockDao_1 = require("../dao/StockDao");
class MarketDataManager {
    static initWeeklyEconomicData() {
        return FMPService_1.default.getWeeklyEconomicData(true).then(data => {
            return MarketDataManager.marketDao.batchSaveMultipleDocsInCollectionWithFieldIds(MarketDataManager.marketDao.economicDataCollectionWeekly, "id", data, false);
        });
    }
    static initMonthlyEconomicData() {
        return FMPService_1.default.getMonthlyEconomicData(true).then(data => {
            return MarketDataManager.marketDao.batchSaveMultipleDocsInCollectionWithFieldIds(MarketDataManager.marketDao.economicDataCollectionMonthly, "id", data, false);
        });
    }
    static initQuarterlyEconomicData() {
        return FMPService_1.default.getQuarterlyEconomicData(true).then(data => {
            return MarketDataManager.marketDao.batchSaveMultipleDocsInCollectionWithFieldIds(MarketDataManager.marketDao.economicDataCollectionQuarterly, "id", data, false);
        });
    }
    static getStocktwitsTrending(symbolsOnly) {
        return MarketDataManager.marketDao.getStocktwitsTrending().then((result) => {
            if (symbolsOnly) {
                const symbols = {};
                for (const trendingObject of result) {
                    if (trendingObject.symbols.length > 0) {
                        const symbol = trendingObject.symbols[0].symbol;
                        if (!symbols.hasOwnProperty(symbol)) {
                            symbols[symbol] = {};
                            symbols[symbol].Bullish = 0;
                            symbols[symbol].Bearish = 0;
                        }
                        if (trendingObject.entities.sentiment && trendingObject.entities.sentiment.basic) {
                            const sentiment = trendingObject.entities.sentiment.basic;
                            symbols[symbol][sentiment] += 1;
                        }
                    }
                }
                const finalizedSymbols = [];
                for (const symbolKey of Object.keys(symbols)) {
                    const symbol = symbols[symbolKey];
                    if (!symbol.Bullish && !symbol.Bearish) {
                        finalizedSymbols.push({
                            symbol: symbolKey,
                            sentiment: null
                        });
                    }
                    else {
                        finalizedSymbols.push({
                            symbol: symbolKey,
                            sentiment: symbol.Bullish / (symbol.Bearish + symbol.Bullish)
                        });
                    }
                }
                return finalizedSymbols;
            }
            else {
                const results = [];
                for (const r of result) {
                    const post = {};
                    post.id = r.id;
                    post.body = r.body;
                    post.symbols = r.symbols.map(s => s.symbol);
                    post.username = r.user.username;
                    if (r.entities && r.entities.sentiment && r.entities.sentiment.basic) {
                        post.sentiment = r.entities.sentiment.basic;
                    }
                    post.timestamp = r.timestamp;
                    post.createdAt = r.created_at;
                    results.push(post);
                }
                return results;
            }
        }).catch();
    }
    static getAllTop10() {
        return MarketDataManager.marketDao.getAllTop10().then(result => result).catch(err => err);
    }
    static getAllMarketSocialSentiments() {
        let symbols = StockDao_1.default.getStockDaoInstance().getAllSymbols();
        return MarketDataManager.marketDao.getSocialSentimentData().then(result => {
            for (let key of Object.keys(result)) {
                if (result.hasOwnProperty(key) && result[key]) {
                    result[key] = result[key].filter(i => symbols.includes(i.symbol));
                    if (result[key].length > 10) {
                        result[key] = result[key].slice(0, 10);
                    }
                }
            }
            return result;
        }).catch(err => err);
    }
    static getMarketNews() {
        return MarketDataManager.marketDao.getMarketNews().then(result => result);
    }
    static getSectorPerformances() {
        return MarketDataManager.marketDao.getSectorPerformances().then(performances => {
            if (!performances) {
                return MarketDataManager.iexDataService.getSectorPerformance().then(iexResult => {
                    return MarketDataManager.marketDao.saveSectorPerformances(iexResult);
                }).then(() => {
                    return MarketDataManager.marketDao.getSectorPerformances();
                }).then(dbResult => dbResult);
            }
            return performances;
        }).catch();
    }
    static getLatestEconomicData() {
        const aggregateData = {};
        return MarketDataManager.marketDao.getLatestEconomicData(MarketDataManager.marketDao.economicDataCollectionWeekly)
            .then(data1 => {
            aggregateData.weekly = data1;
            return MarketDataManager.marketDao.getLatestEconomicData(MarketDataManager.marketDao.economicDataCollectionMonthly);
        }).then(data2 => {
            aggregateData.monthly = data2;
            return MarketDataManager.marketDao.getLatestEconomicData(MarketDataManager.marketDao.economicDataCollectionQuarterly);
        }).then(data3 => {
            aggregateData.quarterly = data3;
            return aggregateData;
        });
    }
    /* gdp is quarterly, we probably want around 5 years which is 20 quarterly docs */
    static getEconomicData(numDocs) {
        const aggregateData = {};
        return MarketDataManager.marketDao.getEconomicData(MarketDataManager.marketDao.economicDataCollectionWeekly, numDocs * 13)
            .then(data1 => {
            aggregateData.weekly = data1;
            return MarketDataManager.marketDao.getEconomicData(MarketDataManager.marketDao.economicDataCollectionMonthly, numDocs * 3);
        }).then(data2 => {
            aggregateData.monthly = data2;
            return MarketDataManager.marketDao.getEconomicData(MarketDataManager.marketDao.economicDataCollectionQuarterly, numDocs);
        }).then(data3 => {
            aggregateData.quarterly = data3;
            return aggregateData;
        });
    }
    static getTipranksTopAnalysts() {
        return MarketDataManager.marketDao.getTipranksTopAnalysts();
    }
    static async getTipranksSymbols(numAnalystThreshold) {
        let docDataList = [];
        if (!MarketDataManager.tipranksSymbolCache || Date.now() - MarketDataManager.tipranksSymbolCacheLastUpdate > MarketDataManager.tipranksSymbolCacheUpdateIntervalMs) {
            //snapshots
            let docSnaps = await MarketDataManager.marketDao.getTipranksTopSymbols();
            let allData = [];
            for (let doc of docSnaps) {
                let numAnalysts = doc.get("numAnalysts");
                let docData = doc.data();
                if (!numAnalystThreshold || numAnalysts >= numAnalystThreshold) {
                    docDataList.push(docData);
                }
                allData.push(docData);
            }
            MarketDataManager.tipranksSymbolCache = allData;
            MarketDataManager.tipranksSymbolCacheLastUpdate = Date.now();
        }
        else {
            for (let ci of MarketDataManager.tipranksSymbolCache) {
                if (!numAnalystThreshold || ci.numAnalysts >= numAnalystThreshold) {
                    docDataList.push(ci);
                }
            }
        }
        return docDataList;
    }
    static getFearGreed() {
        return MarketDataManager.marketDao.getFearGreed();
    }
    static getMarketAndEconomyData() {
        const combinedData = {};
        return MarketDataManager.getFearGreed().then(fearGreed => {
            combinedData["fearGreed"] = fearGreed;
            return;
        }).then(() => {
            return MarketDataManager.getSectorPerformances();
        }).then(sectors => {
            combinedData["sectorPerformance"] = Object.values(sectors);
            return MarketDataManager.getEconomicData(20); //5 years
        }).then(economy => {
            combinedData["economy"] = economy;
            return combinedData;
        });
    }
    static async updateTopAnalystPortfolio() {
        let md = MarketDao_1.default.getMarketDaoInstance();
        let top10 = await md.getTop10Field(md.topAnalysts);
        let portfolio = await md.getTopAnalystsPortfolio();
        if (portfolio && portfolio.currentPositions && portfolio.currentPositions.length) {
            //if we have a portfolio, calculate and save the new value of it
            let currentPositions = portfolio.currentPositions;
            let newPortValue = 0;
            for (let pos of currentPositions) {
                let quotes = await QuoteService_1.default.getLatestQuotes([pos.symbol], false);
                if (quotes.hasOwnProperty(pos.symbol)) {
                    let latestPrice = quotes[pos.symbol].price;
                    let currentPosValue = pos.numShares * latestPrice;
                    newPortValue += currentPosValue;
                }
                else {
                    //if theres a quote missing, we're done and can try again tomorrow, the 
                    //new portfolio value wont be accurate and it will throw off everything
                    return;
                }
            }
            if (newPortValue == 0) {
                //new portfolio value isn't accurate and it will throw off everything
                return;
            }
            md.updateTopAnalystsPortfolioValue(newPortValue);
            //adjust the portfolio positions
            let top10symbols = top10.map(s => s.symbol);
            let dollarsOfEach = newPortValue / top10symbols.length;
            let newPortfolio = [];
            for (let s of top10symbols) {
                let quotes = await QuoteService_1.default.getLatestQuotes([s], false);
                let latestPrice = 0;
                if (quotes.hasOwnProperty(s)) {
                    latestPrice = quotes[s].price;
                }
                let position = {
                    symbol: s,
                    numShares: dollarsOfEach / latestPrice
                };
                newPortfolio.push(position);
            }
            md.updateTopAnalystsPortfolioPositions(newPortfolio);
        }
        else {
            //create a portfolio
            let newPortfolio = [];
            for (let top of top10) {
                let quotes = await QuoteService_1.default.getLatestQuotes([top.symbol], false);
                let latestPrice = 0;
                if (quotes.hasOwnProperty(top.symbol)) {
                    latestPrice = quotes[top.symbol].price;
                }
                let numShares = 1.0 / latestPrice;
                let position = {
                    symbol: top.symbol,
                    numShares: numShares
                };
                newPortfolio.push(position);
            }
            let newPortValue = 0;
            for (let pos of newPortfolio) {
                let quotes = await QuoteService_1.default.getLatestQuotes([pos.symbol], false);
                let latestPrice = 0;
                if (quotes.hasOwnProperty(pos.symbol)) {
                    latestPrice = quotes[pos.symbol].price;
                }
                let currentPosValue = pos.numShares * latestPrice;
                newPortValue += currentPosValue;
            }
            md.updateTopAnalystsPortfolioValue(newPortValue);
            md.updateTopAnalystsPortfolioPositions(newPortfolio);
        }
    }
}
exports.default = MarketDataManager;
MarketDataManager.marketDao = MarketDao_1.default.getMarketDaoInstance();
MarketDataManager.iexDataService = IexDataService_1.default.getIexDataServiceInstance();
MarketDataManager.tipranksSymbolCache = null;
MarketDataManager.tipranksSymbolCacheLastUpdate = 0;
MarketDataManager.tipranksSymbolCacheUpdateIntervalMs = 10800000; //3 hours
//# sourceMappingURL=MarketDataManager.js.map