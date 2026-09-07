import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  
  // Desktop
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'desktop.png', fullPage: true });
  
  // Mobile
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobilePage.goto('http://localhost:8080');
  await mobilePage.waitForTimeout(4000);
  try {
    // Attempt to dismiss install prompt
    await mobilePage.click('text=Continue to Web Version', { timeout: 2000 });
    await mobilePage.waitForTimeout(1000);
  } catch (e) {}
  await mobilePage.screenshot({ path: 'mobile.png', fullPage: true });
  
  await browser.close();
})();
