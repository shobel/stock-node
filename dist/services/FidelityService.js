"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer = require('puppeteer');
const AnalystsDao_1 = require("../dao/AnalystsDao");
class FidelityService {
    static async scrape() {
        let startTime = Date.now();
        console.log(`starting fidelity webscrape`);
        const browser = await puppeteer.launch({ headless: false });
        const url = `https://www.fidelity.com/`;
        let wait = 0;
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36");
        await page.goto(url);
        wait = this.waitForRandomTimeUpTo(5, 3);
        await page.waitForTimeout(wait);
        await page.waitForSelector('#userId-input').catch(async (err) => {
            await page.waitForSelector('.hp-new-log-in');
            let newLoginButton = await page.$('.hp-new-log-in');
            newLoginButton.click();
        });
        await page.type('#userId-input', "shobel87");
        wait = this.waitForRandomTimeUpTo(2, 1);
        await page.waitForTimeout(wait);
        await page.waitForSelector('#password');
        await page.type('#password', "Cheetaharrows22!");
        wait = this.waitForRandomTimeUpTo(2, 1);
        await page.waitForTimeout(wait);
        await page.waitForSelector('button[type="submit"]');
        await page.$('button[type="submit"]');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        const screenerUrl = 'https://research2.fidelity.com/pi/stock-screener#strategies';
        page.goto(screenerUrl);
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        wait = this.waitForRandomTimeUpTo(6, 3);
        await page.waitForTimeout(wait);
        await page.waitForSelector('[data-field="FI.StarmineScore"]');
        let ele1 = await page.$('[data-field="FI.StarmineScore"]');
        await ele1.click();
        wait = this.waitForRandomTimeUpTo(6, 4);
        await page.waitForTimeout(wait);
        await page.waitForSelector('[data-field="FI.IssueType"]');
        let ele2 = await page.$('[data-field="FI.IssueType"]');
        await ele2.click();
        wait = this.waitForRandomTimeUpTo(6, 4);
        await page.waitForTimeout(wait);
        let ele3 = await page.$x("//span[contains(., 'Common Stock')]");
        await ele3[0].click();
        wait = this.waitForRandomTimeUpTo(3, 2);
        await page.waitForTimeout(wait);
        let ele10 = await page.$x("//span[contains(., 'ESS from StarMine from Refinitiv')]");
        await ele10[0].click();
        let obj = await FidelityService.iteratePages(5, page);
        browser.close();
        let map = {};
        for (let i = 0; i < obj.symbols.length; i++) {
            if (obj.symbols[i].length > 1 && obj.data[i].length > 3) {
                let symbol = obj.symbols[i][1];
                let score = obj.data[i][3];
                if (!score.includes("\n")) {
                    continue;
                }
                let fidelityAnalystObj = {
                    symbol: symbol,
                    score: score.split("\n")[0],
                    dayChange: 0
                };
                map[symbol] = fidelityAnalystObj;
            }
        }
        let oldDocSnapshots = await FidelityService.analystDao.getFidelityAnalystsSnapshots();
        if (oldDocSnapshots) {
            for (let doc of oldDocSnapshots) {
                if (doc) {
                    let oldData = doc.data();
                    let newData = map[oldData.symbol];
                    if (newData) {
                        newData.dayChange = newData.score - oldData.score;
                    }
                }
            }
        }
        FidelityService.analystDao.saveFidelityAnalysts(Object.values(map));
        let endTime = Date.now();
        console.log(`finished fidelty webscrape in ${(endTime - startTime) / 1000.0}s`);
    }
    static async iteratePages(pages, page) {
        let wait = 0;
        let orderedSymbols = [];
        let orderedData = [];
        for (let i = 0; i < pages; i++) {
            if (i > 0) {
                wait = this.waitForRandomTimeUpTo(3, 2);
                await page.waitForTimeout(wait);
                await page.waitForSelector(`[data-actionvalue="${i * 100}"]`);
                let ele = await page.$(`[data-actionvalue="${i * 100}"]`);
                ele.click();
            }
            wait = this.waitForRandomTimeUpTo(6, 4);
            await page.waitForTimeout(wait);
            await page.waitForSelector(".table.results-table.sortableTable.screener-table");
            let data = await page.$$eval('.table.results-table.sortableTable.screener-table tbody tr', rows => {
                return Array.from(rows, (row) => {
                    const columns = row.querySelectorAll('td');
                    return Array.from(columns, (column) => column.innerText);
                });
            });
            wait = this.waitForRandomTimeUpTo(3, 2);
            await page.waitForTimeout(wait);
            await page.waitForSelector(".table.fixed-results-table.screener-table");
            const symbols = await page.$$eval('.table.fixed-results-table.screener-table tbody tr', rows => {
                return Array.from(rows, (row) => {
                    const columns = row.querySelectorAll('td');
                    return Array.from(columns, (column) => column.innerText);
                });
            });
            orderedSymbols = [...orderedSymbols, ...symbols];
            orderedData = [...orderedData, ...data];
        }
        return {
            symbols: orderedSymbols,
            data: orderedData
        };
    }
    static getFidelityAnalystData() {
        return this.analystDao.getFidelityAnalystsData();
    }
    //returns time in ms
    static waitForRandomTimeUpTo(secondsToWait, min) {
        let diff = secondsToWait - min;
        let rand = Math.random() * diff;
        let wait = rand + min;
        return wait * 1000.0;
    }
}
exports.default = FidelityService;
FidelityService.analystDao = AnalystsDao_1.default.getAnalystsDaoInstance();
//# sourceMappingURL=FidelityService.js.map