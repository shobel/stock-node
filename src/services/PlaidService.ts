import UserDao from "../dao/UserDao";

const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

export default class PlaidService {

    private client: any
    private static plaidService: PlaidService

    constructor() {
        const configuration = new Configuration({
            basePath: PlaidEnvironments[process.env.PLAID_ENV as string],
            baseOptions: {
                headers: {
                    'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
                    'PLAID-SECRET': process.env.PLAID_SECRET_PROD,
                },
            },
        });
        this.client = new PlaidApi(configuration);
    }

    public static getPlaidService() {
        if (!PlaidService.plaidService) {
            PlaidService.plaidService = new PlaidService()
        }
        return PlaidService.plaidService
    }

    public async createLinkToken(request: any) {
        try {
            const createTokenResponse = await this.client.linkTokenCreate(request);
            return createTokenResponse.data
        } catch (error) {
            console.log(error)
        }
    }

    public async updateHoldingsForAllUsers(){
        let ud = UserDao.getUserDaoInstance()
        let userDocs:any = await ud.getAllDocSnapshotsInCollection(ud.userCollection)
        for (let userDoc of userDocs) {
            let linkedAccount = userDoc.get("linkedAccount")
            if (linkedAccount && linkedAccount.accessToken && linkedAccount.accessToken.accessToken){
                let accountAndholdings:any = await this.setLinkedAccount(userDoc.id, linkedAccount.accessToken.accessToken, linkedAccount)
                await UserDao.getUserDaoInstance().saveLinkedAccount(userDoc.id, accountAndholdings.account)
                await UserDao.getUserDaoInstance().saveLinkedHoldings(userDoc.id, accountAndholdings.holdings)
            }
        }
    }

    public async updateAccountBalancesForAllUsers(){
        let ud = UserDao.getUserDaoInstance()
        let userDocs:any = await ud.getAllDocSnapshotsInCollection(ud.userCollection)
        for (let userDoc of userDocs) {
            let linkedAccount = userDoc.get("linkedAccount")
            if (linkedAccount && linkedAccount.accessToken && linkedAccount.accessToken.accessToken){
                let request = {
                    access_token: linkedAccount.accessToken.accessToken,
                    options: {
                        account_ids: [linkedAccount.accountId]
                    }
                }
                let balances = await this.getAccountBalance(request)
                await ud.addLinkedAccountBalanceToBalancesCollection(userDoc.id, balances.current)
                await ud.updateLinkedAccountBalanceInDoc(userDoc.id, balances)
            }
        }
    }

    public async getAccountBalance(request:any) {
          try {
            const response = await this.client.accountsBalanceGet(request)
            const accounts = response.data.accounts
            if (accounts.length > 0){
                return accounts[0].balances
            }
          } catch (error) {
            console.log(error)
          }
    }

    public async removeAccount(request: any) {
        try {
            await this.client.itemRemove(request);
        } catch (error) {
            console.log(error)
        }
    }

    public async exchangePublicForAccess(publicToken: string) {
        try {
            const response = await this.client.itemPublicTokenExchange({
                public_token: publicToken,
            });
            const accessToken = response.data.access_token;
            const itemId = response.data.item_id;
            return {
                accessToken: accessToken,
                itemId: itemId
            }
        } catch (error) {
            console.log(error)
        }
        return null
    }

    public async setLinkedAccount(userid: string, publicToken: string, account: any) {
        const request: any = {
            access_token: publicToken,
            options: {
                account_ids: [account.accountId]
            }
        }
        try {
            const response = await this.client.investmentsHoldingsGet(request)
            const holdings = response.data.holdings
            const securities = response.data.securities

            if (response.data.accounts.length > 0) {
                account.balances = response.data.accounts[0].balances
            }

            for (let holding of holdings) {
                if (holding.iso_currency_code != "USD") {
                    continue
                }
                let hsecurityId = holding.security_id
                for (let security of securities) {
                    let securityId = security.security_id
                    if (hsecurityId == securityId) {
                        holding.symbol = security.ticker_symbol
                        holding.name = security.name.split("-")[0]
                        holding.close_price = security.close_price
                        holding.close_price_as_of = security.close_price_as_of
                        break
                    }
                }
            }
            return {
                account: account,
                holdings: holdings
            }
        } catch (error) {
            console.log(error)
        }
        return null
    }
}