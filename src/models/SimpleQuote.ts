export default interface SimpleQuote {
    symbol:string               //symbol
    open:number                 //open
    openTime:number             //
    close:number                //close
    closeTime:number            //
    high:number                 //dayHigh
    low:number                  //dayLow
    latestPrice:number          //price
    latestSource:string         //
    latestTime:string           //timestamp
    latestUpdate:number         //timestamp
    latestVolume:number         //volume
    extendedPrice:number        //
    extendedChange:number       //
    extendedChangePercent:number//
    extendedPriceTime:number    //
    previousClose:number        //previousClose
    previousVolume:number       //
    change:number               //change
    changePercent:number        //changesPercent
    avgTotalVolume:number       //iex is over 30 days, FMP: avgVolume
    week52High:number           //yearHigh
    week52Low:number            //yearLow
    peRatio:number              //pe
    isUSMarketOpen:boolean      //
}