export default interface FMPAnnualEstimates {
    symbol : string,
    date : string,
    estimatedRevenueLow : number,
    estimatedRevenueHigh : number,
    estimatedRevenueAvg : number,
    estimatedEbitdaLow : number,
    estimatedEbitdaHigh : number,
    estimatedEbitdaAvg : number,
    estimatedNetIncomeLow : number,
    estimatedNetIncomeHigh : number,
    estimatedNetIncomeAvg : number,
    estimatedEpsAvg : number,
    estimatedEpsHigh : number,
    estimatedEpsLow : number,
    numberAnalystEstimatedRevenue : number,
    numberAnalystsEstimatedEps : number
}