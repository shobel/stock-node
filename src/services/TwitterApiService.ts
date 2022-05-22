const fetch = require('node-fetch');
const SpellCorrector = require('spelling-corrector');
const aposToLexForm = require('apos-to-lex-form');
const natural = require('natural');
const SW = require('stopword');
import SentimentIntensityAnalyzer from '../packages/vader/vaderSentiment';
import TwitterDao from '../dao/TwitterDao';
import UserDao from '../dao/UserDao';
import Utilities from '../utils/Utilities';

export default class TwitterApiService {

    public static apiBaseUrl = `https://api.twitter.com/2/`// users/by?usernames=hedgeyeretail
    public static userLookup = `users/by?usernames=`

    public static dayInMs = 86400000
    public static sixMonthsInMs = 15552000000
    public static maxTwitterFollowsPerMonth = 5
    public static maxTweetsInit = 100
    public static maxTweetsDay = 10

    private static spellCorrector = new SpellCorrector();
    
    constructor(){
        TwitterApiService.spellCorrector.loadDictionary()
    }

    public static async removeTwitterAccount(userid:string, at:string){
        let udi = UserDao.getUserDaoInstance()
        let userSnap:any = await udi.getDocSnapshotsInCollection(udi.userCollection, userid)
        let existingTwitterAccounts:any[] = userSnap.get(udi.twitterAccountsArrayField)
        existingTwitterAccounts.splice(existingTwitterAccounts.indexOf(at.toLowerCase()), 1)
        return UserDao.getUserDaoInstance().removeTwitterAccount(userid, existingTwitterAccounts)
    }

    public static async searchForTwitterAccount(userid:string, at:string){
        let udi = UserDao.getUserDaoInstance()
        let userSnap:any = await udi.getDocSnapshotsInCollection(udi.userCollection, userid)
        let existingTwitterAccounts:any[] = userSnap.get(udi.twitterAccountsArrayField)
        let currentMonthlyFollows = userSnap.get(udi.twitterAccountsMonthlyCounter)

        if (existingTwitterAccounts && existingTwitterAccounts.includes(at.toLowerCase())){
            return {
                error: "You already follow this user."
            }
        }

        //if user is currently follow 5 accounts, they can't add another
        if (existingTwitterAccounts && existingTwitterAccounts.length >= TwitterApiService.maxTwitterFollowsPerMonth) {
            return {
                error: "You already follow the maximum number of Twitter useres."
            }
        }
        //if user has reached their monthly limit, they can't add another (even if they are follow < max)
        if (currentMonthlyFollows && currentMonthlyFollows >= TwitterApiService.maxTwitterFollowsPerMonth){
            return {
                error: "You've reached the monthly limit of added users."
            }
        }

        let docsnap:any = await TwitterDao.twitterDao.getDocSnapshot(at.toLowerCase())
        //if someone has already added this account, fetch info from db
        if (docsnap != null && docsnap.id != null && docsnap.exists) {
            return docsnap.data()?.account
        }
        return await TwitterApiService.fetchTwitterAccount(at)
    }

    public static async getDailyTweetsForAllFollowedAccounts(){
        let allUserSnapshots = Object.values(UserDao.getUserDaoInstance().snapshotCache)
        let twitterAccountsSet = new Set()
        for (let snap of allUserSnapshots){
            let twitterList = (snap as any).get(UserDao.getUserDaoInstance().twitterAccountsArrayField)
            if (twitterList != null){
                for (let twitterAccount of twitterList){
                    twitterAccountsSet.add(twitterAccount)
                }
            }
        }
        for (let account of twitterAccountsSet) {
            let since = (new Date(Date.now() - TwitterApiService.dayInMs)).toISOString()
            let returnData = await TwitterApiService.updateTwitterAccountData(account as string, since, 10)
            if (!returnData || !returnData.cashtags){
                continue
            }
            let docsnap:any = await TwitterDao.twitterDao.getDocSnapshot(account as string)
            let existingData:any
            if (docsnap.exists) {
                existingData = {
                    account: docsnap.get("account"),
                    cashtags: docsnap.get("cashtags")
                }
            }
            if (existingData && returnData.cashtags){
                //we have to merge existing data into new data
                let existingCashtags:any = existingData?.cashtags
                let newCashtags:any = returnData.cashtags
                if (existingCashtags) {
                    for (let ct of Object.values(existingCashtags)) {
                        let existingCt:any = ct 
                        let newCt = newCashtags[existingCt.symbol]
                        if (newCt) {
                            let newOverallSent = ((existingCt.overallSentiment * existingCt.count) + (newCt.overallSentiment * newCt.count)) / (existingCt.count + newCt.count)
                            newCt.count = existingCt.count + newCt.count
                            newCt.overallSentiment = newOverallSent
                            for (let sent of existingCt.sentiments) {
                                newCt.sentiments.push(sent)
                            }
                        } else {
                            newCashtags[existingCt.symbol] = existingCt
                        }
                    }
                }
            }
            TwitterDao.twitterDao.updateOrCreateTwitterDoc(returnData.account.username.toLowerCase(), { account: returnData.account, cashtags: returnData.cashtags }, returnData.tweets)
        }
    }

    public static async addTwitterAccount(userid:string, at:string){
        let udi = UserDao.getUserDaoInstance()
        let userSnap:any = await udi.getDocSnapshotsInCollection(udi.userCollection, userid)
        let existingTwitterAccounts:any[] = userSnap.get(udi.twitterAccountsArrayField)
        let currentMonthlyFollows = userSnap.get(udi.twitterAccountsMonthlyCounter)

        if (existingTwitterAccounts && existingTwitterAccounts.includes(at.toLowerCase())){
            return false
        }

        //if user is currently follow 5 accounts, they can't add another
        if (existingTwitterAccounts && existingTwitterAccounts.length >= TwitterApiService.maxTwitterFollowsPerMonth) {
            return false
        }
        //if user has reached their monthly limit, they can't add another (even if they are follow < max)
        if (currentMonthlyFollows && currentMonthlyFollows >= TwitterApiService.maxTwitterFollowsPerMonth){
            return false
        }

        let tweetsToGet = 0
        let since:string = ""
        let existingData:any
        let docsnap:any = await TwitterDao.twitterDao.getDocSnapshot(at.toLowerCase())
        if (docsnap != null && docsnap.id != null && docsnap.exists) {
            //someone has added this account, possibly fetch info from db (but probably not - only if someone fetched already today)
            let latestTweet = await TwitterDao.twitterDao.getLatestTweetForDoc(at.toLowerCase())
            let daysOld = -1
            if (latestTweet && latestTweet.created_at) {
                daysOld = Utilities.countDaysBetweenDateStrings((new Date()).toISOString(), (new Date(latestTweet.created_at).toISOString())) 
                if (daysOld > 0) {
                    since = new Date(Date.now() - (daysOld * TwitterApiService.dayInMs)).toISOString()
                    tweetsToGet = daysOld * TwitterApiService.maxTweetsDay
                }
            }

            existingData = {
                account: docsnap.get("account"),
                cashtags: docsnap.get("cashtags")
            }

            if (daysOld == 0 || daysOld == 1){
                if (!existingTwitterAccounts) {
                    existingTwitterAccounts = []
                }
                existingTwitterAccounts.push(at.toLowerCase())
                if (!currentMonthlyFollows) {
                    currentMonthlyFollows = 0
                }
                udi.addTwitterAccount(userid, existingTwitterAccounts, ++currentMonthlyFollows)
                return existingData
            }
        }

        if (tweetsToGet > 100 || tweetsToGet == 0){
            tweetsToGet = 100
        }
        if (since == ""){
            let timeAgo = Date.now() - TwitterApiService.sixMonthsInMs
            since = new Date(timeAgo).toISOString()
        }
        let returnData = await TwitterApiService.updateTwitterAccountData(at, since, tweetsToGet)
        if (!returnData) {
            //no new data, but there is existing data so return the existing data
            return existingData
        }
        if (existingData && returnData.cashtags){
            //we have to merge existing data into new data
            let existingCashtags:any = existingData?.cashtags
            let newCashtags:any = returnData.cashtags
            if (existingCashtags) {
                for (let ct of Object.values(existingCashtags)) {
                    let existingCt:any = ct 
                    let newCt = newCashtags[existingCt.symbol]
                    if (newCt) {
                        let newOverallSent = ((existingCt.overallSentiment * existingCt.count) + (newCt.overallSentiment * newCt.count)) / (existingCt.count + newCt.count)
                        newCt.count = existingCt.count + newCt.count
                        newCt.overallSentiment = newOverallSent
                        for (let sent of existingCt.sentiments) {
                            newCt.sentiments.push(sent)
                        }
                    } else {
                        newCashtags[existingCt.symbol] = existingCt
                    }
                }
            }
        }
        TwitterDao.twitterDao.updateOrCreateTwitterDoc(returnData.account.username.toLowerCase(), { account: returnData.account, cashtags: returnData.cashtags }, returnData.tweets)
        
        if (existingTwitterAccounts && existingTwitterAccounts.includes(at.toLowerCase())) {
            return returnData
        } else {
            if (!existingTwitterAccounts) {
                existingTwitterAccounts = []
            }
            existingTwitterAccounts.push(at.toLowerCase())
            if (!currentMonthlyFollows) {
                currentMonthlyFollows = 0
            }
            udi.addTwitterAccount(userid, existingTwitterAccounts, ++currentMonthlyFollows)
            return returnData
        }
    }

    public static async getTweetsForTwitterAccountAndSymbol(userid:string, username:string, symbol:string) {
        let udi = UserDao.getUserDaoInstance()
        let userSnap:any = await udi.getDocSnapshotsInCollection(udi.userCollection, userid)
        let existingTwitterAccounts:any[] = userSnap.get(udi.twitterAccountsArrayField)
        if (!existingTwitterAccounts || !existingTwitterAccounts.includes(username.toLowerCase())) {
            return
        }
        if (symbol.toUpperCase() == "RECENT"){
            let docSnaps:any = await TwitterDao.twitterDao.getAllTweetsForTwitterUser(username.toLowerCase())
            return docSnaps.map(d => d.data())
        } else {
            let docSnaps:any = await TwitterDao.twitterDao.getTweetsForDocAndSymbol(username.toLowerCase(), symbol)
            return docSnaps.map(d => d.data())
        }
    }

    public static async getAllTwitterAccountsForUser(userid:string){
        let udi = UserDao.getUserDaoInstance()
        let userSnap:any = await udi.getDocSnapshotsInCollection(udi.userCollection, userid)
        let existingTwitterAccounts:any[] = userSnap.get(udi.twitterAccountsArrayField)
        let twitterAccounts:any[] = []
        if (existingTwitterAccounts != null){
            for (let acc of existingTwitterAccounts){
                let snap = await TwitterDao.twitterDao.getDocSnapshot(acc.toLowerCase())
                if (snap){
                    twitterAccounts.push(snap.data())
                }
            }
        }
        return twitterAccounts
    }

    public static async updateTwitterAccountData(at:string, since:string, max:number){
        let twitterAccount = await TwitterApiService.fetchTwitterAccount(at)
        if (twitterAccount && !twitterAccount.error) {
            let data = await TwitterApiService.fetchTweetsForUser(twitterAccount.id, since, max, at)
            let cashtags = null
            let tweets = []
            if (data){
                cashtags = data.cashtags
                tweets = data.tweets
            }
            return {
                account: twitterAccount, 
                cashtags: cashtags,
                tweets: tweets
            }
        }
        return null
    }

    public static async fetchTwitterAccount(username:string){
        let url = `${TwitterApiService.apiBaseUrl}${TwitterApiService.userLookup}${username}&user.fields=profile_image_url,public_metrics,description`
        return fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
            }
        })
        .then((res: { json: () => any; }) => {
            return res.json()
        }).catch(err => err)
        .then((data: any) => {
            if (data && data.data && data.data.length){
                let d = data.data[0]
                d.followers_count = d["public_metrics"].followers_count,
                d.following_count = d["public_metrics"].following_count,
                d.tweet_count = d["public_metrics"].tweet_count,
                d.listed_count = d["public_metrics"].listed_count,
                delete d.public_metrics
                return d
            }
            return {
                error: `No Twitter user ${username} found`
            }
        })
    }

    public static async fetchTweetsForUser(id:string, since:string, max:number, username:string){
        let url = `${TwitterApiService.apiBaseUrl}users/${id}/tweets?start_time=${since}&max_results=${max}&tweet.fields=created_at&exclude=retweets`
        return fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
            } 
        }).then((res: { json: () => any; }) => {
            return res.json()
        }).catch(err => err)
        .then(async (data: any) => {
            let cashtags:any = {}
            let tweets:any[] = []
            if (data && data.data && data.data.length) {
                let existingTweets = await TwitterDao.twitterDao.getTweetsForDoc(username.toLowerCase())
                for (let tweet of data.data){
                    let tweetAlreadyExists = false
                    if (existingTweets) {
                        for (let et of existingTweets){
                            if (et.id == tweet.id) {
                                tweetAlreadyExists = true
                                break
                            }
                        }
                    }
                    if (tweetAlreadyExists){
                        continue
                    }
                    let sent = TwitterApiService.getSentiment(tweet.text)
                    let tags = TwitterApiService.findTickerMentionsInTweet(tweet.text)
                    if (!tags || !tags.length){
                        continue
                    }
                    for (let t of tags) {
                        if (cashtags[t] != null){
                            cashtags[t].count = ++(cashtags[t].count)
                            cashtags[t].sentiments.push(sent)
                        } else {
                            cashtags[t] = {
                                count: 1,
                                sentiments: [sent]
                            }
                        }
                    }
                    tweet.created_at = (new Date(tweet.created_at)).toLocaleString("en-US")
                    tweet.sentiment = sent
                    tweet.cashtags = tags
                    tweets.push(tweet)
                }
                for (let [key,val] of Object.entries(cashtags)){
                    let total = 0.0
                    for (let sent of cashtags[key].sentiments){
                        total += sent
                    }
                    let overall = total / cashtags[key].sentiments.length
                    cashtags[key].overallSentiment = overall
                    cashtags[key].symbol = key
                }
                return {
                    cashtags: cashtags,
                    tweets: tweets
                }
            }
            return null
        })
    }

    public static async resetMonthlyCounters(){
        let userdocsnaps = UserDao.getUserDaoInstance().snapshotCache
        for (let docsnap of userdocsnaps){
            if (docsnap && docsnap.exists) {
                UserDao.getUserDaoInstance().resetTwitterMonthlyCounter(docsnap.id)
            }
        }
    }

    public static getSentiment(text:string){
        // let filteredReview = TwitterApiService.preprocessSentence(text)
        // const { SentimentAnalyzer, PorterStemmer } = natural;
        // const analyzer = new SentimentAnalyzer('English', PorterStemmer, 'senticon');
        // const analysis = analyzer.getSentiment(filteredReview);
        // console.log(`SENTICON: ${analysis}`)

        //SentimentIntensityAnalyzer.setStockLexicon(false)
        //let intensity = SentimentIntensityAnalyzer.polarity_scores(text)
        //console.log(`REGULAR VADER: [neg:${intensity.neg}, pos:${intensity.pos}, neu:${intensity.neu}, comp:${intensity.compound}]`)

        SentimentIntensityAnalyzer.setStockLexicon(true)
        let intensity = SentimentIntensityAnalyzer.polarity_scores(text)
        //console.log(`STOCK VADER: [neg:${intensity.neg}, pos:${intensity.pos}, neu:${intensity.neu}, comp:${intensity.compound}]`)

        return intensity.compound
    }

    public static preprocessSentence(text:string){
        const lexedReview = aposToLexForm(text);
        const casedReview = lexedReview.toLowerCase();
        const alphaOnlyReview = casedReview.replace(/[^a-zA-Z\s]+/g, '');
      
        const { WordTokenizer } = natural;
        const tokenizer = new WordTokenizer();
        const tokenizedReview = tokenizer.tokenize(alphaOnlyReview);
      
        tokenizedReview.forEach((word, index) => {
          tokenizedReview[index] = TwitterApiService.spellCorrector.correct(word);
        })
        const filteredReview = SW.removeStopwords(tokenizedReview);
        return filteredReview
    }

    private static findTickerMentionsInTweet(tweet: string) {
        let cashtags:string[] = []
        var cashtagIndices:number[] = [];
        for (var i = 0; i < tweet.length; i++) {
            if (tweet[i] == "$") {
                cashtagIndices.push(i)
            }
        }
        for (let index of cashtagIndices){
            let cashtag:string = ""
            let end:boolean = false
            let pos:number = 1
            while (!end){
                if (pos >= tweet.length){
                    end = true
                }
                let char = tweet[index + pos]
                if (char == " " || !char || !char.match(/[A-Z|a-z]/i)){
                    end = true
                } else {
                    cashtag += char
                }
                pos++
            }
            if (cashtag != "" && cashtag.length <= 4 && !cashtags.includes(cashtag.toUpperCase())) {
                cashtags.push(cashtag.toUpperCase())
            }
        }
        return cashtags
    }
}