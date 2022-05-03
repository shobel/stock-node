export default interface IexAdjustedDailyBar {

    /**
     * This type of object can be retrieved from 2 iex endpoints
     * 1. the 'previous' endpoint and 
     * 2. chart/date/{YYYYMMDD}?chartCloseOnly=true&chartByDay=true endpoint
     * Price: 2 points per symbol
     */
    date:string     //YYYY-MM-DD
    uClose:number   //unadjusted close
    uOpen:number    //unadjusted open
    uHigh:number    //unadjusted high
    uLow:number     //unadjusted low
    uVolume:number  //unadjusted volume (volume is never adjusted)
    close:number    //adjusted close
    open:number     //adjusted open
    high:number     //adjusted high
    low:number      //adjusted low
    volume:number   //adjusted volume
    change:number   //Change from previous trading day
    changePercent:number    //Change percent from previous trading day
    changeOverTime:number   //change from first value returned by query if querying a range, not applicable if querying single date
    symbol:string
}