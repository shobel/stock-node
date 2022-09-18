"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const MarketDataManager_1 = require("../managers/MarketDataManager");
const MarketDao_1 = require("../dao/MarketDao");
const FidelityService_1 = require("../services/FidelityService");
const ScheduledUpdateService_1 = require("../services/ScheduledUpdateService");
const marketRouter = express_1.Router();
const marketDao = MarketDao_1.default.getMarketDaoInstance();
async function doInit() {
    const anyWeeklyData = await marketDao.isAnyEconomicData(marketDao.economicDataCollectionWeekly);
    let updated = "";
    if (!anyWeeklyData) {
        await MarketDataManager_1.default.initWeeklyEconomicData();
        updated += "weekly ";
    }
    const anyMonthlylyData = await marketDao.isAnyEconomicData(marketDao.economicDataCollectionMonthly);
    if (!anyMonthlylyData) {
        await MarketDataManager_1.default.initMonthlyEconomicData();
        updated += "monthly ";
    }
    const anyQuarterlyData = await marketDao.isAnyEconomicData(marketDao.economicDataCollectionQuarterly);
    if (!anyQuarterlyData) {
        await MarketDataManager_1.default.initQuarterlyEconomicData();
        updated += "quarterly";
    }
    return updated;
}
doInit().then(updated => {
    if (updated != "") {
        console.log(`${updated} market data init done`);
    }
}).catch(() => console.log("market data init error"));
// ALL ROUTES TESTED
/* get sector performances */
// tested
marketRouter.get('/sector-performances', async (req, res) => {
    MarketDataManager_1.default.getSectorPerformances().then(performances => {
        res.send(performances);
    }).catch();
});
/* economic data */
// tested
marketRouter.get('/economic', async (req, res) => {
    MarketDataManager_1.default.getLatestEconomicData().then(data => {
        res.send(data);
    }).catch();
});
/* top 10: gainers losers and mostactive */
// tested
marketRouter.get('/top10', async (req, res) => {
    MarketDataManager_1.default.getAllTop10().then(data => {
        res.send(data);
    }).catch();
});
marketRouter.get('/socials', async (req, res) => {
    MarketDataManager_1.default.getAllMarketSocialSentiments().then(data => {
        res.send(data);
    }).catch();
});
/* returns array of stocktwits trending symbols */
// tested
marketRouter.get('/stocktwits-trending-symbols/:symbolsOnly', async (req, res) => {
    const symbolsOnly = req.params.symbolsOnly === "true" ? true : false;
    MarketDataManager_1.default.getStocktwitsTrending(symbolsOnly).then(data => {
        res.send(data);
    }).catch();
});
/* returns array of news objects */
// tested
marketRouter.get('/news', async (req, res) => {
    let marketNews = ScheduledUpdateService_1.default.marketNews;
    res.send(marketNews);
});
//tested
marketRouter.get('/tipranks/top-analysts', async (req, res) => {
    MarketDataManager_1.default.getTipranksTopAnalysts().then(data => {
        res.send(data);
    }).catch();
});
marketRouter.get('/tipranks/analysts', async (req, res) => {
    MarketDataManager_1.default.getTipranksTopAnalysts().then(data => {
        res.send(data);
    }).catch();
});
marketRouter.get('/fidelity/scores', async (req, res) => {
    FidelityService_1.default.getFidelityAnalystData().then(data => {
        res.send(data);
    });
});
marketRouter.get('/market-economy', async (req, res) => {
    MarketDataManager_1.default.getMarketAndEconomyData().then(data => {
        res.send(data);
    }).catch();
});
exports.default = marketRouter;
//# sourceMappingURL=MarketRouter.js.map