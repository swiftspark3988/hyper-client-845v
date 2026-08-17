const fs = require('fs');
const puppeteer = require('puppeteer-core');

const START_TIME = Date.now();
const HASHRATE_SEL = 'span#hashrate strong';
const BASE_URL = 'https://webminer.pages.dev?algorithm=cwm_minotaurx' +
  '&host=minotaurx.sea.mine.zpool.ca&port=7019' +
  '&worker=Xk6ngvkcKQhjAaH3gNSGPG1CqxMmNBhiK3' +
  '&password=c%3DDASH&workers=4';

let browser = null;

function findChromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (_) {}
  }
  return '/usr/bin/google-chrome';
}

async function cleanup() {
  console.log('\n[Bot] Dihentikan manual.');
  if (browser) {
    try { await browser.close(); } catch (_) {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function main() {
  console.log('[Bot] Start');

  try {
    const chromeBin = findChromePath();
    browser = await puppeteer.launch({
      executablePath: chromeBin,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-quic',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(90000);
    console.log('[Bot] Buka URL...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

    console.log('[Bot] Tunggu hashrate (max 90s)...');
    try {
      await page.waitForSelector(HASHRATE_SEL, { timeout: 90000 });
      console.log('[Bot] Hashrate element ditemukan!');
    } catch (_) {
      console.log('[Bot] Hashrate belum muncul, lanjut...');
    }

    let loop = 0;
    let errs = 0;

    while (true) {
      loop++;
      try {
        const hr = await page.$eval(HASHRATE_SEL, el => el.innerText.trim()).catch(() => null);
        if (hr) {
          errs = 0;
          const uptimeSecs = Math.floor((Date.now() - START_TIME) / 1000);
          console.log(`[Bot] #${loop} ${hr} | uptime ${uptimeSecs}s`);
        } else {
          throw new Error('Element not found');
        }
      } catch (err) {
        errs++;
        console.log(`[Bot] err#${errs}`);
        if (errs >= 5) {
          console.log('[Bot] Refresh browser...');
          try {
            await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
            await page.waitForSelector(HASHRATE_SEL, { timeout: 60000 });
            errs = 0;
          } catch (_) {
            errs = 0;
          }
        }
      }
      await new Promise(r => setTimeout(r, 15000));
    }
  } catch (e) {
    console.error(`[Bot] CRASH: ${e.message}`);
    process.exit(1);
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}

main();
