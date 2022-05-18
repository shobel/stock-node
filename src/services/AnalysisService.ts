import StockDao from "../dao/StockDao"
import Utilities from "../utils/Utilities"
import ChartDao from "../dao/ChartDao"
import MarketDao from "../dao/MarketDao"
import { QueryDocumentSnapshot } from "firebase-functions/v1/firestore"
import QuoteService from "./QuoteService"

export default class AnalysisService {
    //28 - 30 total variables
    //instead of industry and market, should compare to industry and sector

    //valuation (5)
        //-pe --- keystats
        //-epsTTM --- keystats
        //-ps --- advanced stats
        //-pb --- advanced stats
        //-price compared to fair value (requires DCF) ...dont really trust the dcf...

    //future growth (4)
        //-peg/future earnings for next few years --- advanced stats
        //-eps growth for next quarter --- earnings
        //-price targets --- priceTargets
        //-buy,hold,sell ratings (recommendations) --- recommendations

    //past performance (7)
        //-earnings (netIncome) growth (5 years) 
        //-revenue growth (5 years) 
        //-profit margin growth
        //-cashflow growth
        //-earnings growth rate
        //-revenue growth rate

    //financial health (8)
        //-roe (net income/equity where equity = assets - debt) --- income and balance sheet
        //-stability: (assets - liabilities) / liabilities --- balance sheets
        //-debt1: debt to equity --- advanced stats
        //-debt2: debt to assets --- advanced stats
        //-coverage: cashflow > debt --- cashflow and balance sheets
        //-dividend: dividend yield --- keystats
        //-institutional ownership change --- institutional

    //technicals (6)
        //-trends: short,medium,long term trends
        //-pressure: gaps
        //-support: smas, golden cross and death cross
        //-strength: rsi
        //-momentum: is average 10 volume higher than average 30 volume?
        //-safety: circuit breaker 

    //premium
        //kavout
        //sentiment from social media
        //**shorts: putcall ratio and/or scrape the short float from finviz

    private static stockDao:StockDao = StockDao.getStockDaoInstance()
    private static chartDao:ChartDao = ChartDao.getChartDaoInstance()
    private static marketDao:MarketDao = MarketDao.getMarketDaoInstance()

    public static valuationMetrics = ["peRatio", "epsTTM", "priceToSales", "priceToBook"]
    public static futureMetrics = ["futureRevenueGrowth", "futureIncomeGrowth", "pegRatio", "epsNextQGrowth", "priceTargetScore", "recommendationScore"]
    public static pastMetrics = ["avgRevenueGrowth", "avgIncomeGrowth", "revenueGrowthRate", "incomeGrowthRate", "cashFlowGrowth", "profitMarginGrowth"]
    public static healthMetrics = ["debtToAssets", "debtToEquity", "returnOnEquity", "tutes", "cashflowDebt", "dividendYield"]
    // public static technicalMetrics = ["trends", "pressure", "support", "strength", "momentum", "circuitBreaker"]
    public static lowerIsBetterMetrics = ["peRatio", "debtToAssets", "debtToEquity", "priceToSales", "priceToBool", "pegRatio", "priceFairValue", "recommendationScore"]

    public static variableNamesMap = {
        peRatio: "Price to Earnings",
        epsTTM: "Earnings Per Share",
        priceToSales: "Price To Sales",
        priceToBook: "Price To Book",
        pegRatio: "Quarter PEG Ratio",
        epsNextQGrowth: "EPS Growth Consensus",
        priceTargetScore: "Price Target Score",
        recommendationScore: "Analysts Actions",
        avgRevenueGrowth: "Avg Revenue Growth",
        avgIncomeGrowth: "Avg Income Growth",
        revenueGrowthRate: "Revenue Accel Rate",
        incomeGrowthRate: "Income Accel Rate",
        cashFlowGrowth: "Cashflow Growth",
        profitMarginGrowth: "Profit Margin Growth",
        debtToAssets: "Debt to Assets",
        debtToEquity: "Debt to Equity",
        returnOnEquity: "Return on Equity",
        tutes: "Institutional Change",
        cashflowDebt: "Cashflow to Debt",
        dividendYield: "Dividend Yield",
        futureRevenueGrowth: "Future Revenue Growth",
        futureIncomeGrowth: "Future Earnings Growth"
        // trends: "Price Trends",
        // pressure: "Gap Pressure",
        // support: "Support / Resistance",
        // strength: "Relative Strength Index",
        // momentum: "Volume Momentum",
        // circuitBreaker: "Short Sale Restricted"
    }

    public static getMetricsByCategory(){
        return {
            "Valuation": AnalysisService.valuationMetrics,
            "Future Growth": AnalysisService.futureMetrics,
            "Past Performance": AnalysisService.pastMetrics,
            "Financial Health": AnalysisService.healthMetrics,
            // "Technical Analysis": AnalysisService.technicalMetrics
        }
    }

    public static async doAnalysis() {
        let start = Date.now()
        let docSnaps:QueryDocumentSnapshot[] = AnalysisService.stockDao.getAllStockDocumentSnapshots() as QueryDocumentSnapshot[]

        //growth scores
        const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        const year = todayString.split("-")[0]
        const month = todayString.split("-")[1]
        const day = todayString.split("-")[2]
        const cutOffYear5 = parseInt(year) - 5
        const cutOffYear2 = parseInt(year) - 2
        const cutOffDate5 = `${cutOffYear5}-${month}-${day}`
        const cutOffDate2 = `${cutOffYear2}-${month}-${day}`
        const incomeStatements = StockDao.getStockDaoInstance().incomeGroupCache //await AnalysisService.stockDao.getDocumentsFromCollectionGroupWithDateCriteria(AnalysisService.stockDao.incomeCollection, "id", cutOffDate5, ">")
        const cashFlows = StockDao.getStockDaoInstance().cashFlowGroupCache //await AnalysisService.stockDao.getDocumentsFromCollectionGroupWithDateCriteria(AnalysisService.stockDao.cashFlowCollection, "id", cutOffDate5, ">")
        const earnings = StockDao.getStockDaoInstance().earningsCache //await AnalysisService.stockDao.getDocumentsFromCollectionGroupWithDateCriteria(AnalysisService.stockDao.earningsCollection, "id", todayString, ">")
        const advanced = StockDao.getStockDaoInstance().advancedGroupCache //await AnalysisService.stockDao.getDocumentsFromCollectionGroupWithDateCriteria(AnalysisService.stockDao.advancedStatsCollection, "id", cutOffDate5, ">")

        let end = Date.now()
        console.log(`ANALYSIS: ${(end - start) / 1000.0}s to get docs for all stocks`)
        
        const valuationCategoryArrays:{ [key:string]:string[] } = {}
        valuationCategoryArrays.valuation = AnalysisService.valuationMetrics
        valuationCategoryArrays.future = AnalysisService.futureMetrics
        valuationCategoryArrays.past = AnalysisService.pastMetrics
        valuationCategoryArrays.health = AnalysisService.healthMetrics
        const lowerIsBetterMetrics = AnalysisService.lowerIsBetterMetrics

        //init market metrics
        const marketMetrics:any = {}
        for (const arr of Object.values(valuationCategoryArrays)){
            for (const metric of arr){
                marketMetrics[metric] = []
            }
        }

        //top analysts
        let topAnalystSymbols = (await AnalysisService.marketDao.getTipranksTopSymbols()).map(snap => snap.data())
        let topAnalystMap:any = {}
        for (let analystData of topAnalystSymbols){
            topAnalystMap[analystData.symbol] = analystData
        }

        const symbolMetrics = {}
        const symbolIndustryMap = {}
        const industrySizeMap = {}
        start = Date.now()
        var snap:QueryDocumentSnapshot
        for (snap of docSnaps) {
            let company = snap.get("company")
            if (!company || !company.isCompany){
                continue
            }
            const symbol = company.symbol
            let quote = QuoteService.quoteCache[symbol]?.latestQuote
            if (!quote){
                continue
            }
            let as = snap.get(AnalysisService.stockDao.latestAdvancedStats)
            let bs = snap.get(AnalysisService.stockDao.latestQuarterlyBalanceSheet)
            let is = snap.get(AnalysisService.stockDao.latestQuarterlyIncome)
            let cf = snap.get(AnalysisService.stockDao.latestQuarterlyCashFlow)
            let pt = snap.get(AnalysisService.stockDao.latestPriceTarget)
            let rec = snap.get(AnalysisService.stockDao.latestRecommendations)
            let inst = snap.get(AnalysisService.stockDao.institutionalOwnership)
            let est = snap.get(AnalysisService.stockDao.latestAnnualEstimates)
            let incAnnual = snap.get(AnalysisService.stockDao.latestAnnualIncome)

            symbolIndustryMap[symbol] = company.industry
            industrySizeMap.hasOwnProperty(company.industry) ? industrySizeMap[company.industry] += 1 : industrySizeMap[company.industry] = 1
            symbolMetrics[symbol] = {}
            if (quote.pe && Utilities.isValidNumber(quote.pe) && quote.pe >= 0) {
                marketMetrics.peRatio.push(quote.pe)
                symbolMetrics[symbol].peRatio = quote.pe
            }
            if (quote.eps && Utilities.isValidNumber(quote.eps)) {
                marketMetrics.epsTTM.push(quote.eps)
                symbolMetrics[symbol].epsTTM = quote.eps
            }
            if (company.lastDiv && Utilities.isValidNumber(company.lastDiv) && company.lastDiv >= 0) {
                let divYield = company.lastDiv / quote.price
                marketMetrics.dividendYield.push(divYield)
                symbolMetrics[symbol].dividendYield = divYield
            }
            if (as && Utilities.isValidNumber(as.debtToAssets) && as.debtToAssets >= 0) {
                marketMetrics.debtToAssets.push(as.debtToAssets)
                symbolMetrics[symbol].debtToAssets = as.debtToAssets
            }
            if (as && Utilities.isValidNumber(as.debtToEquity) && as.debtToEquity >= 0) {
                marketMetrics.debtToEquity.push(as.debtToEquity)
                symbolMetrics[symbol].debtToEquity = as.debtToEquity
            }
            if (as && Utilities.isValidNumber(as.priceToSales) && as.priceToSales >= 0) {
                marketMetrics.priceToSales.push(as.priceToSales)
                symbolMetrics[symbol].priceToSales = as.priceToSales
            }
            if (as && Utilities.isValidNumber(as.priceToBook) && as.priceToBook >= 0) {
                marketMetrics.priceToBook.push(as.priceToBook)
                symbolMetrics[symbol].priceToBook = as.priceToBook
            }
            if (as && Utilities.isValidNumber(as.pegRatio)) {
                marketMetrics.pegRatio.push(as.pegRatio)
                symbolMetrics[symbol].pegRatio = as.pegRatio
            }

            if (bs && is){
                const roe = is.netIncome / (bs.totalAssets - bs.totalDebt)
                if (Utilities.isValidNumber(roe)){
                    marketMetrics.returnOnEquity.push(roe)
                    symbolMetrics[symbol].returnOnEquity = roe
                }
            }
            if (cf && bs){
                const cashflowDebt = (cf.cashFlow - bs.totalDebt) / bs.totalDebt 
                if (Utilities.isValidNumber(cashflowDebt)){
                    marketMetrics.cashflowDebt.push(cashflowDebt)
                    symbolMetrics[symbol].cashflowDebt = cashflowDebt
                }
            }
            //PRICE TARGET SCORE from IEX
            if (pt && pt.currency === "USD"){
                let latestPrice:any = null
                if (quote?.price != null) {
                    latestPrice = quote.price
                } else if (quote?.previousClose != null) {
                    latestPrice = quote.previousClose
                }
                if (latestPrice){
                    let pts = AnalysisService.computeScoreFromPriceTarget(latestPrice, pt)
                    if (topAnalystMap.hasOwnProperty(symbol)){
                        let topAnalystData = topAnalystMap[symbol]
                        if (topAnalystData.avgPriceTarget && topAnalystData.numAnalysts && topAnalystData.lowPriceTarget) {
                            let convertedObj = {
                                priceTargetAverage: topAnalystData.avgPriceTarget,
                                numberOfAnalysts: topAnalystData.numAnalysts,
                                priceTargetLow: topAnalystData.lowPriceTarget
                            }
                            const topPts = AnalysisService.computeScoreFromPriceTarget(latestPrice, convertedObj)
                            //give the top analyst 2x more weight than the other analysts
                            pts = (pts + (topPts*2)) / 2
                        }
                    }
                    if (Utilities.isValidNumber(pts)) {
                        marketMetrics.priceTargetScore.push(pts)
                        symbolMetrics[symbol].priceTargetScore = pts
                    }
                }
            }
            if (rec && Utilities.isValidNumber(rec.ratingScaleMark)){
                marketMetrics.recommendationScore.push(rec.ratingScaleMark)
                symbolMetrics[symbol].recommendationScore = rec.ratingScaleMark
            }

            //change in institutional ownership as percent of total, eg institutions raised ownership of company by x%
            //which is updated every quarter
            if (company && Utilities.isValidNumber(company.sharesOutstanding) && inst && Utilities.isValidNumber(inst.change)){
                marketMetrics.tutes.push(inst.change / company.sharesOutstanding)
                symbolMetrics[symbol].tutes = inst.change / company.sharesOutstanding
            }

            //next quarter eps compared to 1 year ago
            let earningsArray = earnings[symbol]
            if (earningsArray){
                earningsArray = earningsArray.reverse()
            }
            if (earningsArray && earningsArray.length > 0 && earningsArray[earningsArray.length - 1].id > todayString) {
                const consensusEPS = earningsArray[earningsArray.length - 1].consensusEPS
                const yearAgo = earningsArray[earningsArray.length - 1].yearAgo
                if (consensusEPS && yearAgo){
                    const epsGrowth = (consensusEPS - yearAgo) / yearAgo
                    if (Utilities.isValidNumber(epsGrowth)){
                        marketMetrics.epsNextQGrowth.push(epsGrowth)
                        symbolMetrics[symbol].epsNextQGrowth = epsGrowth
                    }
                }
            }

            //revenue and netincome cagr  (FV / PV) ^ (1/ t) - 1
            if (est && est.date && incAnnual && incAnnual.period){
                let futureYear = est.date.split("-")[0]
                let currentYear = incAnnual.period.split(" ")[1]
                let diff = parseInt(futureYear) - parseInt(currentYear)
                let revCagr = Math.pow(est.estimatedRevenueAvg / incAnnual.totalRevenue, 1/diff) - 1
                let incCagr = Math.pow(est.estimatedNetIncomeAvg / incAnnual.netIncome, 1/diff) - 1
                if (revCagr && Utilities.isValidNumber(revCagr)){
                    marketMetrics.futureRevenueGrowth.push(revCagr)
                    symbolMetrics[symbol].futureRevenueGrowth = revCagr
                }
                if (incCagr && Utilities.isValidNumber(incCagr)){
                    marketMetrics.futureIncomeGrowth.push(incCagr)
                    symbolMetrics[symbol].futureIncomeGrowth = incCagr
                }
            }

            //profit margin growth
            let advancedArray = advanced[symbol]
            if (advancedArray) {
                advancedArray = advancedArray.reverse()
            }
            AnalysisService.computeGrowthForMetric(symbol, "profitMarginGrowth", advancedArray, "profitMargin", marketMetrics, symbolMetrics, false, 20)

            //cashflow growth
            let cashflowArray = cashFlows[symbol]
            if (cashflowArray) {
                cashflowArray = cashflowArray.reverse()
            }
            AnalysisService.computeGrowthForMetric(symbol, "cashFlowGrowth", cashflowArray, "cashFlow", marketMetrics, symbolMetrics, false, 20)

            //revenue and income growth and growth rates
            let incomeStatementArray = incomeStatements[symbol]
            if (incomeStatementArray) {
                incomeStatementArray = incomeStatementArray.reverse()
            }
            AnalysisService.computeGrowthForMetric(symbol, "avgRevenueGrowth", incomeStatementArray, "totalRevenue", marketMetrics, symbolMetrics, true, 20, "revenueGrowthRate")
        AnalysisService.computeGrowthForMetric(symbol, "avgIncomeGrowth", incomeStatementArray, "netIncome", marketMetrics, symbolMetrics, true, 20, "incomeGrowthRate")

        }
        end = Date.now()
        console.log(`ANALYSIS: ${(end - start) / 1000.0}s for fundamental calculations`)
        start = Date.now()
        for (const metric of Object.keys(marketMetrics)) {
            if (marketMetrics[metric].length) {
                //marketMetrics[metric] = [...new Set(marketMetrics[metric])]
                marketMetrics[metric] = marketMetrics[metric].sort((a,b) => a - b)
                const medianIndex = Math.floor(marketMetrics[metric].length / 2)
                const medianValue = marketMetrics[metric][medianIndex]
                const upperHalf = marketMetrics[metric].slice(medianIndex + 1, marketMetrics[metric].length)
                const upperQuartileIndex = Math.floor(upperHalf.length / 2)
                const upperQuartileValue = upperHalf[upperQuartileIndex]
                const upperQuartileRange = upperQuartileValue - medianValue
                const lowerHalf = marketMetrics[metric].slice(0, medianIndex)
                const lowerQuartileIndex = Math.floor(lowerHalf.length / 2)
                const lowerQuartileValue = lowerHalf[lowerQuartileIndex]
                const lowerQuartileRange = medianValue - lowerQuartileValue
                const IQR = lowerQuartileRange + upperQuartileRange
                const max = upperQuartileValue + (2 * IQR)
                const min = lowerQuartileValue - (2 * IQR)
                marketMetrics[metric] = marketMetrics[metric].filter(m => m >= min && m <= max)
            }
        }
        end = Date.now()
        console.log(`ANALYSIS: ${(end - start) / 1000.0}s for removing outliers`)

        start = Date.now()
        const companyScores:any = {}
        for (const symbol of Object.keys(symbolMetrics)){
            const symbolMetric = symbolMetrics[symbol]
            const companyScore:any = {}
            companyScore.symbol = symbol
            companyScore.categories = {}
            companyScore.rawValues = symbolMetrics[symbol]
            let overallScore = 0
            for (const key of Object.keys(valuationCategoryArrays)){
                companyScore.categories[key] = {}
                companyScore.categories[key].overall = 0
                for (const metric of valuationCategoryArrays[key]){
                    if (symbolMetric.hasOwnProperty(metric)){
                        const val = AnalysisService.computePercentile(symbolMetric[metric], marketMetrics[metric], lowerIsBetterMetrics.includes(metric))
                        companyScore.categories[key][metric] = val
                        companyScore.categories[key].overall += val
                    } else {
                        companyScore.categories[key][metric] = 0
                    }
                }
                companyScore.categories[key].overall = companyScore.categories[key].overall / valuationCategoryArrays[key].length
                overallScore += companyScore.categories[key].overall
            }
            // if (priceData[symbol]) {
            //     const ts = await AnalysisService.computeTechnicalScoreForSymbol(symbol, priceData[symbol])
            //     companyScore.categories.technical = {}
            //     companyScore.categories.technical.overall = 0
            //     for (const tsKey of Object.keys(ts)){
            //         companyScore.categories.technical[tsKey] = ts[tsKey]
            //         companyScore.categories.technical.overall += ts[tsKey]
            //     }
            //     companyScore.categories.technical.overall = (companyScore.categories.technical.overall / Object.keys(ts).length)
            //     //overallScore += (companyScore.categories.technical.overall / 3)
            // }
            companyScore.overallScore = overallScore / Object.keys(valuationCategoryArrays).length
            companyScores[symbol] = companyScore
        }
        end = Date.now()
        console.log(`ANALYSIS: ${(end - start) / 1000.0}s for overalls`)

        const sortedCompanyScores = Object.values(companyScores).sort((a:any,b:any) => a.overallScore - b.overallScore)
        const overallScores = Object.values(sortedCompanyScores).map((s:any) => s.overallScore)
        const industryMap = {}
        for (let i = Object.values(sortedCompanyScores).length - 1; i >= 0; i--){
            const cs:any = Object.values(sortedCompanyScores)[i]
            const rankPercentile = AnalysisService.computeRankPercentile(cs.overallScore, overallScores)
            cs.percentile = rankPercentile.percentile
            cs.rank = rankPercentile.rank

            const industry = symbolIndustryMap[cs.symbol]
            cs.industry = industry
            cs.industryTotal = industrySizeMap[industry]
            if (industryMap.hasOwnProperty(industry)) {
                industryMap[industry] = industryMap[industry] + 1
            } else {
                industryMap[industry] = 1
            }
            cs.industryRank = industryMap[industry]

            companyScores[cs.symbol] = cs
        }
        return AnalysisService.stockDao.batchSaveFieldsInMultipleStockDocs(AnalysisService.stockDao.stockCollection, 
            AnalysisService.stockDao.scoresField, companyScores, true)
    }

    // public static async computeTechnicalScoreForSymbol(symbol: string, chartData: any[]) {
    //     const score: any = {}
    //     score.support = AnalysisService.computeSupportScore(chartData)
    //     const gapups = await AnalysisService.stockDao.getStockDocumentFieldForSymbol(symbol, "gapUps")
    //     const gapdowns = await AnalysisService.stockDao.getStockDocumentFieldForSymbol(symbol, "gapDowns")
    //     score.pressure = AnalysisService.computeGapScore(gapups, gapdowns)
    //     score.trends = AnalysisService.computeTrendScores(chartData)
    //     if (chartData && chartData.length) {
    //         score.strength = await AnalysisService.computeStrengthScore(chartData[0].rsi14)
    //     } else {
    //         score.strength = 0
    //     }
    //     score.momentum = await AnalysisService.computeMomentumScore(symbol)
    //     if (chartData && chartData.length > 1) {
    //         score.circuitBreaker = ((chartData[0].close - chartData[1].close) / chartData[1].close) > 0.1 ? 1 : 0
    //     } else {
    //         score.circuitBreaker = 0
    //     }
    //     return score
    // }

    //-1 to 1
    //highest score on either end is if one of the volumes is twice as big as the other
    // public static async computeMomentumScore(symbol:string){
    //     return AnalysisService.stockDao.getStockDocumentFieldForSymbol(symbol, AnalysisService.stockDao.latestKeyStatsField).then((keystats:any) => {
    //         if (keystats && keystats.avg30Volume && keystats.avg10Volume) {
    //             if (keystats.avg30Volume < keystats.avg10Volume){
    //                 return Math.min(1, (keystats.avg10Volume - keystats.avg30Volume) / keystats.avg30Volume)
    //             } else {
    //                 return Math.max(-1, (keystats.avg30Volume - keystats.avg10Volume) / keystats.avg30Volume)
    //             }
    //         }
    //         return 0
    //     })
    // }

    // // -1 to 1
    // public static async computeStrengthScore(rsi:number){
    //     const threshold:number = 50.0
    //     if (rsi < threshold){
    //         return (threshold - rsi) / threshold
    //     } else {
    //         return -((rsi - threshold) / threshold)
    //     }
    // }

    // //returns value -1 to 1
    // public static computeTrendScores(chartData:any[]) {
    //     const shortTermThreshold:number = 20 //1 month
    //     const mediumTermThreshold:number = 120 //6 month
    //     const longTermThreshold:number = 260 //1 year
    //     let shortTermScore = 0
    //     let mediumTermScore = 0
    //     let longTermScore = 0
    //     const shortTermChart = chartData.slice(0, shortTermThreshold + 1)
    //     if (shortTermChart.length >= shortTermThreshold) {
    //         shortTermScore = Utilities.calculateTrendlineSlope(Object.values(shortTermChart).map(v => v.close)) > 0 ? 1 : -1
    //     }
    //     const mediumTermChart = chartData.slice(0, mediumTermThreshold + 1)
    //     if (mediumTermChart.length >= mediumTermThreshold) {
    //         mediumTermScore = Utilities.calculateTrendlineSlope(Object.values(mediumTermChart).map(v => v.close)) > 0 ? 1 : -1
    //     }
    //     const longTermChart = chartData.slice(0, longTermThreshold + 1)
    //     if (longTermChart.length >= longTermThreshold) {
    //         longTermScore = Utilities.calculateTrendlineSlope(Object.values(longTermChart).map(v => v.close)) > 0 ? 1 : -1
    //     }
    //     return (shortTermScore + mediumTermScore + longTermScore) / 3
    // }

    //returns value -1 to 1
    // public static computeSupportScore(chartData: any[]) {
    //     //const reversedChartData = chartData.reverse()

    //     // priority of variables
    //     // initial checks: at least one support below price or immediately get worst score
    //     //1. bounce/rejection score
    //     // bounce is +1, rejection is -1, b - r = max/min is +-1
    //     //2. crosses score
    //     //max is 20 crossing over 50, 100, and 200. 3.2 + 2.19 + 1.18 = +-7.1
    //     //3. distance from closest support, modified by which support
    //     // if d<=0.05 then +(1 - d) + (ma / 500), (1 to 0.95)+(0.4 to 0.04), 1.4 to 0.99; max 1.4
    //     // if d>0.05 then max(-1, -(d*10)) + (ma / 500), worst case -1
    //     //4. how many supports below price score (weighted by sma - being above longer period is better and thus being under longer is very bad)
    //     // depending if ma is above or below price, +-(ma / 100) = +- 2+1+0.5+0.2 = +-3.7
    //     //5. distance from lowest support
    //     // -d, max 0, min -1

    //     //Convert each score above to -1 to +1 range
    //     //multiply each score by its weight and add them up
    //     //return (overall score / max possible score) so that what gets returned is -1 to 1 scale again

    //     const minOverallScore = -1
    //     const maxOverallScore = 1
    //     let overallScore = 0.0

    //     if (!chartData || !chartData.length) {
    //         return overallScore
    //     }
    //     const bounces: any[] = []
    //     const rejections: any[] = []
    //     let mostRecentChartItem: any = null
    //     let smas: any[] = []
    //     let linesBelowCurrentPrice: any[] = []
    //     let linesAboveCurrentPrice: any[] = []
    //     let closestSupport: any = null //line that the current price is directly above (support)
    //     let closestResistance: any = null //line that the current price is directly below (resistance)
    //     let distanceFromLowestLine: any = null
    //     let distanceFromClosestSupport: any = null
    //     let currentPrice = 0.0
    //     const smaOrders: any[] = []
    //     for (let i = 0; i < chartData.length; i++) {
    //         const chartItem = chartData[i]
    //         const sma20 = { "line": "20", "val": chartItem.sma20 }
    //         const sma50 = { "line": "50", "val": chartItem.sma50 }
    //         const sma100 = { "line": "100", "val": chartItem.sma100 }
    //         const sma200 = { "line": "200", "val": chartItem.sma200 }
    //         const currentSmas = [sma20, sma50, sma100, sma200].sort((a, b) => a.val < b.val ? 1 : -1)

    //         const linesBelowCurrentPriceTemp: any[] = []
    //         const linesAboveCurrentPriceTemp: any[] = []
    //         let closestSupportTemp: any = {}
    //         let closestRestistanceTemp: any = {}
    //         const smaOrder: any = []
    //         for (const sma of currentSmas) {
    //             smaOrder.push(sma.line)
    //             if (chartItem.close > sma.val) {
    //                 linesBelowCurrentPriceTemp.push(sma)
    //             } else {
    //                 linesAboveCurrentPriceTemp.push(sma)
    //             }
    //             if (!closestSupport && chartItem.close > sma.val) {
    //                 closestSupportTemp = sma
    //             }
    //             if (!closestResistance && chartItem.close < sma.val) {
    //                 closestRestistanceTemp = sma
    //             }
    //         }
    //         if (i === 0) {
    //             currentPrice = chartItem.close
    //             smas = currentSmas
    //             mostRecentChartItem = chartItem
    //             linesBelowCurrentPrice = linesBelowCurrentPriceTemp
    //             linesAboveCurrentPrice = linesAboveCurrentPriceTemp
    //             closestSupport = closestSupportTemp
    //             closestResistance = closestRestistanceTemp

    //             if (linesBelowCurrentPrice.length === 0) {
    //                 return minOverallScore
    //             }
    //         }

    //         //for golden/death cross
    //         if (i <= 40) {
    //             smaOrders.push(smaOrder)
    //         } else {
    //             break
    //         }
    //         if (i < 5) { //looking for bounces or rejections within last 5 chart points
    //             if (i !== 0 && chartData.length > i + 1) {
    //                 const previousChartItem = chartData[i + 1]
    //                 const nextChartItem = chartData[i - 1]
    //                 const rightPart = i - 3 >= 0 ? chartData[i - 3] : chartData[0]
    //                 const leftPart = i + 3 < chartData.length ? chartData[i + 3] : chartData[chartData.length - 1]
    //                 if (previousChartItem.low > chartItem.low && nextChartItem.low > chartItem.low && chartItem.low < mostRecentChartItem.low) {
    //                     //bounces: a bounce is a low point that is preceded and followed by higher lows and the center must be lower than current low
    //                     const rightPartSatified = rightPart.low > chartItem.low
    //                     const leftPartSatisfied = leftPart.low > chartItem.low
    //                     if (rightPartSatified && leftPartSatisfied) {
    //                         for (const sma of currentSmas) {
    //                             const diffLow = Math.abs((chartItem.low - sma.val) / chartItem.low)
    //                             const diffClose = Math.abs((chartItem.close - sma.val) / chartItem.close)
    //                             const diffOpen = Math.abs((chartItem.open - sma.val) / chartItem.open)
    //                             const upBar = chartItem.open < chartItem.close
    //                             //if the low or close gets close to a sma line, its a bounce (meaning the low can go under the sma and the close can be sitting on top)
    //                             if (diffClose < 0.01 || diffLow < 0.01 || (upBar && diffOpen < 0.01)) {
    //                                 bounces.push(chartItem)
    //                                 break
    //                             }
    //                         }
    //                     }
    //                 } else if (previousChartItem.high < chartItem.high && nextChartItem.high < chartItem.high && chartItem.high > mostRecentChartItem.high) {
    //                     //rejections: a rejection is a high point that is preceded and followed by lower highs and the center must be higher than current high
    //                     const rightPartSatified = rightPart.high < chartItem.high
    //                     const leftPartSatisfied = leftPart.high < chartItem.high
    //                     if (rightPartSatified && leftPartSatisfied) {
    //                         for (const sma of linesAboveCurrentPrice) {
    //                             const diffHigh = Math.abs((sma.val - chartItem.high) / chartItem.high)
    //                             //the high can be within 1% of the sma above or below it and still be considered a rejection
    //                             if (diffHigh < 0.01) {
    //                                 rejections.push(chartItem)
    //                                 break
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //     if (linesBelowCurrentPrice.length > 0) {
    //         distanceFromClosestSupport = (mostRecentChartItem.close - closestSupport.val) / mostRecentChartItem.close
    //         distanceFromLowestLine = (mostRecentChartItem.close - linesBelowCurrentPrice[linesBelowCurrentPrice.length - 1].val) / mostRecentChartItem.close
    //     }

    //     //look for golden/death crosses in the last month
    //     const smaStrings: string[] = ["20", "50", "100", "200"]
    //     const goldenCrossScores: number[] = []
    //     const deathCrossScores: number[] = []
    //     for (let i = 0; i < smaOrders.length; i++) {
    //         const smaOrder = smaOrders[i]
    //         if (i < smaOrders.length - 1) {
    //             const previousOrder = smaOrders[i + 1]
    //             if (JSON.stringify(smaOrder) !== JSON.stringify(previousOrder)) {
    //                 for (const smaString of smaStrings) {
    //                     const currentIndex = smaOrder.indexOf(smaString)
    //                     const previousIndex = previousOrder.indexOf(smaString)
    //                     if (currentIndex < previousIndex) {
    //                         //current line crossed over some lines
    //                         for (const sma2 of smaStrings) {
    //                             if (smaOrder.indexOf(sma2) > currentIndex && previousOrder.indexOf(sma2) < previousIndex) {
    //                                 //current line crossed over this line
    //                                 if (parseInt(smaString) < parseInt(sma2)) {
    //                                     //golden cross
    //                                     const timeMultiplier = 1 + ((smaOrders.length - i) / 100.0)
    //                                     const goldenScore = (smaStrings.indexOf(sma2) - smaStrings.indexOf(smaString)) * timeMultiplier
    //                                     goldenCrossScores.push(goldenScore)
    //                                 }
    //                             }
    //                         }
    //                     } else if (currentIndex < previousIndex) {
    //                         //current line crossed under some lines, which lines
    //                         for (const sma2 of smaStrings) {
    //                             if (smaOrder.indexOf(sma2) > currentIndex && previousOrder.indexOf(sma2) < previousIndex) {
    //                                 //current line crossed under this line
    //                                 if (parseInt(smaString) < parseInt(sma2)) {
    //                                     //death cross
    //                                     const timeMultiplier = 1 + ((smaOrders.length - i) / 100.0)
    //                                     const deathScore = (smaStrings.indexOf(sma2) - smaStrings.indexOf(smaString)) * timeMultiplier
    //                                     deathCrossScores.push(deathScore)
    //                                 }
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //     //1. BOUNCE SCORE
    //     //there cannot be a bounce and rejection in the same 5-day window
    //     let bounceRejectionScore = 0
    //     if (bounces.length > 0) {
    //         bounceRejectionScore = 1
    //     } else if (rejections.length > 0) {
    //         bounceRejectionScore = -1
    //     }
    //     //bounceRejectionScore = 1
    //     //console.log(`bounceRejectionScore: ${bounceRejectionScore}`)

    //     //2. CROSSES SCORE
    //     const goldenCrossScore = goldenCrossScores.length > 0 ? goldenCrossScores.reduce((a, b) => a + b) : 0
    //     const deathCrossScore = deathCrossScores.length > 0 ? deathCrossScores.reduce((a, b) => a + b) : 0
    //     const overallCrossesScore = goldenCrossScore - deathCrossScore
    //     const maxCrossesScore = 7.1 //max score is +- 7.1, see below
    //     //20 over 50 = 1 * 1.17 = 1.17
    //     //20 over 100 = 2 * 1.18 = 2.36
    //     //20 over 200 = 3 * 1.19 = 3.57 -> sum these 3 = 7.1 
    //     let overallCrossesScorePercent = overallCrossesScore / maxCrossesScore
    //     //overallCrossesScorePercent = 1
    //     //console.log(`overallCrossesScorePercent: ${overallCrossesScorePercent}`)

    //     //DISTANCE FROM CLOSEST SUPPORT SCORE
    //     let distanceFromClosestSupportScore = 0.0
    //     const closestSupportInt = parseInt(closestSupport.line)
    //     if (distanceFromClosestSupport <= 0.05) {
    //         distanceFromClosestSupportScore = ((1 - distanceFromClosestSupport) + (closestSupportInt / 500)) / 1.4
    //     } else {
    //         distanceFromClosestSupportScore = (Math.max(-1, -(distanceFromClosestSupport * 10)) + (closestSupportInt / 500)) / 1
    //     }
    //     //console.log(`distanceFromClosestSupportScore: ${distanceFromClosestSupportScore}`)

    //     //4. NUMBER OF SUPPORTS BELOW PRICE SCORE 
    //     let supportPositionScore = 0.0
    //     for (const sup of linesBelowCurrentPrice) {
    //         supportPositionScore += (parseInt(sup.line) / 100)
    //     }
    //     for (const sup of linesAboveCurrentPrice) {
    //         supportPositionScore -= (parseInt(sup.line) / 100)
    //     }
    //     supportPositionScore = supportPositionScore / 3.7
    //     //console.log(`supportPositionScore: ${supportPositionScore}`)

    //     //5. DISTANCE FROM LOWEST SUPPORT SCORE
    //     const distanceFromLowestLineScore = -distanceFromClosestSupport
    //     //console.log(`distanceFromLowestLineScore: ${distanceFromLowestLineScore}`)

    //     //add weightings * score
    //     if (Utilities.isValidNumber(bounceRejectionScore)){
    //         overallScore += 1 * bounceRejectionScore
    //     }
    //     if (Utilities.isValidNumber(overallCrossesScorePercent)){
    //         overallScore += 0.4 * overallCrossesScorePercent
    //     }
    //     if (Utilities.isValidNumber(distanceFromClosestSupportScore)){
    //         overallScore += 0.1 * distanceFromClosestSupportScore
    //     }
    //     if (Utilities.isValidNumber(supportPositionScore)){
    //         overallScore += 0.05 * supportPositionScore
    //     }
    //     if (Utilities.isValidNumber(distanceFromLowestLineScore)){
    //         overallScore += 0.05 * distanceFromLowestLineScore
    //     }
    //     overallScore = overallScore / 1.6
    //     //console.log(`overallScore: ${overallScore}`)
    //     return overallScore
    // }

    /**
     * Score is between -1 and +1. 
     * More negative score mean more downward pressure
     * More positive score mean more upward pressure
     * Score around 0 mean neutral pressure, little effect on overall technical score
     * net 10% gap up yields the maximum negative impact
     * net 20% gap down yields the maxmimum positive impact -- gapdowns have 1/2 the impact of gapups) Why? answer below:
     *      - gap down upward pressure (from buy-the-dip) is countered by fear (very strong emotion)
     *      - gap up downward pressure (from profit taking) is countered by hype/excitement (not as strong an emotion)
     */
    // public static computeGapScore(gapups:any[], gapdowns:any[]) {
    //     if (!gapups || gapups.length === 0 || !gapdowns || gapdowns.length === 0){
    //         return 0
    //     }
    //     let totalGapups:number = 0
    //     let totalGapdowns:number = 0
    //     const explanation:any = {
    //         positives: [],
    //         negatives: []
    //     }
    //     for (const gapup of gapups){
    //         const score = gapup.gapPercent
    //         const daysSinceGap = Utilities.countDaysBetweenDates(Date.now(), new Date(gapup.date).getTime())
    //         if (daysSinceGap <= 60){
    //             totalGapups += (score * 1.1)
    //         } else if (daysSinceGap <= 180) {
    //             totalGapups += (score * 1.05)
    //         } else {
    //             totalGapups += (score * 1.01)
    //         }
    //     }
    //     for (const gapdown of gapdowns){
    //         const score = gapdown.gapPercent
    //         const daysSinceGap = Utilities.countDaysBetweenDates(Date.now(), new Date(gapdown.date).getTime())
    //         if (daysSinceGap <= 60){
    //             totalGapdowns += (score * 1.1)
    //         } else if (daysSinceGap <= 180) {
    //             totalGapdowns += (score * 1.05)
    //         } else {
    //             totalGapdowns += (score * 1.01)
    //         }
    //     }
    //     let finalScore = ((totalGapdowns/2.0) - totalGapups)/10.0
    //     if (finalScore > 1) {
    //         finalScore = 1
    //     } else if (finalScore < -1){
    //         finalScore = -1
    //     }
    //     if (gapdowns.length > 0){
    //         explanation.positives.push(`${gapdowns.length} gaps down with total gap percentage of ${totalGapdowns}`)
    //     }
    //     if (gapups.length > 0){
    //         explanation.negatives.push(`${gapups.length} gaps up with total gap percentage of ${totalGapups}`)
    //     }
    //     // return {
    //     //     score: finalScore,
    //     //     explanation: explanation
    //     // }
    //     return finalScore
    // }

    // private static computeZscore(value:number, avg:number, stdDev:number){
    //     return (value - avg) / stdDev
    // }

    /* requires sorted arr */
    public static computeRankPercentile(value:number, arr:number[]){
        if (arr.includes(value)){
            return {
                rank: (arr.length) - arr.indexOf(value),
                //percentile: arr.indexOf(value) / (arr.length - 1)
                percentile: value / (arr[arr.length - 1])
            }
        }
        return {
            rank: 0.0,
            percentile: 0.0
        }
    }

    private static computePercentile(value:number, arr:number[], lowerIsBetter:boolean){
        if (!arr.length){
            return 1
        }
        arr.sort((a,b) => a - b);
        if (value < arr[0]) {
            return lowerIsBetter ? 1 : 0
        }
        if (value > arr[arr.length - 1]){
            return lowerIsBetter ? 0 : 1
        }
        return lowerIsBetter ? (1 - (value - arr[0]) / (arr[arr.length - 1] - arr[0])) : (value - arr[0]) / (arr[arr.length - 1] - arr[0])
    }

    private static computeScoreFromPriceTarget(currentPrice:number, priceTargetObj:any){
        //=(UPSIDE*100) + (log(NUMANALYSTS, 2)*20) + ((LOWSIDE*100)/3)
        const analystScore = Math.log2(priceTargetObj.numberOfAnalysts) * 20

        let upside = ((priceTargetObj.priceTargetAverage - currentPrice) / currentPrice) * 100.0
        if (upside > 100) {
            upside = 100
        }
        
        let lowUpside = (((priceTargetObj.priceTargetLow - currentPrice) / currentPrice) * 100.0) / 3
        if (lowUpside > 50) {
            lowUpside = 50
        }
        //low multiplier only applies if there are at least 2 analysts
        if (priceTargetObj.numberOfAnalysts <= 1){
            lowUpside = 0
        } 
        let score = analystScore + upside + lowUpside
        return score
    }

    private static computeGrowthForMetric(symbol:string, metric:string, arr:number[], field:string, marketMetrics:any, symbolMetrics:any, calculateRate:boolean, limit:number, growthRateMetric:string = ""){
        if (arr && arr.length){
            const diffs:number[] = []
            let startIndex = 0
            if (arr.length > limit){
                startIndex = arr.length - limit
            }
            for (let i = 0; i < arr.length; i++) {
                if (i < arr.length - 1) {
                    const current: any = arr[i]
                    const next: any = arr[i + 1]
                    if (current[field] && next[field]){
                        let increase = Math.abs((next[field] - current[field]) / current[field])
                        increase = next[field] > current[field] ? increase : -increase
                        //growth capped at +- 1000%
                        if (increase > 10) {
                            increase = 10 
                        } else if (increase < -10){
                            increase = -10
                        }
                        diffs.push(increase)
                    }
                }
            }
            if (diffs.length) {
                const avgDiff = diffs.reduce((a, b) => a + b) / diffs.length
                if (Utilities.isValidNumber(avgDiff)){
                    marketMetrics[metric].push(avgDiff)
                    symbolMetrics[symbol][metric] = avgDiff
                }
                if (calculateRate) {
                    const slope = Utilities.calculateTrendlineSlope(diffs)
                    if (Utilities.isValidNumber(slope)) {
                        marketMetrics[growthRateMetric].push(slope)
                        symbolMetrics[symbol][growthRateMetric] = slope
                    }
                }
            }
        }
    }
}