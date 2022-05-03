"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StockMarketUtility_1 = require("../utils/StockMarketUtility");
const FMPService_1 = require("./FMPService");
const IexDataService_1 = require("./IexDataService");
const Utilities_1 = require("../utils/Utilities");
class QuoteService {
    constructor() { }
    //will fetch latestQuotes every updateInterval until stockmarket closes
    static async fetchLatestQuotesUntilMarketCloses(fromInit) {
        if (QuoteService.fetching) {
            return;
        }
        if (!fromInit) {
            for (let key of Object.keys(QuoteService.quoteCache)) {
                QuoteService.quoteCache[key].simplifiedChart = [];
            }
        }
        let iteration = 0;
        var intervalID = setInterval(async function () {
            let isMarketOpen = await FMPService_1.default.getIsMarketOpen();
            StockMarketUtility_1.default.getStockMarketUtility().isMarketOpen = isMarketOpen;
            if (isMarketOpen) {
                QuoteService.fetchLatestQuotesForAllSymbolsAndWriteToCache(iteration);
            }
            else {
                clearInterval(intervalID);
                QuoteService.fetching = false;
            }
            iteration += 1;
        }, QuoteService.updateInterval);
    }
    //fetches quotes, writes quotes to cache, also builds simplified chart every simplifiedChartInterval (10min)
    static fetchLatestQuotesForAllSymbolsAndWriteToCache(iteration) {
        console.log(`fetching all quotes iteration ${iteration}`);
        return FMPService_1.default.getQuoteForAllSymbols().then(quotes => {
            for (let q of quotes) {
                q.symbol = q.symbol.replace("-", ".");
                if (!this.quoteCache[q.symbol]) {
                    this.quoteCache[q.symbol] = {};
                }
                this.quoteCache[q.symbol].latestQuote = q;
                if (!this.quoteCache[q.symbol].simplifiedChart) {
                    this.quoteCache[q.symbol].simplifiedChart = [];
                }
                if ((this.updateInterval * iteration) % this.simplifiedChartInterval == 0) {
                    this.quoteCache[q.symbol].simplifiedChart.push({
                        minute: (this.quoteCache[q.symbol].simplifiedChart.length + 1).toString(),
                        close: q.price
                    });
                }
            }
            return;
        });
    }
    //called from stockrouter
    static async getLatestQuotes(symbols, alsoGetSimplifiedChart) {
        if (!symbols || !symbols.length) {
            return null;
        }
        let su = StockMarketUtility_1.default.getStockMarketUtility();
        let quoteMap = {};
        let symbolsNeedExtendedPrice = [];
        for (let s of symbols) {
            if (QuoteService.quoteCache.hasOwnProperty(s)) {
                quoteMap[s] = {};
                if (alsoGetSimplifiedChart) {
                    quoteMap[s].simplifiedChart = QuoteService.quoteCache[s].simplifiedChart;
                    quoteMap[s].latestQuote = QuoteService.quoteCache[s].latestQuote;
                }
                else {
                    quoteMap[s] = QuoteService.quoteCache[s].latestQuote;
                }
                if (quoteMap[s].latestQuote && isNaN(quoteMap[s].latestQuote.earningsAnnouncement)) {
                    let daysToEarnings = Utilities_1.default.countDaysBetweenDateStringsOrderMatters(quoteMap[s].latestQuote.earningsAnnouncement, new Date().toISOString());
                    quoteMap[s].latestQuote.daysToEarnings = daysToEarnings;
                }
                if (!su.isMarketOpen) {
                    let extendedCachedPrice = QuoteService.extendedQuoteCache[s];
                    if (!extendedCachedPrice) {
                        symbolsNeedExtendedPrice.push(s);
                    }
                    else {
                        let price = extendedCachedPrice.price;
                        let priceTime = extendedCachedPrice.priceTime;
                        let changePercent = extendedCachedPrice.changePercent;
                        let updated = extendedCachedPrice.updated;
                        if ((Date.now() - updated) >= QuoteService.extendedQuoteUpdateInterval) {
                            symbolsNeedExtendedPrice.push(s);
                        }
                        else {
                            if (alsoGetSimplifiedChart) {
                                quoteMap[s].latestQuote.extendedPrice = price;
                                quoteMap[s].latestQuote.extendedPriceTime = priceTime;
                                quoteMap[s].latestQuote.extendedChangePercent = changePercent;
                            }
                            else {
                                quoteMap[s].extendedPrice = price;
                                quoteMap[s].extendedPriceTime = priceTime;
                                quoteMap[s].extendedChangePercent = changePercent;
                            }
                        }
                    }
                }
            }
        }
        if (symbolsNeedExtendedPrice.length) {
            let latestQuotes = await IexDataService_1.default.getIexDataServiceInstance().getJustLatestQuoteForSymbols(symbolsNeedExtendedPrice);
            for (let lq of latestQuotes) {
                QuoteService.extendedQuoteCache[lq.symbol] = {
                    price: lq.extendedPrice,
                    priceTime: lq.extendedPriceTime,
                    changePercent: lq.extendedChangePercent,
                    updated: Date.now()
                };
                if (alsoGetSimplifiedChart) {
                    quoteMap[lq.symbol].latestQuote.extendedPrice = lq.extendedPrice;
                    quoteMap[lq.symbol].latestQuote.extendedPriceTime = lq.extendedPriceTime;
                    quoteMap[lq.symbol].latestQuote.extendedChangePercent = lq.extendedChangePercent;
                }
                else {
                    if (quoteMap[lq.symbol]) {
                        quoteMap[lq.symbol].extendedPrice = lq.extendedPrice;
                        quoteMap[lq.symbol].extendedPriceTime = lq.extendedPriceTime;
                        quoteMap[lq.symbol].extendedChangePercent = lq.extendedChangePercent;
                    }
                }
            }
        }
        quoteMap["isUSMarketOpen"] = su.isMarketOpen;
        return quoteMap;
    }
    static saveSimplifiedChartsToCache(simplifiedCharts) {
        for (let [key, value] of Object.entries(simplifiedCharts)) {
            if (QuoteService.quoteCache.hasOwnProperty(key)) {
                QuoteService.quoteCache[key].simplifiedChart = value;
            }
        }
        console.log();
    }
}
exports.default = QuoteService;
QuoteService.updateInterval = 120000; //1 min
QuoteService.simplifiedChartInterval = 600000; //every 10min
QuoteService.quoteCache = {}; // { symbol:string -> { latestQuote:FMPQuote, simplifiedChart: number[]} }
QuoteService.extendedQuoteCache = {}; //{symbol:string -> { price:number, priceTime:number, updated:number }
QuoteService.extendedQuoteUpdateInterval = 600000 * 3; //30min
QuoteService.fetching = false; //to make sure we don't have 2 "threads" continuously fetching
//# sourceMappingURL=QuoteService.js.map