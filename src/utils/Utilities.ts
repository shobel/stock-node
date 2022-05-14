import * as moment from 'moment-timezone'
import * as fs from 'fs'
import * as jwt from 'jsonwebtoken';

export default class Utilities {

    private static timezone = "America/Los_Angeles"
    private static dateformatDashes = "YYYY-MM-DD"
    private static dateFormatNoSeparators = "YYYYMMDD"
    private static timeformat24 = "HH:mm"
    private static timeformat12 = "h:mm A"
    private static timefomatSec = "hh:mm:ssA"

    public static oneHourMs:number = 3600000
    public static oneDayMs:number = 86400000
    public static oneWeekMs:number = 86400000 * 7
    public static oneMonthMs:number = 86400000 * 30

    public static generateAppleClientSecret() {
        const privateKeyFilePath:string = "/Users/shobel/Documents/stockserver/functions/" + process.env.PRIVATE_KEY_FILE_PATH!
        // sign with RSA SHA256
        const privateKey = fs.readFileSync(privateKeyFilePath)
        const headers = {
            kid: process.env.KEY_ID,
            typ: undefined // is there another way to remove type?
        }
        const claims = {
            'iss': process.env.TEAM_ID,
            'aud': 'https://appleid.apple.com',
            'sub': process.env.CLIENT_ID,
        }
        const token = jwt.sign(claims, privateKey, {
            algorithm: 'ES256',
            header: headers,
            expiresIn: '10d'
        });
        return token
    }

    public static async sleep(millis:number) {
        return new Promise(resolve => setTimeout(resolve, millis));
    }

    /* converts timestamp to YYYY-MM-DD */
    //input can actually be a variety of things, not just unixtimestamp
    public static convertUnixTimestampToDateString(unixTimestamp:any): string{
        return moment(unixTimestamp).tz(this.timezone).format(this.dateformatDashes);
    }

    //input can actually be a variety of things, not just unixtimestamp
    public static convertUnixTimestampToTimeString24(unixTimestamp:any): string{
        return moment(unixTimestamp).tz(this.timezone).format(this.timeformat24);
    }

    //input can actually be a variety of things, not just unixtimestamp
    public static convertUnixTimestampToTimeString12(unixTimestamp:any): string{
        return moment(unixTimestamp).tz(this.timezone).format(this.timeformat12);
    }

    //input can actually be a variety of things, not just unixtimestamp
    public static convertUnixTimestampToTimeStringWithSeconds(unixTimestamp:any): string{
        return moment(unixTimestamp).tz(this.timezone).format(this.timefomatSec);
    }

    //input can actually be a variety of things, not just unixtimestamp
    public static convertDateToDateStringNoSeparators(date:any) {
        return moment(date).tz(this.timezone).format(this.dateFormatNoSeparators);
    }

    //converts a time to a number. each hour = 100 and each minute = 1
    //example, 6:59am = 600 + 59 = 659, 7:00am = 700 + 0 = 700
    public static getNumericalTime(date:Date):number {
        const m = moment(date).tz(this.timezone)
        const numericalTime = (m.hours() * 100) + m.minutes()
        return numericalTime
    }

    public static getMinutesSinceMidnight(date:Date):number {
        const m = moment(date).tz(this.timezone)
        const numericalTime = (m.hours() * 60) + m.minutes()
        return numericalTime
    }

    //converts a time to minutes. each hour = 60 each minute = 1
    //example, 6:59am = 6*60 + 59 = 419, 7am = 7*60 = 420
    public static convertTimestampToMinutes(timestamp:number){
        const m = moment(timestamp).tz(this.timezone)
        const minutes = (m.hours() * 60) + m.minutes()
        return minutes 
    }

    /* doesn't matter which is 1 or 2 */
    public static countDaysBetweenDates(date1:number, date2:number){
        const m1 = moment(date1)
        const m2 = moment(date2)
        return Math.abs(m1.diff(m2, 'days'))
    }

    /* doesn't matter which is 1 or 2 */
    public static countDaysBetweenDateStrings(date1: string, date2: string) {
        const m1 = moment(date1)
        const m2 = moment(date2)
        return Math.abs(m1.diff(m2, 'days'))
    }

    //date1 should be in the future so date1 > date2 will be positive and date1 < date2 will be negative
    public static countDaysBetweenDateStringsOrderMatters(date1: string, date2: string) {
        const m1 = moment(date1)
        const m2 = moment(date2)
        return m1.diff(m2, 'days')
    }

    public static getHourOfTimestamp(timestamp:number):number {
        const m = moment(timestamp).tz(this.timezone)
        return m.hours()
    }

    public static getFiveYearsAgoDateString(){
        let fiveYearsAgoYear = Utilities.getNumericalYear(new Date()) - 5
        let today = Utilities.convertUnixTimestampToDateString(Date.now())
        let fiveYearsAgo = `${fiveYearsAgoYear}-${today.split("-")[1]}-${today.split("-")[2]}`
        return fiveYearsAgo
    }

    public static isWeekend(date:Date){
        const day = moment(date).tz(this.timezone).day()
        return (day === 0 || day === 6)
    }

    public static isWeekendMoment(m:moment.Moment){
        return m.day() === 0 || m.day() === 6
    }

    public static isMonday(date:Date):boolean {
        const day = moment(date).tz(this.timezone).day()
        return day === 1
    }

    public static isTuesday(date:Date):boolean{
        const day = moment(date).tz(this.timezone).day()
        return day === 2
    }

    public static isSunday(date:Date):boolean {
        const day = moment(date).tz(this.timezone).day()
        return day === 0
    }

    public static isFirstOfMonth(date:Date):boolean {
        const day = Utilities.getNumericalDayOfMonth(date)
        return day === 1
    }

    public static getPreviousDay(date:Date):moment.Moment{
        return moment(date).tz(this.timezone).subtract(1, 'days')
    }

    public static getNumericalDayOfWeek(date:Date){
        return moment(date).tz(this.timezone).day()
    }

    public static getNumericalDayOfMonth(date:Date){
        return moment(date).tz(this.timezone).date()
    }

    public static getNumericalYear(date:Date){
        return moment(date).tz(this.timezone).year()
    }

    public static isAfter510pmOfCurrentDay(date:Date){
        const nowmoment = moment()
        const today510pm = moment.tz(`${nowmoment.format("YYYY-MM-DD")} 17:10`, "America/Los_Angeles")
        const datemoment = moment(date)
        return datemoment.isAfter(today510pm)
    }

    public static isAfter510pmOfPreviousDay(date:Date){
        const nowmoment = moment(new Date())
        const yesterday = nowmoment.subtract(1, "days")
        const yesterday510pm = moment.tz(`${yesterday.format("YYYY-MM-DD")} 17:10`, this.timezone)
        const datemoment = moment(date)
        return datemoment.isAfter(yesterday510pm)
    }

    public static isDateBeforeAnotherDate(date1:Date, date2:Date){
        const m1 = moment(date1)
        const m2 = moment(date2)
        return m1.isBefore(m2)
    }

    public static isDatestringBeforeAnotherDatestring(date1:string, date2:string){
        const m1 = moment(date1)
        const m2 = moment(date2)
        return m1.isBefore(m2)
    }

    public static isDatestringSameOrBeforeAnotherDatestring(date1:string, date2:string){
        const m1 = moment(date1)
        const m2 = moment(date2)
        return m1.isSameOrBefore(m2)
    }

    public static isDateSameOrAfterAnotherDate(date1:Date, date2:Date){
        const m1 = moment(date1)
        const m2 = moment(date2)
        return m1.isSameOrAfter(m2)
    }

    public static getTimestampOfDayBeforeDate(date:Date){
        return moment.tz(date, this.timezone).subtract(1, "days").unix() * 1000
    }

    public static sortArrayOfObjectsByNumericalFieldDesc(field:string, arr:any[]){
        const sorted = arr.sort((a, b) => {
            if (a[field] > b[field]) {
             return -1
          } else if (a[field] === b[field]) {
               return 0
          } else {
             return 1
          }
        })
        return sorted
    }

    public static calculateAverageOfArray(arr:number[]){
        if (arr.length == 0){
            return null
        }
        let sum = 0
        for (let item of arr){
            sum += item
        }
        return sum / arr.length
    }

    public static calculateNewAverage(oldAverage:number, newNumber:number, newN:number) {
        return ( (oldAverage*(newN - 1)) + newNumber) / newN
    }

    public static minutesPassedBetweenDates(now, then) {
        const nowMoment = moment(now)
        const thenMoment = moment(then)
        return nowMoment.diff(thenMoment, 'minutes') 
    }

    public static roundToPrecision(value, precision) {
        const multiplier = Math.pow(10, precision || 0);
        return Math.round(value * multiplier) / multiplier;
    }

 
    // public static isDayAfterFirstWeekdayOfMonth(date:Date){
    //     const dayOfMonth = moment(date).tz(this.timezone).date()
    //     const dayBefore = moment(date).tz(this.timezone).subtract(1, 'days')
    //     return (dayOfMonth > 1 && dayOfMonth < 5 ) && !this.isWeekendMoment(dayBefore)
    // }

    public static isValidNumber(num:number){
        return num && !isNaN(num) && isFinite(num)
    }

    public static calculateTrendlineSlope(arr:number[]){
        const xvals:number[] = []
        let sumY = 0
        for (let i = 0; i < arr.length; i++){
            xvals.push(i)
            sumY += arr[i]
        }
        const meanX = xvals.reduce((a,b) => a + b) / xvals.length
        const meanY = sumY / arr.length
        let sumsquares:number = 0
        let sumproducts:number = 0
        for (let j = 0; j < arr.length; j++){
            sumsquares += ((j - meanX) * (j - meanX))
            sumproducts += ((j - meanX) * (arr[j] - meanY))
        }
        const slope = sumproducts / sumsquares
        return slope
    }

    public static convert24hTo12H(time: any) {
        if (time.includes(":") && time.split(":").length >= 3) {
            let spl = time.split(":")
            time = spl[0] + ":" + spl[1]
        }
        // Check correct time format and split into components
        time = time.toString().match(/^([01]\d|2[0-3])(:)([0-5]\d)(:[0-5]\d)?$/) || [time];

        if (time.length > 1) { // If time format correct
            time = time.slice(1);  // Remove full string match value
            time[5] = +time[0] < 12 ? ' AM' : ' PM'; // Set AM/PM
            time[0] = +time[0] % 12 || 12; // Adjust hours
        }
        return time.join(''); // return adjusted time or original string

    }
    
}