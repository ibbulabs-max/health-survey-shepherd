const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`PAGE LOG ERROR: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', exception => {
    console.log(`PAGE ERROR: ${exception}`);
  });
  
  await page.goto('http://localhost:8080/map', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await browser.close();
})();
