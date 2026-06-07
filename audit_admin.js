const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  const shots = [
    { name: '10_admin_login', url: 'http://localhost:3000/login' },
    { name: '11_admin_home', url: 'http://localhost:3000/' },
    { name: '12_admin_analytics', url: 'http://localhost:3000/analytics' },
    { name: '13_admin_settings', url: 'http://localhost:3000/settings' },
  ];

  for (const shot of shots) {
    try {
      await p.goto(shot.url, { waitUntil: 'networkidle', timeout: 10000 });
      await p.waitForTimeout(1200);
      await p.screenshot({ path: path.join(__dirname, 'ui_audit', `${shot.name}.png`), fullPage: true });
      console.log(`✅ ${shot.name}`);
    } catch (e) {
      console.log(`❌ ${shot.name}: ${e.message.slice(0,80)}`);
    }
  }
  await browser.close();
})();
