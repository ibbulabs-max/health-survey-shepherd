const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", async (msg) => {
    const values = [];
    for (const arg of msg.args()) {
      try {
        const val = await arg.jsonValue();
        values.push(val);
      } catch (e) {
        values.push(arg.toString());
      }
    }
    console.log("BROWSER_LOG:", msg.type(), values);
  });

  await context.addInitScript(() => {
    localStorage.setItem("QA_ROLE", "admin");
  });

  await page.goto("http://localhost:8080/");
  await page.waitForTimeout(10000); // 10 seconds

  const content = await page.content();
  console.log("HTML_CONTENT:");
  console.log(content);

  await browser.close();
})();
