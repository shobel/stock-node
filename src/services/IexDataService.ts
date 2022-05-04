import Config from '../config/config'
import delay = require('delay');
import Utilities from '../utils/Utilities';
const fetch = require('node-fetch');
const fetchRetry = require('fetch-retry')(fetch);

export default class IexDataService {

    private configuredUrl:any 
    private configuredToken:any
    private secretToken:any

    private sandboxURL = "https://sandbox.iexapis.com/stable"
    private cloudURL = "https://cloud.iexapis.com/stable"
    private timeout:number = 200
    private maxAllowedSymbols:number = 100

    private allowedTypes = ["cs", "et", "adr"] //our app only deals with common stock and etfs

    public peersEndpoint = 'peers'
    public companyEndpoint = 'company'
    public logoEndpoint = 'logo'
    public earningsEndpoint = 'earnings'
    public estimatesEndpoint = 'estimates'
    public balanceSheetEndpoint = 'balance-sheet'
    public cashFlowEndpoint = 'cash-flow'
    public incomeEndpoint = 'income'
    public newsEndpoint = 'news'
    public advancedStatsEndpoint = 'advanced-stats'
    public keyStatsEndpoint = 'stats'
    public priceTargetEndpoint = 'price-target'
    public recommendationsEndpoint = 'recommendation-trends'
    public insiderSummaryEndpoint = 'insider-summary'
    public sectorPerformanceEndpoint = 'sector-performance'
    public gainersEndpoint = "gainers"
    public losersEndpoint = "losers"
    public mostActiveEndpoint = "mostactive"

    //economy
    public retailMoneyFundsEndpoint = 'WRMFSL'          //weekly, billions
    public institutionalMoneyFundsEndpoint = 'WIMFSL'   //weekly, billions
    public initialClaimsEndpoint = 'IC4WSA'             //weekly (sat), number of claims
    public recessionEndpoint = 'RECPROUSM156N'          //monthly, probability decimal
    public unemploymentEndpoint = 'UNRATE'              //monthly, percent
    public fedFundsRateEndpoint = 'FEDFUNDS'            //monthly, rate
    public cpiEndpoint = 'CPIAUCSL'                     //monthly, consumer price index
    public ipiEndpoint = 'INDPRO'                       //monthly, industrical production index
    public realgdpEndpoint = 'A191RL1Q225SBEA'          //quarterly, latest quarter gdp growth

    //premium endpoints
    public brain30SentimentEndpoint = 'PREMIUM_BRAIN_SENTIMENT_30_DAYS'
    public kscoreEndpoint = 'PREMIUM_KAVOUT_KSCORE'
    public stocktwitsSentimentEndpoint = 'sentiment'
    public brain21RankingEndpoint = 'PREMIUM_BRAIN_RANKING_21_DAYS'
    public brainLanguageEndpoint = 'PREMIUM_BRAIN_LANGUAGE_METRICS_ALL'
    public precisionAlpha = 'PREMIUM_PRECISION_ALPHA_PRICE_DYNAMICS'
    public crossAsset = "PREMIUM_EXTRACT_ALPHA_CAM"
    public tacticalModel = "PREMIUM_EXTRACT_ALPHA_TM"

    private static iexDataServiceInstance:IexDataService = new IexDataService()

    private static timeOfLastFetch:number = 0
    private static rateLimitPerMs:number = 10

    constructor(){
        this.configuredUrl = this.sandboxURL
        this.configuredToken = process.env.IEX_TOKEN_DEV
        this.secretToken = process.env.IEX_TOKEN_SECRET
        if (Config.production) {
            this.configuredUrl = this.cloudURL
            this.configuredToken = process.env.IEX_TOKEN_PROD
        }
    }

    public static getIexDataServiceInstance(){
        return this.iexDataServiceInstance
    }

    public getAccountMetadata(){
        const url = `${this.configuredUrl}/account/metadata?token=${this.configuredToken}`
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data: any) => {
            return data
        }).catch()
    }

    /* Can be used to retrieve any single data object for a single symbol, so won't work for the period based endpoints
     * Works for: company, logo, peers (returns a single array, but that's ok), stats, advanced-stats, price-target
     * Shouldn't be used for: news, balance-sheet, cash-flow, earnings, income, recommendations-trends, estimates,
     */
    public getSimpleDatatypeForSymbol(symbol:string, datatype:string){
        const url = `${this.configuredUrl}/stock/${symbol}/${datatype}?token=${this.configuredToken}`
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data: any) => {
            return data
        }).catch()
    }

    public getPremiumDatatypeForSymbol(symbol:string, datatype:string){
        let url = `${this.configuredUrl}/time-series/${datatype}/${symbol}?token=${this.configuredToken}`
        if (datatype === this.stocktwitsSentimentEndpoint){
            let today = Utilities.convertDateToDateStringNoSeparators(new Date())
            url = `${this.configuredUrl}/stock/${symbol}/sentiment/daily/${today}?token=${this.configuredToken}`
        }
        return fetch(url)
        .then((res:any) => {
            return res.json()
        })
        .then((data: any) => {
            return data
        }).catch()
    }

    public batchRequestMultipleEndpointsForSymbol(symbol:string, endpoints:string[]){
        const url = `${this.configuredUrl}/stock/market/batch?symbols=${symbol}&types=${endpoints.toString()}&token=${this.configuredToken}`
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data: any) => data[symbol]).catch()
    }

    //url = `${this.configuredUrl}/stock/market/batch?symbols=${symbolsSubset}&types=chart&range=date&exactDate=20200526&chartCloseOnly=true&chartByDay=true&token=${this.configuredToken}`
    //url should not include symbols because those will be added to the end of the url in subsets by this function
    private fetchDataForMoreThanMaxAllowedSymbols(symbols: string[], url: string) {
        return new Promise((resolve, reject) => {
            const total = symbols.length
            let currentProgress = 0
            let timeoutCounter = 0
            let combinedResult = {}
            const maxRetries = 5
            for (let i = 0; i < symbols.length; i += this.maxAllowedSymbols) {
                timeoutCounter += 1
                setTimeout(() => {
                    let symbolsSubset = new Array()
                    if ((i + 99) > symbols.length) {
                        symbolsSubset = symbols.slice(i, symbols.length)
                    } else {
                        symbolsSubset = symbols.slice(i, i + this.maxAllowedSymbols)
                    }
		    fetchRetry(`${url}&symbols=${symbolsSubset}`, {
                        retries: maxRetries,
                        retryDelay: 100 * timeoutCounter,
                        retryOn: function (attempt: number, error: null, response: { status: number }) {
                            if (attempt <= maxRetries && (error !== null || response.status >= 400)) {
                                console.log(`retrying ${i + 1} - ${i + symbolsSubset.length}`);
                                return true;
                            } else if (attempt > maxRetries) {
                                console.log(`not retrying ${i + 1} - ${i + symbolsSubset.length}; error: ${error}; response: ${response.status}`);
                                return false
                            }
                            return false
                        }
                    }).then((res: any) => {
                        return res.json()
                    }).then((json: any) => {
                        console.log(`fetched ${i + 1} - ${i + symbolsSubset.length}`)
                        currentProgress += symbolsSubset.length
                        combinedResult = { ...combinedResult, ...json }
                        if (currentProgress >= total) {
                            console.log(`done...fetched ${currentProgress} stocks`)
                            resolve(combinedResult)
                        }
                    }).catch((error: any) => {
                        // console.log(`failed: ${url}&symbols=${symbolsSubset}`)
                        console.log(`error fetching ${i + 1} - ${i + symbolsSubset.length}`)
                        currentProgress += symbolsSubset.length
                        if (currentProgress >= total) {
                            console.log(`done...fetched ${currentProgress} stocks`)
                            resolve(combinedResult)
                        }
                    })
                }, this.timeout * timeoutCounter)
            }
        })
    }

    // Returns object where keys are symbols and values are the corresponding stats object 
    public getDataTypeForSymbols(symbols:string[], dataType:string, dataTypeKey:string){
        if (symbols.length > this.maxAllowedSymbols) {
            const url = `${this.configuredUrl}/stock/market/batch?types=${dataType}&token=${this.configuredToken}`
            return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then((data: any) => {
                const simplifiedData: any = {}
                for (const symbol of Object.keys(data)) {
                    simplifiedData[symbol] = data[symbol][dataTypeKey]
                }
                return simplifiedData
            }).catch()
        } else {
            const url = `${this.configuredUrl}/stock/market/batch?types=${dataType}&token=${this.configuredToken}&symbols=${symbols}`
            return fetch(url)
                .then((res: { json: () => any; }) => res.json())
                .then((data: any) => {
                    const simplifiedData: any = {}
                    for (const symbol of Object.keys(data)) {
                        simplifiedData[symbol] = data[symbol][dataTypeKey]
                    }
                    return simplifiedData
                }).catch()
        }
    }

    public getSectorPerformance(){
        const url = `${this.configuredUrl}/stock/market/${this.sectorPerformanceEndpoint}?token=${this.configuredToken}`
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data: any) => {
            return data
        })
    }

    // Returns single quote object with symbol as a field
    public getLatestQuoteForSymbol(symbol: string) {
        const url = `${this.configuredUrl}/stock/${symbol}/quote?token=${this.configuredToken}`
        return fetch(url)
            .then((res: { json: () => any; }) => res.json())
            .then((data: any) => {
                return data
            })
    }

    public async getIntradayPricesForSymbol(symbol: string, last: any = null) {
        let url = `${this.configuredUrl}/stock/${symbol}/intraday-prices?chartIEXOnly=true&token=${this.configuredToken}`
        if (last !== null) {
            url = `${url}&chartLast=${last}`
        }
        if (Date.now() - IexDataService.timeOfLastFetch <= IexDataService.rateLimitPerMs) {
            await new Promise(resolve => setTimeout(resolve, IexDataService.rateLimitPerMs*2));
        } 
        IexDataService.timeOfLastFetch = Date.now()
        return fetch(url)
            .then((res: { json: () => any; }) => res.json())
            .then((data: any) => {
                return data
            })
    }

    public getCompanyLogoPeersForSymbols(symbols:string[]){
        if (symbols.length > this.maxAllowedSymbols) {
            const url = `${this.configuredUrl}/stock/market/batch?types=company,logo,peers&token=${this.configuredToken}`
            return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then(data => {
                return data
            }).catch()
        } else {
            const url = `${this.configuredUrl}/stock/market/batch?types=company,logo,peers&token=${this.configuredToken}&symbols=${symbols}`
            return fetch(url)
                .then((res: { json: () => any; }) => res.json())
                .then((data: any) => {
                    return data
                }).catch()
        }
    }

    // Returns object where the keys are the symbol and values are the latest quote
    // With test data: seems to take about a second per 100 symbols -> 8 seconds for all stocks
    public getLatestQuoteForSymbols(symbols: string[]) {
        if (symbols.length > this.maxAllowedSymbols) {
            const url = `${this.configuredUrl}/stock/market/batch?types=quote,intraday-prices&chartIEXOnly=true&chartSimplify=true&token=${this.configuredToken}`
            return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then(data => {
                return data
            }).catch()
        } else {
            const url = `${this.configuredUrl}/stock/market/batch?types=quote,intraday-prices&chartIEXOnly=true&chartSimplify=true&token=${this.configuredToken}&symbols=${symbols}`
            return fetch(url)
                .then((res: { json: () => any; }) => res.json()).catch()
                .then((data: any) => {
                    return data
                }).catch()
        }
    }

    public getSimplifiedChartForSymbols(symbols:string[], maxDataPoints:number){
        if (symbols.length > this.maxAllowedSymbols) {
            const url = `${this.configuredUrl}/stock/market/batch?types=intraday-prices&chartIEXOnly=true&&token=${this.configuredToken}`
            return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then((data:any) => {
                let returnData:any = {}
                for (let key in data){
                    if (data.hasOwnProperty(key)){
                        let prices = data[key]["intraday-prices"]
                        let nonNullCloses:any[] = []
                        var delta = Math.floor( prices.length / maxDataPoints )
                        if (delta <= 0){
                            delta = 1
                        }
                        for (let i = 0; i < prices.length; i=i+delta) {                            
                            if (prices[i] && prices[i].close) {
                                nonNullCloses.push({
                                    minute: prices[i].minute,
                                    close: prices[i].close
                                })                            
                            }
                        }
                        returnData[key] = nonNullCloses
                    }
                }
                return returnData         
            }).catch()
        } else {
            const url = `${this.configuredUrl}/stock/market/batch?types=intraday-prices&chartIEXOnly=true&token=${this.configuredToken}&symbols=${symbols}`
            return fetch(url)
                .then((res: { json: () => any; }) => res.json()).catch()
                .then((data: any) => {
                    let returnData:any = {}
                    for (let key in data){
                        if (data.hasOwnProperty(key)){
                            let prices = data[key]["intraday-prices"]
                            let nonNullCloses:any[] = []
                            var delta = Math.floor( prices.length / maxDataPoints )
                            if (delta == 0){
                                delta = 1
                            }
                            for (let i = 0; i < prices.length; i=i+delta) {                            
                                if (prices[i].close) {
                                    nonNullCloses.push({
                                        minute: prices[i].minute,
                                        close: prices[i].close
                                    })                            
                                }
                            }
                            returnData[key] = nonNullCloses
                        }
                    }
                    return returnData
                }).catch()
        }
    }

    public getJustLatestQuoteForSymbols(symbols: string[]) {
        if (symbols.length > this.maxAllowedSymbols) {
            const url = `${this.configuredUrl}/stock/market/batch?types=quote&token=${this.configuredToken}`
            return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then((data:any) => {
                let returnData:any[] = []
                let d:any
                for (d of Object.values(data)){
                    returnData.push(d.quote)
                }
                return returnData
            }).catch()
        } else {
            const url = `${this.configuredUrl}/stock/market/batch?types=quote&token=${this.configuredToken}&symbols=${symbols}`
            return fetch(url)
                .then((res: { json: () => any; }) => res.json()).catch(err => {
                    return {}
                })
                .then((data: any) => {
                    let returnData:any[] = []
                    let d:any
                    for (d of Object.values(data)){
                        returnData.push(d.quote)
                    }
                    return returnData
                }).catch()
        }
    }

    public getEarningsForSymbol(symbol:string, limit:number){
        return this.getStockInfoForArrayTypeEndpoints(symbol, this.earningsEndpoint, limit)
    }

    public getQuarterlyFinancialDataForSymbols(symbols:string[], limit:number){
        const endpoints = ["earnings", "advanced-stats", "cash-flow", "income"]
        if (symbols.length > this.maxAllowedSymbols) {
            const url = `${this.configuredUrl}/stock/market/batch?types=${endpoints}&last=${limit}&token=${this.configuredToken}`
            return this.fetchDataForMoreThanMaxAllowedSymbols(symbols, url).then(data => {
                return this.simplifyBatchResultObjectsForArrayType(data, endpoints)
            }).catch()
        } else {
            const url = `${this.configuredUrl}/stock/market/batch?types=${endpoints}&last=${limit}&token=${this.configuredToken}&symbols=${symbols}`
            return fetch(url)
                .then((res: { json: () => any; }) => res.json())
                .then((data: any) => {
                    return this.simplifyBatchResultObjectsForArrayType(data, endpoints)
                }).catch()
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
    public getAllSymbolsInIEX() {
        const url = `${this.configuredUrl}/ref-data/symbols?token=${this.configuredToken}`
        const stockArray: string[] = []
        return fetch(url)
            .then((res: { json: () => any; }) => res.json())
            .then((json: any) => {
                for (const stock of json) {
                    if (this.allowedTypes.includes(stock.type) && stock.isEnabled && !stock.symbol.includes(".")) {
                        stockArray.push(stock.symbol)
                    }
                }
                return stockArray
            })
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
    public getKeyStatsForSymbols(symbols:string[]){
        return this.getDataTypeForSymbols(symbols, this.keyStatsEndpoint, this.keyStatsEndpoint)
    }

    public getPriceTargetsForSymbols(symbols:string[]){
        return this.getDataTypeForSymbols(symbols, this.priceTargetEndpoint, this.priceTargetEndpoint)
    }

    public getRecommendationsForSymbols(symbols:string[]){
        return this.getDataTypeForSymbols(symbols, this.recommendationsEndpoint, this.recommendationsEndpoint).then(recs => {
            const returnRecs = {}
            for (const symbol of Object.keys(recs)){
                if (recs[symbol].length){
                    returnRecs[symbol] = recs[symbol][0]
                }
            }
            return returnRecs
        })
    }

    // Returns single company object without symbol field
    public getCompany(symbol: string) {
        const url = `${this.configuredUrl}/stock/${symbol}/company?token=${this.configuredToken}`
        return fetch(url)
            .then((res: { json: () => any; }) => res.json())
            .then((json: any) => {
                return json
            }).catch()
    }

    // public getNewsForSymbol(symbol:string, limit:number){
    //     const url = `${this.configuredUrl}/stock/${symbol}/news?last=${limit}&token=${this.configuredToken}`
    //     return fetch(url)
    //         .then((res: { json: () => any; }) => res.json())
    //         .then((json: any) => {
    //             return json
    //         }).catch()
    // }

    public addEconomyArrayDataToAggregate(aggregatedObject: any, key: string, data: any[]) {
        for (let d of data) {
            let dateTimestamp = d.date
            
            //sandbox doesnt have the date field so we have to use "updated" for testing
            if (!dateTimestamp) {
                dateTimestamp = d.updated
            }
            
            if (dateTimestamp) {
                const dateString = Utilities.convertUnixTimestampToDateString(dateTimestamp)
                if (!aggregatedObject.hasOwnProperty(dateString)) {
                    aggregatedObject[dateString] = {}
                    aggregatedObject[dateString].id = dateString
                }
                aggregatedObject[dateString][key] = d.value
            }
        }
        return aggregatedObject
    }

    public getWeeklyEconomicData(init:boolean = false){
        const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        let fromTo = ""
        if (init){
            fromTo += `&from=2010-01-01&to=${todayString}`
        }
        const endpoint = "time-series/economic"
        let aggregatedObject:any = {}
        let url = `${this.configuredUrl}/${endpoint}/${this.retailMoneyFundsEndpoint}?token=${this.configuredToken}${fromTo}`
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data1: any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "retailMoneyFunds", data1)
            url = `${this.configuredUrl}/${endpoint}/${this.institutionalMoneyFundsEndpoint}?token=${this.configuredToken}${fromTo}`
            return delay(100).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data2: any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "institutionalMoneyFunds", data2)
            url = `${this.configuredUrl}/${endpoint}/${this.initialClaimsEndpoint}?token=${this.configuredToken}${fromTo}`
            return delay(100).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data3: any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "initialClaims", data3)
            return Object.values(aggregatedObject)
        })
    }

    public getMonthlyEconomicData(init:boolean = false){
        const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        let fromTo = ""
        if (init){
            fromTo += `&from=2010-01-01&to=${todayString}`
        }
        const endpoint = "time-series/economic"
        let aggregatedObject:any = {}
        let url = `${this.configuredUrl}/${endpoint}/${this.recessionEndpoint}?token=${this.configuredToken}${fromTo}`
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data1: any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "recessionProbability", data1)
            url = `${this.configuredUrl}/${endpoint}/${this.unemploymentEndpoint}?token=${this.configuredToken}${fromTo}`
            return delay(1000).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data2: any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "unemploymentPercent", data2)
            url = `${this.configuredUrl}/${endpoint}/${this.fedFundsRateEndpoint}?token=${this.configuredToken}${fromTo}`
            return delay(1000).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data3: any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "fedFundsRate", data3)
            url = `${this.configuredUrl}/${endpoint}/${this.cpiEndpoint}?token=${this.configuredToken}${fromTo}`
            return delay(1000).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data4: any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "consumerPriceIndex", data4)
            url = `${this.configuredUrl}/${endpoint}/${this.ipiEndpoint}?token=${this.configuredToken}${fromTo}`
            return delay(1000).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data5:any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "industrialProductionIndex", data5)
            return Object.values(aggregatedObject)
        })
    }
    
    public getQuarterlyEconomicData(init: boolean = false){
        const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        let fromTo = ""
        if (init){
            fromTo += `&from=2010-01-01&to=${todayString}`
        }
        let aggregatedObject:any = {}
        const url = `${this.configuredUrl}/time-series/economic/${this.realgdpEndpoint}?token=${this.configuredToken}${fromTo}`
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data: any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "realGDP", data)
            return Object.values(aggregatedObject)
        })
    }

    // public getMarketNews(limit:number){
    //     const url = `${this.configuredUrl}/time-series/${this.newsEndpoint}?limit=${limit}&token=${this.configuredToken}`
    //     return fetch(url)
    //     .then((res: { json: () => any; }) => res.json())
    //     .then((data: any) => {
    //         return data
    //     })
    // }

    public getListType(endpoint:string) {
        const url = `${this.configuredUrl}/stock/market/list/${endpoint}?token=${this.configuredToken}`
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data: any) => data).catch()
    }

    // Returns async function that returns array of objects of whatever infotype is requested
    public getStockInfoForArrayTypeEndpoints(symbol:string, infoType:string, limit:number){
        let infoTypeKey = infoType
        const url = `${this.configuredUrl}/stock/${symbol}/${infoType}?last=${limit}&token=${this.configuredToken}`
        return fetch(url)
            .then((res: { json: () => any; }) => res.json())
            .then((data: any) => {
                if (infoType.includes('-')) {
                    infoTypeKey = infoType.replace('-','')
                }
                if (data.hasOwnProperty(infoTypeKey) && data[infoTypeKey].length > 0){
                    return data[infoTypeKey]
                }
                return []
            }).catch()
    }

    /*  IEX endpoints that just get a single type of data (like quote) for multiple stocks
        will return something like "MSFT": { "quote": { ... } }. This function removes the
        inner data type key because it isn't necessary. The object returned by this function
        will look like "MSFT: { ... } */ 
    private simplifyBatchResultObjectForNonArrayType(data:any, endpoint:string):any {
        const simplifiedData:any = {}
        for (const symbol of Object.keys(data)) {
            simplifiedData[symbol] = data[symbol][endpoint]
        }
        return simplifiedData
    }

    private simplifyBatchResultObjectForArrayType(data:any, endpoint:string){
        const simplifiedData:any = {}
        for (const symbol of Object.keys(data)) {
            simplifiedData[symbol] = data[symbol][endpoint][endpoint]
        }
        return simplifiedData
    }

    private simplifyBatchResultObjectsForArrayType(data:any, endpoints:string[]){
        const simplifiedData:any = {}
        for (const symbol of Object.keys(data)) {
            simplifiedData[symbol] = {}
            for (const endpoint of endpoints) {
                if (endpoint === "advanced-stats"){
                    simplifiedData[symbol][endpoint] = [data[symbol][endpoint]]
                } else if (endpoint === "cash-flow"){
                    simplifiedData[symbol][endpoint] = data[symbol][endpoint]["cashflow"]
                } else {
                    simplifiedData[symbol][endpoint] = data[symbol][endpoint][endpoint]
                }
            }
        }
        return simplifiedData
    }

}
