"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config/config");
const delay = require("delay");
const Utilities_1 = require("../utils/Utilities");
const fetch = require('node-fetch');
const fetchRetry = require('fetch-retry')(fetch);
class IexDataService {
    constructor() {
        this.sandboxURL = "https://sandbox.iexapis.com/stable";
        this.cloudURL = "https://cloud.iexapis.com/stable";
        this.timeout = 100;
        this.maxAllowedSymbols = 100;
        this.allowedTypes = ["cs", "et", "adr"]; //our app only deals with common stock and etfs
        this.peersEndpoint = 'peers';
        this.companyEndpoint = 'company';
        this.logoEndpoint = 'logo';
        this.earningsEndpoint = 'earnings';
        this.estimatesEndpoint = 'estimates';
        this.balanceSheetEndpoint = 'balance-sheet';
        this.cashFlowEndpoint = 'cash-flow';
        this.incomeEndpoint = 'income';
        this.newsEndpoint = 'news';
        this.advancedStatsEndpoint = 'advanced-stats';
        this.keyStatsEndpoint = 'stats';
        this.priceTargetEndpoint = 'price-target';
        this.recommendationsEndpoint = 'recommendation-trends';
        this.insiderSummaryEndpoint = 'insider-summary';
        this.sectorPerformanceEndpoint = 'sector-performance';
        this.gainersEndpoint = "gainers";
        this.losersEndpoint = "losers";
        this.mostActiveEndpoint = "mostactive";
        //economy
        this.retailMoneyFundsEndpoint = 'WRMFSL'; //weekly, billions
        this.institutionalMoneyFundsEndpoint = 'WIMFSL'; //weekly, billions
        this.initialClaimsEndpoint = 'IC4WSA'; //weekly (sat), number of claims
        this.recessionEndpoint = 'RECPROUSM156N'; //monthly, probability decimal
        this.unemploymentEndpoint = 'UNRATE'; //monthly, percent
        this.fedFundsRateEndpoint = 'FEDFUNDS'; //monthly, rate
        this.cpiEndpoint = 'CPIAUCSL'; //monthly, consumer price index
        this.ipiEndpoint = 'INDPRO'; //monthly, industrical production index
        this.realgdpEndpoint = 'A191RL1Q225SBEA'; //quarterly, latest quarter gdp growth
        //premium endpoints
        this.brain30SentimentEndpoint = 'PREMIUM_BRAIN_SENTIMENT_30_DAYS';
        this.kscoreEndpoint = 'PREMIUM_KAVOUT_KSCORE';
        this.stocktwitsSentimentEndpoint = 'sentiment';
        this.brain21RankingEndpoint = 'PREMIUM_BRAIN_RANKING_21_DAYS';
        this.brainLanguageEndpoint = 'PREMIUM_BRAIN_LANGUAGE_METRICS_ALL';
        this.precisionAlpha = 'PREMIUM_PRECISION_ALPHA_PRICE_DYNAMICS';
        this.crossAsset = "PREMIUM_EXTRACT_ALPHA_CAM";
        this.tacticalModel = "PREMIUM_EXTRACT_ALPHA_TM";
        this.configuredUrl = this.sandboxURL;
        this.configuredToken = process.env.IEX_TOKEN_DEV;
        this.secretToken = process.env.IEX_TOKEN_SECRET;
        if (config_1.default.production) {
            this.configuredUrl = this.cloudURL;
            this.configuredToken = process.env.IEX_TOKEN_PROD;
        }
    }
    static getIexDataServiceInstance() {
        return this.iexDataServiceInstance;
    }
    getAccountMetadata() {
        const url = `${this.configuredUrl}/account/metadata?token=${this.configuredToken}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data) => {
            return data;
        }).catch();
    }
    /* Can be used to retrieve any single data object for a single symbol, so won't work for the period based endpoints
     * Works for: company, logo, peers (returns a single array, but that's ok), stats, advanced-stats, price-target
     * Shouldn't be used for: news, balance-sheet, cash-flow, earnings, income, recommendations-trends, estimates,
     */
    getSimpleDatatypeForSymbol(symbol, datatype) {
        const url = `${this.configuredUrl}/stock/${symbol}/${datatype}?token=${this.configuredToken}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data) => {
            return data;
        }).catch();
    }
    getPremiumDatatypeForSymbol(symbol, datatype) {
        let url = `${this.configuredUrl}/time-series/${datatype}/${symbol}?token=${this.configuredToken}`;
        if (datatype === this.stocktwitsSentimentEndpoint) {
            let today = Utilities_1.default.convertDateToDateStringNoSeparators(new Date());
            url = `${this.configuredUrl}/stock/${symbol}/sentiment/daily/${today}?token=${this.configuredToken}`;
        }
        return fetch(url)
            .then((res) => {
            return res.json();
        })
            .then((data) => {
            return data;
        }).catch();
    }
    batchRequestMultipleEndpointsForSymbol(symbol, endpoints) {
        const url = `${this.configuredUrl}/stock/market/batch?symbols=${symbol}&types=${endpoints.toString()}&token=${this.configuredToken}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data) => data[symbol]).catch();
    }
    //url = `${this.configuredUrl}/stock/market/batch?symbols=${symbolsSubset}&types=chart&range=date&exactDate=20200526&chartCloseOnly=true&chartByDay=true&token=${this.configuredToken}`
    //url should not include symbols because those will be added to the end of the url in subsets by this function
    fetchDataForMoreThanMaxAllowedSymbols(symbols, url) {
        return new Promise((resolve, reject) => {
            const total = symbols.length;
            let currentProgress = 0;
            let timeoutCounter = 0;
            let combinedResult = {};
            const maxRetries = 3;
            for (let i = 0; i < symbols.length; i += this.maxAllowedSymbols) {
                timeoutCounter += 1;
                setTimeout(() => {
                    let symbolsSubset = new Array();
                    if ((i + 99) > symbols.length) {
                        symbolsSubset = symbols.slice(i, symbols.length);
                    }
                    else {
                        symbolsSubset = symbols.slice(i, i + this.maxAllowedSymbols);
                    }
                    fetchRetry(`${url}&symbols=${symbolsSubset}`, {
                        retries: maxRetries,
                        retryDelay: 100 * timeoutCounter,
                        retryOn: function (attempt, error, response) {
                            if (attempt <= maxRetries && (error !== null || response.status >= 400)) {
                                // console.log(`retrying ${i + 1} - ${i + symbolsSubset.length}`);
                                return true;
                            }
                            return false;
                        }
                    })
                        .then((res) => {
                        return res.json();
                    })
                        .then((json) => {
                        // console.log(`fetched ${i + 1} - ${i + symbolsSubset.length}`)
                        currentProgress += symbolsSubset.length;
                        combinedResult = Object.assign(Object.assign({}, combinedResult), json);
                        if (currentProgress >= total) {
                            console.log(`done...fetched ${currentProgress} stocks`);
                            resolve(combinedResult);
                        }
                    }).catch((error) => {
                        console.log(`error fetching ${i + 1} - ${i + symbolsSubset.length}`);
                    });
                }, this.timeout * timeoutCounter);
            }
        });
    }
    // Returns object where keys are symbols and values are the corresponding stats object 
    getDataTypeForSymbols(symbols, dataType, dataTypeKey) {
        if (symbols.length > this.maxAllowedSymbols) {
            const url = `${this.configuredUrl}/stock/market/batch?types=${dataType}&token=${this.configuredToken}`;
            return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then((data) => {
                const simplifiedData = {};
                for (const symbol of Object.keys(data)) {
                    simplifiedData[symbol] = data[symbol][dataTypeKey];
                }
                return simplifiedData;
            }).catch();
        }
        else {
            const url = `${this.configuredUrl}/stock/market/batch?types=${dataType}&token=${this.configuredToken}&symbols=${symbols}`;
            return fetch(url)
                .then((res) => res.json())
                .then((data) => {
                const simplifiedData = {};
                for (const symbol of Object.keys(data)) {
                    simplifiedData[symbol] = data[symbol][dataTypeKey];
                }
                return simplifiedData;
            }).catch();
        }
    }
    getSectorPerformance() {
        const url = `${this.configuredUrl}/stock/market/${this.sectorPerformanceEndpoint}?token=${this.configuredToken}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data) => {
            return data;
        });
    }
    // Returns single quote object with symbol as a field
    getLatestQuoteForSymbol(symbol) {
        const url = `${this.configuredUrl}/stock/${symbol}/quote?token=${this.configuredToken}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data) => {
            return data;
        });
    }
    async getIntradayPricesForSymbol(symbol, last = null) {
        let url = `${this.configuredUrl}/stock/${symbol}/intraday-prices?chartIEXOnly=true&token=${this.configuredToken}`;
        if (last !== null) {
            url = `${url}&chartLast=${last}`;
        }
        if (Date.now() - IexDataService.timeOfLastFetch <= IexDataService.rateLimitPerMs) {
            await new Promise(resolve => setTimeout(resolve, IexDataService.rateLimitPerMs * 2));
        }
        IexDataService.timeOfLastFetch = Date.now();
        return fetch(url)
            .then((res) => res.json())
            .then((data) => {
            return data;
        });
    }
    getCompanyLogoPeersForSymbols(symbols) {
        if (symbols.length > this.maxAllowedSymbols) {
            const url = `${this.configuredUrl}/stock/market/batch?types=company,logo,peers&token=${this.configuredToken}`;
            return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then(data => {
                return data;
            }).catch();
        }
        else {
            const url = `${this.configuredUrl}/stock/market/batch?types=company,logo,peers&token=${this.configuredToken}&symbols=${symbols}`;
            return fetch(url)
                .then((res) => res.json())
                .then((data) => {
                return data;
            }).catch();
        }
    }
    // Returns object where the keys are the symbol and values are the latest quote
    // With test data: seems to take about a second per 100 symbols -> 8 seconds for all stocks
    getLatestQuoteForSymbols(symbols) {
        if (symbols.length > this.maxAllowedSymbols) {
            const url = `${this.configuredUrl}/stock/market/batch?types=quote,intraday-prices&chartIEXOnly=true&chartSimplify=true&token=${this.configuredToken}`;
            return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then(data => {
                return data;
            }).catch();
        }
        else {
            const url = `${this.configuredUrl}/stock/market/batch?types=quote,intraday-prices&chartIEXOnly=true&chartSimplify=true&token=${this.configuredToken}&symbols=${symbols}`;
            return fetch(url)
                .then((res) => res.json()).catch()
                .then((data) => {
                return data;
            }).catch();
        }
    }
    getSimplifiedChartForSymbols(symbols, maxDataPoints) {
        if (symbols.length > this.maxAllowedSymbols) {
            const url = `${this.configuredUrl}/stock/market/batch?types=intraday-prices&chartIEXOnly=true&&token=${this.configuredToken}`;
            return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then((data) => {
                let returnData = {};
                for (let key in data) {
                    if (data.hasOwnProperty(key)) {
                        let prices = data[key]["intraday-prices"];
                        let nonNullCloses = [];
                        var delta = Math.floor(prices.length / maxDataPoints);
                        if (delta <= 0) {
                            delta = 1;
                        }
                        for (let i = 0; i < prices.length; i = i + delta) {
                            if (prices[i] && prices[i].close) {
                                nonNullCloses.push({
                                    minute: prices[i].minute,
                                    close: prices[i].close
                                });
                            }
                        }
                        returnData[key] = nonNullCloses;
                    }
                }
                return returnData;
            }).catch();
        }
        else {
            const url = `${this.configuredUrl}/stock/market/batch?types=intraday-prices&chartIEXOnly=true&token=${this.configuredToken}&symbols=${symbols}`;
            return fetch(url)
                .then((res) => res.json()).catch()
                .then((data) => {
                let returnData = {};
                for (let key in data) {
                    if (data.hasOwnProperty(key)) {
                        let prices = data[key]["intraday-prices"];
                        let nonNullCloses = [];
                        var delta = Math.floor(prices.length / maxDataPoints);
                        if (delta == 0) {
                            delta = 1;
                        }
                        for (let i = 0; i < prices.length; i = i + delta) {
                            if (prices[i].close) {
                                nonNullCloses.push({
                                    minute: prices[i].minute,
                                    close: prices[i].close
                                });
                            }
                        }
                        returnData[key] = nonNullCloses;
                    }
                }
                return returnData;
            }).catch();
        }
    }
    getJustLatestQuoteForSymbols(symbols) {
        if (symbols.length > this.maxAllowedSymbols) {
            const url = `${this.configuredUrl}/stock/market/batch?types=quote&token=${this.configuredToken}`;
            return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then((data) => {
                let returnData = [];
                let d;
                for (d of Object.values(data)) {
                    returnData.push(d.quote);
                }
                return returnData;
            }).catch();
        }
        else {
            const url = `${this.configuredUrl}/stock/market/batch?types=quote&token=${this.configuredToken}&symbols=${symbols}`;
            return fetch(url)
                .then((res) => res.json()).catch(err => {
                return {};
            })
                .then((data) => {
                let returnData = [];
                let d;
                for (d of Object.values(data)) {
                    returnData.push(d.quote);
                }
                return returnData;
            }).catch();
        }
    }
    getEarningsForSymbol(symbol, limit) {
        return this.getStockInfoForArrayTypeEndpoints(symbol, this.earningsEndpoint, limit);
    }
    getQuarterlyFinancialDataForSymbols(symbols, limit) {
        const endpoints = ["earnings", "advanced-stats", "cash-flow", "income"];
        if (symbols.length > this.maxAllowedSymbols) {
            const url = `${this.configuredUrl}/stock/market/batch?types=${endpoints}&last=${limit}&token=${this.configuredToken}`;
            return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then(data => {
                return this.simplifyBatchResultObjectsForArrayType(data, endpoints);
            }).catch();
        }
        else {
            const url = `${this.configuredUrl}/stock/market/batch?types=${endpoints}&last=${limit}&token=${this.configuredToken}&symbols=${symbols}`;
            return fetch(url)
                .then((res) => res.json())
                .then((data) => {
                return this.simplifyBatchResultObjectsForArrayType(data, endpoints);
            }).catch();
        }
    }
    // public getEarningsForSymbols(symbols:string[], limit:number){
    //     if (symbols.length > this.maxAllowedSymbols) {
    //         const url = `${this.configuredUrl}/stock/market/batch?types=earnings&last=${limit}&token=${this.configuredToken}`
    //         return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then(data => {
    //             return this.simplifyBatchResultObjectForArrayType(data, 'earnings')
    //         }).catch()
    //     } else {
    //         const url = `${this.configuredUrl}/stock/market/batch?types=earnings&last=${limit}&token=${this.configuredToken}&symbols=${symbols}`
    //         return fetch(url)
    //             .then((res: { json: () => any; }) => res.json())
    //             .then((data: any) => {
    //                 return this.simplifyBatchResultObjectForArrayType(data, 'earnings')
    //             }).catch()
    //     }
    // }
    // Returns array of previous day quote info objects. Each object contains the "symbol" field
    // public getAdjustedCloseForAllSymbolsInIEX() {
    //     const url = `${this.configuredUrl}/stock/market/batch?types=previous&token=${this.configuredToken}`
    //     return fetch(url).then((res: { json: () => any; }) => res.json())
    //         .then((data: any) => {
    //             return data.previous
    //         })
    // }
    // Returns array of strings which represent the common stock and ETFs. There are about 7000 of these
    getAllSymbolsInIEX() {
        const url = `${this.configuredUrl}/ref-data/symbols?token=${this.configuredToken}`;
        const stockArray = [];
        return fetch(url)
            .then((res) => res.json())
            .then((json) => {
            for (const stock of json) {
                if (this.allowedTypes.includes(stock.type) && stock.isEnabled && !stock.symbol.includes(".")) {
                    stockArray.push(stock.symbol);
                }
            }
            return stockArray;
        });
    }
    // Returns single stats object without symbol field
    // public getKeyStatsForSymbol(symbol: string) {
    //     const url = `${this.configuredUrl}/stock/${symbol}/stats?token=${this.configuredToken}`
    //     return fetch(url)
    //         .then((res: { json: () => any; }) => res.json())
    //         .then((json: any) => {
    //             return json
    //         })
    // }
    // Returns object where keys are symbols and values are the corresponding stats object 
    getKeyStatsForSymbols(symbols) {
        return this.getDataTypeForSymbols(symbols, this.keyStatsEndpoint, this.keyStatsEndpoint);
    }
    getPriceTargetsForSymbols(symbols) {
        return this.getDataTypeForSymbols(symbols, this.priceTargetEndpoint, this.priceTargetEndpoint);
    }
    getRecommendationsForSymbols(symbols) {
        return this.getDataTypeForSymbols(symbols, this.recommendationsEndpoint, this.recommendationsEndpoint).then(recs => {
            const returnRecs = {};
            for (const symbol of Object.keys(recs)) {
                if (recs[symbol].length) {
                    returnRecs[symbol] = recs[symbol][0];
                }
            }
            return returnRecs;
        });
    }
    // Returns single company object without symbol field
    getCompany(symbol) {
        const url = `${this.configuredUrl}/stock/${symbol}/company?token=${this.configuredToken}`;
        return fetch(url)
            .then((res) => res.json())
            .then((json) => {
            return json;
        }).catch();
    }
    // public getNewsForSymbol(symbol:string, limit:number){
    //     const url = `${this.configuredUrl}/stock/${symbol}/news?last=${limit}&token=${this.configuredToken}`
    //     return fetch(url)
    //         .then((res: { json: () => any; }) => res.json())
    //         .then((json: any) => {
    //             return json
    //         }).catch()
    // }
    addEconomyArrayDataToAggregate(aggregatedObject, key, data) {
        for (let d of data) {
            let dateTimestamp = d.date;
            //sandbox doesnt have the date field so we have to use "updated" for testing
            if (!dateTimestamp) {
                dateTimestamp = d.updated;
            }
            if (dateTimestamp) {
                const dateString = Utilities_1.default.convertUnixTimestampToDateString(dateTimestamp);
                if (!aggregatedObject.hasOwnProperty(dateString)) {
                    aggregatedObject[dateString] = {};
                    aggregatedObject[dateString].id = dateString;
                }
                aggregatedObject[dateString][key] = d.value;
            }
        }
        return aggregatedObject;
    }
    getWeeklyEconomicData(init = false) {
        const todayString = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        let fromTo = "";
        if (init) {
            fromTo += `&from=2010-01-01&to=${todayString}`;
        }
        const endpoint = "time-series/economic";
        let aggregatedObject = {};
        let url = `${this.configuredUrl}/${endpoint}/${this.retailMoneyFundsEndpoint}?token=${this.configuredToken}${fromTo}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data1) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "retailMoneyFunds", data1);
            url = `${this.configuredUrl}/${endpoint}/${this.institutionalMoneyFundsEndpoint}?token=${this.configuredToken}${fromTo}`;
            return delay(100).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data2) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "institutionalMoneyFunds", data2);
            url = `${this.configuredUrl}/${endpoint}/${this.initialClaimsEndpoint}?token=${this.configuredToken}${fromTo}`;
            return delay(100).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data3) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "initialClaims", data3);
            return Object.values(aggregatedObject);
        });
    }
    getMonthlyEconomicData(init = false) {
        const todayString = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        let fromTo = "";
        if (init) {
            fromTo += `&from=2010-01-01&to=${todayString}`;
        }
        const endpoint = "time-series/economic";
        let aggregatedObject = {};
        let url = `${this.configuredUrl}/${endpoint}/${this.recessionEndpoint}?token=${this.configuredToken}${fromTo}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data1) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "recessionProbability", data1);
            url = `${this.configuredUrl}/${endpoint}/${this.unemploymentEndpoint}?token=${this.configuredToken}${fromTo}`;
            return delay(1000).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data2) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "unemploymentPercent", data2);
            url = `${this.configuredUrl}/${endpoint}/${this.fedFundsRateEndpoint}?token=${this.configuredToken}${fromTo}`;
            return delay(1000).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data3) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "fedFundsRate", data3);
            url = `${this.configuredUrl}/${endpoint}/${this.cpiEndpoint}?token=${this.configuredToken}${fromTo}`;
            return delay(1000).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data4) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "consumerPriceIndex", data4);
            url = `${this.configuredUrl}/${endpoint}/${this.ipiEndpoint}?token=${this.configuredToken}${fromTo}`;
            return delay(1000).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data5) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "industrialProductionIndex", data5);
            return Object.values(aggregatedObject);
        });
    }
    getQuarterlyEconomicData(init = false) {
        const todayString = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        let fromTo = "";
        if (init) {
            fromTo += `&from=2010-01-01&to=${todayString}`;
        }
        let aggregatedObject = {};
        const url = `${this.configuredUrl}/time-series/economic/${this.realgdpEndpoint}?token=${this.configuredToken}${fromTo}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "realGDP", data);
            return Object.values(aggregatedObject);
        });
    }
    // public getMarketNews(limit:number){
    //     const url = `${this.configuredUrl}/time-series/${this.newsEndpoint}?limit=${limit}&token=${this.configuredToken}`
    //     return fetch(url)
    //     .then((res: { json: () => any; }) => res.json())
    //     .then((data: any) => {
    //         return data
    //     })
    // }
    getListType(endpoint) {
        const url = `${this.configuredUrl}/stock/market/list/${endpoint}?token=${this.configuredToken}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data) => data).catch();
    }
    // Returns async function that returns array of objects of whatever infotype is requested
    getStockInfoForArrayTypeEndpoints(symbol, infoType, limit) {
        let infoTypeKey = infoType;
        const url = `${this.configuredUrl}/stock/${symbol}/${infoType}?last=${limit}&token=${this.configuredToken}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data) => {
            if (infoType.includes('-')) {
                infoTypeKey = infoType.replace('-', '');
            }
            if (data.hasOwnProperty(infoTypeKey) && data[infoTypeKey].length > 0) {
                return data[infoTypeKey];
            }
            return [];
        }).catch();
    }
    /*  IEX endpoints that just get a single type of data (like quote) for multiple stocks
        will return something like "MSFT": { "quote": { ... } }. This function removes the
        inner data type key because it isn't necessary. The object returned by this function
        will look like "MSFT: { ... } */
    simplifyBatchResultObjectForNonArrayType(data, endpoint) {
        const simplifiedData = {};
        for (const symbol of Object.keys(data)) {
            simplifiedData[symbol] = data[symbol][endpoint];
        }
        return simplifiedData;
    }
    simplifyBatchResultObjectForArrayType(data, endpoint) {
        const simplifiedData = {};
        for (const symbol of Object.keys(data)) {
            simplifiedData[symbol] = data[symbol][endpoint][endpoint];
        }
        return simplifiedData;
    }
    simplifyBatchResultObjectsForArrayType(data, endpoints) {
        const simplifiedData = {};
        for (const symbol of Object.keys(data)) {
            simplifiedData[symbol] = {};
            for (const endpoint of endpoints) {
                if (endpoint === "advanced-stats") {
                    simplifiedData[symbol][endpoint] = [data[symbol][endpoint]];
                }
                else if (endpoint === "cash-flow") {
                    simplifiedData[symbol][endpoint] = data[symbol][endpoint]["cashflow"];
                }
                else {
                    simplifiedData[symbol][endpoint] = data[symbol][endpoint][endpoint];
                }
            }
        }
        return simplifiedData;
    }
}
exports.default = IexDataService;
IexDataService.iexDataServiceInstance = new IexDataService();
IexDataService.timeOfLastFetch = 0;
IexDataService.rateLimitPerMs = 10;
//# sourceMappingURL=IexDataService.js.map