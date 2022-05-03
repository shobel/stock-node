"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApplePublicKey = void 0;
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const APPLE_BASE_URL = 'https://appleid.apple.com';
exports.getApplePublicKey = async (kid) => {
    const client = jwksClient({
        cache: true,
        jwksUri: `${APPLE_BASE_URL}/auth/keys`,
    });
    const key = await new Promise((resolve, reject) => {
        client.getSigningKey(kid, (error, result) => {
            if (error) {
                reject(error);
            }
            resolve(result);
        });
    });
    return key.publicKey || key.rsaPublicKey;
};
exports.default = async (idToken, clientId) => {
    const decoded = jwt.decode(idToken, { complete: true });
    const { kid, alg } = decoded.header;
    const applePublicKey = await exports.getApplePublicKey(kid);
    const jwtClaims = jwt.verify(idToken, applePublicKey, { algorithms: [alg] });
    if (clientId && jwtClaims.aud !== clientId) {
        throw new Error(`The aud parameter does not include this client - is: ${jwtClaims.aud} | expected: ${clientId}`);
    }
    return jwtClaims;
};
//# sourceMappingURL=VerifyAppleToken.js.map