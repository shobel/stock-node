const fetch = require('node-fetch');
import { parse } from 'node-html-parser';
import IexDataService from './IexDataService';

export default class FinvizService {

    // private static baseUrl = "https://finviz.com/"
    // private static iexService = IexDataService.getIexDataServiceInstance()

    // public static getInfoForAllSymbols(){
    //     return FinvizService.iexService.getAllSymbolsInIEX().then(async symbols => {
    //         const symbolArray:any[] = []
    //         const total = symbols.length
    //         let done = 0
    //         for (const symbol of symbols) {
    //             const symbolInfo = await FinvizService.getInfoForSymbol(symbol)
    //             symbolArray.push(symbolInfo)
    //             done += 1
    //             console.log(`${done}/${total} ${symbol}`)
    //         }
    //         return symbolArray
    //     })
    // }

    // public static getInfoForSymbol(symbol:string){
    //     const url = `${FinvizService.baseUrl}quote.ashx?t=${symbol}`
    //     return fetch(url)
    //     .then((res:any) => {
    //         return res.text()
    //     })
    //     .then((data: any) => {
    //         const root = parse(data)
    //         const snapshotTable = root.querySelector('.snapshot-table2')
    //         if (!snapshotTable) {
    //             return {}
    //         }
    //         const rows = snapshotTable.childNodes
    //         let shortFloat = ""
    //         let shortRatio = ""
    //         if (rows && rows.length > 7){
    //             const cols1 = rows[5].childNodes
    //             if (cols1 && cols1.length > 14){
    //                 shortFloat = cols1[14].innerText
    //             }
    //             const cols2 = rows[7].childNodes
    //             if (cols2 && cols2.length > 14){
    //                 shortRatio = cols2[14].innerText
    //             }
    //         }
    //         return {
    //             symbol: symbol,
    //             shortFloat: shortFloat,
    //             shortRatio: shortRatio,
    //         }
    //     }).catch()
    // }
    
}