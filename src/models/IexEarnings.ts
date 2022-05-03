
export default interface IexEarnings {
    actualEPS:number        //fmp: eps
    consensusEPS:number     //fmp: epsEstimated
    announceTime:string     //fmp: time
    numberOfEstimates:number//
    EPSSurpriseDollar:number//
    EPSReportDate:string    //date
    fiscalPeriod:string     //
    fiscalEndDate:string    //
    yearAgo:number          //
    yearAgoChangePercent:number //
    revenue:number          //fmp: revenue
    revenueEstimated:number //fmp: revenueEstimated
}