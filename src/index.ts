
//load environment
//for local execution, launching program using vscode debugger seems to require .env be in the root folder
//but for running in firebase, the .env seems to need to be in functions folder
require('dotenv').config()
const path = require('path');

console.log(process.cwd())
console.log(__dirname)


/* FIREBASE CONFIG */
// If running locally, we need import our credentials
import * as admin from 'firebase-admin';
const serviceAccount = require('../stockapp-server-4ff79-firebase-adminsdk-xh5fk-8a00290e46.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.DBURL
});

const db:admin.firestore.Firestore = admin.firestore()
db.settings({ ignoreUndefinedProperties: true })

//import libraries
import * as functions from 'firebase-functions'
import * as express from 'express'
import BaseRouter from './routers/BaseRouter'
import ScheduledUpdateService from './services/ScheduledUpdateService'
import Utilities from './utils/Utilities';

//initialize express server
const app = express();

//add the path to receive request and set json as bodyParser to process the body 
app.use('/api', BaseRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
    //res.send("no no no")
    res.sendFile(path.join(process.cwd()+'/public//index.html'));
});

//Start local server for development. Apparently firebase function will automatically listen on a port
//So we can get rid of this when we deploy
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
    console.log('Express server started on port: ' + port)
});

exports.webapp = functions.https.onRequest(app);

const scheduledUpdateService = new ScheduledUpdateService()

if (process.env.CLIENT_SECRET === "") {
    const token = Utilities.generateAppleClientSecret()
    console.log("new client secret token created: " + token)
}

