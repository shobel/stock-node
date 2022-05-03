export default interface SimplifiedCashFlow {
    reportDate:string //fillingDate
    fiscalDate:string //date
    period:string //period
    netIncome:number //netIncome
    cashChange:number //netChangeInCash
    cashFlow:number //freeCashFlow
    capitalExpenditures:number //capitalExpenditure
    dividendsPaid:number //dividendsPaid
}