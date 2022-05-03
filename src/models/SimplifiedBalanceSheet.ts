export default interface SimplifiedBalanceSheet {
    fiscalDate:string //date
    reportDate:string //fillingDate
    period:string
    cashAndCashEquivalents:number
    totalAssets:number
    totalLiabilities:number
    totalDebt:number
    netDebt:number
    totalStockholdersEquity:number
}