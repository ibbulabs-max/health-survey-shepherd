import { test, expect } from "@playwright/test";

test("Import followup test data and verify UI", async ({ page }) => {
  test.setTimeout(60000);

  // 1. Navigate to import
  await page.goto("http://localhost:8080/import");

  // Wait for login or ensure we are logged in - assuming the dev server skips auth or auth is cached?
  // Let's assume auth is needed. We might need to handle login if we are redirected.
  if (page.url().includes("/auth")) {
    await page.fill("input[type='email']", "demo@example.com"); // We will see if it redirects
    await page.fill("input[type='password']", "password");
    await page.click("button[type='submit']");
    await page.waitForURL("**/import");
  }

  // 2. Upload file
  const fileInput = await page.$("input[type='file']");
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
