const fetch = require('node-fetch');

export default class StocktwitsService{

    private static accessToken = process.env.STOCKTWITS_ACCESS_TOKEN
    private static stocktwitsURL = "https://api.stocktwits.com/api/2/streams/"
    private static stocktwitsTrendingURL = "https://api.stocktwits.com/api/2/trending/symbols.json"
    private static trendingEndpoint = "trending.json"

    public static getTrendingMessages(){
        const url = `${StocktwitsService.stocktwitsURL}${StocktwitsService.trendingEndpoint}?access_token=${StocktwitsService.accessToken}`
        return fetch(url)
        .then((res: { json: () => any; }) => {
            return res.json()
        }).then((data: any) => {
            if (data && data.response.status === 200){
                return data.messages
            }
            return null
        }).catch(err => console.log(err))
    }

    public static getTrendingSymbols(){
        const url = `${StocktwitsService.stocktwitsTrendingURL}?access_token=${StocktwitsService.accessToken}`
        return fetch(url)
        .then((res: { json: () => any; }) => {
            return res.json()
        }).then((data: any) => {
            if (data && data.response.status === 200){
                return data.symbols
            }
            return null
        }).catch(err => console.log(err))
    }

    public static getPostsForSymbol(symbol:String) {
        const url = `${StocktwitsService.stocktwitsURL}symbol/${symbol}.json?access_token=${StocktwitsService.accessToken}`
        return fetch(url)
        .then((res: { json: () => any; }) => {
            return res.json()
        }).then((data: any) => {
            if (data && data.response.status === 200){
                return data.messages
            }
            return null
        }).catch(err => console.log(err)) 
    }
}