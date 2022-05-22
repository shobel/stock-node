import ChartEntry from "../models/ChartEntry";
import Utilities from "../utils/Utilities";
import StockDao from "../dao/StockDao";
import SimplifiedBalanceSheet from "../models/SimplifiedBalanceSheet";
import SimplifiedIncome from "../models/SimplifiedIncome";
import SimplifiedCashFlow from "../models/SimplifiedCashFlow";
import SimplifiedEarnings from "../models/SimplifiedEarnings";
import SimplifiedAdvancedStats from "../models/SimplifiedAdvancedStats";
import SimpleQuote from "../models/SimpleQuote";
import ScheduledUpdateService from "./ScheduledUpdateService";
import StockDataService from "./StockDataService";
import delay = require('delay');
import StockMarketUtility from "../utils/StockMarketUtility";
const fetch = require('node-fetch');
const fetchRetry = require('fetch-retry')(fetch);

export default class FMPService {
    private static apikey = process.env.FMP_API_KEY
    private static stockDao:StockDao = StockDao.getStockDaoInstance()
    private static baseUrlv3 = "https://financialmodelingprep.com/api/v3/"
    private static baseUrlv4 = "https://financialmodelingprep.com/api/v4/"
    private static maxAllowedSymbols = 1500

    public static companyOutlookEndpoint = "company-outlook" //v4
    public static companyEndpoint = "profile" //v3
    public static peersEndpoint = "stock_peers" //v4
    public static floatEndpoint = "shares_float" //v4
    public static cashFlowEndpoint = "cash-flow-statement"
    public static incomeEndpoint = "income-statement"
    public static balanceSheetEndpoint = "balance-sheet-statement"
    public static newsEndpoint = "stock_news"
    public static estimatesEndpoint = "analyst-estimates"
    public static gainersEndpoint = "stock_market/gainers"
    public static losersEndpoint = "stock_market/losers"
    public static activeEndpoint = "stock_market/actives"

    public static cooldown:number = 300 //the advertised rate limit is 300/min (5/sec) (once every 200 ms) so we go a little higher for some wiggle room
    public static lastFetchTime:number = 0
    public static fetchQueue:any[] = []
    public static workingOnQueue:boolean = false
    public static latestRequestId:number = 0

    public static async populateAllHistoryForSymbol(symbol: string) {
        console.log(`processing ${symbol}`)
        const start = Date.now()
        let company = await FMPService.getCompanyProfileAndPeers(symbol)
        FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.companyField, company)
        if (company.isCompany) {
            await FMPService.updateAllFinancialDataForSymbol(symbol, false)
        } else {
            console.log(`${symbol} is not a company`)
        }

        const end = Date.now()
        const dur = (end - start) / 1000
        console.log(`Finished financial data for ${symbol}`)
        console.log(`${dur} seconds for ${symbol}`)
        console.log()
    }
    
    //this function is scheduled "around" earnings for each stock. It will actually save the latest
    //5 financial statements in each collection, so this should correct any data we might have missed
    //i.e. if our server goes down and we miss earnings for a few symbols, those symbols will be corrected
    //at their next earnings 
    public static async updateAllFinancialDataSingleEndpoint(symbol:string){
        symbol = symbol.toUpperCase()
        let url = `${FMPService.baseUrlv4}${FMPService.companyOutlookEndpoint}?symbol=${symbol}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(data => {
            let incomesAnnual = data?.financialsAnnual?.income
            if (incomesAnnual) {
                if (Array.isArray(incomesAnnual)) {
                    incomesAnnual = incomesAnnual.map(i => FMPService.convertIncomeStatementToSimple(i)).filter(i => i).filter(i => i?.period.includes("FY"))
                }          
                let annualIncomeStatements = { [symbol]: incomesAnnual }
                if (annualIncomeStatements[symbol].length) {
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualIncome, annualIncomeStatements[symbol][0])
                    FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                        FMPService.stockDao.annualIncomeCollection, "fiscalDate", annualIncomeStatements)
                }
            }
            let incomesQuarterly = data?.financialsQuarter?.income
            if (incomesQuarterly) {
                if (Array.isArray(incomesQuarterly)) {
                    incomesQuarterly = incomesQuarterly.map(i => FMPService.convertIncomeStatementToSimple(i)).filter(i => i).filter(i => i?.period.includes("Q"))
                }          
                let quarterlyIncomes = { [symbol]: incomesQuarterly }
                if (quarterlyIncomes[symbol].length){
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestQuarterlyBalanceSheet, quarterlyIncomes[symbol][0])
                    FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                        FMPService.stockDao.incomeCollection, "fiscalDate", quarterlyIncomes)
        
                    const latestEarningsDate = quarterlyIncomes[symbol][0].reportDate
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.lastEarningsDate, latestEarningsDate)
                }
            }

            let balanceSheetsAnnual = data?.financialsAnnual?.balance
            if (balanceSheetsAnnual) {
                if (Array.isArray(balanceSheetsAnnual)) {
                    balanceSheetsAnnual = balanceSheetsAnnual.map(i => FMPService.convertBalanceSheetToSimple(i)).filter(i => i).filter(i => i?.period.includes("FY"))
                }          
                let annualBalanceSheets = { [symbol]: balanceSheetsAnnual }
                if (annualBalanceSheets[symbol].length){
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualBalanceSheet, annualBalanceSheets[symbol][0])
                    FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                        FMPService.stockDao.annualBalanceSheetCollection, "fiscalDate", annualBalanceSheets)
                }
            }
            let balanceSheetsQuarterly = data?.financialsQuarter?.balance
            if (balanceSheetsQuarterly) {
                if (Array.isArray(balanceSheetsQuarterly)) {
                    balanceSheetsQuarterly = balanceSheetsQuarterly.map(i => FMPService.convertBalanceSheetToSimple(i)).filter(i => i).filter(i => i?.period.includes("Q"))
                }          
                let quarterlyBalanceSheets = { [symbol]: balanceSheetsQuarterly }
                if (quarterlyBalanceSheets[symbol].length){
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestQuarterlyBalanceSheet, quarterlyBalanceSheets[symbol][0])
                    FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                        FMPService.stockDao.balanceSheetCollection, "fiscalDate", quarterlyBalanceSheets)
        
                    const latestEarningsDate = quarterlyBalanceSheets[symbol][0].reportDate
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.lastEarningsDate, latestEarningsDate)
                }
            }

            let cashflowsAnnual = data?.financialsAnnual?.cash
            if (cashflowsAnnual) {
                if (Array.isArray(cashflowsAnnual)) {
                    cashflowsAnnual = cashflowsAnnual.map(i => FMPService.convertCashFlowToSimple(i)).filter(i => i).filter(i => i?.period.includes("FY"))
                }          
                let annualBalanceSheets = { [symbol]: cashflowsAnnual }
                let annualCashFlows = { [symbol]: annualBalanceSheets }
                if (annualCashFlows[symbol].length){
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualCashFlow, annualCashFlows[symbol][0])
                    FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                        FMPService.stockDao.annualCashFlowCollection, "fiscalDate", annualCashFlows)
                }
            }
            let cashflowsQuarterly = data?.financialsQuarter?.cash
            if (cashflowsQuarterly) {
                if (Array.isArray(cashflowsQuarterly)) {
                    cashflowsQuarterly = cashflowsQuarterly.map(i => FMPService.convertCashFlowToSimple(i)).filter(i => i).filter(i => i?.period.includes("Q"))
                }          
                let quarterlyCashFlows = { [symbol]: cashflowsQuarterly }
                if (quarterlyCashFlows[symbol].length){
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestQuarterlyBalanceSheet, quarterlyCashFlows[symbol][0])
                    FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                        FMPService.stockDao.cashFlowCollection, "fiscalDate", quarterlyCashFlows)
        
                    const latestEarningsDate = quarterlyCashFlows[symbol][0].reportDate
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.lastEarningsDate, latestEarningsDate)
                }
            }
        }).then(() => {
            return FMPService.getFinancialsExcludingStatements(symbol, true)
        })
    }

    public static async updateAllFinancialDataForSymbol(symbolInput: string, isDailyUpdate:boolean) {
        const symbol = symbolInput.toUpperCase()
        console.log(`updating financials for ${symbol}`)
        let annualLimit = 4
        let quarterLimit = 16
        let earningsLimit = 20
        if (isDailyUpdate){
            annualLimit = 1
            quarterLimit = 1
            earningsLimit = 5
        }
        let quarterlyBalanceSheets:any = await FMPService.getBalanceSheetsForSymbol(symbol, "quarter", quarterLimit)
        quarterlyBalanceSheets = quarterlyBalanceSheets.filter(qbs => qbs?.period.includes("Q"))
        quarterlyBalanceSheets = { [symbol]: quarterlyBalanceSheets }
        let annualBalanceSheets:any = await FMPService.getBalanceSheetsForSymbol(symbol, "annual", annualLimit)
        annualBalanceSheets = annualBalanceSheets.filter(abs => abs?.period.includes("FY"))
        annualBalanceSheets = { [symbol]: annualBalanceSheets }
        if (annualBalanceSheets[symbol].length){
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualBalanceSheet, annualBalanceSheets[symbol][0])
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                FMPService.stockDao.annualBalanceSheetCollection, "fiscalDate", annualBalanceSheets)
        }
        if (quarterlyBalanceSheets[symbol].length){
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestQuarterlyBalanceSheet, quarterlyBalanceSheets[symbol][0])
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                FMPService.stockDao.balanceSheetCollection, "fiscalDate", quarterlyBalanceSheets)

            const latestEarningsDate = quarterlyBalanceSheets[symbol][0].reportDate
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.lastEarningsDate, latestEarningsDate)
        }

        let quarterlyIncomeStatements:any = await FMPService.getIncomeStatementsForSymbol(symbol, "quarter", quarterLimit)
        quarterlyIncomeStatements = quarterlyIncomeStatements.filter(qis => qis?.period.includes("Q"))
        quarterlyIncomeStatements = { [symbol]: quarterlyIncomeStatements }
        let annualIncomeStatements:any = await FMPService.getIncomeStatementsForSymbol(symbol, "annual", annualLimit)
        annualIncomeStatements = annualIncomeStatements.filter(ais => ais?.period.includes("FY"))
        annualIncomeStatements = { [symbol]: annualIncomeStatements }
        if (annualIncomeStatements[symbol].length) {
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualIncome, annualIncomeStatements[symbol][0])
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                FMPService.stockDao.annualIncomeCollection, "fiscalDate", annualIncomeStatements)
        }
        if (quarterlyIncomeStatements[symbol].length){
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestQuarterlyIncome, quarterlyIncomeStatements[symbol][0])
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                FMPService.stockDao.incomeCollection, "fiscalDate", quarterlyIncomeStatements)
        }

        let quarterlyCashFlows:any = await FMPService.getCashFlowsForSymbol(symbol, "quarter", quarterLimit)
        quarterlyCashFlows = quarterlyCashFlows.filter(qcf => qcf?.period.includes("Q"))
        quarterlyCashFlows = { [symbol]: quarterlyCashFlows }
        let annualCashFlows:any = await FMPService.getCashFlowsForSymbol(symbol, "annual", annualLimit)
        annualCashFlows = annualCashFlows.filter(acf => acf?.period.includes("FY"))
        annualCashFlows = { [symbol]: annualCashFlows }
        if (annualCashFlows[symbol].length){
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualCashFlow, annualCashFlows[symbol][0])
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                FMPService.stockDao.annualCashFlowCollection, "fiscalDate", annualCashFlows)
        }
        if (quarterlyCashFlows[symbol].length){
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestQuarterlyCashFlow, quarterlyCashFlows[symbol][0])
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                FMPService.stockDao.cashFlowCollection, "fiscalDate", quarterlyCashFlows)
        }

        let keyAndAdvancedAnnual:any = await FMPService.getAdvancedStatsForSymbol(symbol, "annual", annualLimit)
        keyAndAdvancedAnnual = { [symbol]: keyAndAdvancedAnnual }
        if (keyAndAdvancedAnnual[symbol].length){
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualAdvancedStats, keyAndAdvancedAnnual[symbol][0])
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                FMPService.stockDao.annualAdvancedStatsCollection, "date", keyAndAdvancedAnnual)
        }
        let keyAndAdvanced:any = await FMPService.getAdvancedStatsForSymbol(symbol, "quarter", quarterLimit)
        keyAndAdvanced = { [symbol]: keyAndAdvanced }
        if (keyAndAdvanced[symbol].length){
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAdvancedStats, keyAndAdvanced[symbol][0])
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                FMPService.stockDao.advancedStatsCollection, "date", keyAndAdvanced)
        }

        let earnings:any = await FMPService.getEarningsForSymbol(symbol, earningsLimit)
        const earningsRevised:any[] = []
        //seems to be some sort of check that makes sure we don't save false earnings reports that are 
        //too close together, ie less than 30 days apart
        for (let i = 0; i < earnings.length; i++) {
            const currentEarnings = earnings[i]
            if (i < earnings.length - 1){
                const previousEarnings = earnings[i+1]
                if (Utilities.countDaysBetweenDateStrings(currentEarnings.EPSReportDate, previousEarnings.EPSReportDate) > 30){
                    earningsRevised.push(currentEarnings)
                }
            } else {
                earningsRevised.push(currentEarnings)
            }
        }
        earnings = earningsRevised
        if (earnings.length) {
            const savedEarnings = await FMPService.stockDao.getMostRecentDocsFromSubCollectionForSymbol(symbol, FMPService.stockDao.earningsCollection, earningsLimit)
            for (let i = 0; i < earnings.length; i++) {
                for (const savedEarning of savedEarnings) {
                    if (savedEarning.EPSReportDate === earnings[i].EPSReportDate){
                        earnings[i].yearAgo = savedEarning.yearAgo
                    }
                }
                if (i + 4 < earnings.length) {
                    earnings[i].yearAgo = earnings[i + 4].actualEPS
                }
            }
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                FMPService.stockDao.earningsCollection, 'EPSReportDate', { [symbol]: earnings })     
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestEarnings, earnings[0])
        }

        const ih = await FMPService.getInstitutionalHoldersForSymbol(symbol)
        await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.institutionalOwnership, ih)

        return earnings
    }

    public static async getFinancialsExcludingStatements(symbol:string, shortLimits:boolean){
        let annualLimit = 4
        let quarterLimit = 16
        let earningsLimit = 20
        if (shortLimits){
            annualLimit = 1
            quarterLimit = 1
            earningsLimit = 5
        }
        let keyAndAdvancedAnnual:any = await FMPService.getAdvancedStatsForSymbol(symbol, "annual", annualLimit)
        keyAndAdvancedAnnual = { [symbol]: keyAndAdvancedAnnual }
        if (keyAndAdvancedAnnual[symbol].length){
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualAdvancedStats, keyAndAdvancedAnnual[symbol][0])
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                FMPService.stockDao.annualAdvancedStatsCollection, "date", keyAndAdvancedAnnual)
        }
        let keyAndAdvanced:any = await FMPService.getAdvancedStatsForSymbol(symbol, "quarter", quarterLimit)
        keyAndAdvanced = { [symbol]: keyAndAdvanced }
        if (keyAndAdvanced[symbol].length){
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAdvancedStats, keyAndAdvanced[symbol][0])
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                FMPService.stockDao.advancedStatsCollection, "date", keyAndAdvanced)
        }

        let earnings:any = await FMPService.getEarningsForSymbol(symbol, earningsLimit)
        const earningsRevised:any[] = []
        //seems to be some sort of check that makes sure we don't save false earnings reports that are 
        //too close together, ie less than 30 days apart
        for (let i = 0; i < earnings.length; i++) {
            const currentEarnings = earnings[i]
            if (i < earnings.length - 1){
                const previousEarnings = earnings[i+1]
                if (Utilities.countDaysBetweenDateStrings(currentEarnings.EPSReportDate, previousEarnings.EPSReportDate) > 30){
                    earningsRevised.push(currentEarnings)
                }
            } else {
                earningsRevised.push(currentEarnings)
            }
        }
        earnings = earningsRevised
        if (earnings.length) {
            const savedEarnings = await FMPService.stockDao.getMostRecentDocsFromSubCollectionForSymbol(symbol, FMPService.stockDao.earningsCollection, earningsLimit)
            for (let i = 0; i < earnings.length; i++) {
                for (const savedEarning of savedEarnings) {
                    if (savedEarning.EPSReportDate === earnings[i].EPSReportDate){
                        earnings[i].yearAgo = savedEarning.yearAgo
                    }
                }
                if (i + 4 < earnings.length) {
                    earnings[i].yearAgo = earnings[i + 4].actualEPS
                }
            }
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                FMPService.stockDao.earningsCollection, 'EPSReportDate', { [symbol]: earnings })     
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestEarnings, earnings[0])
        }

        const ih = await FMPService.getInstitutionalHoldersForSymbol(symbol)
        await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.institutionalOwnership, ih)

        return earnings
    }

    //peers can be called in batch (symbol=MSFT,FB,etc)
    //float endpoint can also be called for all stocks if needed
    public static async getCompanyProfileAndPeers(symbol:string){
        let companyData:any = {}
        let profileUrl = `${FMPService.baseUrlv3}${FMPService.companyEndpoint}/${symbol}?apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(profileUrl).then(profile => {
            if (profile && profile.length){
                companyData = profile[0]
            }
            let peersUrl = `${FMPService.baseUrlv4}${FMPService.peersEndpoint}?symbol=${symbol}&apikey=${FMPService.apikey}`
            return FMPService.fetchDataFromUrl(peersUrl)
        }).then(peers => {
            if (peers && peers.length && peers[0].hasOwnProperty("peersList")){
                companyData.peers = peers[0].peersList
            }
            let floatUrl = `${FMPService.baseUrlv4}${FMPService.floatEndpoint}?symbol=${symbol}&apikey=${FMPService.apikey}`
            return FMPService.fetchDataFromUrl(floatUrl)
        }).then(float => {
            if (float.length){
                float = float[0]
                companyData.float = float.floatShares
                companyData.sharesOutstanding = float.outstandingShares
                companyData.freeFloat = float.freeFloat //its a percent
            }
            companyData.isCompany = StockDataService.isCompany(companyData)
            companyData.logo = companyData.image
            companyData.employees = companyData.fullTimeEmployees
            delete companyData.image
            delete companyData.fullTimeEmployees
            return companyData
        })
    }

    public static async updateEarningsForSymbols(symbols: string[]) {
        const earningsLimit = 5
        for (const symbol of symbols) {
            let earnings: any = await FMPService.getEarningsForSymbol(symbol, earningsLimit)
            const earningsRevised: any[] = []
            for (let i = 0; i < earnings.length; i++) {
                const currentEarnings = earnings[i]
                if (i < earnings.length - 1) {
                    const previousEarnings = earnings[i + 1]
                    if (Utilities.countDaysBetweenDateStrings(currentEarnings.EPSReportDate, previousEarnings.EPSReportDate) > 30) {
                        earningsRevised.push(currentEarnings)
                    }
                } else {
                    earningsRevised.push(currentEarnings)
                }
            }
            earnings = earningsRevised
            if (earnings.length) {
                const savedEarnings = await FMPService.stockDao.getMostRecentDocsFromSubCollectionForSymbol(symbol, FMPService.stockDao.earningsCollection, earningsLimit)
                for (let i = 0; i < earnings.length; i++) {
                    for (const savedEarning of savedEarnings) {
                        if (savedEarning.EPSReportDate === earnings[i].EPSReportDate) {
                            earnings[i].yearAgo = savedEarning.yearAgo
                        }
                    }
                    if (i + 4 < earnings.length) {
                        earnings[i].yearAgo = earnings[i + 4].actualEPS
                    }
                }
                await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection,
                    FMPService.stockDao.earningsCollection, 'EPSReportDate', { [symbol]: earnings })
                await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestEarnings, earnings[0])
            }
        }
    }

    public static updateAnnualEarningsEstimates(allSymbols: string[]){
        let i = 0;
        for (let s of allSymbols){
            let url = `${FMPService.baseUrlv3}${FMPService.estimatesEndpoint}/${s.toUpperCase()}?limit=${1}&apikey=${FMPService.apikey}`
            FMPService.fetchDataFromUrlWithCallback(url, function(res) {
                if (res.length){
                    console.log(`fetched ${i+=1} earnings estimates(${res[0].symbol})`)
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(s, FMPService.stockDao.latestAnnualEstimates, res[0])
                } else {
                    console.log(`fetched ${i+=1} earnings estimates (${s} no data)`)
                }
            })
        }
    }

    //for batch requests, currently only available for quotes
    public static fetchDataForMoreThanAllowedSymbols(symbols: string[], endpoint: string) {
        return new Promise((resolve, reject) => {
            const total = symbols.length
            let currentProgress = 0
            let combinedResult = []
            for (let i = 0; i < symbols.length; i += FMPService.maxAllowedSymbols) {
                let symbolsSubset = new Array()
                if ((i + (FMPService.maxAllowedSymbols - 1)) > symbols.length) {
                    symbolsSubset = symbols.slice(i, symbols.length)
                } else {
                    symbolsSubset = symbols.slice(i, i + FMPService.maxAllowedSymbols)
                }
                const url = `${FMPService.baseUrlv3}${endpoint}${symbolsSubset}?apikey=${FMPService.apikey}`
                fetchRetry(url, {
                    retries: 1,
                    retryDelay: 100,
                    retryOn: function (attempt: number, error: null, response: { status: number }) {
                        if (error !== null || response.status >= 400) {
                            console.log(`retrying ${i + 1} - ${i + symbolsSubset.length}`);
                            return true;
                        }
                        return false
                    }
                }).then((res: any) => {
                    return res.json()
                }).then((json: any) => {
                    combinedResult = combinedResult.concat(json)
                    currentProgress += symbolsSubset.length
                    if (currentProgress >= total) {
                        resolve(combinedResult)
                    }
                })
            }
        })
    }

    //gets foreign symbols as well. 36,860 symbols
    public static getAllSymbols(){
        const url = `${FMPService.baseUrlv3}stock/list?apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url)
    }

    public static getQuoteForAllSymbols(){
        let url = `${FMPService.baseUrlv3}quotes/nyse?apikey=${FMPService.apikey}`
        let allData:any = []
        let start = Date.now()
        return FMPService.fetchDataFromUrl(url).then(res => {
            allData = res
            let end = Date.now()
            let dur = (end - start) / 1000
            console.log(`fetched nyse quotes in ${dur} secs`)
            url = `${FMPService.baseUrlv3}quotes/nasdaq?apikey=${FMPService.apikey}`
            return FMPService.fetchDataFromUrl(url)
        }).then(res2 => {
            let end = Date.now()
            let dur = (end - start) / 1000
            console.log(`fetched nasdaq. Done fetching quotes in ${dur} secs`)
	    allData = [...allData, ...res2]
	    url = `${FMPService.baseUrlv3}quotes/amex?apikey=${FMPService.apikey}`
            return FMPService.fetchDataFromUrl(url)
        }).then(res3 => {
            let end = Date.now()
            let dur = (end - start) / 1000
            console.log(`fetched amex. Done fetching quotes in ${dur} secs`)
            allData = [...allData, ...res3]
            url = `${FMPService.baseUrlv3}quotes/etf?apikey=${FMPService.apikey}`
            return FMPService.fetchDataFromUrl(url)
        }).then(res4 => {
            let end = Date.now()
            let dur = (end - start) / 1000
            console.log(`fetched etf. Done fetching quotes in ${dur} secs`)
            allData = [...allData, ...res4]
            return allData
        })
    }

    public static getQuoteForSymbols(symbols:string[], isMarketOpen:boolean = true) {
        return FMPService.fetchDataForMoreThanAllowedSymbols(symbols, "quote/").then((result:any) => {
            return result.map(q => FMPService.convertFMPQuoteToSimple(q, isMarketOpen))
        }).catch(err => err)
    }

    public static getExtendedQuoteForSymbol(symbol:string){
        let todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        let url = `${FMPService.baseUrlv4}historical-price/${symbol.toUpperCase()}/1/minute/${todayString}/${todayString}?apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrlWithCallback(url, function(res) {
            if (res && res.hasOwnProperty("results")){
                let quotes = res["results"]
                let lastQuote = quotes[quotes.length - 1].c
                console.log(lastQuote)
                return lastQuote
            }
            return null
        })
    }

    public static getListType(endpoint:string){
        const url = `${this.baseUrlv3}/${endpoint}?apikey=${FMPService.apikey}`
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data: any) => data).catch()
    }

    public static getMarketNews(numItems:number){
        let url = `${FMPService.baseUrlv3}${FMPService.newsEndpoint}?limit=${numItems}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(res => {
            if (res && res.length) {
                return res.map(n => FMPService.convertNews(n))
            }
            return res
        })
    }

    //converts a FMP news object to IEX format
    private static convertNews(news:any) {
        let convertedObj:any = {}
        convertedObj.date = news.publishedDate
        convertedObj.headline = news.title
        convertedObj.source = news.site
        convertedObj.related = news.symbol
        convertedObj.summary = news.text
        //no change required
        convertedObj.url = news.url
        convertedObj.image = news.image
        return convertedObj
    }

    //for some reason I was trying to pass in the current date as from= and to= but if you put in a date greater
    //than the latest trading day, which is easy to do (fetch anytime between midnight and 6:30am) it will return 
    //data for previous days as well, which is bad. But now I'm just omitting the from/to attributes and it seems
    //to be working
    public static getIntradayChartForSymbol(symbol:string){
        // const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        const url = `${FMPService.baseUrlv3}historical-chart/1min/${symbol}?apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(chart => {
            let latestDate:string = ""
            if (chart.length > 0) {
                let entry = chart[0]
                latestDate = entry.date.includes(" ") ? entry.date.split(" ")[0] : ""
            } else {
                return []
            }
            let reversed = chart.reverse()
            let filteredResult = reversed.filter(r => r.high && r.low && r.open && r.close)
            filteredResult = filteredResult.filter(e => {
                let d = e.date.includes(" ") ? e.date.split(" ")[0] : ""
                return d == latestDate
            })
            //fmp gives most recent price first AND sometimes includes prices from the previous day at the end (WTF?!)

            const chartEntries:any[] = []
            let volumeSum = 0
            for (let i = 0; i < filteredResult.length; i++) {
                const entry = filteredResult[i]
                if (i === 0){
                    entry.volume = 0
                }
                const chartEntry:any = {
                    date: entry.date.includes(" ") ? entry.date.split(" ")[0] : "",
                    label: entry.date.includes(" ") ? Utilities.convert24hTo12H(entry.date.split(" ")[1]) : "",
                    minute: entry.date.includes(" ") ? Utilities.convert24hTo12H(entry.date.split(" ")[1]) : "",
                    open: entry.open,
                    close: entry.close,
                    high: entry.high,
                    low: entry.low,
                    volume: entry.volume//entry.volume - volumeSum,
                }
                volumeSum += chartEntry.volume
                chartEntries.push(chartEntry)
            }
            return chartEntries
        })
    }

    public static getFinancialDataForSymbol(symbol:string, period:string, endpoint:string, limit:number){
        const url = `${FMPService.baseUrlv3}${endpoint}/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url)
    }

    //dont really need these next 3, can use above 1 instead
    public static getBalanceSheetsForSymbol(symbol:string, period:string, limit:number) {
        const url = `${FMPService.baseUrlv3}balance-sheet-statement/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(balanceSheets => {
            if (Array.isArray(balanceSheets)) {
                const x = balanceSheets.map(bs => FMPService.convertBalanceSheetToSimple(bs))
                const y = x.filter(bs => bs)
                return y  
            }          
            console.log(`error: ${balanceSheets}`)
            return []
        })
    }

    public static getIncomeStatementsForSymbol(symbol:string, period:string, limit:number){
        const url = `${FMPService.baseUrlv3}income-statement/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(incomes => {
            if (Array.isArray(incomes)) {
                return incomes.map(i => FMPService.convertIncomeStatementToSimple(i)).filter(i => i)
            }
            console.log(`error: ${incomes}`)
            return []
        })
    }

    public static getCashFlowsForSymbol(symbol:string, period:string, limit:number){
        const url = `${FMPService.baseUrlv3}cash-flow-statement/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(cashflows => {
            if (Array.isArray(cashflows)) {
                return cashflows.map(cf => FMPService.convertCashFlowToSimple(cf)).filter(cf => cf)
            }
            console.log(`error: ${cashflows}`)
            return []
        })
    }

    //returns fully processed daily chart
    public static getFullPriceHistoryForSymbol(symbol:string){
        const url = `${FMPService.baseUrlv3}historical-price-full/${symbol}?from=${ScheduledUpdateService.fiveYearsAgoDateString}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(data => {
            return data.historical
        })
    }

    public static getEarningsForSymbol(symbol:string, limit:number){
        const url = `${FMPService.baseUrlv3}historical/earning_calendar/${symbol}?limit=${limit}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(data => {
            if (Array.isArray(data)) {
                return data.map(e => FMPService.convertEarningsToSimple(e))
            }
            return []
        })
    }

    public static getSocialSentiment(symbol:String){
        const url = `${FMPService.baseUrlv4}historical/social-sentiment?symbol=${symbol}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url)
    }

    public static getTrendingBySocialSentiment() {
        const url = `${FMPService.baseUrlv4}social-sentiment/trending?apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url)  
    }

    //options are twitter or stocktwits
    public static getSocialSentimentChanges(source:string){
        const url = `${FMPService.baseUrlv4}social-sentiments/change?type=bullish&source=${source}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url)  
    }

    public static async getAdvancedStatsForSymbol(symbol:string, period:string, limit:number){
        const advancedStats = await FMPService.getRatiosForSymbol(symbol, period, limit)
        const keyMetrics = await FMPService.getKeyMetricsForSymbol(symbol, period, limit)
        const keyAndAdvanced = FMPService.mergeKeyAndAdvancedStats(keyMetrics, advancedStats)
        return keyAndAdvanced
    }

    private static getRatiosForSymbol(symbol:string, period:string, limit:number){
        const url = `${FMPService.baseUrlv3}ratios/${symbol}?limit=${limit}&period=${period}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(data => {
            return data
        })
    }

    private static getKeyMetricsForSymbol(symbol:string, period:string, limit:number){
        const url = `${FMPService.baseUrlv3}key-metrics/${symbol}?limit=${limit}&period=${period}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(data => {
            return data
        })
    }

    public static getIsMarketOpen(){
        const url = `${FMPService.baseUrlv3}is-the-market-open?apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(data => {
            return data && data["isTheStockMarketOpen"]
        })
    }

    public static getHolidaysUsMarket() {
        const url = `${FMPService.baseUrlv3}is-the-market-open?apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(data => {
            var d = new Date();
            var currentYear = d.getFullYear();
            let holidayArray:any[] = []
            if (data){
                if (data["stockExchangeName"] && data["stockExchangeName"] == "New York Stock Exchange") {
                    let seData = data["stockMarketHolidays"]
                    if (seData) {
                        for (let yearHolidays of seData) {
                            if (yearHolidays.year == currentYear) {
                                for (let holiday in yearHolidays) {
                                    if (holiday != "year"){
                                        let holidayObj = {
                                            holiday: holiday,
                                            date: yearHolidays[holiday]
                                        }
                                        holidayArray.push(holidayObj)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return holidayArray
        })
    }

    public static screener(marketCap:any, beta:any, volume:any, dividend:any, sector:any, industry:any, exchange:any){
        let marketCapQuery = ""
        const queryParts:string[] = []
        if (marketCap){
            marketCapQuery = marketCap.operation === ">" ? "marketCapMoreThan" : "marketCapLowerThan"
            marketCapQuery += `=${marketCap.value}`
            queryParts.push(marketCapQuery)
        }
        if (beta){
            let betaQuery = beta.operation === ">" ? "betaMoreThan" : "betaLowerThan"
            betaQuery += `=${beta.value}`
            queryParts.push(betaQuery)
        }
        if (volume){
            let volumeQuery = volume.operation === ">" ? "volumeMoreThan" : "volumeLowerThan"
            volumeQuery += `=${volume.value}`
            queryParts.push(volumeQuery)
        }
        if (dividend){
            let dividendQuery = dividend.operation === ">" ? "dividendMoreThan" : "dividendLowerThan"
            dividendQuery += `=${dividend.value}`
            queryParts.push(dividendQuery)
        }
        if (sector) {
            const sectorQuery = `sector=${sector}`
            queryParts.push(sectorQuery)
        }
        if (industry){
            const industryQuery = `industry=${industry}`
            queryParts.push(industryQuery)
        }
        if (exchange){
            const exchangeQuery = `exchange=${exchange}`
            queryParts.push(exchangeQuery)
        }
        let query = ""
        for (let i = 0; i < queryParts.length; i++){
            if (i === 0){
                query += `?${queryParts[i]}`
            } else {
                query += `&${queryParts[i]}`
            }
        }
        const url = `${FMPService.baseUrlv3}stock-screener${query}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(data => {
            return data
        })
    }

    public static getInstitutionalHoldersForSymbol(symbol:string) {
        const url = `${FMPService.baseUrlv3}institutional-holder/${symbol}?apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(data => {
            let totalShares = 0
            let totalChange = 0
            for (const d of data){
                totalShares += d.shares
                totalChange += d.change
            }
            return {
                shares: totalShares,
                change: totalChange
            }
        })
    }

    public static getStockSplitCalendar(){
        const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        const url = `${FMPService.baseUrlv3}stock_split_calendar?from=${todayString}&to=${todayString}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(data => {
            let returnMap:any = {}
            for (let d of data){
                returnMap[d.symbol] = d
            }
            return returnMap
        })
    }

    //only care about purchase and sales
    public static getInsiderSummaryForSymbol(symbol:string){
        let purchaseType = "P-Purchase"
        let sellType = "S-Sale"
        const url = `${FMPService.baseUrlv4}insider-trading?symbol=${symbol}&transactionType=P-Purchase,S-Sale&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(data => {
            let filtered = data.filter(d => d.transactionType == purchaseType || d.transactionType == sellType)
            let netTransacted = 0
            let days = 0
            if (filtered.length == 1){
                days = 1
            }
            for (let item of filtered) {
                let d = Utilities.countDaysBetweenDateStrings(filtered[0].transactionDate, item.transactionDate)
                if (d < 180){
                    break
                }
                let total = item.securitiesTransacted * item.price
                if (item.transactionType == sellType) {
                    total = -total
                }
                netTransacted += total
            }
            return {
                netTransacted: Math.round(netTransacted),
                days: days
            }
        })
    }

    public static getNewsForSymbol(symbol:string, limit:number){
        const url = `${FMPService.baseUrlv3}stock_news?tickers=${symbol}&limit=${limit}&apikey=${FMPService.apikey}`
        return FMPService.fetchDataFromUrl(url).then(data => {
            return data.map(n => FMPService.convertNews(n))
        })
    }

    public static getWeeklyEconomicData(init:boolean = false){
        let from = Utilities.convertUnixTimestampToDateString(Date.now())
        if (init){
            from = `2017-01-01`
        }        
        let aggregatedObject:any = {}
        let url = `${FMPService.baseUrlv4}economic?name=initialClaims&from=${from}&apikey=${FMPService.apikey}`
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data1: any) => {
            aggregatedObject = FMPService.addEconomyArrayDataToAggregate(aggregatedObject, "initialClaims", data1)
            return Object.values(aggregatedObject)
        })
    }

    public static getMonthlyEconomicData(init:boolean = false){
        let from = Utilities.convertUnixTimestampToDateString(Date.now())
        if (init){
            from = `2017-01-01`
        }
        let aggregatedObject:any = {}
        let url = `${FMPService.baseUrlv4}economic?name=smoothedUSRecessionProbabilities&from=${from}&apikey=${FMPService.apikey}`
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data1: any) => {
            aggregatedObject = FMPService.addEconomyArrayDataToAggregate(aggregatedObject, "recessionProbability", data1)
            url = `${FMPService.baseUrlv4}economic?name=unemploymentRate&from=${from}&apikey=${FMPService.apikey}`
            return delay(1000).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data2: any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "unemploymentPercent", data2)
            url = `${FMPService.baseUrlv4}economic?name=federalFunds&from=${from}&apikey=${FMPService.apikey}`
            return delay(1000).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data3: any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "fedFundsRate", data3)
            url = `${FMPService.baseUrlv4}economic?name=CPI&from=${from}&apikey=${FMPService.apikey}`
            return delay(1000).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data4: any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "consumerPriceIndex", data4)
            url = `${FMPService.baseUrlv4}economic?name=industrialProductionTotalIndex&from=${from}&apikey=${FMPService.apikey}`
            return delay(1000).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data5:any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "industrialProductionIndex", data5)
            url = `${FMPService.baseUrlv4}economic?name=retailSales&from=${from}&apikey=${FMPService.apikey}`
            return delay(1000).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data6:any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "retailSales", data6)
            url = `${FMPService.baseUrlv4}economic?name=consumerSentiment&from=${from}&apikey=${FMPService.apikey}`
            return delay(1000).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data7:any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "consumerSentiment", data7)
            url = `${FMPService.baseUrlv4}economic?name=retailMoneyFunds&from=${from}&apikey=${FMPService.apikey}`
            return delay(1000).then(() => fetch(url))
        })
        .then((res: { json: () => any; }) => res.json())
        .then((data8:any) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "retailMoneyFunds", data8)
            return Object.values(aggregatedObject)
        })
    }

    public static getQuarterlyEconomicData(init:boolean = false){
        let from = Utilities.convertUnixTimestampToDateString(Date.now())
        if (init){
            from = `2015-01-01`
        }
        const url = `${FMPService.baseUrlv4}economic?name=realGDP&from=${from}&apikey=${FMPService.apikey}`
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data: any) => {
            return data.map(d => {
                return {
                    id: d.date,
                    realGDP: d.value
                }
            })
        })
    }

    private static async fetchDataFromUrl(url:string){
        return fetch(url)
        .then((res: { json: () => any; }) => res.json())
        .then((data: any) => {
            return data
        }).catch(err => {
            console.log(err)
            return err
        })
    }

    private static async fetchDataFromUrlWithCallback(url: string, callback: any) {
        FMPService.fetchQueue.push({ url: url, callback: callback, id:FMPService.latestRequestId+=1 })
        if (!FMPService.workingOnQueue) {
            FMPService.workingOnQueue = true
            while (FMPService.fetchQueue.length) {
                let nextRequest = FMPService.fetchQueue.shift()
                let url = nextRequest.url
                let cb = nextRequest.callback
                let diff = Date.now() - FMPService.lastFetchTime
                if (diff <= (FMPService.cooldown)) {
                    await new Promise(resolve => setTimeout(resolve, FMPService.cooldown));
                }
                FMPService.lastFetchTime = Date.now()
                fetch(url)
                    .then((res: { json: () => any; }) => res.json())
                    .then((data: any) => {
                        cb(data)
                    }).catch(err => {
                        cb(err)
                    })
            }
            FMPService.workingOnQueue = false
        }
    }

    private static mergeKeyAndAdvancedStats(keystats:any[], advancedStats:any[]){
        const combinedArray:SimplifiedAdvancedStats[] = []
        for (let i = 0; i < keystats.length; i++){
            const keystat = keystats[i]
            const advancedStat = advancedStats[i]
            const combined = { ...keystat, ...advancedStat}
            combinedArray.push(FMPService.convertAdvancedStatsToSimple(combined))
        }
        return combinedArray
    }

    public static convertFMPQuoteToSimple(fmpQuote:any, isUSMarketOpen){
        const quote:SimpleQuote = {
            symbol: fmpQuote.symbol,
            open: fmpQuote.open,
            close: fmpQuote.close ?? fmpQuote.price,
            high: fmpQuote.dayHigh,
            low: fmpQuote.dayLow,
            latestPrice: fmpQuote.price,
            latestTime: Utilities.convertUnixTimestampToTimeStringWithSeconds(fmpQuote.timestamp),
            latestUpdate: fmpQuote.timestamp,
            latestVolume: fmpQuote.volume,
            previousClose: fmpQuote.previousClose,
            change: fmpQuote.change,
            changePercent: fmpQuote.changesPercentage / 100.0,
            avgTotalVolume: fmpQuote.avgVolume,
            week52High: fmpQuote.yearHigh,
            week52Low: fmpQuote.yearLow,
            peRatio: fmpQuote.pe,

            isUSMarketOpen: isUSMarketOpen,   //
            closeTime: 0,           //
            openTime: 0,            //
            latestSource: "",       //
            previousVolume: 0,      //
            extendedPrice: 0 ,      //
            extendedChange: 0,      //
            extendedChangePercent:0,//
            extendedPriceTime: 0,   //
        }
        return quote
    }

    public static convertPriceDataObjectToChartEntry(priceData:any) {
        const chartEntry:ChartEntry = {
            date: priceData.date,
            open: priceData.open,
            close: priceData.adjClose,
            high: priceData.high,
            low: priceData.low,
            volume: priceData.volume,
            earnings: false
        }
        return chartEntry
    }

    public static convertBalanceSheetToSimple(balanceSheet:any){
        let fiscalDate = balanceSheet.date        
        let reportDate = balanceSheet.fillingDate
        if (!fiscalDate || !reportDate) {
            return null
        }
        if (balanceSheet.date.includes(" ")) {
            fiscalDate = balanceSheet.date.split(" ")[0]
        }
        if (balanceSheet.fillingDate.includes(" ")) {
            reportDate = balanceSheet.fillingDate.split(" ")[0]
        }
        const simpleBalanceSheet:SimplifiedBalanceSheet = {
            reportDate: reportDate,
            fiscalDate: fiscalDate,
            period: balanceSheet.period === "FY" ? "FY " + balanceSheet.calendarYear : balanceSheet.period + " " + balanceSheet.calendarYear,
            cashAndCashEquivalents: balanceSheet.cashAndCashEquivalents,
            totalAssets: balanceSheet.totalAssets,
            totalLiabilities: balanceSheet.totalLiabilities,
            totalDebt: balanceSheet.totalDebt,
            netDebt: balanceSheet.netDebt,
            totalStockholdersEquity: balanceSheet.totalStockholdersEquity,
        }
        return simpleBalanceSheet
    }

    public static convertIncomeStatementToSimple(incomeStatement:any){
        let fiscalDate = incomeStatement.date        
        let reportDate = incomeStatement.fillingDate
        if (!fiscalDate || !reportDate) {
            return null
        }
        if (incomeStatement.date.includes(" ")) {
            fiscalDate = incomeStatement.date.split(" ")[0]
        }
        if (incomeStatement.fillingDate.includes(" ")) {
            reportDate = incomeStatement.fillingDate.split(" ")[0]
        }
        const simplifiedIncome:SimplifiedIncome = {
            reportDate: reportDate, 
            fiscalDate: fiscalDate,
            period: incomeStatement.period === "FY" ? "FY " + incomeStatement.calendarYear : incomeStatement.period + " " + incomeStatement.calendarYear,
            totalRevenue: incomeStatement.revenue,
            researchAndDevelopment: incomeStatement.researchAndDevelopmentExpenses,
            costOfRevenue: incomeStatement.costOfRevenue,
            operatingExpense: incomeStatement.operatingExpenses,
            operatingIncome: incomeStatement.operatingIncome,
            netIncome: incomeStatement.netIncome,
            grossProfit: incomeStatement.grossPofit,
            eps: incomeStatement.eps,
            epsDiluted: incomeStatement.epsDiluted,
            ebitda: incomeStatement.ebitda
        }
        return simplifiedIncome
    }

    public static convertCashFlowToSimple(cashFlow:any){
        let fiscalDate = cashFlow.date
        let reportDate = cashFlow.fillingDate
        if (!fiscalDate || !reportDate) {
            return null
        }
        if (cashFlow.date.includes(" ")) {
            fiscalDate = cashFlow.date.split(" ")[0]
        }
        if (cashFlow.fillingDate.includes(" ")) {
            reportDate = cashFlow.fillingDate.split(" ")[0]
        }
        const simplifiedCashFlow:SimplifiedCashFlow = {
            reportDate: reportDate,
            fiscalDate: fiscalDate,
            period: cashFlow.period === "FY" ? "FY " + cashFlow.calendarYear : cashFlow.period + " " + cashFlow.calendarYear,
            netIncome: cashFlow.netIncome,
            cashChange: cashFlow.netChangeInCash,
            cashFlow: cashFlow.freeCashFlow,
            capitalExpenditures: cashFlow.capitalExpenditure,
            dividendsPaid: cashFlow.dividendsPaid
        }
        return simplifiedCashFlow
    }

    public static convertEarningsToSimple(earnings:any):SimplifiedEarnings {
        const e:SimplifiedEarnings = {
            EPSReportDate: earnings.date,
            actualEPS: earnings.eps,
            consensusEPS: earnings.epsEstimated,
            announceTime: earnings.time,
            revenue: earnings.revenue,
            revenueEstimated: earnings.revenueEstimated,
            symbol: earnings.symbol,
            numberOfEstimates: 0,
            EPSSurpriseDollar: 0,
            fiscalPeriod: "",
            fiscalEndDate: "",
            yearAgo: 0,
            yearAgoChangePercent: 0
        }
        return e
    }

    public static convertAdvancedStatsToSimple(keyAndAdvanced:any):SimplifiedAdvancedStats {
        const adv:SimplifiedAdvancedStats = {
            enterpriseValue: keyAndAdvanced.enterpriseValue,
            enterpriseValueToRevenue: keyAndAdvanced.enterpriseValueMultiple,
            debtToEquity: keyAndAdvanced.debtToEquity,
            revenuePerShare: keyAndAdvanced.revenuePerShare,
            pegRatio: keyAndAdvanced.priceEarningsToGrowthRatio,
            priceToBook: keyAndAdvanced.priceToBookRatio,
            priceToSales: keyAndAdvanced.priceToSalesRatio,
            profitMargin: keyAndAdvanced.grossProfitMargin,
            debtToAssets: keyAndAdvanced.debtToAssets,
            priceFairValue: keyAndAdvanced.priceFairValue,
            date: keyAndAdvanced.date
        }
        return adv
    }

    public static async aggregate(symbols: string[]) {
        const aggregateArray: any[] = []
        for (const symbol of symbols) {
            console.log(`aggregating ${symbol}`)
            const period = "quarter"
            const limit = "999"
            let url = `${FMPService.baseUrlv3}balance-sheet-statement/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`
            const bss = await FMPService.fetchDataFromUrl(url).then(balanceSheets => {
                return balanceSheets
            })
            url = `${FMPService.baseUrlv3}income-statement/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`
            const iss = await FMPService.fetchDataFromUrl(url).then(incomes => {
                return incomes
            })
            url = `${FMPService.baseUrlv3}cash-flow-statement/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`
            const cfs = await FMPService.fetchDataFromUrl(url).then(cashflows => {
                return cashflows
            })
            url = `${FMPService.baseUrlv3}ratios/${symbol}?limit=${limit}&period=${period}&apikey=${FMPService.apikey}`
            const ratios = await FMPService.fetchDataFromUrl(url).then(data => {
                return data
            })
            for (let i = 0; i < bss.length; i++) {
                const bs = bss[i]
                const inc = iss[i]
                const cf = cfs[i]
                const rat = ratios[i]
                if (!bs.date || bs.date === "") {
                    continue
                }
                const obj = { ...bs, ...inc, ...cf, ...rat }
                aggregateArray.push(obj)
            }
        }
        return aggregateArray
    }

    public static addEconomyArrayDataToAggregate(aggregatedObject: any, key: string, data: any[]) {
        for (let d of data) {
            let dateTimestamp = d.date
            
            //sandbox doesnt have the date field so we have to use "updated" for testing
            if (!dateTimestamp) {
                dateTimestamp = d.updated
            }
            
            if (dateTimestamp) {
                const dateString = dateTimestamp
                if (!aggregatedObject.hasOwnProperty(dateString)) {
                    aggregatedObject[dateString] = {}
                    aggregatedObject[dateString].id = dateString
                }
                aggregatedObject[dateString][key] = d.value
            }
        }
        return aggregatedObject
    }
}
