import { test, expect } from "@playwright/test";

test("Import followup test data and verify UI", async ({ page }) => {
  test.setTimeout(60000);

  await page.goto("http://localhost:8080/");

  if (page.url() === 'http://localhost:8080/') {
    await page.fill("#userId", process.env.QA_ADMIN_USER || "admin-placeholder");
    await page.locator('input[inputmode="numeric"]').fill(process.env.QA_PASSWORD || "000000");
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  }

  await page.goto("http://localhost:8080/import");

  // 2. Upload file
  const fileInput = await page.waitForSelector("input[type='file']", { state: "attached", timeout: 15000 });
  if (!fileInput) throw new Error("No file input found");

  await fileInput.setInputFiles("test_followup_import.csv");

  // 3. Follow wizard
  await page.click("text='Upload & Preview'");

  // Map columns if needed? The headers match the expected headers so it might auto-map.
  // Wait for mapping to finish
  await page.waitForTimeout(2000);
  await page.click("text='Looks Good, Import Data'");

  // Wait for import complete
  await page.waitForSelector("text='Import Complete'", { timeout: 15000 });

  console.log("Import finished!");
});
