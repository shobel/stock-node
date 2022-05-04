import IexDataService from "../services/IexDataService"
import Utilities from "./Utilities";
import MarketDao from "../dao/MarketDao";
import * as moment from 'moment-timezone'

export default class StockMarketUtility {

    //everything in PST 
    private premarketOpenTime:number = 100 //premarket starts at 1amPST/4amEST
    private premarketCloseTime:number = 630
    private openTime:number = 630
    public static openTimeString:string = "06:30"
    private closeTime:number = 1300
    private aftermarketOpenTime:number = 1300
    private aftermarketCloseTime:number = 1700 //aftermarket closes at 5pmEST/8pmPST
    public newsStartHour:number = 6 //get a lot of news after 6am
    public static numMinuteInStandardTradingDay:number = 390
    private timezone = "America/Los_Angeles"

    private marketDao:MarketDao

    public isMarketOpen:any = true
    public isExtendedHours:boolean = true
    private static holidays:any[] = []

    private static stockMarketUtility:StockMarketUtility = new StockMarketUtility()

    private constructor(){
        this.marketDao = MarketDao.getMarketDaoInstance()
    }

    public static getStockMarketUtility(){
        if (StockMarketUtility.stockMarketUtility) {
            return StockMarketUtility.stockMarketUtility
        }
        return new StockMarketUtility()
    }

    public static setHolidays(holidays:any[]){
        this.holidays = holidays
    }

    public static getHolidays(){
        return this.holidays
    }

    public checkAndSetIfMarketIsOpenToday(){
        const date = new Date()
        let marketOpenToday:boolean = false
        if (!Utilities.isWeekend(date) && !this.isHoliday(date)){
            marketOpenToday = true
        } else {
            marketOpenToday = false
        }
        return MarketDao.getMarketDaoInstance().setTodayWasATradingDay(marketOpenToday)
    }

    private isMarketOpenNow() {
        //todo stuff
        console.log(`${Utilities.convertUnixTimestampToTimeStringWithSeconds(Date.now())}: market is now closed`)
    }

    //functions below based on market's regular schedule
    public isMarketNormallyOpen(date:Date):boolean{
        if (Utilities.isWeekend(date)){
            return false
        }
        const numericalTime = Utilities.getNumericalTime(date)
        if (numericalTime >= this.openTime && numericalTime <= this.closeTime){
            return true
        }
        return false
    }

    public isHoliday(date:Date):boolean {
        let providedDateString = Utilities.convertUnixTimestampToDateString(date.getTime())
        for (let holiday of StockMarketUtility.holidays) {
            if (providedDateString == holiday.date) {
                return true 
            }
        }
        return false
    }

    public getMinutesIntoTradingDay() {
        const numericalTime = Utilities.getMinutesSinceMidnight(new Date())
        return numericalTime - 390 //390 is the minutes since midnight of 630am (open time)
    }

    public isAfterMarket(date:Date):boolean{
        if (Utilities.isWeekend(date)){
            return false
        }
        const numericalTime = Utilities.getNumericalTime(date)
        if (numericalTime >= this.aftermarketOpenTime && numericalTime <= this.aftermarketCloseTime){
            return true
        }
        return false
    }

    public isPreMarket(date:Date):boolean{
        if (Utilities.isWeekend(date)){
            return false
        }
        const numericalTime = Utilities.getNumericalTime(date)
        if (numericalTime >= this.premarketOpenTime && numericalTime <= this.premarketCloseTime){
            return true
        }
        return false
    }

    public isDateBetweenPreAndAfterMarket(date:Date):boolean {
        if (Utilities.isWeekend(date)){
            return false
        }
        const numericalTime = Utilities.getNumericalTime(date)
        if (numericalTime >= this.premarketOpenTime && numericalTime <= this.aftermarketCloseTime){
            return true
        }
        return false
    }

    public isTodayFirstTradingDayOfMonth(dateString:string, previousDateString:string){
        if (!dateString || !previousDateString){
            return false
        }
        const m1 = moment(dateString).tz(this.timezone)
        const m2 = moment(previousDateString).tz(this.timezone)
        const day = m1.date()
        if (day > 3){
            return false
        }
        if (m1.month() === m2.month()){
            return false
        }
        return true
    }

    // public isDayAfterFirstTradingDayOfMonth(date:Date){
    //     const day = Utilities.getNumericalDayOfMonth(date)
    //     for (let i = 2; i < 5; i++){
    //         if (day === i && this.isDateTheDayAfterATradingDay(date)){
    //             return true
    //         }
    //     }
    //     return false
    // }
}
