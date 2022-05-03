export default interface FMPDailyChartItem {
    //the FMPQuote has a bunch of things this doesn't have
    //1. priceAvg50 or 200, has vwap instead
    //2. eps, pe, marketcap, sharesOutstanding
    //3. next earnings, year low/high
    //Also important, this one has date as a string and quote has a timestmap
    date: "2021-07-19",
    open: 179.152496,
    high: 190.419998,
    low: 178.654999,
    close: 187.797501,
    adjClose: 187.797501,
    volume: 7.4906E7,
    unadjustedVolume: 7.4906E7,
    change: 8.64501,
    changePercent: 4.826,
    vwap: 185.62417,
    label: "July 19, 21",
    changeOverTime: 0.04826
}