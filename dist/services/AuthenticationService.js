"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const VerifyAppleToken_1 = require("../utils/VerifyAppleToken");
const UserManager_1 = require("../managers/UserManager");
const rp = require('request-promise');
class AuthenticationService {
    static async signInWithAppleToken(appleToken) {
        let claims = null;
        try {
            claims = await VerifyAppleToken_1.default(appleToken, process.env.CLIENT_ID);
        }
        catch (err) {
            //just return error to app, cant do anything else
            //maybe this should trigger app to have the user sign in to apple id again
            console.log("invalid token: " + err);
        }
        let user;
        if (claims) {
            try {
                user = await admin.auth().getUserByEmail(claims.email);
            }
            catch (err) {
                console.log("user doesnt exist: " + err);
                //create new user in firebase auth
                user = await admin.auth().createUser({
                    email: claims.email
                });
                //create new user in firestore
                const userDoc = await UserManager_1.default.createNewUser(user.uid, claims.email);
            }
        }
        if (user) {
            const uid = user.uid;
            const customToken = await admin.auth().createCustomToken(uid);
            let tokenResponse = null;
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
            }
            catch (err) {
                return tokenResponse;
            }
            if (tokenResponse) {
                tokenResponse.email = user.email;
            }
            return tokenResponse;
        }
        return null;
    }
    static async getNewIdTokenWithRefreshToken(refreshToken) {
        let tokenResponse = null;
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
        }
        catch (err) {
            return null;
        }
        return {
            accessToken: tokenResponse["access_token"],
            expiresIn: tokenResponse["expires_in"],
            idToken: tokenResponse["id_token"],
            projectId: tokenResponse["project_id"],
            refreshToken: tokenResponse["refresh_token"],
            tokenType: tokenResponse["token_type"],
            userId: tokenResponse["user_id"]
        };
    }
    static async signOut(userid) {
        return admin.auth().revokeRefreshTokens(userid);
    }
}
exports.default = AuthenticationService;
//# sourceMappingURL=AuthenticationService.js.map