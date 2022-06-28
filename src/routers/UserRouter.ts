import { Request, Response, Router } from 'express';
import UserManager from '../managers/UserManager';
import AnalysisService from '../services/AnalysisService';
import StockDataManager from '../managers/StockDataManager';
import PremiumDataManager from '../managers/PremiumDataManager';
import UserDao from '../dao/UserDao';
import MarketDataManager from '../managers/MarketDataManager';
import StockDao from '../dao/StockDao';
import TwitterApiService from '../services/TwitterApiService';
import PlaidService from '../services/PlaidService';
import AuthenticationService from '../services/AuthenticationService';

const baseRouter = require('./BaseRouter');
const userRouter = Router();

//verify token for all user functions
userRouter.use((req, res, next) => {
    baseRouter.verifyToken(req, res).then(userid => {
        res.locals = {userid: userid}
        next()
    }).catch(err => {console.log("token expired")})
})

userRouter.get('/delete-account', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    let d = await AuthenticationService.deleteAccount(userid)
    res.status(200).send(d)
})

//buys credits
userRouter.post('/verifyReceipt', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    const email = req.body.email
    const receiptCode = req.body.receipt
    const productid = req.body.productid
    UserManager.handlePurchase(receiptCode, userid, productid).then(credits => {
        res.status(200).send({ credits: credits })
    })
})

userRouter.get('/createUser/:email', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    const email = req.params.email
    //create new user in firestore
    const userDoc = await UserManager.createNewUser(userid, email)
    res.status(200).send(userDoc)
})            

userRouter.get('/getReceipts', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    let receipts = await UserManager.getReceiptsForUser(userid)
    res.status(200).send(receipts)
})

userRouter.get('/getPremiumTransactions', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    PremiumDataManager.getPremiumDataTransactionHistoryForUser(userid).then(transactions => {
        res.status(200).send(transactions)
    }).catch(err => err)
})

userRouter.post('/create', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    const email = req.body.email
    UserManager.createNewUser(userid, email).then(result => {
        res.status(200).send(result)
    }).catch()
})

userRouter.get('/watchlist', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    let watchlist = UserManager.getWatchlistForUser(userid)
    let quotes = await StockDataManager.getLatestQuotesForSymbols(watchlist, true)
    res.status(200).send(quotes)
})

userRouter.get('/watchlist/add/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    const userid = res.locals.userid
    UserManager.addToWatchlist(userid, symbol).then(result => {
        res.status(200).send(result)
    }).catch()
})

userRouter.get('/watchlist/remove/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    const userid = res.locals.userid
    UserManager.removeFromWatchlist(userid, symbol).then(result => {
        res.status(200).send(result)
    }).catch()
})

userRouter.get('/getCredits', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    UserManager.getCreditsForUser(userid).then(result => {
        res.status(200).send({ credits: result })
    }).catch(error => error)
})

userRouter.get('/spendCredits/:symbol/:premiumId', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    const premiumId = req.params.premiumId
    const symbol = req.params.symbol
    PremiumDataManager.spendCreditsForPremiumData(userid, symbol, premiumId).then(result => {
        res.status(200).send(result)
    }).catch(err => err)
}) 

userRouter.get('/premium-for-symbols', async (req: Request, res: Response) => { 
    const userid = res.locals.userid
    const symbols: string = req.query.symbols as string
    const premiumId:string = req.query.premiumId as string
    if (!symbols){
        res.send(null)
        return
    }
    PremiumDataManager.getLatestPremiumDataTypeForSymbols(symbols.split(","), premiumId, userid).then(result => {
        res.send(result)
    })
})

//premium data 
userRouter.get('/premium/:symbol', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    const symbol:string = req.params.symbol
    PremiumDataManager.getPremiumDataForUserAndStock(symbol, userid).then(result => {
        res.status(200).send(result)
    }).catch(err => err)
})

userRouter.get('/get-selected-score', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    let userDao = UserDao.getUserDaoInstance()
    userDao.getField(userDao.userCollection, userid, userDao.selectedScoreField).then(result =>{
        res.send({ "selectedScore": result })
    })
})

userRouter.get('/set-selected-score/:selectedScore', async (req: Request, res: Response) => {
    const scoreId = req.params.selectedScore
    const userid = res.locals.userid
    let userDao = UserDao.getUserDaoInstance()
    userDao.setField(userDao.userCollection, userid, userDao.selectedScoreField, scoreId)
    res.send(true)
})

//endpoint called by UI for the main analysts page
userRouter.get('/tipranks/symbols', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    let subscribed = await PremiumDataManager.getTopAnalystsSubscription(userid)
    if (!subscribed){
        res.send(null)
        return
    }
    MarketDataManager.getTipranksSymbols(parseInt(req.query.numAnalystThreshold as string)).then(data => {
        res.send(data)
    }).catch()
})

userRouter.get('/stocktwits-for-symbol/:symbol', async (req: Request, res: Response) => {
    const symbol:string = req.params.symbol
    StockDataManager.getStocktwitsPostsForSymbol(symbol).then(data => {
        res.send(data)
    }).catch()
})

userRouter.post('/set-score-settings', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    const settings = req.body.settings
    UserManager.setUserScoreSettings(userid, settings).then(result => {
        res.send(result)
    }).catch()
})

userRouter.get('/scores-settings-applied', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    StockDataManager.applyUserScoreSettings(userid).then(result => {
        res.send(result)
    }).catch()
})

userRouter.get('/scores-settings-applied-for-symbol/:symbol', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    const symbol:string = req.params.symbol
    StockDataManager.applyUserScoreSettingsForSymbol(userid, symbol).then(result => {
        res.send(result)
    }).catch()
})

userRouter.get('/scores-settings-applied-for-symbols', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    const symbols = req.query.symbols as string
    const symbolsArray = symbols.split(',');
    StockDataManager.applyUserScoreSettings(userid, symbolsArray).then(result => {
        res.send(result)
    }).catch()
})

userRouter.get('/variables-and-score-settings', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    const variableNames = AnalysisService.variableNamesMap
    const future = AnalysisService.futureMetrics
    const past = AnalysisService.pastMetrics
    const health = AnalysisService.healthMetrics
    const valuation = AnalysisService.valuationMetrics
    UserManager.getUserScoreSettings(userid).then(result => {
        res.send({
            scoreSettings: result,
            variableNames: variableNames,
            future: future,
            past: past,
            health: health,
            valuation: valuation
        })
    }).catch()
})

userRouter.get('/subscribe-top-analysts', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    PremiumDataManager.spendCreditsForTopAnalysts(userid, PremiumDataManager.TOP_ANALYSTS_DOC_ID, PremiumDataManager.TOP_ANALYSTS_PACKAGE_ID).then(results => { 
      res.send(results)
    })
})

//check for whether user has sub
userRouter.get('/top-analysts-subscription', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    PremiumDataManager.getTopAnalystsSubscription(userid).then(results => { 
      res.send({date: results})
    })
})

userRouter.get('/get-issues', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    UserDao.getUserDaoInstance().getIssueSnapshots(userid).then(results => {
      let issues = results.map(r => r.data())  
      res.send(issues)
    })
})

userRouter.get('/get-email-from-latest-issue', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    UserDao.getUserDaoInstance().getIssueSnapshots(userid).then(results => {
        if (results.length) {
            let lastResult = results[results.length - 1]
            let email = lastResult.get("email")
            res.send({email: email})
        } else {
            res.send(null)
        }
    })
})

userRouter.post('/add-issue', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    const issue = req.body.issue
    const email = req.body.email
    UserDao.getUserDaoInstance().addIssue(userid, issue, email).then(result => {
      res.send(result)
    })
})

userRouter.get('/add-twitter-account/:at', async (req: Request, res: Response) => {
    const at:string = req.params.at
    const userid = res.locals.userid
    TwitterApiService.addTwitterAccount(userid, at).then(data => {
        res.send(data)
    })
})

userRouter.get('/remove-twitter-account/:at', async (req: Request, res: Response) => {
    const at:string = req.params.at
    const userid = res.locals.userid
    TwitterApiService.removeTwitterAccount(userid, at).then(data => {
        res.send(data)
    })
})

userRouter.get('/get-twitter-accounts', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    TwitterApiService.getAllTwitterAccountsForUser(userid).then(data => {
        res.send(data)
    })
})

userRouter.get('/get-tweets-for-twitter-account-and-symbol/:username/:symbol', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    const username:string = req.params.username
    const symbol:string = req.params.symbol
    TwitterApiService.getTweetsForTwitterAccountAndSymbol(userid, username, symbol).then(data => {
        res.send(data)
    })
})

userRouter.get('/get-twitter-account/:at', async (req: Request, res: Response) => {
    const at:string = req.params.at
    const userid = res.locals.userid
    TwitterApiService.searchForTwitterAccount(userid, at).then(result => {
        res.send(result)
    })
})

userRouter.get('/create-link-token', async (req: Request, res: Response) => {
    const userid = res.locals.userid
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
    }
    let plaidService = PlaidService.getPlaidService()
    let x = await plaidService.createLinkToken(request)
    res.send({"linkToken": x.link_token})
});

userRouter.get('/get-linked-account-and-holdings', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    let ud = UserDao.getUserDaoInstance()
    let account = await ud.getLinkedAccount(userid)
    let holdings = await ud.getLinkedHoldings(userid)
    res.send({
        account: account,
        holdings: holdings
    })
})
userRouter.get('/get-linked-account-balance-history', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    let ud = UserDao.getUserDaoInstance()
    let balanceHistory = await ud.getLinkedAccountBalanceHistory(userid)
    res.send({balanceHistory:balanceHistory})
})

userRouter.post('/set-linked-account', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    const publicToken = req.body.publicToken
    const account = req.body.account
    let plaidService = PlaidService.getPlaidService()
    let accessTokenObj:any = await plaidService.exchangePublicForAccess(publicToken)
    account.accessToken = accessTokenObj
    let accountAndholdings:any = await plaidService.setLinkedAccount(userid, accessTokenObj.accessToken, account)
    await UserDao.getUserDaoInstance().saveLinkedAccount(userid, accountAndholdings.account)
    await UserDao.getUserDaoInstance().saveLinkedHoldings(userid, accountAndholdings.holdings)
    res.send()
});

userRouter.get('/unlink-account', async (req: Request, res: Response) => {
    const userid = res.locals.userid
    let linkedAccount: any = await UserDao.getUserDaoInstance().getLinkedAccount(userid)
    if (linkedAccount) {
        const request: any = {
            access_token: linkedAccount.accessToken.accessToken,
        }
        const response = await PlaidService.getPlaidService().removeAccount(request);
        UserDao.getUserDaoInstance().deleteAccountAndHoldings(userid)
        res.send(response)
    } else {
        res.send(null)
    }
})

export default userRouter