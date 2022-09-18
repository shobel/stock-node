"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
class BaseDao {
    constructor() {
        this.admin = admin;
        this.db = admin.firestore();
        this.docIdRef = admin.firestore.FieldPath.documentId();
        this.batchLimit = 500;
        // console.log("init basedao")
    }
    deleteAccount(userid) {
        admin.auth().deleteUser(userid)
            .then(() => {
            console.log(`Successfully deleted user ${userid}`);
        }).catch((error) => {
            console.log(`Error deleting user ${userid} `, error);
        });
    }
    getField(collection, doc, field) {
        return this.db.collection(collection).doc(doc).get().then(snap => {
            return snap.get(field);
        });
    }
    setField(collection, doc, field, value) {
        return this.db.collection(collection).doc(doc).set({
            [field]: value
        }, { merge: true });
    }
    deleteFieldFromDoc(doc, field) {
        doc.ref.update({
            [field]: admin.firestore.FieldValue.delete()
        });
    }
    /* Will not create documents if they don't exist */
    /* Updates fields but will fail if the document doesn't exist */
    batchUpdate(batchUpdateItems) {
        return new Promise((resolve, reject) => {
            const batchArray = [];
            batchArray.push(this.db.batch());
            let operationCounter = 0;
            let batchCounter = 0;
            for (const batchUpdateItem of batchUpdateItems) {
                batchArray[batchCounter].update(batchUpdateItem.documentRef, batchUpdateItem.data);
                operationCounter += 1;
                if (operationCounter === (this.batchLimit - 1)) {
                    batchArray.push(this.db.batch());
                    batchCounter += 1;
                    operationCounter = 0;
                }
            }
            let numBatchesWritten = 0;
            batchArray.forEach(async (batch) => {
                await batch.commit().then(result => {
                    numBatchesWritten += 1;
                    if (numBatchesWritten >= batchArray.length) {
                        resolve(true);
                    }
                }).catch(err => {
                    numBatchesWritten += 1;
                    console.error(err);
                });
            });
        });
    }
    /* Will create documents if they don't exist
    /* If merge is true, document fields will be updated */
    /* If merge is false, document will be overwritten by new data */
    batchSet(batchUpdateItems, merge) {
        return new Promise((resolve, reject) => {
            const batchArray = [];
            batchArray.push(this.db.batch());
            let operationCounter = 0;
            let batchCounter = 0;
            for (const batchUpdateItem of batchUpdateItems) {
                batchArray[batchCounter].set(batchUpdateItem.documentRef, batchUpdateItem.data, { merge: merge });
                operationCounter += 1;
                if (operationCounter === (this.batchLimit - 1)) {
                    batchArray.push(this.db.batch());
                    batchCounter += 1;
                    operationCounter = 0;
                }
            }
            let numBatchesWritten = 0;
            batchArray.forEach(async (batch) => {
                await batch.commit().then(result => {
                    numBatchesWritten += 1;
                    if (numBatchesWritten >= batchArray.length) {
                        resolve(true);
                    }
                });
            });
        });
    }
    deleteAllDocumentsInCollection(collectioName) {
        return this.db.collection(collectioName).get().then(snapshot => {
            const docRefs = [];
            for (const doc of snapshot.docs) {
                docRefs.push(doc.ref);
            }
            if (docRefs.length > 0) {
                return this.batchDelete(docRefs);
            }
            return true;
        });
    }
    batchDelete(docRefs) {
        return new Promise((resolve, reject) => {
            const batchArray = [];
            batchArray.push(this.db.batch());
            let operationCounter = 0;
            let batchCounter = 0;
            for (const docRef of docRefs) {
                batchArray[batchCounter].delete(docRef);
                operationCounter += 1;
                if (operationCounter === (this.batchLimit - 1)) {
                    batchArray.push(this.db.batch());
                    batchCounter += 1;
                    operationCounter = 0;
                }
            }
            let numBatchesDeleted = 0;
            batchArray.forEach(async (batch) => {
                await batch.commit().then(result => {
                    numBatchesDeleted += 1;
                    if (numBatchesDeleted >= batchArray.length) {
                        resolve(true);
                    }
                });
            });
        });
    }
    // data objects look like this: 
    // { aapl: {...}, msft: {...} }
    // the idField is the field in the data object who's value should be used as the document id 
    // OR, if the field doesnt exist, it is the actual value of the id field and doc id
    batchSaveDocInSubcollectionForSymbols(mainCollection, subcollection, idField, data) {
        return new Promise((resolve, reject) => {
            const batchUpdateItems = [];
            const collectionRef = this.db.collection(mainCollection);
            for (const symbol of Object.keys(data)) {
                if (data[symbol]) {
                    const element = data[symbol];
                    const stockRef = collectionRef.doc(symbol.toUpperCase());
                    if (element.hasOwnProperty(idField)) {
                        const docRef = stockRef.collection(subcollection).doc(element[idField].toString());
                        element.id = element[idField];
                        const batchUpdateItem = {
                            documentRef: docRef,
                            data: element
                        };
                        batchUpdateItems.push(batchUpdateItem);
                    }
                    else {
                        const docRef = stockRef.collection(subcollection).doc(idField.toString());
                        element.id = idField;
                        const batchUpdateItem = {
                            documentRef: docRef,
                            data: element
                        };
                        batchUpdateItems.push(batchUpdateItem);
                    }
                }
            }
            this.batchSet(batchUpdateItems, false).then(result => resolve()).catch();
        });
    }
    // data objects look like this: 
    // { aapl: [ {...}, {...} ], msft: [ {...}, {...} ] }
    // the idField is the field in the data object who's value should be used as the document id 
    // OR, if the field doesnt exist, it is the actual value of the id field and doc id
    batchSaveMultipleDocsInSubcollectionForSymbols(mainCollection, subcollection, idField, data) {
        return new Promise((resolve, reject) => {
            const batchUpdateItems = [];
            const collectionRef = this.db.collection(mainCollection);
            for (const symbol of Object.keys(data)) {
                if (data[symbol]) {
                    const stockRef = collectionRef.doc(symbol.toUpperCase());
                    for (const element of data[symbol]) {
                        if (!element) {
                            continue;
                        }
                        if (element.hasOwnProperty(idField)) {
                            const docRef = stockRef.collection(subcollection).doc(element[idField].toString());
                            element.id = element[idField];
                            const batchUpdateItem = {
                                documentRef: docRef,
                                data: element
                            };
                            batchUpdateItems.push(batchUpdateItem);
                        }
                        else {
                            const docRef = stockRef.collection(subcollection).doc(idField.toString());
                            element.id = idField;
                            const batchUpdateItem = {
                                documentRef: docRef,
                                data: element
                            };
                            batchUpdateItems.push(batchUpdateItem);
                        }
                    }
                }
            }
            this.batchSet(batchUpdateItems, false).then(result => resolve()).catch();
        });
    }
    /* data is an array of objects */
    batchSaveMultipleDocsInCollectionWithNumberedDocumentIds(collection, dataArr) {
        return new Promise((resolve, reject) => {
            const batchUpdateItems = [];
            const collectionRef = this.db.collection(collection);
            for (let i = 0; i < dataArr.length; i++) {
                const item = dataArr[i];
                let indexString = i.toString();
                if (i < 10) {
                    indexString = "0" + i;
                }
                const docRef = collectionRef.doc(indexString);
                const batchUpdateItem = {
                    documentRef: docRef,
                    data: item
                };
                batchUpdateItems.push(batchUpdateItem);
            }
            this.batchSet(batchUpdateItems, false).then(result => resolve()).catch();
        });
    }
    batchSaveMultipleDocsInCollectionWithFieldIds(collection, field, dataArr, overwrite) {
        const batchUpdateItems = [];
        const collectionRef = this.db.collection(collection);
        for (const item of dataArr) {
            const docRef = collectionRef.doc(item[field].toString());
            const batchUpdateItem = {
                documentRef: docRef,
                data: item
            };
            batchUpdateItems.push(batchUpdateItem);
        }
        if (batchUpdateItems.length > 0) {
            return this.batchSet(batchUpdateItems, !overwrite);
        }
        else {
            return true;
        }
    }
    // data objects look like this: 
    // { symbol1: { field1: [{},{}], field2: [{},{}] }, symbol2: { field1: [{},{}], field2: [{},{}] } }
    // the idField is the field in the data object that should be used as the document id
    // subcollectionmap is fieldName -> collection name
    batchSaveMultipleDocsInMultipleSubcollectionsForSymbols(mainCollection, subcollectionMap, idField, data) {
        return new Promise((resolve, reject) => {
            const batchUpdateItems = [];
            const collectionRef = this.db.collection(mainCollection);
            for (const symbol of Object.keys(data)) {
                if (data[symbol]) {
                    const stockRef = collectionRef.doc(symbol.toUpperCase());
                    for (const field of Object.keys(subcollectionMap)) {
                        const subcollection = subcollectionMap[field];
                        for (const element of data[symbol][field]) {
                            if (element.hasOwnProperty(idField)) {
                                const docRef = stockRef.collection(subcollection).doc(element[idField].toString());
                                element.id = element[idField];
                                const batchUpdateItem = {
                                    documentRef: docRef,
                                    data: element
                                };
                                batchUpdateItems.push(batchUpdateItem);
                            }
                        }
                    }
                }
            }
            this.batchSet(batchUpdateItems, false).then(result => resolve()).catch();
        });
    }
    batchSaveFieldsInMultipleStockDocs(collection, field, symbolMap, update) {
        const batchUpdateItems = [];
        const collectionRef = this.db.collection(collection);
        for (const symbol of Object.keys(symbolMap)) {
            if (symbolMap[symbol] == null) {
                continue;
            }
            const docRef = collectionRef.doc(symbol.toUpperCase());
            const batchUpdateItem = {
                documentRef: docRef,
                data: {
                    [field]: symbolMap[symbol]
                }
            };
            batchUpdateItems.push(batchUpdateItem);
        }
        if (batchUpdateItems.length > 0) {
            //this will create docs if they dont exist
            //we cant use update (which wont create docs if they dont exist), because the whole commit will fail if a doc doesnt exist
            if (update) {
                return this.batchUpdate(batchUpdateItems);
            }
            else {
                return this.batchSet(batchUpdateItems, true);
            }
        }
        else {
            return true;
        }
    }
    batchSaveMultipleDocsInCollectionRefWithFieldIds(collectionRef, field, dataArr, overwrite) {
        const batchUpdateItems = [];
        for (const item of dataArr) {
            const docRef = collectionRef.doc(item[field].toString());
            const batchUpdateItem = {
                documentRef: docRef,
                data: item
            };
            batchUpdateItems.push(batchUpdateItem);
        }
        if (batchUpdateItems.length > 0) {
            return this.batchSet(batchUpdateItems, !overwrite);
        }
        else {
            return Promise.resolve();
        }
    }
    getAllDocsInCollection(collection) {
        return this.db.collection(collection).get().then(snapshot => {
            return snapshot.docs.map(doc => doc.data());
        });
    }
    getAllDocIdsInCollection(collection) {
        return this.db.collection(collection).get().then(snapshot => {
            return snapshot.docs.map(doc => doc.id);
        });
    }
    getAllDocSnapshotsInCollection(collection) {
        return this.db.collection(collection).get().then(snapshot => {
            return snapshot.docs;
        });
    }
    getDocSnapshotsInCollection(collection, docid) {
        return this.db.collection(collection).doc(docid).get().then(snapshot => {
            return snapshot;
        });
    }
}
exports.default = BaseDao;
//# sourceMappingURL=BaseDao.js.map