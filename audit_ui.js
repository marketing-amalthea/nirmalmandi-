const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'ui_audit');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  const shots = [
    { name: '01_marketplace_home', url: 'http://localhost:3010/' },
    { name: '02_listings_page', url: 'http://localhost:3010/listings' },
    { name: '03_login_page', url: 'http://localhost:3010/login' },
    { name: '04_seller_register', url: 'http://localhost:3010/seller-register' },
    { name: '05_seller_dashboard', url: 'http://localhost:3010/seller/dashboard' },
    { name: '06_seller_listings', url: 'http://localhost:3010/seller/listings' },
    { name: '07_seller_analytics', url: 'http://localhost:3010/seller/analytics' },
    { name: '08_orders_page', url: 'http://localhost:3010/orders' },
    { name: '09_referral_page', url: 'http://localhost:3010/referral' },
    // Admin
    { name: '10_admin_home', url: 'http://localhost:3000/' },
    { name: '11_admin_analytics', url: 'http://localhost:3000/analytics' },
    { name: '12_admin_settings', url: 'http://localhost:3000/settings' },
  ];

  const errors = {};
  p.on('console', msg => {
    if (msg.type() === 'error') {
      const url = p.url();
      if (!errors[url]) errors[url] = [];
      errors[url].push(msg.text());
    }
  });

  for (const shot of shots) {
    try {
      await p.goto(shot.url, { waitUntil: 'networkidle', timeout: 15000 });
      await p.waitForTimeout(1500);
      await p.screenshot({ path: path.join(OUT, `${shot.name}.png`), fullPage: true });
      console.log(`✅ ${shot.name}`);
    } catch (e) {
      console.log(`❌ ${shot.name}: ${e.message.slice(0, 80)}`);
    }
  }

  console.log('\n--- Console Errors ---');
  for (const [url, errs] of Object.entries(errors)) {
    console.log(`\n${url}:`);
    errs.slice(0, 5).forEach(e => console.log('  ', e));
  }

  await browser.close();
})();
