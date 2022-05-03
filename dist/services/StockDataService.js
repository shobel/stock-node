"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class StockDataService {
    static convertIexKeystatsToSimplifiedKeystats(iexKeystats) {
        const simplifiedKeystats = {
            marketcap: 0,
            ttmDividendRate: 0,
            dividendYield: 0,
            beta: 0,
            ttmEPS: 0,
            peRatio: 0,
            float: 0,
            avg30Volume: 0,
            avg10Volume: 0,
            sharesOutstanding: 0,
            nextDividendDate: "",
            nextEarningsDate: "",
            day30ChangePercent: 0,
            month6ChangePercent: 0,
            year1ChangePercent: 0,
            year2ChangePercent: 0,
            year5ChangePercent: 0,
        };
        for (const key of Object.keys(simplifiedKeystats)) {
            if (iexKeystats.hasOwnProperty(key)) {
                simplifiedKeystats[key] = iexKeystats[key];
            }
        }
        return simplifiedKeystats;
    }
    static convertIexAdvancedStatsToSimplified(advancedStats) {
        const simplifiedAdvancedstats = {
            revenuePerShare: 0,
            debtToEquity: 0,
            profitMargin: 0,
            enterpriseValue: 0,
            enterpriseValueToRevenue: 0,
            priceToSales: 0,
            priceToBook: 0,
            pegRatio: 0,
            debtToAssets: 0,
            priceFairValue: 0,
            date: ""
        };
        for (const key of Object.keys(simplifiedAdvancedstats)) {
            if (advancedStats.hasOwnProperty(key)) {
                simplifiedAdvancedstats[key] = advancedStats[key];
            }
        }
        return simplifiedAdvancedstats;
    }
    static convertIexCashFlowsToSimplified(cashflow) {
        const simplifiedCashFlow = {
            reportDate: "",
            fiscalDate: "",
            netIncome: 0,
            cashChange: 0,
            cashFlow: 0,
            capitalExpenditures: 0,
            dividendsPaid: 0,
            period: ""
        };
        for (const key of Object.keys(simplifiedCashFlow)) {
            if (cashflow.hasOwnProperty(key)) {
                simplifiedCashFlow[key] = cashflow[key];
            }
        }
        return simplifiedCashFlow;
    }
    static convertIexIncomeToSimplified(income) {
        const simplifiedIncome = {
            researchAndDevelopment: 0,
            totalRevenue: 0,
            operatingExpense: 0,
            costOfRevenue: 0,
            fiscalDate: "",
            reportDate: "",
            operatingIncome: 0,
            netIncome: 0,
            grossProfit: 0,
            period: "",
            ebitda: 0,
            eps: 0,
            epsDiluted: 0
        };
        for (const key of Object.keys(simplifiedIncome)) {
            if (income.hasOwnProperty(key)) {
                simplifiedIncome[key] = income[key];
            }
        }
        return simplifiedIncome;
    }
    static isCompany(c) {
        return c.sector && c.sector !== "" && !c.isEtf && !c.isFund;
    }
}
exports.default = StockDataService;
//# sourceMappingURL=StockDataService.js.map