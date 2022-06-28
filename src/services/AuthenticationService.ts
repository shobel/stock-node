import * as admin from 'firebase-admin';
import * as auth from "firebase/auth";
import verifyAppleToken from '../utils/VerifyAppleToken';
import UserManager from '../managers/UserManager';
const rp = require('request-promise');

export default class AuthenticationService {

    //1. verify apple token from Sign in with Apple 
    //2. if apple token can be verified, user is retrieved (or created) from firebase Auth by email from apple token 
    //      (what if there is no email in apple token?)
    //3. We have the firebase user now, we ask firebase to create a token
    //4. we verify the firebase token and return the token response or the email from the response
    public static async signInWithAppleToken(appleToken: string) {
        let claims: any = null
        try {
            claims = await verifyAppleToken(appleToken, process.env.CLIENT_ID)
        } catch (err) {
            //just return error to app, cant do anything else
            //maybe this should trigger app to have the user sign in to apple id again
            console.log("invalid token: " + err)
        }

        let user: any
        if (claims) {
            try {
                user = await admin.auth().getUserByEmail(claims.email)
            } catch (err) {
                console.log("user doesnt exist: " + err)
                //create new user in firebase auth
                user = await admin.auth().createUser({
                    email: claims.email
                })
                //create new user in firestore
                const userDoc = await UserManager.createNewUser(user.uid, claims.email)
            }
        }

        if (user) {
            const uid = user.uid
            const customToken = await admin.auth().createCustomToken(uid)
            let tokenResponse:any = null
            try {
                tokenResponse = await rp({
                    url: `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyCustomToken?key=${process.env.FIREBASE_API_KEY}`,
                    method: 'POST',
                    body: {
                        token: customToken,
                        returnSecureToken: true
                    },
                    json: true,
                });
            } catch (err) {
                return tokenResponse
            }
            if (tokenResponse){
                tokenResponse.email = user.email
            }
            return tokenResponse
        }
        return null
    }

    public static async getNewIdTokenWithRefreshToken(refreshToken: string) {
        let tokenResponse:any = null
        try {
            tokenResponse = await rp({
                url: `https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`,
                method: 'POST',
                body: {
                    refresh_token: refreshToken,
                    grant_type: "refresh_token"
                },
                json: true,
            });
        } catch (err) {
            return null
        }
        return {
            accessToken: tokenResponse["access_token"],
            expiresIn: tokenResponse["expires_in"],
            idToken: tokenResponse["id_token"],
            projectId: tokenResponse["project_id"],
            refreshToken: tokenResponse["refresh_token"],
            tokenType: tokenResponse["token_type"],
            userId: tokenResponse["user_id"]
        }
    }

    public static async signOut(userid:string) {
        return admin.auth().revokeRefreshTokens(userid)
    }

    public static async deleteAccount(userid:string){
        return admin.auth().deleteUser(userid)
    }
}