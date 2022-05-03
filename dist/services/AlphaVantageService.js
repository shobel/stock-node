"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StockDao_1 = require("../dao/StockDao");
const ChartDao_1 = require("../dao/ChartDao");
const fetch = require('node-fetch');
class AlphaVantageService {
    constructor() {
        this.alphaVantageBaseUrl = "https://www.alphavantage.co/query?function=";
        this.intradayEndpoint = "TIME_SERIES_INTRADAY";
        this.dailyEndpoint = "TIME_SERIES_DAILY_ADJUSTED";
        this.weeklyEndpoint = "TIME_SERIES_WEEKLY_ADJUSTED";
        this.monthlyEndpoint = "TIME_SERIES_MONTHLY_ADJUSTED";
        this.smaEndpoint = "SMA";
        this.rsiEndpoint = "RSI";
        this.apikey = "R6DTNYUJKN13ZYN4";
        this.stockDao = StockDao_1.default.getStockDaoInstance();
        this.chartDao = ChartDao_1.default.getChartDaoInstance();
    }
}
exports.default = AlphaVantageService;
//# sourceMappingURL=AlphaVantageService.js.map