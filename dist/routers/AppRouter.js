"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AppDao_1 = require("../dao/AppDao");
const PremiumDataManager_1 = require("../managers/PremiumDataManager");
const appRouter = express_1.Router();
const appDao = AppDao_1.default.getAppDaoInstance();
appRouter.get('/products', async (req, res) => {
    appDao.getProducts().then(products => {
        res.send(products);
    }).catch();
});
appRouter.get('/premium-packages', async (req, res) => {
    appDao.getPremiumPackages().then(packages => {
        res.send(packages);
    }).catch();
});
appRouter.get('/analysts-premium-package', async (req, res) => {
    appDao.getPremiumPackages().then(packages => {
        let p = packages.filter(p => p.id == PremiumDataManager_1.default.TOP_ANALYSTS_PACKAGE_ID);
        if (p.length) {
            res.send(p[0]);
        }
        else {
            res.send(null);
        }
    }).catch();
});
exports.default = appRouter;
//# sourceMappingURL=AppRouter.js.map