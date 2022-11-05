'use strict';

const puppeteer = require('puppeteer');

const user_urls = [
    "https://roc.com/recruit.php?uniqid=3mzh", // Kab
    //"https://roc.com/recruit.php?uniqid=715e" // cardboard
];

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    //args: [ '--proxy-server=127.0.0.1:9876' ]
});

  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (req) => {
        if(req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image'){
            req.abort();
    }
    else {
        req.continue();
    }
  });
  await page.goto(user_urls[0]);

  await new Promise(r => setTimeout(r, 2000));

  await browser.close();
})();