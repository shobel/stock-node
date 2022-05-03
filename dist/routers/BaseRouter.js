"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StocksRouter_1 = require("./StocksRouter");
const UserRouter_1 = require("./UserRouter");
const MarketRouter_1 = require("./MarketRouter");
const AuthRouter_1 = require("./AuthRouter");
const TestRouter_1 = require("./TestRouter");
const express = require("express");
const admin = require("firebase-admin");
const AppRouter_1 = require("./AppRouter");
const rateLimit = require("express-rate-limit");
// Init router and path
const baseRouter = express.Router();
baseRouter.use(express.json());
const limiter = rateLimit({
    windowMs: 1000,
    max: 15 // limit each IP to max requests per windowMs
});
baseRouter.use(limiter);
// Add sub-routes
baseRouter.use('/app', AppRouter_1.default);
baseRouter.use('/stocks', StocksRouter_1.default);
baseRouter.use('/user', UserRouter_1.default);
baseRouter.use('/market', MarketRouter_1.default);
baseRouter.use('/auth', AuthRouter_1.default);
baseRouter.use('/test', TestRouter_1.default);
const verifyToken = async function (req, res) {
    return new Promise((resolve, reject) => {
        if (!req.headers.authorization) {
            res.status(400).send("No token provided");
            reject();
            return;
        }
        const token = req.headers.authorization;
        return admin.auth().verifyIdToken(token)
            .then(function (decodedToken) {
            resolve(decodedToken.uid);
        }).catch(function (error) {
            res.status(401).send("Invalid token");
            reject();
            return;
        });
    });
};
module.exports.verifyToken = verifyToken;
exports.default = baseRouter;
//# sourceMappingURL=BaseRouter.js.map