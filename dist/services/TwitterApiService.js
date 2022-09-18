"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetch = require('node-fetch');
const SpellCorrector = require('spelling-corrector');
const aposToLexForm = require('apos-to-lex-form');
const natural = require('natural');
const SW = require('stopword');
const vaderSentiment_1 = require("../packages/vader/vaderSentiment");
const TwitterDao_1 = require("../dao/TwitterDao");
const UserDao_1 = require("../dao/UserDao");
const Utilities_1 = require("../utils/Utilities");
class TwitterApiService {
    constructor() {
        TwitterApiService.spellCorrector.loadDictionary();
    }
    static async removeTwitterAccount(userid, at) {
        let udi = UserDao_1.default.getUserDaoInstance();
        let userSnap = await udi.getDocSnapshotsInCollection(udi.userCollection, userid);
        let existingTwitterAccounts = userSnap.get(udi.twitterAccountsArrayField);
        existingTwitterAccounts.splice(existingTwitterAccounts.indexOf(at.toLowerCase()), 1);
        return UserDao_1.default.getUserDaoInstance().removeTwitterAccount(userid, existingTwitterAccounts);
    }
    static async searchForTwitterAccount(userid, at) {
        var _a;
        let udi = UserDao_1.default.getUserDaoInstance();
        let userSnap = await udi.getDocSnapshotsInCollection(udi.userCollection, userid);
        let existingTwitterAccounts = userSnap.get(udi.twitterAccountsArrayField);
        let currentMonthlyFollows = userSnap.get(udi.twitterAccountsMonthlyCounter);
        if (existingTwitterAccounts && existingTwitterAccounts.includes(at.toLowerCase())) {
            return {
                error: "You already follow this user."
            };
        }
        //if user is currently follow 5 accounts, they can't add another
        if (existingTwitterAccounts && existingTwitterAccounts.length >= TwitterApiService.maxTwitterFollowsPerMonth) {
            return {
                error: "You already follow the maximum number of Twitter useres."
            };
        }
        //if user has reached their monthly limit, they can't add another (even if they are follow < max)
        if (currentMonthlyFollows && currentMonthlyFollows >= TwitterApiService.maxTwitterFollowsPerMonth) {
            return {
                error: "You've reached the monthly limit of added users."
            };
        }
        let docsnap = await TwitterDao_1.default.twitterDao.getDocSnapshot(at.toLowerCase());
        //if someone has already added this account, fetch info from db
        if (docsnap != null && docsnap.id != null && docsnap.exists) {
            return (_a = docsnap.data()) === null || _a === void 0 ? void 0 : _a.account;
        }
        return await TwitterApiService.fetchTwitterAccount(at);
    }
    static async getDailyTweetsForAllFollowedAccounts() {
        let allUserSnapshots = Object.values(UserDao_1.default.getUserDaoInstance().snapshotCache);
        let twitterAccountsSet = new Set();
        for (let snap of allUserSnapshots) {
            let twitterList = snap.get(UserDao_1.default.getUserDaoInstance().twitterAccountsArrayField);
            if (twitterList != null) {
                for (let twitterAccount of twitterList) {
                    twitterAccountsSet.add(twitterAccount);
                }
            }
        }
        for (let account of twitterAccountsSet) {
            let since = (new Date(Date.now() - TwitterApiService.dayInMs)).toISOString();
            let returnData = await TwitterApiService.updateTwitterAccountData(account, since, 10);
            if (!returnData || !returnData.cashtags) {
                continue;
            }
            let docsnap = await TwitterDao_1.default.twitterDao.getDocSnapshot(account);
            let existingData;
            if (docsnap.exists) {
                existingData = {
                    account: docsnap.get("account"),
                    cashtags: docsnap.get("cashtags")
                };
            }
            if (existingData && returnData.cashtags) {
                //we have to merge existing data into new data
                let existingCashtags = existingData === null || existingData === void 0 ? void 0 : existingData.cashtags;
                let newCashtags = returnData.cashtags;
                if (existingCashtags) {
                    for (let ct of Object.values(existingCashtags)) {
                        let existingCt = ct;
                        let newCt = newCashtags[existingCt.symbol];
                        if (newCt) {
                            let newOverallSent = ((existingCt.overallSentiment * existingCt.count) + (newCt.overallSentiment * newCt.count)) / (existingCt.count + newCt.count);
                            newCt.count = existingCt.count + newCt.count;
                            newCt.overallSentiment = newOverallSent;
                            for (let sent of existingCt.sentiments) {
                                newCt.sentiments.push(sent);
                            }
                        }
                        else {
                            newCashtags[existingCt.symbol] = existingCt;
                        }
                    }
                }
            }
            TwitterDao_1.default.twitterDao.updateOrCreateTwitterDoc(returnData.account.username.toLowerCase(), { account: returnData.account, cashtags: returnData.cashtags }, returnData.tweets);
        }
    }
    static async addTwitterAccount(userid, at) {
        let udi = UserDao_1.default.getUserDaoInstance();
        let userSnap = await udi.getDocSnapshotsInCollection(udi.userCollection, userid);
        let existingTwitterAccounts = userSnap.get(udi.twitterAccountsArrayField);
        let currentMonthlyFollows = userSnap.get(udi.twitterAccountsMonthlyCounter);
        if (existingTwitterAccounts && existingTwitterAccounts.includes(at.toLowerCase())) {
            return false;
        }
        //if user is currently follow 5 accounts, they can't add another
        if (existingTwitterAccounts && existingTwitterAccounts.length >= TwitterApiService.maxTwitterFollowsPerMonth) {
            return false;
        }
        //if user has reached their monthly limit, they can't add another (even if they are follow < max)
        if (currentMonthlyFollows && currentMonthlyFollows >= TwitterApiService.maxTwitterFollowsPerMonth) {
            return false;
        }
        let tweetsToGet = 0;
        let since = "";
        let existingData;
        let docsnap = await TwitterDao_1.default.twitterDao.getDocSnapshot(at.toLowerCase());
        if (docsnap != null && docsnap.id != null && docsnap.exists) {
            //someone has added this account, possibly fetch info from db (but probably not - only if someone fetched already today)
            let latestTweet = await TwitterDao_1.default.twitterDao.getLatestTweetForDoc(at.toLowerCase());
            let daysOld = -1;
            if (latestTweet && latestTweet.created_at) {
                daysOld = Utilities_1.default.countDaysBetweenDateStrings((new Date()).toISOString(), (new Date(latestTweet.created_at).toISOString()));
                if (daysOld > 0) {
                    since = new Date(Date.now() - (daysOld * TwitterApiService.dayInMs)).toISOString();
                    tweetsToGet = daysOld * TwitterApiService.maxTweetsDay;
                }
            }
            existingData = {
                account: docsnap.get("account"),
                cashtags: docsnap.get("cashtags")
            };
            if (daysOld == 0 || daysOld == 1) {
                if (!existingTwitterAccounts) {
                    existingTwitterAccounts = [];
                }
                existingTwitterAccounts.push(at.toLowerCase());
                if (!currentMonthlyFollows) {
                    currentMonthlyFollows = 0;
                }
                udi.addTwitterAccount(userid, existingTwitterAccounts, ++currentMonthlyFollows);
                return existingData;
            }
        }
        if (tweetsToGet > 100 || tweetsToGet == 0) {
            tweetsToGet = 100;
        }
        if (since == "") {
            let timeAgo = Date.now() - TwitterApiService.sixMonthsInMs;
            since = new Date(timeAgo).toISOString();
        }
        let returnData = await TwitterApiService.updateTwitterAccountData(at, since, tweetsToGet);
        if (!returnData) {
            //no new data, but there is existing data so return the existing data
            return existingData;
        }
        if (existingData && returnData.cashtags) {
            //we have to merge existing data into new data
            let existingCashtags = existingData === null || existingData === void 0 ? void 0 : existingData.cashtags;
            let newCashtags = returnData.cashtags;
            if (existingCashtags) {
                for (let ct of Object.values(existingCashtags)) {
                    let existingCt = ct;
                    let newCt = newCashtags[existingCt.symbol];
                    if (newCt) {
                        let newOverallSent = ((existingCt.overallSentiment * existingCt.count) + (newCt.overallSentiment * newCt.count)) / (existingCt.count + newCt.count);
                        newCt.count = existingCt.count + newCt.count;
                        newCt.overallSentiment = newOverallSent;
                        for (let sent of existingCt.sentiments) {
                            newCt.sentiments.push(sent);
                        }
                    }
                    else {
                        newCashtags[existingCt.symbol] = existingCt;
                    }
                }
            }
        }
        TwitterDao_1.default.twitterDao.updateOrCreateTwitterDoc(returnData.account.username.toLowerCase(), { account: returnData.account, cashtags: returnData.cashtags }, returnData.tweets);
        if (existingTwitterAccounts && existingTwitterAccounts.includes(at.toLowerCase())) {
            return returnData;
        }
        else {
            if (!existingTwitterAccounts) {
                existingTwitterAccounts = [];
            }
            existingTwitterAccounts.push(at.toLowerCase());
            if (!currentMonthlyFollows) {
                currentMonthlyFollows = 0;
            }
            udi.addTwitterAccount(userid, existingTwitterAccounts, ++currentMonthlyFollows);
            return returnData;
        }
    }
    static async getTweetsForTwitterAccountAndSymbol(userid, username, symbol) {
        let udi = UserDao_1.default.getUserDaoInstance();
        let userSnap = await udi.getDocSnapshotsInCollection(udi.userCollection, userid);
        let existingTwitterAccounts = userSnap.get(udi.twitterAccountsArrayField);
        if (!existingTwitterAccounts || !existingTwitterAccounts.includes(username.toLowerCase())) {
            return;
        }
        if (symbol.toUpperCase() == "RECENT") {
            let docSnaps = await TwitterDao_1.default.twitterDao.getAllTweetsForTwitterUser(username.toLowerCase());
            return docSnaps.map(d => d.data());
        }
        else {
            let docSnaps = await TwitterDao_1.default.twitterDao.getTweetsForDocAndSymbol(username.toLowerCase(), symbol);
            return docSnaps.map(d => d.data());
        }
    }
    static async getAllTwitterAccountsForUser(userid) {
        let udi = UserDao_1.default.getUserDaoInstance();
        let userSnap = await udi.getDocSnapshotsInCollection(udi.userCollection, userid);
        let existingTwitterAccounts = userSnap.get(udi.twitterAccountsArrayField);
        let twitterAccounts = [];
        if (existingTwitterAccounts != null) {
            for (let acc of existingTwitterAccounts) {
                let snap = await TwitterDao_1.default.twitterDao.getDocSnapshot(acc.toLowerCase());
                if (snap) {
                    twitterAccounts.push(snap.data());
                }
            }
        }
        return twitterAccounts;
    }
    static async updateTwitterAccountData(at, since, max) {
        let twitterAccount = await TwitterApiService.fetchTwitterAccount(at);
        if (twitterAccount && !twitterAccount.error) {
            let data = await TwitterApiService.fetchTweetsForUser(twitterAccount.id, since, max, at);
            let cashtags = null;
            let tweets = [];
            if (data) {
                cashtags = data.cashtags;
                tweets = data.tweets;
            }
            return {
                account: twitterAccount,
                cashtags: cashtags,
                tweets: tweets
            };
        }
        return null;
    }
    static async fetchTwitterAccount(username) {
        let url = `${TwitterApiService.apiBaseUrl}${TwitterApiService.userLookup}${username}&user.fields=profile_image_url,public_metrics,description`;
        return fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
            }
        })
            .then((res) => {
            return res.json();
        }).catch(err => err)
            .then((data) => {
            if (data && data.data && data.data.length) {
                let d = data.data[0];
                d.followers_count = d["public_metrics"].followers_count,
                    d.following_count = d["public_metrics"].following_count,
                    d.tweet_count = d["public_metrics"].tweet_count,
                    d.listed_count = d["public_metrics"].listed_count,
                    delete d.public_metrics;
                return d;
            }
            return {
                error: `No Twitter user ${username} found`
            };
        });
    }
    static async fetchTweetsForUser(id, since, max, username) {
        let url = `${TwitterApiService.apiBaseUrl}users/${id}/tweets?start_time=${since}&max_results=${max}&tweet.fields=created_at&exclude=retweets`;
        return fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
            }
        }).then((res) => {
            return res.json();
        }).catch(err => err)
            .then(async (data) => {
            let cashtags = {};
            let tweets = [];
            if (data && data.data && data.data.length) {
                let existingTweets = await TwitterDao_1.default.twitterDao.getTweetsForDoc(username.toLowerCase());
                for (let tweet of data.data) {
                    let tweetAlreadyExists = false;
                    if (existingTweets) {
                        for (let et of existingTweets) {
                            if (et.id == tweet.id) {
                                tweetAlreadyExists = true;
                                break;
                            }
                        }
                    }
                    if (tweetAlreadyExists) {
                        continue;
                    }
                    let sent = TwitterApiService.getSentiment(tweet.text);
                    let tags = TwitterApiService.findTickerMentionsInTweet(tweet.text);
                    if (!tags || !tags.length) {
                        continue;
                    }
                    for (let t of tags) {
                        if (cashtags[t] != null) {
                            cashtags[t].count = ++(cashtags[t].count);
                            cashtags[t].sentiments.push(sent);
                        }
                        else {
                            cashtags[t] = {
                                count: 1,
                                sentiments: [sent]
                            };
                        }
                    }
                    tweet.created_at = (new Date(tweet.created_at)).toLocaleString("en-US");
                    tweet.sentiment = sent;
                    tweet.cashtags = tags;
                    tweets.push(tweet);
                }
                for (let [key, val] of Object.entries(cashtags)) {
                    let total = 0.0;
                    for (let sent of cashtags[key].sentiments) {
                        total += sent;
                    }
                    let overall = total / cashtags[key].sentiments.length;
                    cashtags[key].overallSentiment = overall;
                    cashtags[key].symbol = key;
                }
                return {
                    cashtags: cashtags,
                    tweets: tweets
                };
            }
            return null;
        });
    }
    static async resetMonthlyCounters() {
        let userdocsnaps = UserDao_1.default.getUserDaoInstance().snapshotCache;
        for (let docsnap of userdocsnaps) {
            if (docsnap && docsnap.exists) {
                UserDao_1.default.getUserDaoInstance().resetTwitterMonthlyCounter(docsnap.id);
            }
        }
    }
    static getSentiment(text) {
        // let filteredReview = TwitterApiService.preprocessSentence(text)
        // const { SentimentAnalyzer, PorterStemmer } = natural;
        // const analyzer = new SentimentAnalyzer('English', PorterStemmer, 'senticon');
        // const analysis = analyzer.getSentiment(filteredReview);
        // console.log(`SENTICON: ${analysis}`)
        //SentimentIntensityAnalyzer.setStockLexicon(false)
        //let intensity = SentimentIntensityAnalyzer.polarity_scores(text)
        //console.log(`REGULAR VADER: [neg:${intensity.neg}, pos:${intensity.pos}, neu:${intensity.neu}, comp:${intensity.compound}]`)
        vaderSentiment_1.default.setStockLexicon(true);
        let intensity = vaderSentiment_1.default.polarity_scores(text);
        //console.log(`STOCK VADER: [neg:${intensity.neg}, pos:${intensity.pos}, neu:${intensity.neu}, comp:${intensity.compound}]`)
        return intensity.compound;
    }
    static preprocessSentence(text) {
        const lexedReview = aposToLexForm(text);
        const casedReview = lexedReview.toLowerCase();
        const alphaOnlyReview = casedReview.replace(/[^a-zA-Z\s]+/g, '');
        const { WordTokenizer } = natural;
        const tokenizer = new WordTokenizer();
        const tokenizedReview = tokenizer.tokenize(alphaOnlyReview);
        tokenizedReview.forEach((word, index) => {
            tokenizedReview[index] = TwitterApiService.spellCorrector.correct(word);
        });
        const filteredReview = SW.removeStopwords(tokenizedReview);
        return filteredReview;
    }
    static findTickerMentionsInTweet(tweet) {
        let cashtags = [];
        var cashtagIndices = [];
        for (var i = 0; i < tweet.length; i++) {
            if (tweet[i] == "$") {
                cashtagIndices.push(i);
            }
        }
        for (let index of cashtagIndices) {
            let cashtag = "";
            let end = false;
            let pos = 1;
            while (!end) {
                if (pos >= tweet.length) {
                    end = true;
                }
                let char = tweet[index + pos];
                if (char == " " || !char || !char.match(/[A-Z|a-z]/i)) {
                    end = true;
                }
                else {
                    cashtag += char;
                }
                pos++;
            }
            if (cashtag != "" && cashtag.length <= 4 && !cashtags.includes(cashtag.toUpperCase())) {
                cashtags.push(cashtag.toUpperCase());
            }
        }
        return cashtags;
    }
}
exports.default = TwitterApiService;
TwitterApiService.apiBaseUrl = `https://api.twitter.com/2/`; // users/by?usernames=hedgeyeretail
TwitterApiService.userLookup = `users/by?usernames=`;
TwitterApiService.dayInMs = 86400000;
TwitterApiService.sixMonthsInMs = 15552000000;
TwitterApiService.maxTwitterFollowsPerMonth = 5;
TwitterApiService.maxTweetsInit = 100;
TwitterApiService.maxTweetsDay = 10;
TwitterApiService.spellCorrector = new SpellCorrector();
//# sourceMappingURL=TwitterApiService.js.map