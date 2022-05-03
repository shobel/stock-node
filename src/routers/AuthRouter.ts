import { Request, Response, Router } from 'express';
import AuthenticationService from '../services/AuthenticationService';
const baseRouter = require('./BaseRouter');

const authRouter = Router();

//when client app user signs into their apple account, they get a 10 minute apple token
//this method exchanges their apple token for a 1 hour idToken and infinite refreshToken
authRouter.post('/signinwithappletoken', async (req: Request, res: Response) => {
    const tokenResponse = await AuthenticationService.signInWithAppleToken(req.body.token)
    if (!tokenResponse){
        res.status(400).send(tokenResponse)
    } else {
        res.status(200).send(tokenResponse)
    }
})

//when client app user recieves a 400 or 401 response from this server, it means their idToken is invalid
//they can try to use this endpoint to use their refresh token to get a new idToken and refresh token
authRouter.post('/getnewidtokenwithrefreshtoken', async (req: Request, res: Response) => {
    const tokenResponse = await AuthenticationService.getNewIdTokenWithRefreshToken(req.body.refreshToken)
    if (!tokenResponse){
        res.status(400).send(tokenResponse)
    } else {
        res.status(200).send(tokenResponse)
    }
})

authRouter.post('/signout', async (req: Request, res: Response) => {
    baseRouter.verifyToken(req, res).then(userid => {
        AuthenticationService.signOut(userid).then(response => {
            res.status(200).send({message: "You have been successfully signed out"})
        }).catch(err => {
            res.status(500).send({message: "Error signing out"})
        })  
    })
})

export default authRouter
