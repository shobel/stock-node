"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config/config");
const fetch = require('node-fetch');
class AppleService {
    constructor() {
        this.verifyReceiptSandboxUrl = "https://sandbox.itunes.apple.com/verifyReceipt";
        this.verifyReceiptProdUrl = "https://buy.itunes.apple.com/verifyReceipt";
        this.verifyReceiptUrl = this.verifyReceiptSandboxUrl;
        if (config_1.default.production) {
            this.verifyReceiptUrl = this.verifyReceiptProdUrl;
        }
    }
    verifyReceipt(receipt) {
        return fetch(this.verifyReceiptUrl, {
            method: 'post',
            body: JSON.stringify({
                "receipt-data": receipt,
                password: process.env.APP_STORE_SECRET
            }),
            headers: { 'Content-Type': 'application/json' }
        })
            .then((res) => res.json())
            .then((response) => {
            return response;
        }).catch();
    }
    getTransactionIdFromReceiptForProduct(receipt, productid) {
        var _a, _b, _c;
        if ((_b = (_a = receipt.receipt) === null || _a === void 0 ? void 0 : _a.in_app) === null || _b === void 0 ? void 0 : _b.length) {
            let inappArray = (_c = receipt.receipt) === null || _c === void 0 ? void 0 : _c.in_app;
            for (let t of inappArray) {
                if (t.product_id == productid) {
                    return t.transaction_id;
                }
            }
        }
        return null;
    }
}
exports.default = AppleService;
//# sourceMappingURL=AppleService.js.map