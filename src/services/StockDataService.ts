import IexKeystats from "../models/IexKeystats";
import SimplifiedKeystats from "../models/SimplifiedKeystats";
import SimplifiedCashFlow from "../models/SimplifiedCashFlow";
import SimplifiedIncome from "../models/SimplifiedIncome";
import SimplifiedAdvancedStats from "../models/SimplifiedAdvancedStats";

export default class StockDataService {

    public static convertIexKeystatsToSimplifiedKeystats(iexKeystats:IexKeystats):SimplifiedKeystats {
        const simplifiedKeystats:SimplifiedKeystats = {
            marketcap:0,
            ttmDividendRate:0,
            dividendYield:0,
            beta:0,
            ttmEPS:0,
            peRatio:0,
            float:0,
            avg30Volume:0,
            avg10Volume:0,
            sharesOutstanding:0,
            nextDividendDate:"",
            nextEarningsDate:"",
            day30ChangePercent: 0,
            month6ChangePercent: 0,
            year1ChangePercent: 0,
            year2ChangePercent: 0,
            year5ChangePercent: 0,
        }
        for (const key of Object.keys(simplifiedKeystats)){
            if (iexKeystats.hasOwnProperty(key)) {
                simplifiedKeystats[key] = iexKeystats[key]
            }
        }
        return simplifiedKeystats
    }

    public static convertIexAdvancedStatsToSimplified(advancedStats:any):SimplifiedAdvancedStats {
        const simplifiedAdvancedstats:SimplifiedAdvancedStats = {
            revenuePerShare:0,
            debtToEquity:0,
            profitMargin:0,
            enterpriseValue:0,
            enterpriseValueToRevenue:0,
            priceToSales:0,
            priceToBook:0,
            pegRatio:0,
            debtToAssets: 0,
            priceFairValue: 0,
            date: ""
        }
        for (const key of Object.keys(simplifiedAdvancedstats)){
            if (advancedStats.hasOwnProperty(key)) {
                simplifiedAdvancedstats[key] = advancedStats[key]
            }
        }
        return simplifiedAdvancedstats
    }

    public static convertIexCashFlowsToSimplified(cashflow:any):SimplifiedCashFlow {
        const simplifiedCashFlow:SimplifiedCashFlow = {
            reportDate: "",
            fiscalDate: "",
            netIncome: 0,
            cashChange: 0,
            cashFlow: 0,
            capitalExpenditures: 0,
            dividendsPaid: 0,
            period: ""
        }
        for (const key of Object.keys(simplifiedCashFlow)){
            if (cashflow.hasOwnProperty(key)) {
                simplifiedCashFlow[key] = cashflow[key]
            }
        }
        return simplifiedCashFlow
    }

    public static convertIexIncomeToSimplified(income:any):SimplifiedIncome {
        const simplifiedIncome:SimplifiedIncome = {
            researchAndDevelopment:0,
            totalRevenue: 0,
            operatingExpense:0,
            costOfRevenue:0,
            fiscalDate:"",
            reportDate:"",
            operatingIncome:0,
            netIncome: 0,
            grossProfit: 0,
            period: "",
            ebitda: 0,
            eps: 0,
            epsDiluted: 0
        }
        for (const key of Object.keys(simplifiedIncome)){
            if (income.hasOwnProperty(key)) {
                simplifiedIncome[key] = income[key]
            }
        }
        return simplifiedIncome
    }  

    public static isCompany(c:any){
        return c.sector && c.sector !== "" && !c.isEtf && !c.isFund
    }

    /* no use for this yet
    public static combineStockDataObjectsIntoOne(dataObject:any){
        let returnObj = {}
        for (const endpoint of Object.keys(dataObject)){
            returnObj = {...returnObj, ...dataObject[endpoint]}
        }
        return returnObj
    }
    */
}