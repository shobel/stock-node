"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetch = require('node-fetch');
class StocktwitsService {
    static getTrendingMessages() {
        const url = `${StocktwitsService.stocktwitsURL}${StocktwitsService.trendingEndpoint}?access_token=${StocktwitsService.accessToken}`;
        return fetch(url)
            .then((res) => {
            return res.json();
        }).then((data) => {
            if (data && data.response.status === 200) {
                return data.messages;
            }
            return null;
        }).catch(err => console.log(err));
    }
    static getTrendingSymbols() {
        const url = `${StocktwitsService.stocktwitsTrendingURL}?access_token=${StocktwitsService.accessToken}`;
        return fetch(url)
            .then((res) => {
            return res.json();
        }).then((data) => {
            if (data && data.response.status === 200) {
                return data.symbols;
            }
            return null;
        }).catch(err => console.log(err));
    }
    static getPostsForSymbol(symbol) {
        const url = `${StocktwitsService.stocktwitsURL}symbol/${symbol}.json?access_token=${StocktwitsService.accessToken}`;
        return fetch(url)
            .then((res) => {
            return res.json();
        }).then((data) => {
            if (data && data.response.status === 200) {
                return data.messages;
            }
            return null;
        }).catch(err => console.log(err));
    }
}
exports.default = StocktwitsService;
StocktwitsService.accessToken = process.env.STOCKTWITS_ACCESS_TOKEN;
StocktwitsService.stocktwitsURL = "https://api.stocktwits.com/api/2/streams/";
StocktwitsService.stocktwitsTrendingURL = "https://api.stocktwits.com/api/2/trending/symbols.json";
StocktwitsService.trendingEndpoint = "trending.json";
//# sourceMappingURL=StocktwitsService.js.map