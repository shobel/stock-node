"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//load environment
//for local execution, launching program using vscode debugger seems to require .env be in the root folder
//but for running in firebase, the .env seems to need to be in functions folder
require('dotenv').config();
const path = require('path');
console.log(process.cwd());
console.log(__dirname);
/* FIREBASE CONFIG */
// If running locally, we need import our credentials
const admin = require("firebase-admin");
const serviceAccount = require('../stockapp-server-4ff79-firebase-adminsdk-xh5fk-8a00290e46.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.DBURL
});
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
//import libraries
const functions = require("firebase-functions");
const express = require("express");
const BaseRouter_1 = require("./routers/BaseRouter");
const ScheduledUpdateService_1 = require("./services/ScheduledUpdateService");
const Utilities_1 = require("./utils/Utilities");
//initialize express server
const app = express();
//add the path to receive request and set json as bodyParser to process the body 
app.use('/api', BaseRouter_1.default);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd() + '/public/html/index.html'));
});
app.get('/terms', (req, res) => {
    res.sendFile(path.join(process.cwd() + '/public/html/terms.html'));
});
app.get('/privacy', (req, res) => {
    res.sendFile(path.join(process.cwd() + '/public/html/privacy.html'));
});
app.get('/contact', (req, res) => {
    res.sendFile(path.join(process.cwd() + '/public/html/contact.html'));
});
//Start local server for development. Apparently firebase function will automatically listen on a port
//So we can get rid of this when we deploy
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
    console.log('Express server started on port: ' + port);
});
exports.webapp = functions.https.onRequest(app);
const scheduledUpdateService = new ScheduledUpdateService_1.default();
if (process.env.CLIENT_SECRET === "") {
    const token = Utilities_1.default.generateAppleClientSecret();
    console.log("new client secret token created: " + token);
}
//# sourceMappingURL=index.js.map