'use strict';
import 'global-agent/bootstrap.js';
import puppeteer from 'puppeteer';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs'

const proxy_get_req = false
const user_urls = [
    "https://rofc.com/recruit.php?uniqid=3mzh", // Kab
    "https://rofc.com/recruit.php?uniqid=715e", // cardboard
    //"https://r.com/recruit.php?uniqid=vdf8" // Viking
];



const useragent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:106.0) Gecko/20100101 Firefox/106.0'
const clicks = 500
const ip_url = 'https://ipv4.icanhazip.com'
const proxy = 'geo.iproyal.com:12321'
const proxyhost = 'geo.iproyal.com';
const proxyport = 12321;

var closeReqTimeout;

function start_proxy(){
    global.GLOBAL_AGENT.HTTP_PROXY = 'http://geo.iproyal.com:12321'
    //global.GLOBAL_AGENT.HTTPS_PROXY = 'https://geo.iproyal.com:12321'
}

function end_proxy(){
    global.GLOBAL_AGENT.HTTPS_PROXY = "127.0.0.1:443"
}
  
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

function make_request(request, options) {
    let p = new Promise((resolve) => 
    { 
        const url = request.url()
        options['timeout'] = 2000
        console.log(`Proxy: ${url}`)
        const r = https.request(url,options, function(res) {
            const data = []
            res.on('data', (d) => {
                clearTimeout(closeReqTimeout)
                closeReqTimeout = setTimeout(() => {
                    r.destroy();
                    let resp = {body: 'error', error:'socket open too long'}
                    resolve(resp);
                }, 5000)
                data.push(d)
            })

            res.on('end', () => {
                clearTimeout(closeReqTimeout)
                res.body = data.join('')
                resolve(res)
            })
        }).on('error',(e) => {
            clearTimeout(closeReqTimeout)
            let resp = {body: 'error', error:'e'};
            resolve(resp);
        }).on('timeout', () => {
            clearTimeout(closeReqTimeout)
            r.destroy();
            let resp = {body: 'error', error:'inner request timeout'}
            resolve(resp);
        });
        r.setTimeout(2000, () => {
            clearTimeout(closeReqTimeout)
            r.destroy();
            let resp = {body: 'error', error:'request timeout'}
            resolve(resp);
        })
        if (options.method == 'POST'){  
            r.write(request.postData())
        }
        r.end();
        closeReqTimeout = setTimeout(() => {
            r.destroy();
            let resp = {body: 'error', error:'socket open too long'}
            resolve(resp);
        }, 5000)
    });
    return p;
}

async function handle_post(request) {
    const options = {
        method: request.method(),
        headers: request.headers(),
    };

    let response = await make_request(request, options, );
    if (response.body == 'error') {
        console.log(`Error getting page: ${response.error}`)
    }

    if(response.body == 'error') {
        console.log(`Error: ${response.error}`)
        request.abort()
    } else {
        request.respond({
            status: response.statusCode,
            contentType: response.headers['content-type'],
            headers: response.headers,
            body: response.body,
        });
    }
}

async function handle_get(request) {
    const options = {
        method: request.method(),
        headers: request.headers(),
        body: request.postData(),
    };
    let response = await make_request(request, options);

    if (response.body == 'error') {
        console.log(`Error getting page: ${response.error}`)
    }

    if(response.body == 'error') {
        console.log(`Error: ${response.error}`)
        request.abort()
    } else {
        request.respond({
            status: response.statusCode,
            contentType: response.headers['content-type'],
            headers: response.headers,
            body: response.body,
        });
    }
}

async function create_page(browser) {
    let page = await browser.newPage();
    await page.setRequestInterception(true);
 
    page.on('request', async (req) => {
        let url = req.url()

        if(req.method() == "POST") {
            await handle_post(req);
        }
        else if(proxy_get_req && url.includes('uniqid') || url.includes(ip_url)) {
            await handle_get(req)
        } else {
            req.continue()
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
              ]
    });

    let page = await create_page(browser)

    start_proxy()
    await click_all(page);
    end_proxy()

    console.log('Done');
    await browser.close();
}

async function click_all(page) {
    const doneusers = new Set();

    while (doneusers.size != user_urls.length) {
        for (let i = 0; i < user_urls.length; i++) {
            if(!doneusers.has(user_urls[i])) {
                let res = await click_user(page, user_urls[i]);

                if(res == 'done') {
                    doneusers.add(user_urls[i]);
                    console.log(`Done user ${user_urls[i]}`)
                } else {
                    console.log(res)
                }
            }
        }
    }
}

async function wait_page_load(page) {
    for(let i = 0; i < 15; i++) {
        let recmsg = null
        try {
            recmsg = await page.$('#recruitmsg')
            if(recmsg != null){
                return;
            }
        } catch (rewriteError) {}

        let errmsg = null
        try {
            errmsg = await page.$('#main-message')
            if(errmsg != null){
                return;
            }
        } catch (rewriteError) {}

        await new Promise(r => setTimeout(r, 500));
    }
}

async function click_user(page, url) {
    try {
        await page.goto(url);
    } catch (rewriteError) {
        return 'Page didn\'t load'
    }

    try {
        const recmsg = await page.$('#recruitmsg')
        const t = await (await recmsg.getProperty('textContent')).jsonValue()

        if (t.includes('100 people today')) {
            return 'done'
        }
    } catch (rewriteError) { }

    let recform = await page.$('#recruit_form');

    if (recform === null) {
        // BUG WHEN FINISHED. GETS STUCK HERE
        await new Promise(r => setTimeout(r, 1000));
        return 'Error: Could not find recruit form.';
    }

    let butty = await recform.$('.button');
    //await page.click('#recruit_form .button', {waitUntil: 'domcontentloaded'});
    await butty.click()

    await wait_page_load(page)

    try {
        const recmsg = await page.$('#recruitmsg')
        const t = await (await recmsg.getProperty('textContent')).jsonValue()

        if (t.includes('100 people today')) {
            return 'done'
        }
    return 'success'
    } catch (rewriteError) {
        return 'Failure'
    }
}

external_click();
