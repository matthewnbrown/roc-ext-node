'use strict';
import 'global-agent/bootstrap.js';
import puppeteer from 'puppeteer';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs'


const useragent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:106.0) Gecko/20100101 Firefox/106.0'
const clicks = 150
const ip_url = 'https://ipv4.icanhazip.com'
const proxy = 'geo.iproyal.com:12321'
const proxyhost = 'geo.iproyal.com';
const proxyport = 12321;
const user_urls = [
    "https://roc.com/recruit.php?uniqid=3mzh", // Kab
    //"https://roc.com/recruit.php?uniqid=715e" // cardboard
    //"https://rox.com/recruit.php?uniqid=vdf8" // Viking
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
        const r = https.request(url, options, (response) => {
            let data = []
            response.on('data', (d) => {
                data.push(d)
            })
            response.on('end', () => {
                response.body = data.join('')
                resolve(response)
            });
        }).on('error',(e) => console.error((e)));
        r.write(postdata)
        r.end();
    });
    return p;
}

async function create_page(browser) {
    let page = await browser.newPage();
    await page.setRequestInterception(true);
 
    page.on('request', async (req) => {
        let url = req.url()
        if(req.method() != "GET") {
            const options = {
                method: req.method(),
                headers: req.headers(),
                //usingProxy: true,
            };
            //options.headers[':path']= '/recruit.php',
            //options.headers['fetch']= 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            //options.headers['sec-fetch-site']= 'same-origin',
            //options.headers['sec-fetch-moded']= 'navigate'
            //options.headers['sec-fetch-dest']= 'document'
            //options.headers['accept-encoding']= 'gzip, deflate'
            //options.headers['accept-languate']= 'en-US,en;q=0.9'
            //options.headers['cache-control']= 'max-age=0'
            //options.headers.cookie = (await page.cookies()).map((cookie) => { return `${cookie.name}=${cookie.value}`; }).join('; ');
            console.log(`Detected NON-get ${req}`);

            let response = await post(url, options, req.postData());
            req.respond({
                status: response.statusCode,
                contentType: response.headers['content-type'],
                headers: response.headers,
                body: response.body,
            });
        }
        else if (!url.includes('uniqid222222') && !url.includes(ip_url)) {
            req.continue();
        } else {
            if(url.indexOf('data') == 0){
                req.continue()
            } else {
            //url = url.replace('https', 'http')
            const options = {
                headers: req.headers(),
                body: req.postData(),
                //usingProxy: true,
            };
            let response = await get(url, options);
            if(response.body.length > 1) {
                console.log(`Got ${url}`)
            } else {
                console.log(`No body ${url}`)
            }
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
               //`--proxy-server=${proxy}`
              ]
    });

    let page = await create_page(browser)
    start_proxy()

    //while(true) {
    //    await page.goto(ip_url)
    //    await new Promise(r => setTimeout(r, 1000 ))
    //}
    //await page.goto(ip_url)
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
