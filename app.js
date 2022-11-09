'use strict';
import 'global-agent/bootstrap.js';
import puppeteer from 'puppeteer';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs'

const proxy_get_req = false

const useragent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:106.0) Gecko/20100101 Firefox/106.0'
const clicks = 500
const ip_url = 'https://ipv4.icanhazip.com'
const proxy = 'geo.iproyal.com:12321'
const proxyhost = 'geo.iproyal.com';
const proxyport = 12321;
const user_urls = [
    //"https://roc.com/recruit.php?uniqid=3mzh", // Kab
    //"https://r.com/recruit.php?uniqid=715e", // cardboard
    //"https://r.com/recruit.php?uniqid=vdf8" // Viking
];


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


function get(url, options) {

    let p = new Promise((resolve) => 
    { 
        console.log(`Proxy: ${url}`)
        const r = https.request(url,options, function(res) {
            const data = []
            res.on('data', (d) => {
                data.push(d)
            })

            res.on('end', () => {
                res.body = data.join('')
                resolve(res)
            })
        }).on('error',(e) => console.error((e)));
        r.setTimeout(4000, () => {
            r.destroy();
            resp = {body: 'error', error:'timeout'}
            resolve(resp);
        })
        r.end()
    })
    return p;
}
/// todo: TIMEOUT
/// https://stackoverflow.com/questions/6214902/how-to-set-a-timeout-on-a-http-request-in-node
function post(url, options, postdata) {
    let p = new Promise((resolve) => 
    { 
        console.log(`Proxy: ${url}`)
        const r = https.request(url,options, function(res) {
            const data = []
            res.on('data', (d) => {
                data.push(d)
            })

            res.on('end', () => {
                res.body = data.join('')
                resolve(res)
            })
        }).on('error',(e) => console.error((e)));
        r.setTimeout(4000, () => {
            r.destroy();
            resp = {body: 'error', error:'timeout'}
            resolve(resp);
        })
        r.write(postdata)
        r.end();
    });
    return p;
}

async function handle_post(request) {
    const options = {
        method: request.method(),
        headers: request.headers(),
    };

    let response = await post(request.url(), options, request.postData());
    if (response.body == 'error') {
        console.log(`Error getting page: ${response.error}`)
    }
    request.respond({
        status: response.statusCode,
        contentType: response.headers['content-type'],
        headers: response.headers,
        body: response.body,
    });
}

async function handle_get(request) {
    const options = {
        headers: request.headers(),
        body: request.postData(),
    };
    let response = await get(url, options);

    if (response.body == 'error') {
        console.log(`Error getting page: ${response.error}`)
    } else if(response.body.length > 1) {
        console.log(`Got ${url}`)
    } else {
        console.log(`No body ${url}`)
    }
    request.respond({
        status: response.statusCode,
        contentType: response.headers['content-type'],
        headers: response.headers,
        body: response.body,
    });
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
        } catch (rewriteError) {
            
        }
        
        await new Promise(r => setTimeout(r, 500));
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
        const recmsg = await page.$('#recruitmsg')
        const t = await (await recmsg.getProperty('textContent')).jsonValue()

        if (t.includes('100 people today')) {
            return 'done'
        }
    return 'success'
    } catch (rewriteError) {
        return 'FFailure'
    }
}

external_click();
