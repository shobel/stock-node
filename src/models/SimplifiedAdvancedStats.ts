export default interface SimplifiedAdvancedStats {
    // totalCash:number
    // currentDebt:number
    // revenue:number
    // grossProfit:number
    // EBITDA:number
    // revenuePerEmployee:number  //only in IEX advanced stats
    // forwardPERatio:number //only in IEX advanced stats
    // putCallRatio:number   //only in IEX advanced stats
    date:string
    revenuePerShare:number
    debtToEquity:number
    debtToAssets:number
    profitMargin:number
    enterpriseValue:number
    enterpriseValueToRevenue:number
    priceToSales:number
    priceToBook:number
    pegRatio:number
    priceFairValue:number

    //ignoring
    // totalRevenue
    // peHigh
    // peLow
    // week52highDate
    // week52lowDate

}