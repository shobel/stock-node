export default interface SimplifiedEarnings {
    EPSReportDate:string        //date
    actualEPS:number            //fmp: eps
    consensusEPS:number         //fmp: epsEstimated
    announceTime:string         //fmp: time
    revenue:number              //fmp: revenue
    revenueEstimated:number     //fmp: revenueEstimated
    symbol:string               //fmp: symbol
    numberOfEstimates:number    //
    EPSSurpriseDollar:number    //
    fiscalPeriod:string         //
    fiscalEndDate:string        //
    yearAgo:number              //
    yearAgoChangePercent:number //
}