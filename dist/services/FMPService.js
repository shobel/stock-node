"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Utilities_1 = require("../utils/Utilities");
const StockDao_1 = require("../dao/StockDao");
const ScheduledUpdateService_1 = require("./ScheduledUpdateService");
const StockDataService_1 = require("./StockDataService");
const delay = require("delay");
const fetch = require('node-fetch');
const fetchRetry = require('fetch-retry')(fetch);
class FMPService {
    static async populateAllHistoryForSymbol(symbol) {
        console.log(`processing ${symbol}`);
        const start = Date.now();
        let company = await FMPService.getCompanyProfileAndPeers(symbol);
        FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.companyField, company);
        if (company.isCompany) {
            await FMPService.updateAllFinancialDataForSymbol(symbol, false);
        }
        else {
            console.log(`${symbol} is not a company`);
        }
        const end = Date.now();
        const dur = (end - start) / 1000;
        console.log(`Finished financial data for ${symbol}`);
        console.log(`${dur} seconds for ${symbol}`);
        console.log();
    }
    //this function is scheduled "around" earnings for each stock. It will actually save the latest
    //5 financial statements in each collection, so this should correct any data we might have missed
    //i.e. if our server goes down and we miss earnings for a few symbols, those symbols will be corrected
    //at their next earnings 
    static async updateAllFinancialDataSingleEndpoint(symbol) {
        symbol = symbol.toUpperCase();
        let url = `${FMPService.baseUrlv4}${FMPService.companyOutlookEndpoint}?symbol=${symbol}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(data => {
            var _a, _b, _c, _d, _e, _f;
            let incomesAnnual = (_a = data === null || data === void 0 ? void 0 : data.financialsAnnual) === null || _a === void 0 ? void 0 : _a.income;
            if (incomesAnnual) {
                if (Array.isArray(incomesAnnual)) {
                    incomesAnnual = incomesAnnual.map(i => FMPService.convertIncomeStatementToSimple(i)).filter(i => i).filter(i => i === null || i === void 0 ? void 0 : i.period.includes("FY"));
                }
                let annualIncomeStatements = { [symbol]: incomesAnnual };
                if (annualIncomeStatements[symbol].length) {
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualIncome, annualIncomeStatements[symbol][0]);
                    FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.annualIncomeCollection, "fiscalDate", annualIncomeStatements);
                }
            }
            let incomesQuarterly = (_b = data === null || data === void 0 ? void 0 : data.financialsQuarter) === null || _b === void 0 ? void 0 : _b.income;
            if (incomesQuarterly) {
                if (Array.isArray(incomesQuarterly)) {
                    incomesQuarterly = incomesQuarterly.map(i => FMPService.convertIncomeStatementToSimple(i)).filter(i => i).filter(i => i === null || i === void 0 ? void 0 : i.period.includes("Q"));
                }
                let quarterlyIncomes = { [symbol]: incomesQuarterly };
                if (quarterlyIncomes[symbol].length) {
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestQuarterlyBalanceSheet, quarterlyIncomes[symbol][0]);
                    FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.incomeCollection, "fiscalDate", quarterlyIncomes);
                    const latestEarningsDate = quarterlyIncomes[symbol][0].reportDate;
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.lastEarningsDate, latestEarningsDate);
                }
            }
            let balanceSheetsAnnual = (_c = data === null || data === void 0 ? void 0 : data.financialsAnnual) === null || _c === void 0 ? void 0 : _c.balance;
            if (balanceSheetsAnnual) {
                if (Array.isArray(balanceSheetsAnnual)) {
                    balanceSheetsAnnual = balanceSheetsAnnual.map(i => FMPService.convertBalanceSheetToSimple(i)).filter(i => i).filter(i => i === null || i === void 0 ? void 0 : i.period.includes("FY"));
                }
                let annualBalanceSheets = { [symbol]: balanceSheetsAnnual };
                if (annualBalanceSheets[symbol].length) {
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualBalanceSheet, annualBalanceSheets[symbol][0]);
                    FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.annualBalanceSheetCollection, "fiscalDate", annualBalanceSheets);
                }
            }
            let balanceSheetsQuarterly = (_d = data === null || data === void 0 ? void 0 : data.financialsQuarter) === null || _d === void 0 ? void 0 : _d.balance;
            if (balanceSheetsQuarterly) {
                if (Array.isArray(balanceSheetsQuarterly)) {
                    balanceSheetsQuarterly = balanceSheetsQuarterly.map(i => FMPService.convertBalanceSheetToSimple(i)).filter(i => i).filter(i => i === null || i === void 0 ? void 0 : i.period.includes("Q"));
                }
                let quarterlyBalanceSheets = { [symbol]: balanceSheetsQuarterly };
                if (quarterlyBalanceSheets[symbol].length) {
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestQuarterlyBalanceSheet, quarterlyBalanceSheets[symbol][0]);
                    FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.balanceSheetCollection, "fiscalDate", quarterlyBalanceSheets);
                    const latestEarningsDate = quarterlyBalanceSheets[symbol][0].reportDate;
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.lastEarningsDate, latestEarningsDate);
                }
            }
            let cashflowsAnnual = (_e = data === null || data === void 0 ? void 0 : data.financialsAnnual) === null || _e === void 0 ? void 0 : _e.cash;
            if (cashflowsAnnual) {
                if (Array.isArray(cashflowsAnnual)) {
                    cashflowsAnnual = cashflowsAnnual.map(i => FMPService.convertCashFlowToSimple(i)).filter(i => i).filter(i => i === null || i === void 0 ? void 0 : i.period.includes("FY"));
                }
                let annualBalanceSheets = { [symbol]: cashflowsAnnual };
                let annualCashFlows = { [symbol]: annualBalanceSheets };
                if (annualCashFlows[symbol].length) {
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualCashFlow, annualCashFlows[symbol][0]);
                    FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.annualCashFlowCollection, "fiscalDate", annualCashFlows);
                }
            }
            let cashflowsQuarterly = (_f = data === null || data === void 0 ? void 0 : data.financialsQuarter) === null || _f === void 0 ? void 0 : _f.cash;
            if (cashflowsQuarterly) {
                if (Array.isArray(cashflowsQuarterly)) {
                    cashflowsQuarterly = cashflowsQuarterly.map(i => FMPService.convertCashFlowToSimple(i)).filter(i => i).filter(i => i === null || i === void 0 ? void 0 : i.period.includes("Q"));
                }
                let quarterlyCashFlows = { [symbol]: cashflowsQuarterly };
                if (quarterlyCashFlows[symbol].length) {
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestQuarterlyBalanceSheet, quarterlyCashFlows[symbol][0]);
                    FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.cashFlowCollection, "fiscalDate", quarterlyCashFlows);
                    const latestEarningsDate = quarterlyCashFlows[symbol][0].reportDate;
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.lastEarningsDate, latestEarningsDate);
                }
            }
        }).then(() => {
            return FMPService.getFinancialsExcludingStatements(symbol, true);
        });
    }
    static async updateAllFinancialDataForSymbol(symbolInput, isDailyUpdate) {
        const symbol = symbolInput.toUpperCase();
        console.log(`updating financials for ${symbol}`);
        let annualLimit = 4;
        let quarterLimit = 16;
        let earningsLimit = 20;
        if (isDailyUpdate) {
            annualLimit = 1;
            quarterLimit = 1;
            earningsLimit = 5;
        }
        let quarterlyBalanceSheets = await FMPService.getBalanceSheetsForSymbol(symbol, "quarter", quarterLimit);
        quarterlyBalanceSheets = quarterlyBalanceSheets.filter(qbs => qbs === null || qbs === void 0 ? void 0 : qbs.period.includes("Q"));
        quarterlyBalanceSheets = { [symbol]: quarterlyBalanceSheets };
        let annualBalanceSheets = await FMPService.getBalanceSheetsForSymbol(symbol, "annual", annualLimit);
        annualBalanceSheets = annualBalanceSheets.filter(abs => abs === null || abs === void 0 ? void 0 : abs.period.includes("FY"));
        annualBalanceSheets = { [symbol]: annualBalanceSheets };
        if (annualBalanceSheets[symbol].length) {
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualBalanceSheet, annualBalanceSheets[symbol][0]);
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.annualBalanceSheetCollection, "fiscalDate", annualBalanceSheets);
        }
        if (quarterlyBalanceSheets[symbol].length) {
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestQuarterlyBalanceSheet, quarterlyBalanceSheets[symbol][0]);
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.balanceSheetCollection, "fiscalDate", quarterlyBalanceSheets);
            const latestEarningsDate = quarterlyBalanceSheets[symbol][0].reportDate;
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.lastEarningsDate, latestEarningsDate);
        }
        let quarterlyIncomeStatements = await FMPService.getIncomeStatementsForSymbol(symbol, "quarter", quarterLimit);
        quarterlyIncomeStatements = quarterlyIncomeStatements.filter(qis => qis === null || qis === void 0 ? void 0 : qis.period.includes("Q"));
        quarterlyIncomeStatements = { [symbol]: quarterlyIncomeStatements };
        let annualIncomeStatements = await FMPService.getIncomeStatementsForSymbol(symbol, "annual", annualLimit);
        annualIncomeStatements = annualIncomeStatements.filter(ais => ais === null || ais === void 0 ? void 0 : ais.period.includes("FY"));
        annualIncomeStatements = { [symbol]: annualIncomeStatements };
        if (annualIncomeStatements[symbol].length) {
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualIncome, annualIncomeStatements[symbol][0]);
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.annualIncomeCollection, "fiscalDate", annualIncomeStatements);
        }
        if (quarterlyIncomeStatements[symbol].length) {
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestQuarterlyIncome, quarterlyIncomeStatements[symbol][0]);
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.incomeCollection, "fiscalDate", quarterlyIncomeStatements);
        }
        let quarterlyCashFlows = await FMPService.getCashFlowsForSymbol(symbol, "quarter", quarterLimit);
        quarterlyCashFlows = quarterlyCashFlows.filter(qcf => qcf === null || qcf === void 0 ? void 0 : qcf.period.includes("Q"));
        quarterlyCashFlows = { [symbol]: quarterlyCashFlows };
        let annualCashFlows = await FMPService.getCashFlowsForSymbol(symbol, "annual", annualLimit);
        annualCashFlows = annualCashFlows.filter(acf => acf === null || acf === void 0 ? void 0 : acf.period.includes("FY"));
        annualCashFlows = { [symbol]: annualCashFlows };
        if (annualCashFlows[symbol].length) {
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualCashFlow, annualCashFlows[symbol][0]);
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.annualCashFlowCollection, "fiscalDate", annualCashFlows);
        }
        if (quarterlyCashFlows[symbol].length) {
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestQuarterlyCashFlow, quarterlyCashFlows[symbol][0]);
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.cashFlowCollection, "fiscalDate", quarterlyCashFlows);
        }
        let keyAndAdvancedAnnual = await FMPService.getAdvancedStatsForSymbol(symbol, "annual", annualLimit);
        keyAndAdvancedAnnual = { [symbol]: keyAndAdvancedAnnual };
        if (keyAndAdvancedAnnual[symbol].length) {
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualAdvancedStats, keyAndAdvancedAnnual[symbol][0]);
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.annualAdvancedStatsCollection, "date", keyAndAdvancedAnnual);
        }
        let keyAndAdvanced = await FMPService.getAdvancedStatsForSymbol(symbol, "quarter", quarterLimit);
        keyAndAdvanced = { [symbol]: keyAndAdvanced };
        if (keyAndAdvanced[symbol].length) {
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAdvancedStats, keyAndAdvanced[symbol][0]);
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.advancedStatsCollection, "date", keyAndAdvanced);
        }
        let earnings = await FMPService.getEarningsForSymbol(symbol, earningsLimit);
        const earningsRevised = [];
        //seems to be some sort of check that makes sure we don't save false earnings reports that are 
        //too close together, ie less than 30 days apart
        for (let i = 0; i < earnings.length; i++) {
            const currentEarnings = earnings[i];
            if (i < earnings.length - 1) {
                const previousEarnings = earnings[i + 1];
                if (Utilities_1.default.countDaysBetweenDateStrings(currentEarnings.EPSReportDate, previousEarnings.EPSReportDate) > 30) {
                    earningsRevised.push(currentEarnings);
                }
            }
            else {
                earningsRevised.push(currentEarnings);
            }
        }
        earnings = earningsRevised;
        if (earnings.length) {
            const savedEarnings = await FMPService.stockDao.getMostRecentDocsFromSubCollectionForSymbol(symbol, FMPService.stockDao.earningsCollection, earningsLimit);
            for (let i = 0; i < earnings.length; i++) {
                for (const savedEarning of savedEarnings) {
                    if (savedEarning.EPSReportDate === earnings[i].EPSReportDate) {
                        earnings[i].yearAgo = savedEarning.yearAgo;
                    }
                }
                if (i + 4 < earnings.length) {
                    earnings[i].yearAgo = earnings[i + 4].actualEPS;
                }
            }
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.earningsCollection, 'EPSReportDate', { [symbol]: earnings });
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestEarnings, earnings[0]);
        }
        const ih = await FMPService.getInstitutionalHoldersForSymbol(symbol);
        await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.institutionalOwnership, ih);
        return earnings;
    }
    static async getFinancialsExcludingStatements(symbol, shortLimits) {
        let annualLimit = 4;
        let quarterLimit = 16;
        let earningsLimit = 20;
        if (shortLimits) {
            annualLimit = 1;
            quarterLimit = 1;
            earningsLimit = 5;
        }
        let keyAndAdvancedAnnual = await FMPService.getAdvancedStatsForSymbol(symbol, "annual", annualLimit);
        keyAndAdvancedAnnual = { [symbol]: keyAndAdvancedAnnual };
        if (keyAndAdvancedAnnual[symbol].length) {
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAnnualAdvancedStats, keyAndAdvancedAnnual[symbol][0]);
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.annualAdvancedStatsCollection, "date", keyAndAdvancedAnnual);
        }
        let keyAndAdvanced = await FMPService.getAdvancedStatsForSymbol(symbol, "quarter", quarterLimit);
        keyAndAdvanced = { [symbol]: keyAndAdvanced };
        if (keyAndAdvanced[symbol].length) {
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestAdvancedStats, keyAndAdvanced[symbol][0]);
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.advancedStatsCollection, "date", keyAndAdvanced);
        }
        let earnings = await FMPService.getEarningsForSymbol(symbol, earningsLimit);
        const earningsRevised = [];
        //seems to be some sort of check that makes sure we don't save false earnings reports that are 
        //too close together, ie less than 30 days apart
        for (let i = 0; i < earnings.length; i++) {
            const currentEarnings = earnings[i];
            if (i < earnings.length - 1) {
                const previousEarnings = earnings[i + 1];
                if (Utilities_1.default.countDaysBetweenDateStrings(currentEarnings.EPSReportDate, previousEarnings.EPSReportDate) > 30) {
                    earningsRevised.push(currentEarnings);
                }
            }
            else {
                earningsRevised.push(currentEarnings);
            }
        }
        earnings = earningsRevised;
        if (earnings.length) {
            const savedEarnings = await FMPService.stockDao.getMostRecentDocsFromSubCollectionForSymbol(symbol, FMPService.stockDao.earningsCollection, earningsLimit);
            for (let i = 0; i < earnings.length; i++) {
                for (const savedEarning of savedEarnings) {
                    if (savedEarning.EPSReportDate === earnings[i].EPSReportDate) {
                        earnings[i].yearAgo = savedEarning.yearAgo;
                    }
                }
                if (i + 4 < earnings.length) {
                    earnings[i].yearAgo = earnings[i + 4].actualEPS;
                }
            }
            await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.earningsCollection, 'EPSReportDate', { [symbol]: earnings });
            await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestEarnings, earnings[0]);
        }
        const ih = await FMPService.getInstitutionalHoldersForSymbol(symbol);
        await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.institutionalOwnership, ih);
        return earnings;
    }
    //peers can be called in batch (symbol=MSFT,FB,etc)
    //float endpoint can also be called for all stocks if needed
    static async getCompanyProfileAndPeers(symbol) {
        let companyData = {};
        let profileUrl = `${FMPService.baseUrlv3}${FMPService.companyEndpoint}/${symbol}?apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(profileUrl).then(profile => {
            if (profile && profile.length) {
                companyData = profile[0];
            }
            let peersUrl = `${FMPService.baseUrlv4}${FMPService.peersEndpoint}?symbol=${symbol}&apikey=${FMPService.apikey}`;
            return FMPService.fetchDataFromUrl(peersUrl);
        }).then(peers => {
            if (peers && peers.length && peers[0].hasOwnProperty("peersList")) {
                companyData.peers = peers[0].peersList;
            }
            let floatUrl = `${FMPService.baseUrlv4}${FMPService.floatEndpoint}?symbol=${symbol}&apikey=${FMPService.apikey}`;
            return FMPService.fetchDataFromUrl(floatUrl);
        }).then(float => {
            if (float.length) {
                float = float[0];
                companyData.float = float.floatShares;
                companyData.sharesOutstanding = float.outstandingShares;
                companyData.freeFloat = float.freeFloat; //its a percent
            }
            companyData.isCompany = StockDataService_1.default.isCompany(companyData);
            companyData.logo = companyData.image;
            companyData.employees = companyData.fullTimeEmployees;
            delete companyData.image;
            delete companyData.fullTimeEmployees;
            return companyData;
        });
    }
    static async updateEarningsForSymbols(symbols) {
        const earningsLimit = 5;
        for (const symbol of symbols) {
            let earnings = await FMPService.getEarningsForSymbol(symbol, earningsLimit);
            const earningsRevised = [];
            for (let i = 0; i < earnings.length; i++) {
                const currentEarnings = earnings[i];
                if (i < earnings.length - 1) {
                    const previousEarnings = earnings[i + 1];
                    if (Utilities_1.default.countDaysBetweenDateStrings(currentEarnings.EPSReportDate, previousEarnings.EPSReportDate) > 30) {
                        earningsRevised.push(currentEarnings);
                    }
                }
                else {
                    earningsRevised.push(currentEarnings);
                }
            }
            earnings = earningsRevised;
            if (earnings.length) {
                const savedEarningsDocs = await FMPService.stockDao.getMostRecentDocRefsFromSubCollectionForSymbol(symbol, FMPService.stockDao.earningsCollection, earningsLimit);
                const savedEarnings = [];
                const savedEarningsDocMap = {};
                for (const savedEarningDoc of savedEarningsDocs) {
                    var data = savedEarningDoc.data();
                    savedEarningsDocMap[savedEarningDoc.id] = data;
                    savedEarnings.push(data);
                }
                for (let i = 0; i < earnings.length; i++) {
                    for (const savedEarning of savedEarnings) {
                        if (savedEarning.EPSReportDate === earnings[i].EPSReportDate) {
                            earnings[i].yearAgo = savedEarning.yearAgo;
                        }
                    }
                    if (i + 4 < earnings.length) {
                        earnings[i].yearAgo = earnings[i + 4].actualEPS;
                    }
                }
                var deleteArr = [];
                for (const savedEarningDoc of savedEarningsDocs) {
                    var foundMatch = false;
                    for (let i = 0; i < earnings.length; i++) {
                        if (savedEarningsDocMap[savedEarningDoc.id].EPSReportDate === earnings[i].EPSReportDate) {
                            foundMatch = true;
                        }
                    }
                    if (!foundMatch) {
                        deleteArr.push(savedEarningDoc.ref);
                    }
                }
                await FMPService.stockDao.batchDelete(deleteArr);
                await FMPService.stockDao.batchSaveMultipleDocsInSubcollectionForSymbols(FMPService.stockDao.stockCollection, FMPService.stockDao.earningsCollection, 'EPSReportDate', { [symbol]: earnings });
                await FMPService.stockDao.saveStockDocumentFieldForSymbol(symbol, FMPService.stockDao.latestEarnings, earnings[0]);
            }
        }
    }
    static updateAnnualEarningsEstimates(allSymbols) {
        let i = 0;
        for (let s of allSymbols) {
            let url = `${FMPService.baseUrlv3}${FMPService.estimatesEndpoint}/${s.toUpperCase()}?limit=${1}&apikey=${FMPService.apikey}`;
            FMPService.fetchDataFromUrlWithCallback(url, function (res) {
                if (res.length) {
                    console.log(`fetched ${i += 1} earnings estimates(${res[0].symbol})`);
                    FMPService.stockDao.saveStockDocumentFieldForSymbol(s, FMPService.stockDao.latestAnnualEstimates, res[0]);
                }
                else {
                    console.log(`fetched ${i += 1} earnings estimates (${s} no data)`);
                }
            });
        }
    }
    //for batch requests, currently only available for quotes
    static fetchDataForMoreThanAllowedSymbols(symbols, endpoint) {
        return new Promise((resolve, reject) => {
            const total = symbols.length;
            let currentProgress = 0;
            let combinedResult = [];
            for (let i = 0; i < symbols.length; i += FMPService.maxAllowedSymbols) {
                let symbolsSubset = new Array();
                if ((i + (FMPService.maxAllowedSymbols - 1)) > symbols.length) {
                    symbolsSubset = symbols.slice(i, symbols.length);
                }
                else {
                    symbolsSubset = symbols.slice(i, i + FMPService.maxAllowedSymbols);
                }
                const url = `${FMPService.baseUrlv3}${endpoint}${symbolsSubset}?apikey=${FMPService.apikey}`;
                fetchRetry(url, {
                    retries: 1,
                    retryDelay: 100,
                    retryOn: function (attempt, error, response) {
                        if (error !== null || response.status >= 400) {
                            console.log(`retrying ${i + 1} - ${i + symbolsSubset.length}`);
                            return true;
                        }
                        return false;
                    }
                }).then((res) => {
                    return res.json();
                }).then((json) => {
                    combinedResult = combinedResult.concat(json);
                    currentProgress += symbolsSubset.length;
                    if (currentProgress >= total) {
                        resolve(combinedResult);
                    }
                });
            }
        });
    }
    //gets foreign symbols as well. 36,860 symbols
    static getAllSymbols() {
        const url = `${FMPService.baseUrlv3}stock/list?apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url);
    }
    static getQuoteForAllSymbols() {
        let url = `${FMPService.baseUrlv3}quotes/nyse?apikey=${FMPService.apikey}`;
        let allData = [];
        let start = Date.now();
        return FMPService.fetchDataFromUrl(url).then(res => {
            allData = res;
            let end = Date.now();
            let dur = (end - start) / 1000;
            console.log(`fetched nyse quotes in ${dur} secs`);
            url = `${FMPService.baseUrlv3}quotes/nasdaq?apikey=${FMPService.apikey}`;
            return FMPService.fetchDataFromUrl(url);
        }).then(res2 => {
            let end = Date.now();
            let dur = (end - start) / 1000;
            console.log(`fetched nasdaq. Done fetching quotes in ${dur} secs`);
            allData = [...allData, ...res2];
            url = `${FMPService.baseUrlv3}quotes/amex?apikey=${FMPService.apikey}`;
            return FMPService.fetchDataFromUrl(url);
        }).then(res3 => {
            let end = Date.now();
            let dur = (end - start) / 1000;
            console.log(`fetched amex. Done fetching quotes in ${dur} secs`);
            allData = [...allData, ...res3];
            url = `${FMPService.baseUrlv3}quotes/etf?apikey=${FMPService.apikey}`;
            return FMPService.fetchDataFromUrl(url);
        }).then(res4 => {
            let end = Date.now();
            let dur = (end - start) / 1000;
            console.log(`fetched etf. Done fetching quotes in ${dur} secs`);
            allData = [...allData, ...res4];
            return allData;
        });
    }
    static getQuoteForSymbols(symbols, isMarketOpen = true) {
        return FMPService.fetchDataForMoreThanAllowedSymbols(symbols, "quote/").then((result) => {
            return result.map(q => FMPService.convertFMPQuoteToSimple(q, isMarketOpen));
        }).catch(err => err);
    }
    static getExtendedQuoteForSymbol(symbol) {
        let todayString = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        let url = `${FMPService.baseUrlv4}historical-price/${symbol.toUpperCase()}/1/minute/${todayString}/${todayString}?apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrlWithCallback(url, function (res) {
            if (res && res.hasOwnProperty("results")) {
                let quotes = res["results"];
                let lastQuote = quotes[quotes.length - 1].c;
                console.log(lastQuote);
                return lastQuote;
            }
            return null;
        });
    }
    static getListType(endpoint) {
        const url = `${this.baseUrlv3}/${endpoint}?apikey=${FMPService.apikey}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data) => data).catch();
    }
    static getMarketNews(numItems) {
        let url = `${FMPService.baseUrlv3}${FMPService.newsEndpoint}?limit=${numItems}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(res => {
            if (res && res.length) {
                return res.map(n => FMPService.convertNews(n));
            }
            return res;
        });
    }
    //converts a FMP news object to IEX format
    static convertNews(news) {
        let convertedObj = {};
        convertedObj.date = news.publishedDate;
        convertedObj.headline = news.title;
        convertedObj.source = news.site;
        convertedObj.related = news.symbol;
        convertedObj.summary = news.text;
        //no change required
        convertedObj.url = news.url;
        convertedObj.image = news.image;
        return convertedObj;
    }
    //for some reason I was trying to pass in the current date as from= and to= but if you put in a date greater
    //than the latest trading day, which is easy to do (fetch anytime between midnight and 6:30am) it will return 
    //data for previous days as well, which is bad. But now I'm just omitting the from/to attributes and it seems
    //to be working
    static getIntradayChartForSymbol(symbol) {
        // const todayString = Utilities.convertUnixTimestampToDateString(Date.now())
        const url = `${FMPService.baseUrlv3}historical-chart/1min/${symbol}?apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(chart => {
            let latestDate = "";
            if (chart.length > 0) {
                let entry = chart[0];
                latestDate = entry.date.includes(" ") ? entry.date.split(" ")[0] : "";
            }
            else {
                return [];
            }
            let reversed = chart.reverse();
            let filteredResult = reversed.filter(r => r.high && r.low && r.open && r.close);
            filteredResult = filteredResult.filter(e => {
                let d = e.date.includes(" ") ? e.date.split(" ")[0] : "";
                return d == latestDate;
            });
            //fmp gives most recent price first AND sometimes includes prices from the previous day at the end (WTF?!)
            const chartEntries = [];
            let volumeSum = 0;
            for (let i = 0; i < filteredResult.length; i++) {
                const entry = filteredResult[i];
                if (i === 0) {
                    entry.volume = 0;
                }
                const chartEntry = {
                    date: entry.date.includes(" ") ? entry.date.split(" ")[0] : "",
                    label: entry.date.includes(" ") ? Utilities_1.default.convert24hTo12H(entry.date.split(" ")[1]) : "",
                    minute: entry.date.includes(" ") ? Utilities_1.default.convert24hTo12H(entry.date.split(" ")[1]) : "",
                    open: entry.open,
                    close: entry.close,
                    high: entry.high,
                    low: entry.low,
                    volume: entry.volume //entry.volume - volumeSum,
                };
                volumeSum += chartEntry.volume;
                chartEntries.push(chartEntry);
            }
            return chartEntries;
        });
    }
    static getFinancialDataForSymbol(symbol, period, endpoint, limit) {
        const url = `${FMPService.baseUrlv3}${endpoint}/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url);
    }
    //dont really need these next 3, can use above 1 instead
    static getBalanceSheetsForSymbol(symbol, period, limit) {
        const url = `${FMPService.baseUrlv3}balance-sheet-statement/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(balanceSheets => {
            if (Array.isArray(balanceSheets)) {
                const x = balanceSheets.map(bs => FMPService.convertBalanceSheetToSimple(bs));
                const y = x.filter(bs => bs);
                return y;
            }
            console.log(`error: ${balanceSheets}`);
            return [];
        });
    }
    static getIncomeStatementsForSymbol(symbol, period, limit) {
        const url = `${FMPService.baseUrlv3}income-statement/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(incomes => {
            if (Array.isArray(incomes)) {
                return incomes.map(i => FMPService.convertIncomeStatementToSimple(i)).filter(i => i);
            }
            console.log(`error: ${incomes}`);
            return [];
        });
    }
    static getCashFlowsForSymbol(symbol, period, limit) {
        const url = `${FMPService.baseUrlv3}cash-flow-statement/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(cashflows => {
            if (Array.isArray(cashflows)) {
                return cashflows.map(cf => FMPService.convertCashFlowToSimple(cf)).filter(cf => cf);
            }
            console.log(`error: ${cashflows}`);
            return [];
        });
    }
    //returns fully processed daily chart
    static getFullPriceHistoryForSymbol(symbol) {
        const url = `${FMPService.baseUrlv3}historical-price-full/${symbol}?from=${ScheduledUpdateService_1.default.fiveYearsAgoDateString}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(data => {
            return data.historical;
        });
    }
    static getEarningsForSymbol(symbol, limit) {
        const url = `${FMPService.baseUrlv3}historical/earning_calendar/${symbol}?limit=${limit}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(data => {
            if (Array.isArray(data)) {
                return data.map(e => FMPService.convertEarningsToSimple(e));
            }
            return [];
        });
    }
    static getSocialSentiment(symbol) {
        const url = `${FMPService.baseUrlv4}historical/social-sentiment?symbol=${symbol}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url);
    }
    static getTrendingBySocialSentiment() {
        const url = `${FMPService.baseUrlv4}social-sentiment/trending?apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url);
    }
    //options are twitter or stocktwits
    static getSocialSentimentChanges(source) {
        const url = `${FMPService.baseUrlv4}social-sentiments/change?type=bullish&source=${source}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url);
    }
    static async getAdvancedStatsForSymbol(symbol, period, limit) {
        const advancedStats = await FMPService.getRatiosForSymbol(symbol, period, limit);
        const keyMetrics = await FMPService.getKeyMetricsForSymbol(symbol, period, limit);
        const keyAndAdvanced = FMPService.mergeKeyAndAdvancedStats(keyMetrics, advancedStats);
        return keyAndAdvanced;
    }
    static getRatiosForSymbol(symbol, period, limit) {
        const url = `${FMPService.baseUrlv3}ratios/${symbol}?limit=${limit}&period=${period}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(data => {
            return data;
        });
    }
    static getKeyMetricsForSymbol(symbol, period, limit) {
        const url = `${FMPService.baseUrlv3}key-metrics/${symbol}?limit=${limit}&period=${period}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(data => {
            return data;
        });
    }
    static getIsMarketOpen() {
        const url = `${FMPService.baseUrlv3}is-the-market-open?apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(data => {
            return data && data["isTheStockMarketOpen"];
        });
    }
    static getHolidaysUsMarket() {
        const url = `${FMPService.baseUrlv3}is-the-market-open?apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(data => {
            var d = new Date();
            var currentYear = d.getFullYear();
            let holidayArray = [];
            if (data) {
                if (data["stockExchangeName"] && data["stockExchangeName"] == "New York Stock Exchange") {
                    let seData = data["stockMarketHolidays"];
                    if (seData) {
                        for (let yearHolidays of seData) {
                            if (yearHolidays.year == currentYear) {
                                for (let holiday in yearHolidays) {
                                    if (holiday != "year") {
                                        let holidayObj = {
                                            holiday: holiday,
                                            date: yearHolidays[holiday]
                                        };
                                        holidayArray.push(holidayObj);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return holidayArray;
        });
    }
    static screener(marketCap, beta, volume, dividend, sector, industry, exchange) {
        let marketCapQuery = "";
        const queryParts = [];
        if (marketCap) {
            marketCapQuery = marketCap.operation === ">" ? "marketCapMoreThan" : "marketCapLowerThan";
            marketCapQuery += `=${marketCap.value}`;
            queryParts.push(marketCapQuery);
        }
        if (beta) {
            let betaQuery = beta.operation === ">" ? "betaMoreThan" : "betaLowerThan";
            betaQuery += `=${beta.value}`;
            queryParts.push(betaQuery);
        }
        if (volume) {
            let volumeQuery = volume.operation === ">" ? "volumeMoreThan" : "volumeLowerThan";
            volumeQuery += `=${volume.value}`;
            queryParts.push(volumeQuery);
        }
        if (dividend) {
            let dividendQuery = dividend.operation === ">" ? "dividendMoreThan" : "dividendLowerThan";
            dividendQuery += `=${dividend.value}`;
            queryParts.push(dividendQuery);
        }
        if (sector) {
            const sectorQuery = `sector=${sector}`;
            queryParts.push(sectorQuery);
        }
        if (industry) {
            const industryQuery = `industry=${industry}`;
            queryParts.push(industryQuery);
        }
        if (exchange) {
            const exchangeQuery = `exchange=${exchange}`;
            queryParts.push(exchangeQuery);
        }
        let query = "";
        for (let i = 0; i < queryParts.length; i++) {
            if (i === 0) {
                query += `?${queryParts[i]}`;
            }
            else {
                query += `&${queryParts[i]}`;
            }
        }
        const url = `${FMPService.baseUrlv3}stock-screener${query}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(data => {
            return data;
        });
    }
    static getInstitutionalHoldersForSymbol(symbol) {
        const url = `${FMPService.baseUrlv3}institutional-holder/${symbol}?apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(data => {
            let totalShares = 0;
            let totalChange = 0;
            for (const d of data) {
                totalShares += d.shares;
                totalChange += d.change;
            }
            return {
                shares: totalShares,
                change: totalChange
            };
        });
    }
    static getStockSplitCalendar() {
        const todayString = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        const url = `${FMPService.baseUrlv3}stock_split_calendar?from=${todayString}&to=${todayString}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(data => {
            let returnMap = {};
            for (let d of data) {
                returnMap[d.symbol] = d;
            }
            return returnMap;
        });
    }
    //only care about purchase and sales
    static getInsiderSummaryForSymbol(symbol) {
        let purchaseType = "P-Purchase";
        let sellType = "S-Sale";
        const url = `${FMPService.baseUrlv4}insider-trading?symbol=${symbol}&transactionType=P-Purchase,S-Sale&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(data => {
            let filtered = data.filter(d => d.transactionType == purchaseType || d.transactionType == sellType);
            let netTransacted = 0;
            let days = 0;
            if (filtered.length == 1) {
                days = 1;
            }
            for (let item of filtered) {
                let d = Utilities_1.default.countDaysBetweenDateStrings(filtered[0].transactionDate, item.transactionDate);
                days = d;
                if (d > 180) {
                    break;
                }
                let total = item.securitiesTransacted * item.price;
                if (item.transactionType == sellType) {
                    total = -total;
                }
                netTransacted += total;
            }
            return {
                netTransacted: Math.round(netTransacted),
                days: days
            };
        });
    }
    static getNewsForSymbol(symbol, limit) {
        const url = `${FMPService.baseUrlv3}stock_news?tickers=${symbol}&limit=${limit}&apikey=${FMPService.apikey}`;
        return FMPService.fetchDataFromUrl(url).then(data => {
            return data.map(n => FMPService.convertNews(n));
        });
    }
    static getWeeklyEconomicData(init = false) {
        let from = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        if (init) {
            from = `2017-01-01`;
        }
        let aggregatedObject = {};
        let url = `${FMPService.baseUrlv4}economic?name=initialClaims&from=${from}&apikey=${FMPService.apikey}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data1) => {
            aggregatedObject = FMPService.addEconomyArrayDataToAggregate(aggregatedObject, "initialClaims", data1);
            return Object.values(aggregatedObject);
        });
    }
    static getMonthlyEconomicData(init = false) {
        let from = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        if (init) {
            from = `2017-01-01`;
        }
        let aggregatedObject = {};
        let url = `${FMPService.baseUrlv4}economic?name=smoothedUSRecessionProbabilities&from=${from}&apikey=${FMPService.apikey}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data1) => {
            aggregatedObject = FMPService.addEconomyArrayDataToAggregate(aggregatedObject, "recessionProbability", data1);
            url = `${FMPService.baseUrlv4}economic?name=unemploymentRate&from=${from}&apikey=${FMPService.apikey}`;
            return delay(1000).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data2) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "unemploymentPercent", data2);
            url = `${FMPService.baseUrlv4}economic?name=federalFunds&from=${from}&apikey=${FMPService.apikey}`;
            return delay(1000).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data3) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "fedFundsRate", data3);
            url = `${FMPService.baseUrlv4}economic?name=CPI&from=${from}&apikey=${FMPService.apikey}`;
            return delay(1000).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data4) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "consumerPriceIndex", data4);
            url = `${FMPService.baseUrlv4}economic?name=industrialProductionTotalIndex&from=${from}&apikey=${FMPService.apikey}`;
            return delay(1000).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data5) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "industrialProductionIndex", data5);
            url = `${FMPService.baseUrlv4}economic?name=retailSales&from=${from}&apikey=${FMPService.apikey}`;
            return delay(1000).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data6) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "retailSales", data6);
            url = `${FMPService.baseUrlv4}economic?name=consumerSentiment&from=${from}&apikey=${FMPService.apikey}`;
            return delay(1000).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data7) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "consumerSentiment", data7);
            url = `${FMPService.baseUrlv4}economic?name=retailMoneyFunds&from=${from}&apikey=${FMPService.apikey}`;
            return delay(1000).then(() => fetch(url));
        })
            .then((res) => res.json())
            .then((data8) => {
            aggregatedObject = this.addEconomyArrayDataToAggregate(aggregatedObject, "retailMoneyFunds", data8);
            return Object.values(aggregatedObject);
        });
    }
    static getQuarterlyEconomicData(init = false) {
        let from = Utilities_1.default.convertUnixTimestampToDateString(Date.now());
        if (init) {
            from = `2015-01-01`;
        }
        const url = `${FMPService.baseUrlv4}economic?name=realGDP&from=${from}&apikey=${FMPService.apikey}`;
        return fetch(url)
            .then((res) => res.json())
            .then((data) => {
            return data.map(d => {
                return {
                    id: d.date,
                    realGDP: d.value
                };
            });
        });
    }
    static async fetchDataFromUrl(url) {
        return fetch(url)
            .then((res) => res.json())
            .then((data) => {
            return data;
        }).catch(err => {
            console.log(err);
            return err;
        });
    }
    static async fetchDataFromUrlWithCallback(url, callback) {
        FMPService.fetchQueue.push({ url: url, callback: callback, id: FMPService.latestRequestId += 1 });
        if (!FMPService.workingOnQueue) {
            FMPService.workingOnQueue = true;
            while (FMPService.fetchQueue.length) {
                let nextRequest = FMPService.fetchQueue.shift();
                let url = nextRequest.url;
                let cb = nextRequest.callback;
                let diff = Date.now() - FMPService.lastFetchTime;
                if (diff <= (FMPService.cooldown)) {
                    await new Promise(resolve => setTimeout(resolve, FMPService.cooldown));
                }
                FMPService.lastFetchTime = Date.now();
                fetch(url)
                    .then((res) => res.json())
                    .then((data) => {
                    cb(data);
                }).catch(err => {
                    cb(err);
                });
            }
            FMPService.workingOnQueue = false;
        }
    }
    static mergeKeyAndAdvancedStats(keystats, advancedStats) {
        const combinedArray = [];
        for (let i = 0; i < keystats.length; i++) {
            const keystat = keystats[i];
            const advancedStat = advancedStats[i];
            const combined = Object.assign(Object.assign({}, keystat), advancedStat);
            combinedArray.push(FMPService.convertAdvancedStatsToSimple(combined));
        }
        return combinedArray;
    }
    static convertFMPQuoteToSimple(fmpQuote, isUSMarketOpen) {
        var _a;
        const quote = {
            symbol: fmpQuote.symbol,
            open: fmpQuote.open,
            close: (_a = fmpQuote.close) !== null && _a !== void 0 ? _a : fmpQuote.price,
            high: fmpQuote.dayHigh,
            low: fmpQuote.dayLow,
            latestPrice: fmpQuote.price,
            latestTime: Utilities_1.default.convertUnixTimestampToTimeStringWithSeconds(fmpQuote.timestamp),
            latestUpdate: fmpQuote.timestamp,
            latestVolume: fmpQuote.volume,
            previousClose: fmpQuote.previousClose,
            change: fmpQuote.change,
            changePercent: fmpQuote.changesPercentage / 100.0,
            avgTotalVolume: fmpQuote.avgVolume,
            week52High: fmpQuote.yearHigh,
            week52Low: fmpQuote.yearLow,
            peRatio: fmpQuote.pe,
            isUSMarketOpen: isUSMarketOpen,
            closeTime: 0,
            openTime: 0,
            latestSource: "",
            previousVolume: 0,
            extendedPrice: 0,
            extendedChange: 0,
            extendedChangePercent: 0,
            extendedPriceTime: 0,
        };
        return quote;
    }
    static convertPriceDataObjectToChartEntry(priceData) {
        const chartEntry = {
            date: priceData.date,
            open: priceData.open,
            close: priceData.adjClose,
            high: priceData.high,
            low: priceData.low,
            volume: priceData.volume,
            earnings: false
        };
        return chartEntry;
    }
    static convertBalanceSheetToSimple(balanceSheet) {
        let fiscalDate = balanceSheet.date;
        let reportDate = balanceSheet.fillingDate;
        if (!fiscalDate || !reportDate) {
            return null;
        }
        if (balanceSheet.date.includes(" ")) {
            fiscalDate = balanceSheet.date.split(" ")[0];
        }
        if (balanceSheet.fillingDate.includes(" ")) {
            reportDate = balanceSheet.fillingDate.split(" ")[0];
        }
        const simpleBalanceSheet = {
            reportDate: reportDate,
            fiscalDate: fiscalDate,
            period: balanceSheet.period === "FY" ? "FY " + balanceSheet.calendarYear : balanceSheet.period + " " + balanceSheet.calendarYear,
            cashAndCashEquivalents: balanceSheet.cashAndCashEquivalents,
            totalAssets: balanceSheet.totalAssets,
            totalLiabilities: balanceSheet.totalLiabilities,
            totalDebt: balanceSheet.totalDebt,
            netDebt: balanceSheet.netDebt,
            totalStockholdersEquity: balanceSheet.totalStockholdersEquity,
        };
        return simpleBalanceSheet;
    }
    static convertIncomeStatementToSimple(incomeStatement) {
        let fiscalDate = incomeStatement.date;
        let reportDate = incomeStatement.fillingDate;
        if (!fiscalDate || !reportDate) {
            return null;
        }
        if (incomeStatement.date.includes(" ")) {
            fiscalDate = incomeStatement.date.split(" ")[0];
        }
        if (incomeStatement.fillingDate.includes(" ")) {
            reportDate = incomeStatement.fillingDate.split(" ")[0];
        }
        const simplifiedIncome = {
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
        };
        return simplifiedIncome;
    }
    static convertCashFlowToSimple(cashFlow) {
        let fiscalDate = cashFlow.date;
        let reportDate = cashFlow.fillingDate;
        if (!fiscalDate || !reportDate) {
            return null;
        }
        if (cashFlow.date.includes(" ")) {
            fiscalDate = cashFlow.date.split(" ")[0];
        }
        if (cashFlow.fillingDate.includes(" ")) {
            reportDate = cashFlow.fillingDate.split(" ")[0];
        }
        const simplifiedCashFlow = {
            reportDate: reportDate,
            fiscalDate: fiscalDate,
            period: cashFlow.period === "FY" ? "FY " + cashFlow.calendarYear : cashFlow.period + " " + cashFlow.calendarYear,
            netIncome: cashFlow.netIncome,
            cashChange: cashFlow.netChangeInCash,
            cashFlow: cashFlow.freeCashFlow,
            capitalExpenditures: cashFlow.capitalExpenditure,
            dividendsPaid: cashFlow.dividendsPaid
        };
        return simplifiedCashFlow;
    }
    static convertEarningsToSimple(earnings) {
        const e = {
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
        };
        return e;
    }
    static convertAdvancedStatsToSimple(keyAndAdvanced) {
        const adv = {
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
        };
        return adv;
    }
    static async aggregate(symbols) {
        const aggregateArray = [];
        for (const symbol of symbols) {
            console.log(`aggregating ${symbol}`);
            const period = "quarter";
            const limit = "999";
            let url = `${FMPService.baseUrlv3}balance-sheet-statement/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`;
            const bss = await FMPService.fetchDataFromUrl(url).then(balanceSheets => {
                return balanceSheets;
            });
            url = `${FMPService.baseUrlv3}income-statement/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`;
            const iss = await FMPService.fetchDataFromUrl(url).then(incomes => {
                return incomes;
            });
            url = `${FMPService.baseUrlv3}cash-flow-statement/${symbol}?period=${period}&limit=${limit}&apikey=${FMPService.apikey}`;
            const cfs = await FMPService.fetchDataFromUrl(url).then(cashflows => {
                return cashflows;
            });
            url = `${FMPService.baseUrlv3}ratios/${symbol}?limit=${limit}&period=${period}&apikey=${FMPService.apikey}`;
            const ratios = await FMPService.fetchDataFromUrl(url).then(data => {
                return data;
            });
            for (let i = 0; i < bss.length; i++) {
                const bs = bss[i];
                const inc = iss[i];
                const cf = cfs[i];
                const rat = ratios[i];
                if (!bs.date || bs.date === "") {
                    continue;
                }
                const obj = Object.assign(Object.assign(Object.assign(Object.assign({}, bs), inc), cf), rat);
                aggregateArray.push(obj);
            }
        }
        return aggregateArray;
    }
    static addEconomyArrayDataToAggregate(aggregatedObject, key, data) {
        for (let d of data) {
            let dateTimestamp = d.date;
            //sandbox doesnt have the date field so we have to use "updated" for testing
            if (!dateTimestamp) {
                dateTimestamp = d.updated;
            }
            if (dateTimestamp) {
                const dateString = dateTimestamp;
                if (!aggregatedObject.hasOwnProperty(dateString)) {
                    aggregatedObject[dateString] = {};
                    aggregatedObject[dateString].id = dateString;
                }
                aggregatedObject[dateString][key] = d.value;
            }
        }
        return aggregatedObject;
    }
}
exports.default = FMPService;
FMPService.apikey = process.env.FMP_API_KEY;
FMPService.stockDao = StockDao_1.default.getStockDaoInstance();
FMPService.baseUrlv3 = "https://financialmodelingprep.com/api/v3/";
FMPService.baseUrlv4 = "https://financialmodelingprep.com/api/v4/";
FMPService.maxAllowedSymbols = 1500;
FMPService.companyOutlookEndpoint = "company-outlook"; //v4
FMPService.companyEndpoint = "profile"; //v3
FMPService.peersEndpoint = "stock_peers"; //v4
FMPService.floatEndpoint = "shares_float"; //v4
FMPService.cashFlowEndpoint = "cash-flow-statement";
FMPService.incomeEndpoint = "income-statement";
FMPService.balanceSheetEndpoint = "balance-sheet-statement";
FMPService.newsEndpoint = "stock_news";
FMPService.estimatesEndpoint = "analyst-estimates";
FMPService.gainersEndpoint = "stock_market/gainers";
FMPService.losersEndpoint = "stock_market/losers";
FMPService.activeEndpoint = "stock_market/actives";
FMPService.cooldown = 300; //the advertised rate limit is 300/min (5/sec) (once every 200 ms) so we go a little higher for some wiggle room
FMPService.lastFetchTime = 0;
FMPService.fetchQueue = [];
FMPService.workingOnQueue = false;
FMPService.latestRequestId = 0;
//# sourceMappingURL=FMPService.js.map