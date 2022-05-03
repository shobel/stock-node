"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetch = require('node-fetch');
const node_html_parser_1 = require("node-html-parser");
const MarketDao_1 = require("../dao/MarketDao");
class FearGreedService {
    static getFearAndGreedIndicators() {
        const url = `${FearGreedService.url}`;
        return fetch(url)
            .then((res) => {
            return res.text();
        })
            .then((data) => {
            const root = node_html_parser_1.parse(data);
            let startIndex = root.innerHTML.indexOf("Currently");
            let fearGreadValue = root.innerHTML.substring(startIndex + 13, startIndex + 15);
            let updatedIndex = root.innerHTML.indexOf("Last updated");
            let sub = root.innerHTML.substring(updatedIndex + 13, updatedIndex + 31);
            let updatedSplit = sub.split(",");
            let updated = "";
            if (updatedSplit.length > 1) {
                updated = updatedSplit[0] + updatedSplit[1];
            }
            const fearAndGreed = {
                timeline: {
                    now: fearGreadValue
                },
                updated: updated
            };
            return FearGreedService.marketDao.setFearGreed(fearAndGreed);
        });
    }
}
exports.default = FearGreedService;
FearGreedService.url = "https://pyinvesting.com/fear-and-greed/";
FearGreedService.marketDao = MarketDao_1.default.getMarketDaoInstance();
//# sourceMappingURL=FearGreedService.js.map