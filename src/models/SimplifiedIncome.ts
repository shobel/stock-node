export default interface SimplifiedIncome {
    reportDate:string //fillingDate
    fiscalDate:string //date
    period:string //quarter
    totalRevenue:number //revenue
    researchAndDevelopment:number //researchAndDevelopmentExpenses
    costOfRevenue:number //costOfRevenue
    operatingExpense:number //operatingExpenses
    operatingIncome:number //operatingIncome
    netIncome:number //netIncome
    grossProfit:number //grossPofit
    eps:number //eps
    epsDiluted:number //epsDiluted
    ebitda:number //ebitda
}