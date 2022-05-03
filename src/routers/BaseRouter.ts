import StockRouter from './StocksRouter'
import UserRouter from './UserRouter'
import MarketRouter from './MarketRouter'
import AuthenticationRouter from './AuthRouter'
import TestRouter from './TestRouter'
import * as express from 'express'
import * as admin from 'firebase-admin';
import AppRouter from './AppRouter'
const rateLimit = require("express-rate-limit");

// Init router and path
const baseRouter = express.Router()
baseRouter.use(express.json());

const limiter = rateLimit({
    windowMs: 1000, // 1 second
    max: 15 // limit each IP to max requests per windowMs
});
baseRouter.use(limiter)

// Add sub-routes
baseRouter.use('/app', AppRouter)
baseRouter.use('/stocks', StockRouter)
baseRouter.use('/user', UserRouter)
baseRouter.use('/market', MarketRouter)
baseRouter.use('/auth', AuthenticationRouter)
baseRouter.use('/test', TestRouter)

const verifyToken = async function (req, res) {
    return new Promise((resolve, reject) => {
        if (!req.headers.authorization) {
            res.status(400).send("No token provided")
            reject()
            return
        }
        const token = req.headers.authorization
        return admin.auth().verifyIdToken(token)
            .then(function (decodedToken) {
                resolve(decodedToken.uid)
            }).catch(function (error) {
                res.status(401).send("Invalid token")
                reject()
                return
            })
    })
}

module.exports.verifyToken = verifyToken
export default baseRouter
