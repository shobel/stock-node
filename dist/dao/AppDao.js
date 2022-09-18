"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseDao_1 = require("./BaseDao");
const Utilities_1 = require("../utils/Utilities");
class AppDao extends BaseDao_1.default {
    constructor() {
        super();
        this.appCollection = "app";
        this.generalDoc = "general";
        this.premiumPackagesDoc = "premiumPackages";
        this.productsDoc = "products";
        this.creditValueBase = 0.1; //1 credit = 10cents, can be updated manually
        this.dollarOfIexCredits = 1000000; //1 dollar gets you 500k iex credits
        this.tipranksFetchCounterField = "tipranksFetchCounter";
        //only populates packages and such when there is no data in the app collection
        //if there is data, it must be edited manually
        this.initProducts();
    }
    static getAppDaoInstance() {
        return this.appDaoInstance;
    }
    initProducts() {
        this.db.collection(this.appCollection).doc(this.productsDoc).get()
            .then(snapshot => {
            if (!snapshot.exists) {
                return this.db.collection(this.appCollection).doc(this.productsDoc).set({
                    "shobel.stonks.credits1": {
                        id: "shobel.stonks.credits1",
                        usd: 0.99,
                        credits: Math.round(1 / this.creditValueBase)
                    },
                    "shobel.stonks.credits5": {
                        id: "shobel.stonks.credits5",
                        usd: 4.99,
                        credits: Math.round((5 / this.creditValueBase) + (5 / this.creditValueBase) * 0.1)
                    },
                    "shobel.stonks.credits10": {
                        id: "shobel.stonks.credits10",
                        usd: 9.99,
                        credits: Math.round((10 / this.creditValueBase) + (10 / this.creditValueBase) * 0.2)
                    },
                    "shobel.stonks.credits50": {
                        id: "shobel.stonks.credits50",
                        usd: 49.99,
                        credits: Math.round((50 / this.creditValueBase) + (50 / this.creditValueBase) * 0.3)
                    }
                });
            }
            return null;
        }).then(() => {
            return this.db.collection(this.appCollection).doc(this.generalDoc).get();
        }).then(snapshot => {
            if (!snapshot.exists || !snapshot.data()) {
                return this.db.collection(this.appCollection).doc(this.generalDoc).set({
                    creditValue: this.creditValueBase,
                    dollarOfIexCredits: this.dollarOfIexCredits
                });
            }
            else {
                let data = snapshot.data();
                if (!data.hasOwnProperty("creditValue")) {
                    return this.db.collection(this.appCollection).doc(this.generalDoc).update({
                        creditValue: this.creditValueBase,
                        dollarOfIexCredits: this.dollarOfIexCredits
                    });
                }
            }
            return null;
        }).then(() => {
            return this.db.collection(this.appCollection).doc(this.premiumPackagesDoc).get();
        }).then(snapshot => {
            if (!snapshot || !snapshot.exists) {
                return this.db.collection(this.appCollection).doc(this.premiumPackagesDoc).set({
                    PREMIUM_KAVOUT_KSCORE: {
                        id: "PREMIUM_KAVOUT_KSCORE",
                        name: "K Score For US Equities",
                        weight: 126263,
                        credits: Math.ceil(((126263 / this.dollarOfIexCredits) / this.creditValueBase) * 2),
                        enabled: true
                    },
                    PREMIUM_BRAIN_SENTIMENT_30_DAYS: {
                        id: "PREMIUM_BRAIN_SENTIMENT_30_DAYS",
                        name: "BRAIN Company’s 30 Day Sentiment Indicator",
                        weight: 60000,
                        credits: Math.ceil(((60000 / this.dollarOfIexCredits) / this.creditValueBase) * 2),
                        enabled: true
                    },
                    PREMIUM_BRAIN_RANKING_21_DAYS: {
                        id: "PREMIUM_BRAIN_RANKING_21_DAYS",
                        name: "BRAIN Company’s 21 Day Machine Learning Estimated Return Ranking",
                        weight: 211538,
                        credits: Math.ceil(((211538 / this.dollarOfIexCredits) / this.creditValueBase) * 2),
                        enabled: true
                    },
                    PREMIUM_BRAIN_LANGUAGE_METRICS_ALL: {
                        id: "PREMIUM_BRAIN_LANGUAGE_METRICS_ALL",
                        name: "BRAIN Company’s Language Metrics on Company Filings (Quarterly and Annual)",
                        weight: 218254,
                        credits: Math.ceil(((218254 / this.dollarOfIexCredits) / this.creditValueBase) * 2),
                        enabled: true
                    },
                    STOCKTWITS_SENTIMENT: {
                        id: "STOCKTWITS_SENTIMENT",
                        name: "Stocktwits Sentiment",
                        weight: 750000,
                        credits: Math.ceil(((750000 / this.dollarOfIexCredits) / this.creditValueBase) * 2),
                        enabled: true
                    },
                    PREMIUM_PRECISION_ALPHA_PRICE_DYNAMICS: {
                        id: "PREMIUM_PRECISION_ALPHA_PRICE_DYNAMICS",
                        name: "Precision alpha price dynamics",
                        weight: 350000,
                        credits: Math.ceil(((350000 / this.dollarOfIexCredits) / this.creditValueBase) * 2),
                        enabled: true
                    },
                    EXTRACT_ALPHA_CROSS_ASSET_MODEL: {
                        id: "EXTRACT_ALPHA_CROSS_ASSET_MODEL",
                        name: "Extract Alpha Cross-Asset Model",
                        weight: 76190,
                        credits: Math.ceil(((76190 / this.dollarOfIexCredits) / this.creditValueBase) * 2),
                        enabled: true
                    },
                    EXTRACT_ALPHA_TACTICAL_MODEL: {
                        id: "EXTRACT_ALPHA_TACTICAL_MODEL",
                        name: "Extract Alpha Tactical Model",
                        weight: 42850,
                        credits: Math.ceil(((42850 / this.dollarOfIexCredits) / this.creditValueBase) * 2),
                        enabled: true
                    },
                    TOP_ANALYSTS_SCORES: {
                        id: "TOP_ANALYSTS_SCORES",
                        name: "Top Analyst Scoring System",
                        weight: null,
                        credits: 100,
                        enabled: true
                    }
                });
            }
            return null;
        }).catch(err => err);
    }
    getProducts() {
        return this.db.collection(this.appCollection).doc(this.productsDoc).get()
            .then(snapshot => {
            let products = [];
            if (snapshot) {
                let data = snapshot.data();
                for (let d in data) {
                    if (data.hasOwnProperty(d)) {
                        products.push(data[d]);
                    }
                }
            }
            return products;
        });
    }
    getPremiumPackages() {
        return this.db.collection(this.appCollection).doc(this.premiumPackagesDoc).get()
            .then(snapshot => {
            let premiumPackages = [];
            if (snapshot) {
                let data = snapshot.data();
                for (let d in data) {
                    if (data.hasOwnProperty(d)) {
                        premiumPackages.push(data[d]);
                    }
                }
            }
            return premiumPackages;
        });
    }
    getPremiumPackageById(packageId) {
        return this.db.collection(this.appCollection).doc(this.premiumPackagesDoc).get()
            .then(snapshot => {
            if (snapshot) {
                let data = snapshot.data();
                for (let d in data) {
                    if (data.hasOwnProperty(d) && data[d].id == packageId) {
                        return data[d];
                    }
                }
            }
            return null;
        }).catch();
    }
    getProductById(productid) {
        return this.db.collection(this.appCollection).doc(this.productsDoc).get()
            .then(snapshot => {
            if (snapshot) {
                let data = snapshot.data();
                for (let d in data) {
                    if (data.hasOwnProperty(d) && data[d].id == productid) {
                        return data[d];
                    }
                }
            }
            return null;
        }).catch();
    }
    setFirstScheduledUpdateDone(firstScheduledUpdateDone) {
        return this.db.collection(this.appCollection).doc(this.generalDoc).set({
            firstScheduledUpdateDone: firstScheduledUpdateDone,
            firstScheduledUpdateDate: Utilities_1.default.convertUnixTimestampToDateString(Date.now())
        }).catch();
    }
    wasFirstScheduledUpdateDone() {
        return this.db.collection(this.appCollection).doc(this.generalDoc).get()
            .then(snapshot => {
            const data = snapshot.data();
            if (data && data.hasOwnProperty("firstScheduledUpdateDone")) {
                return data.firstScheduledUpdateDone;
            }
            return false;
        });
    }
    getTipranksFetchCounter() {
        return this.db.collection(this.appCollection).doc(this.generalDoc).get()
            .then(snapshot => {
            let c = snapshot.get(this.tipranksFetchCounterField);
            if (c == null) {
                return 0;
            }
            return c;
        });
    }
    setTipranksFetchCounter(counter) {
        return this.db.collection(this.appCollection).doc(this.generalDoc).set({ [this.tipranksFetchCounterField]: counter }, { merge: true }).catch();
    }
}
exports.default = AppDao;
AppDao.appDaoInstance = new AppDao();
//# sourceMappingURL=AppDao.js.map