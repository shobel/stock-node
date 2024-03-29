"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const UserManager_1 = require("../managers/UserManager");
const AnalysisService_1 = require("../services/AnalysisService");
const StockDataManager_1 = require("../managers/StockDataManager");
const PremiumDataManager_1 = require("../managers/PremiumDataManager");
const UserDao_1 = require("../dao/UserDao");
const MarketDataManager_1 = require("../managers/MarketDataManager");
const TwitterApiService_1 = require("../services/TwitterApiService");
const PlaidService_1 = require("../services/PlaidService");
const AuthenticationService_1 = require("../services/AuthenticationService");
const baseRouter = require('./BaseRouter');
const userRouter = express_1.Router();
//verify token for all user functions
userRouter.use((req, res, next) => {
    baseRouter.verifyToken(req, res).then(userid => {
        res.locals = { userid: userid };
        next();
    }).catch(err => { console.log("token expired"); });
});
userRouter.get('/delete-account', async (req, res) => {
    const userid = res.locals.userid;
    let d = await AuthenticationService_1.default.deleteAccount(userid);
    res.status(200).send(d);
});
//buys credits
userRouter.post('/verifyReceipt', async (req, res) => {
    const userid = res.locals.userid;
    const email = req.body.email;
    const receiptCode = req.body.receipt;
    const productid = req.body.productid;
    UserManager_1.default.handlePurchase(receiptCode, userid, productid).then(credits => {
        res.status(200).send({ credits: credits });
    });
});
userRouter.get('/createUser/:email', async (req, res) => {
    const userid = res.locals.userid;
    const email = req.params.email;
    //create new user in firestore
    const userDoc = await UserManager_1.default.createNewUser(userid, email);
    res.status(200).send(userDoc);
});
userRouter.get('/getReceipts', async (req, res) => {
    const userid = res.locals.userid;
    let receipts = await UserManager_1.default.getReceiptsForUser(userid);
    res.status(200).send(receipts);
});
userRouter.get('/getPremiumTransactions', async (req, res) => {
    const userid = res.locals.userid;
    PremiumDataManager_1.default.getPremiumDataTransactionHistoryForUser(userid).then(transactions => {
        res.status(200).send(transactions);
    }).catch(err => err);
});
userRouter.post('/create', async (req, res) => {
    const userid = res.locals.userid;
    const email = req.body.email;
    UserManager_1.default.createNewUser(userid, email).then(result => {
        res.status(200).send(result);
    }).catch();
});
userRouter.get('/watchlist', async (req, res) => {
    const userid = res.locals.userid;
    let watchlist = UserManager_1.default.getWatchlistForUser(userid);
    let quotes = await StockDataManager_1.default.getLatestQuotesForSymbols(watchlist, true);
    res.status(200).send(quotes);
});
userRouter.get('/watchlist/add/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    const userid = res.locals.userid;
    UserManager_1.default.addToWatchlist(userid, symbol).then(result => {
        res.status(200).send(result);
    }).catch();
});
userRouter.get('/watchlist/remove/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    const userid = res.locals.userid;
    UserManager_1.default.removeFromWatchlist(userid, symbol).then(result => {
        res.status(200).send(result);
    }).catch();
});
userRouter.get('/getCredits', async (req, res) => {
    const userid = res.locals.userid;
    UserManager_1.default.getCreditsForUser(userid).then(result => {
        res.status(200).send({ credits: result });
    }).catch(error => error);
});
userRouter.get('/spendCredits/:symbol/:premiumId', async (req, res) => {
    const userid = res.locals.userid;
    const premiumId = req.params.premiumId;
    const symbol = req.params.symbol;
    PremiumDataManager_1.default.spendCreditsForPremiumData(userid, symbol, premiumId).then(result => {
        res.status(200).send(result);
    }).catch(err => err);
});
userRouter.get('/premium-for-symbols', async (req, res) => {
    const userid = res.locals.userid;
    const symbols = req.query.symbols;
    const premiumId = req.query.premiumId;
    if (!symbols) {
        res.send(null);
        return;
    }
    PremiumDataManager_1.default.getLatestPremiumDataTypeForSymbols(symbols.split(","), premiumId, userid).then(result => {
        res.send(result);
    });
});
//premium data 
userRouter.get('/premium/:symbol', async (req, res) => {
    const userid = res.locals.userid;
    const symbol = req.params.symbol;
    PremiumDataManager_1.default.getPremiumDataForUserAndStock(symbol, userid).then(result => {
        res.status(200).send(result);
    }).catch(err => err);
});
userRouter.get('/get-selected-score', async (req, res) => {
    const userid = res.locals.userid;
    let userDao = UserDao_1.default.getUserDaoInstance();
    userDao.getField(userDao.userCollection, userid, userDao.selectedScoreField).then(result => {
        res.send({ "selectedScore": result });
    });
});
userRouter.get('/set-selected-score/:selectedScore', async (req, res) => {
    const scoreId = req.params.selectedScore;
    const userid = res.locals.userid;
    let userDao = UserDao_1.default.getUserDaoInstance();
    userDao.setField(userDao.userCollection, userid, userDao.selectedScoreField, scoreId);
    res.send(true);
});
//endpoint called by UI for the main analysts page
userRouter.get('/tipranks/symbols', async (req, res) => {
    const userid = res.locals.userid;
    let subscribed = await PremiumDataManager_1.default.getTopAnalystsSubscription(userid);
    if (!subscribed) {
        res.send(null);
        return;
    }
    MarketDataManager_1.default.getTipranksSymbols(parseInt(req.query.numAnalystThreshold)).then(data => {
        res.send(data);
    }).catch();
});
userRouter.get('/stocktwits-for-symbol/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    StockDataManager_1.default.getStocktwitsPostsForSymbol(symbol).then(data => {
        res.send(data);
    }).catch();
});
userRouter.post('/set-score-settings', async (req, res) => {
    const userid = res.locals.userid;
    const settings = req.body.settings;
    UserManager_1.default.setUserScoreSettings(userid, settings).then(result => {
        res.send(result);
    }).catch();
});
userRouter.get('/scores-settings-applied', async (req, res) => {
    const userid = res.locals.userid;
    StockDataManager_1.default.applyUserScoreSettings(userid).then(result => {
        res.send(result);
    }).catch();
});
userRouter.get('/scores-settings-applied-for-symbol/:symbol', async (req, res) => {
    const userid = res.locals.userid;
    const symbol = req.params.symbol;
    StockDataManager_1.default.applyUserScoreSettingsForSymbol(userid, symbol).then(result => {
        res.send(result);
    }).catch();
});
userRouter.get('/scores-settings-applied-for-symbols', async (req, res) => {
    const userid = res.locals.userid;
    const symbols = req.query.symbols;
    const symbolsArray = symbols.split(',');
    StockDataManager_1.default.applyUserScoreSettings(userid, symbolsArray).then(result => {
        res.send(result);
    }).catch();
});
userRouter.get('/variables-and-score-settings', async (req, res) => {
    const userid = res.locals.userid;
    const variableNames = AnalysisService_1.default.variableNamesMap;
    const future = AnalysisService_1.default.futureMetrics;
    const past = AnalysisService_1.default.pastMetrics;
    const health = AnalysisService_1.default.healthMetrics;
    const valuation = AnalysisService_1.default.valuationMetrics;
    UserManager_1.default.getUserScoreSettings(userid).then(result => {
        res.send({
            scoreSettings: result,
            variableNames: variableNames,
            future: future,
            past: past,
            health: health,
            valuation: valuation
        });
    }).catch();
});
userRouter.get('/subscribe-top-analysts', async (req, res) => {
    const userid = res.locals.userid;
    PremiumDataManager_1.default.spendCreditsForTopAnalysts(userid, PremiumDataManager_1.default.TOP_ANALYSTS_DOC_ID, PremiumDataManager_1.default.TOP_ANALYSTS_PACKAGE_ID).then(results => {
        res.send(results);
    });
});
//check for whether user has sub
userRouter.get('/top-analysts-subscription', async (req, res) => {
    const userid = res.locals.userid;
    PremiumDataManager_1.default.getTopAnalystsSubscription(userid).then(results => {
        res.send({ date: results });
    });
});
userRouter.get('/get-issues', async (req, res) => {
    const userid = res.locals.userid;
    UserDao_1.default.getUserDaoInstance().getIssueSnapshots(userid).then(results => {
        let issues = results.map(r => r.data());
        res.send(issues);
    });
});
userRouter.get('/get-email-from-latest-issue', async (req, res) => {
    const userid = res.locals.userid;
    UserDao_1.default.getUserDaoInstance().getIssueSnapshots(userid).then(results => {
        if (results.length) {
            let lastResult = results[results.length - 1];
            let email = lastResult.get("email");
            res.send({ email: email });
        }
        else {
            res.send(null);
        }
    });
});
userRouter.post('/add-issue', async (req, res) => {
    const userid = res.locals.userid;
    const issue = req.body.issue;
    const email = req.body.email;
    UserDao_1.default.getUserDaoInstance().addIssue(userid, issue, email).then(result => {
        res.send(result);
    });
});
userRouter.get('/add-twitter-account/:at', async (req, res) => {
    const at = req.params.at;
    const userid = res.locals.userid;
    TwitterApiService_1.default.addTwitterAccount(userid, at).then(data => {
        res.send(data);
    });
});
userRouter.get('/remove-twitter-account/:at', async (req, res) => {
    const at = req.params.at;
    const userid = res.locals.userid;
    TwitterApiService_1.default.removeTwitterAccount(userid, at).then(data => {
        res.send(data);
    });
});
userRouter.get('/get-twitter-accounts', async (req, res) => {
    const userid = res.locals.userid;
    TwitterApiService_1.default.getAllTwitterAccountsForUser(userid).then(data => {
        res.send(data);
    });
});
userRouter.get('/get-tweets-for-twitter-account-and-symbol/:username/:symbol', async (req, res) => {
    const userid = res.locals.userid;
    const username = req.params.username;
    const symbol = req.params.symbol;
    TwitterApiService_1.default.getTweetsForTwitterAccountAndSymbol(userid, username, symbol).then(data => {
        res.send(data);
    });
});
userRouter.get('/get-twitter-account/:at', async (req, res) => {
    const at = req.params.at;
    const userid = res.locals.userid;
    TwitterApiService_1.default.searchForTwitterAccount(userid, at).then(result => {
        res.send(result);
    });
});
userRouter.get('/create-link-token', async (req, res) => {
    const userid = res.locals.userid;
    const request = {
        user: {
            client_user_id: userid,
        },
        client_name: 'Stoccoon',
        products: ['investments'],
        language: 'en',
        redirect_uri: 'https://stoccoon.com',
        country_codes: ['US'],
        account_filters: {
            "investment": {
                account_subtypes: ["all"],
            }
        }
    };
    let plaidService = PlaidService_1.default.getPlaidService();
    let x = await plaidService.createLinkToken(request);
    res.send({ "linkToken": x.link_token });
});
userRouter.get('/get-linked-account-and-holdings', async (req, res) => {
    const userid = res.locals.userid;
    let ud = UserDao_1.default.getUserDaoInstance();
    let account = await ud.getLinkedAccount(userid);
    let holdings = await ud.getLinkedHoldings(userid);
    res.send({
        account: account,
        holdings: holdings
    });
});
userRouter.get('/get-linked-account-balance-history', async (req, res) => {
    const userid = res.locals.userid;
    let ud = UserDao_1.default.getUserDaoInstance();
    let balanceHistory = await ud.getLinkedAccountBalanceHistory(userid);
    res.send({ balanceHistory: balanceHistory });
});
userRouter.post('/set-linked-account', async (req, res) => {
    const userid = res.locals.userid;
    const publicToken = req.body.publicToken;
    const account = req.body.account;
    let plaidService = PlaidService_1.default.getPlaidService();
    let accessTokenObj = await plaidService.exchangePublicForAccess(publicToken);
    account.accessToken = accessTokenObj;
    let accountAndholdings = await plaidService.setLinkedAccount(userid, accessTokenObj.accessToken, account);
    await UserDao_1.default.getUserDaoInstance().saveLinkedAccount(userid, accountAndholdings.account);
    await UserDao_1.default.getUserDaoInstance().saveLinkedHoldings(userid, accountAndholdings.holdings);
    res.send();
});
userRouter.get('/unlink-account', async (req, res) => {
    const userid = res.locals.userid;
    let linkedAccount = await UserDao_1.default.getUserDaoInstance().getLinkedAccount(userid);
    if (linkedAccount) {
        const request = {
            access_token: linkedAccount.accessToken.accessToken,
        };
        const response = await PlaidService_1.default.getPlaidService().removeAccount(request);
        UserDao_1.default.getUserDaoInstance().deleteAccountAndHoldings(userid);
        res.send(response);
    }
    else {
        res.send(null);
    }
});
exports.default = userRouter;
//# sourceMappingURL=UserRouter.js.map