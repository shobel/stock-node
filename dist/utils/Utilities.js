"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const moment = require("moment-timezone");
const fs = require("fs");
const jwt = require("jsonwebtoken");
class Utilities {
    static generateAppleClientSecret() {
        const privateKeyFilePath = "/Users/shobel/Documents/stockserver/functions/" + process.env.PRIVATE_KEY_FILE_PATH;
        // sign with RSA SHA256
        const privateKey = fs.readFileSync(privateKeyFilePath);
        const headers = {
            kid: process.env.KEY_ID,
            typ: undefined // is there another way to remove type?
        };
        const claims = {
            'iss': process.env.TEAM_ID,
            'aud': 'https://appleid.apple.com',
            'sub': process.env.CLIENT_ID,
        };
        const token = jwt.sign(claims, privateKey, {
            algorithm: 'ES256',
            header: headers,
            expiresIn: '10d'
        });
        return token;
    }
    static async sleep(millis) {
        return new Promise(resolve => setTimeout(resolve, millis));
    }
    /* converts timestamp to YYYY-MM-DD */
    //input can actually be a variety of things, not just unixtimestamp
    static convertUnixTimestampToDateString(unixTimestamp) {
        return moment(unixTimestamp).tz(this.timezone).format(this.dateformatDashes);
    }
    //input can actually be a variety of things, not just unixtimestamp
    static convertUnixTimestampToTimeString24(unixTimestamp) {
        return moment(unixTimestamp).tz(this.timezone).format(this.timeformat24);
    }
    //input can actually be a variety of things, not just unixtimestamp
    static convertUnixTimestampToTimeString12(unixTimestamp) {
        return moment(unixTimestamp).tz(this.timezone).format(this.timeformat12);
    }
    //input can actually be a variety of things, not just unixtimestamp
    static convertUnixTimestampToTimeStringWithSeconds(unixTimestamp) {
        return moment(unixTimestamp).tz(this.timezone).format(this.timefomatSec);
    }
    //input can actually be a variety of things, not just unixtimestamp
    static convertDateToDateStringNoSeparators(date) {
        return moment(date).tz(this.timezone).format(this.dateFormatNoSeparators);
    }
    //converts a time to a number. each hour = 100 and each minute = 1
    //example, 6:59am = 600 + 59 = 659, 7:00am = 700 + 0 = 700
    static getNumericalTime(date) {
        const m = moment(date).tz(this.timezone);
        const numericalTime = (m.hours() * 100) + m.minutes();
        return numericalTime;
    }
    static getMinutesSinceMidnight(date) {
        const m = moment(date).tz(this.timezone);
        const numericalTime = (m.hours() * 60) + m.minutes();
        return numericalTime;
    }
    //converts a time to minutes. each hour = 60 each minute = 1
    //example, 6:59am = 6*60 + 59 = 419, 7am = 7*60 = 420
    static convertTimestampToMinutes(timestamp) {
        const m = moment(timestamp).tz(this.timezone);
        const minutes = (m.hours() * 60) + m.minutes();
        return minutes;
    }
    /* doesn't matter which is 1 or 2 */
    static countDaysBetweenDates(date1, date2) {
        const m1 = moment(date1);
        const m2 = moment(date2);
        return Math.abs(m1.diff(m2, 'days'));
    }
    /* doesn't matter which is 1 or 2 */
    static countDaysBetweenDateStrings(date1, date2) {
        const m1 = moment(date1);
        const m2 = moment(date2);
        return Math.abs(m1.diff(m2, 'days'));
    }
    //date1 should be in the future so date1 > date2 will be positive and date1 < date2 will be negative
    static countDaysBetweenDateStringsOrderMatters(date1, date2) {
        const m1 = moment(date1);
        const m2 = moment(date2);
        return m1.diff(m2, 'days');
    }
    static getHourOfTimestamp(timestamp) {
        const m = moment(timestamp).tz(this.timezone);
        return m.hours();
    }
    static getFiveYearsAgoDateString() {
        let fiveYearsAgoYear = Utilities.getNumericalYear(new Date()) - 5;
        let today = Utilities.convertUnixTimestampToDateString(Date.now());
        let fiveYearsAgo = `${fiveYearsAgoYear}-${today.split("-")[1]}-${today.split("-")[2]}`;
        return fiveYearsAgo;
    }
    static isWeekend(date) {
        const day = moment(date).tz(this.timezone).day();
        return (day === 0 || day === 6);
    }
    static isWeekendMoment(m) {
        return m.day() === 0 || m.day() === 6;
    }
    static isMonday(date) {
        const day = moment(date).tz(this.timezone).day();
        return day === 1;
    }
    static isTuesday(date) {
        const day = moment(date).tz(this.timezone).day();
        return day === 2;
    }
    static isSunday(date) {
        const day = moment(date).tz(this.timezone).day();
        return day === 0;
    }
    static isFirstOfMonth(date) {
        const day = Utilities.getNumericalDayOfMonth(date);
        return day === 1;
    }
    static getPreviousDay(date) {
        return moment(date).tz(this.timezone).subtract(1, 'days');
    }
    static getNumericalDayOfWeek(date) {
        return moment(date).tz(this.timezone).day();
    }
    static getNumericalDayOfMonth(date) {
        return moment(date).tz(this.timezone).date();
    }
    static getNumericalYear(date) {
        return moment(date).tz(this.timezone).year();
    }
    static isAfter510pmOfCurrentDay(date) {
        const nowmoment = moment();
        const today510pm = moment.tz(`${nowmoment.format("YYYY-MM-DD")} 17:10`, "America/Los_Angeles");
        const datemoment = moment(date);
        return datemoment.isAfter(today510pm);
    }
    static isAfter510pmOfPreviousDay(date) {
        const nowmoment = moment(new Date());
        const yesterday = nowmoment.subtract(1, "days");
        const yesterday510pm = moment.tz(`${yesterday.format("YYYY-MM-DD")} 17:10`, this.timezone);
        const datemoment = moment(date);
        return datemoment.isAfter(yesterday510pm);
    }
    static isDateBeforeAnotherDate(date1, date2) {
        const m1 = moment(date1);
        const m2 = moment(date2);
        return m1.isBefore(m2);
    }
    static isDatestringBeforeAnotherDatestring(date1, date2) {
        const m1 = moment(date1);
        const m2 = moment(date2);
        return m1.isBefore(m2);
    }
    static isDatestringSameOrBeforeAnotherDatestring(date1, date2) {
        const m1 = moment(date1);
        const m2 = moment(date2);
        return m1.isSameOrBefore(m2);
    }
    static isDateSameOrAfterAnotherDate(date1, date2) {
        const m1 = moment(date1);
        const m2 = moment(date2);
        return m1.isSameOrAfter(m2);
    }
    static getTimestampOfDayBeforeDate(date) {
        return moment.tz(date, this.timezone).subtract(1, "days").unix() * 1000;
    }
    static sortArrayOfObjectsByNumericalFieldDesc(field, arr) {
        const sorted = arr.sort((a, b) => {
            if (a[field] > b[field]) {
                return -1;
            }
            else if (a[field] === b[field]) {
                return 0;
            }
            else {
                return 1;
            }
        });
        return sorted;
    }
    static calculateAverageOfArray(arr) {
        if (arr.length == 0) {
            return null;
        }
        let sum = 0;
        for (let item of arr) {
            sum += item;
        }
        return sum / arr.length;
    }
    static calculateNewAverage(oldAverage, newNumber, newN) {
        return ((oldAverage * (newN - 1)) + newNumber) / newN;
    }
    static minutesPassedBetweenDates(now, then) {
        const nowMoment = moment(now);
        const thenMoment = moment(then);
        return nowMoment.diff(thenMoment, 'minutes');
    }
    static roundToPrecision(value, precision) {
        const multiplier = Math.pow(10, precision || 0);
        return Math.round(value * multiplier) / multiplier;
    }
    // public static isDayAfterFirstWeekdayOfMonth(date:Date){
    //     const dayOfMonth = moment(date).tz(this.timezone).date()
    //     const dayBefore = moment(date).tz(this.timezone).subtract(1, 'days')
    //     return (dayOfMonth > 1 && dayOfMonth < 5 ) && !this.isWeekendMoment(dayBefore)
    // }
    static isValidNumber(num) {
        return num && !isNaN(num) && isFinite(num);
    }
    static calculateTrendlineSlope(arr) {
        const xvals = [];
        let sumY = 0;
        for (let i = 0; i < arr.length; i++) {
            xvals.push(i);
            sumY += arr[i];
        }
        const meanX = xvals.reduce((a, b) => a + b) / xvals.length;
        const meanY = sumY / arr.length;
        let sumsquares = 0;
        let sumproducts = 0;
        for (let j = 0; j < arr.length; j++) {
            sumsquares += ((j - meanX) * (j - meanX));
            sumproducts += ((j - meanX) * (arr[j] - meanY));
        }
        const slope = sumproducts / sumsquares;
        return slope;
    }
}
exports.default = Utilities;
Utilities.timezone = "America/Los_Angeles";
Utilities.dateformatDashes = "YYYY-MM-DD";
Utilities.dateFormatNoSeparators = "YYYYMMDD";
Utilities.timeformat24 = "HH:mm";
Utilities.timeformat12 = "h:mm A";
Utilities.timefomatSec = "hh:mm:ssA";
Utilities.oneHourMs = 3600000;
Utilities.oneDayMs = 86400000;
Utilities.oneWeekMs = 86400000 * 7;
Utilities.oneMonthMs = 86400000 * 30;
//# sourceMappingURL=Utilities.js.map