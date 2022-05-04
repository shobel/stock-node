"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Utilities_1 = require("./Utilities");
const MarketDao_1 = require("../dao/MarketDao");
const moment = require("moment-timezone");
class StockMarketUtility {
    constructor() {
        //everything in PST 
        this.premarketOpenTime = 100; //premarket starts at 1amPST/4amEST
        this.premarketCloseTime = 630;
        this.openTime = 630;
        this.closeTime = 1300;
        this.aftermarketOpenTime = 1300;
        this.aftermarketCloseTime = 1700; //aftermarket closes at 5pmEST/8pmPST
        this.newsStartHour = 6; //get a lot of news after 6am
        this.timezone = "America/Los_Angeles";
        this.isMarketOpen = true;
        this.isExtendedHours = true;
        this.marketDao = MarketDao_1.default.getMarketDaoInstance();
    }
    static getStockMarketUtility() {
        if (StockMarketUtility.stockMarketUtility) {
            return StockMarketUtility.stockMarketUtility;
        }
        return new StockMarketUtility();
    }
    static setHolidays(holidays) {
        this.holidays = holidays;
    }
    static getHolidays() {
        return this.holidays;
    }
    checkAndSetIfMarketIsOpenToday() {
        const date = new Date();
        let marketOpenToday = false;
        if (!Utilities_1.default.isWeekend(date) && !this.isHoliday(date)) {
            marketOpenToday = true;
        }
        else {
            marketOpenToday = false;
        }
        return MarketDao_1.default.getMarketDaoInstance().setTodayWasATradingDay(marketOpenToday);
    }
    isMarketOpenNow() {
        //todo stuff
        console.log(`${Utilities_1.default.convertUnixTimestampToTimeStringWithSeconds(Date.now())}: market is now closed`);
    }
    //functions below based on market's regular schedule
    isMarketNormallyOpen(date) {
        if (Utilities_1.default.isWeekend(date)) {
            return false;
        }
        const numericalTime = Utilities_1.default.getNumericalTime(date);
        if (numericalTime >= this.openTime && numericalTime <= this.closeTime) {
            return true;
        }
        return false;
    }
    isHoliday(date) {
        let providedDateString = Utilities_1.default.convertUnixTimestampToDateString(date.getTime());
        for (let holiday of StockMarketUtility.holidays) {
            if (providedDateString == holiday.date) {
                return true;
            }
        }
        return false;
    }
    getMinutesIntoTradingDay() {
        const numericalTime = Utilities_1.default.getMinutesSinceMidnight(new Date());
        return numericalTime - 390; //390 is the minutes since midnight of 630am (open time)
    }
    isAfterMarket(date) {
        if (Utilities_1.default.isWeekend(date)) {
            return false;
        }
        const numericalTime = Utilities_1.default.getNumericalTime(date);
        if (numericalTime >= this.aftermarketOpenTime && numericalTime <= this.aftermarketCloseTime) {
            return true;
        }
        return false;
    }
    isPreMarket(date) {
        if (Utilities_1.default.isWeekend(date)) {
            return false;
        }
        const numericalTime = Utilities_1.default.getNumericalTime(date);
        if (numericalTime >= this.premarketOpenTime && numericalTime <= this.premarketCloseTime) {
            return true;
        }
        return false;
    }
    isDateBetweenPreAndAfterMarket(date) {
        if (Utilities_1.default.isWeekend(date)) {
            return false;
        }
        const numericalTime = Utilities_1.default.getNumericalTime(date);
        if (numericalTime >= this.premarketOpenTime && numericalTime <= this.aftermarketCloseTime) {
            return true;
        }
        return false;
    }
    isTodayFirstTradingDayOfMonth(dateString, previousDateString) {
        if (!dateString || !previousDateString) {
            return false;
        }
        const m1 = moment(dateString).tz(this.timezone);
        const m2 = moment(previousDateString).tz(this.timezone);
        const day = m1.date();
        if (day > 3) {
            return false;
        }
        if (m1.month() === m2.month()) {
            return false;
        }
        return true;
    }
}
exports.default = StockMarketUtility;
StockMarketUtility.openTimeString = "06:30";
StockMarketUtility.numMinuteInStandardTradingDay = 390;
StockMarketUtility.holidays = [];
StockMarketUtility.stockMarketUtility = new StockMarketUtility();
//# sourceMappingURL=StockMarketUtility.js.map