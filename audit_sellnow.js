const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  // Click "Sell Now" from home page
  await p.goto('http://localhost:3010/', { waitUntil: 'networkidle', timeout: 15000 });
  await p.waitForTimeout(1000);
  await p.click('text=Sell Now');
  await p.waitForTimeout(2000);
  const url = p.url();
  console.log('After Sell Now click → URL:', url);
  await p.screenshot({ path: path.join(__dirname, 'ui_audit', 'sell_now_result.png'), fullPage: false });
  console.log(url.includes('seller-register') ? '✅ Correct route' : '❌ Wrong route: ' + url);

  await browser.close();
})();
