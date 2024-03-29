export default interface IexBalanceSheet {
    reportDate:string
    fiscalDate:string
    currency:string
    currentCash:number
    shortTermInvestments:number
    receivables:number
    inventory:number
    otherCurrentAssets:number
    currentAssets:number
    longTermInvestments:number
    propertyPlantEquipment:number
    goodwill:number
    intangibleAssets:number
    otherAssets:number
    totalAssets:number
    accountsPayable:number
    currentLongTermDebt:number
    otherCurrentLiabilities:number
    totalCurrentLiabilities:number
    longTermDebt:number
    otherLiabilities:number
    minorityInterest:number
    totalLiabilities:number
    commonStock:number
    retainedEarnings:number
    treasuryStock:number
    capitalSurplus:number
    shareholderEquity:number
    netTangibleAssets:number
}