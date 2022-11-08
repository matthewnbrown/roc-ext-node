'use strict';

const puppeteer = require('puppeteer');
const https = require('node:https');
const fs = require('fs');

const useragent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:106.0) Gecko/20100101 Firefox/106.0'
const clicks = 150
const proxy = 'geo.iproyal.com:12321'
const user_urls = [
    //"https://roc.com/recruit.php?uniqid=3mzh", // Kab
    "https://roc.com/recruit.php?uniqid=715e" // cardboard
    //"https://rox.com/recruit.php?uniqid=vdf8" // Viking
];

async function load_local(page, filepath) {
    return page.addScriptTag({
        path: `${filepath}`
    })
}
async function run_js(page, file_path) {
    const file_content = fs.existsSync(file_path) ? fs.readFileSync(file_path, 'utf8') : '';

    return page.evaluate(file_content => {
        console.log(file_content);
    }, file_content);
}
function download_file(url, options) {
    let p = new Promise((resolve) => { 
        https.get(url, options, function (response) {
            let data = []
            response.on('data', (d) => {
                data.push(d)
             })
             response.on('end', () => {
                response.body = data.join('');
                resolve(response);
             })
        }).on('error', (e) => {
            console.error(e);
          });;
    });
    return p
}

async function create_page(browser) {
    let page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
        let url = req.url()

        if(req.method() != "GET") {
            console.log(`Detected method ${req.method()}`)
            req.continue()
        }
        else if (url.includes('uniqid')) {
            req.continue();
        } else {
            if(url.indexOf('data') == 0){
                req.continue()
            } else {
            const options = {
                uri: url,
                method: req.method(),
                headers: req.headers(),
                body: req.postData(),
                //usingProxy: true,
            };
            let response = await download_file(url, options)
            req.respond({
                status: response.statusCode,
                contentType: response.headers['content-type'],
                headers: response.headers,
                body: response.body,
            });
        }
        }
    });

    return page;
}
async function external_click() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--disk-cache-dir=/puppet_cache',
               '--allow-file-access-from-files',
               '--enable-local-file-accesses',
               `--proxy-server=${proxy}`
              ]
    });

    let page = await create_page(browser)
    await click_all(page);

    console.log('DOne');
    await browser.close();
}

async function click_all(page) {
    for (let i = 0; i < clicks; i++) {
        console.log(`Loop ${i}`)
        for (let i = 0; i < user_urls.length; i++) {
            await click_user(page, user_urls[i]).then((res) => console.log(res), (res) => console.log(res));
        }
    }
}

async function wait_page_load(page) {
    for(let i = 0; i < 15; i++) {
        let recmsg = null
        try {
        let recmsg = await page.$('#recruitmsg')
            console.log(recmsg)
        if(recmsg != null){
            return;
        }
        } catch (rewriteError) {
            
        }
        // Thirsty has searched far and wide for recruits, reaching at least 100 people today
        
        await new Promise(r => setTimeout(r, 700));
    }
}
async function click_user(page, url) {
    await page.goto(url);

    let recform = await page.$('#recruit_form');

    if (recform === null) {
        await new Promise(r => setTimeout(r, 1000));
        return 'Error: Could not find recruit form.';
    }

    let butty = await recform.$('.button');
    //await page.click('#recruit_form .button', {waitUntil: 'domcontentloaded'});
    await butty.click()

    await wait_page_load(page)

    try {
        let recmsg = await page.$('#recruitmsg')
    return 'Success'
    } catch (rewriteError) {
        return 'FFailure'
    }
}

external_click();
