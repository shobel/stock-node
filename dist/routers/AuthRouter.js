"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthenticationService_1 = require("../services/AuthenticationService");
const baseRouter = require('./BaseRouter');
const authRouter = express_1.Router();
//when client app user signs into their apple account, they get a 10 minute apple token
//this method exchanges their apple token for a 1 hour idToken and infinite refreshToken
authRouter.post('/signinwithappletoken', async (req, res) => {
    const tokenResponse = await AuthenticationService_1.default.signInWithAppleToken(req.body.token);
    if (!tokenResponse) {
        res.status(400).send(tokenResponse);
    }
    else {
        res.status(200).send(tokenResponse);
    }
});
//when client app user recieves a 400 or 401 response from this server, it means their idToken is invalid
//they can try to use this endpoint to use their refresh token to get a new idToken and refresh token
authRouter.post('/getnewidtokenwithrefreshtoken', async (req, res) => {
    const tokenResponse = await AuthenticationService_1.default.getNewIdTokenWithRefreshToken(req.body.refreshToken);
    if (!tokenResponse) {
        res.status(400).send(tokenResponse);
    }
    else {
        res.status(200).send(tokenResponse);
    }
});
authRouter.post('/signout', async (req, res) => {
    baseRouter.verifyToken(req, res).then(userid => {
        AuthenticationService_1.default.signOut(userid).then(response => {
            res.status(200).send({ message: "You have been successfully signed out" });
        }).catch(err => {
            res.status(500).send({ message: "Error signing out" });
        });
    });
});
exports.default = authRouter;
//# sourceMappingURL=AuthRouter.js.map