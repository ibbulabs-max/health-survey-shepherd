const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto("http://localhost:8081/");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "screenshot.png" });
  console.log("Screenshot taken.");

  await browser.close();
})();
