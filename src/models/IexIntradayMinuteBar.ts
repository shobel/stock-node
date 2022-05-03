export default interface IexIntradayMinuteBar {
    /**
     * Returned from "intraday-prices" with chartIEXOnly=true
     * FREE!
     */
    date:string	                //YYYY-MM-DD
    minute:string	            //HH:mm (24 hour)
    label:number	            //hh:mm A (12 hour)
    average:number	            //IEX only data. Average price during the minute for trades on IEX.
    notional:number	            //IEX only data. Total notional value during the minute for trades on IEX.
    numberOfTrades:number	    //IEX only data. Number of trades during the minute on IEX.
    high:number	                //IEX only data. Highest price during the minute on IEX.
    low:number	                //IEX only data. Lowest price during the minute on IEX.
    volume:number	            //IEX only data. Total volume during the minute on IEX.
    open:number	                //IEX only data. First price during the minute on IEX.
    close:number	            //IEX only data. Last price during the minute on IEX. 
}