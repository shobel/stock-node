import ChartEntry from "../models/ChartEntry"

export default class TechnicalsUtility {

    public static computeSmas(data:any[]) {
        const reversedData = data.reverse()
        const smaTypes = [20, 50, 100, 200]
        const newSmas: any = { 20: 0, 50: 0, 100: 0, 200: 0 }
        let closeSum = 0

        for (let i = 0; i < reversedData.length; i++) {
            const chartEntry = reversedData[i] as ChartEntry
            closeSum += chartEntry.close
            for (const smaType of smaTypes) {
                if (i === (smaType - 1)) {
                    newSmas[smaType] = closeSum / smaType
                }
            }
        }
        return {
            sma20: newSmas[20] === 0 ? null : newSmas[20],
            sma50: newSmas[50] === 0 ? null : newSmas[50],
            sma100: newSmas[100] === 0 ? null : newSmas[100],
            sma200: newSmas[200] === 0 ? null : newSmas[200]
        }
    }

    public static computeRsi(data:any[], period:number) {
        const ups:number[] = []
        const downs:number[] = []
        if (data.length < period){
            return null
        }
        for (let i = 0; i < data.length; i++) {
            const chartEntry = data[i] as ChartEntry
            if (i > 0){
                const previousBar = data[i-1]
                if (chartEntry.close - previousBar.close > 0) {
                    ups.push(chartEntry.close - previousBar.close)
                } else if (chartEntry.close - previousBar.close < 0){
                    downs.push(previousBar.close - chartEntry.close)
                } else {
                    downs.push(0)
                    ups.push(0)
                }
            }
        }
        let rsi:any = null
        if (ups.length && downs.length) {
            const avgUps = ups.reduce((a, b) => a + b) / data.length
            const avgDowns = downs.reduce((a, b) => a + b) / data.length
            const rs = avgUps / avgDowns
            rsi = 100 - (100 / ( 1 + rs ))
        }
        return rsi
    }
}