const fetch = require('node-fetch');
import { parse } from 'node-html-parser';
import MarketDao from '../dao/MarketDao';

export default class FearGreedService {

    private static url = "https://pyinvesting.com/fear-and-greed/"
    private static marketDao:MarketDao = MarketDao.getMarketDaoInstance()

    public static getFearAndGreedIndicators(){
        const url = `${FearGreedService.url}`
        return fetch(url)
        .then((res:any) => {
            return res.text()
        })
        .then((data: any) => {
            const root = parse(data)
            let startIndex = root.innerHTML.indexOf("Currently")
            let fearGreadValue = root.innerHTML.substring(startIndex + 13, startIndex + 15)

            let updatedIndex = root.innerHTML.indexOf("Last updated")
            let sub = root.innerHTML.substring(updatedIndex + 13, updatedIndex + 31)
            let updatedSplit = sub.split(",")
            let updated:string = ""
            if (updatedSplit.length > 1) {
                updated = updatedSplit[0] + updatedSplit[1]
            }
            const fearAndGreed:any = {
                timeline: {
                    now: fearGreadValue
                },
                updated: updated
            }
           
            return FearGreedService.marketDao.setFearGreed(fearAndGreed)            
        })
    }
}