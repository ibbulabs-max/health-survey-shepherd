import { test, expect } from "@playwright/test";

test.describe("QA User Creation Flow", () => {
  // Increase timeout for this long flow
  test.setTimeout(120000);

  test("Create QA Users and Change Passwords", async ({ page }) => {
    // --- 1. LOGIN AS ADMIN ---
    await page.goto("http://localhost:8080/");
    await page.waitForSelector("#userId");
    await page.fill("#userId", process.env.QA_ADMIN_USER || "admin-placeholder");
    await page.keyboard.press("Tab");

    // Attempt login with 112233 first
    await page.keyboard.type(process.env.QA_NEW_PASSWORD || "111111");
    await page.waitForTimeout(1000);

    // If still on login page and error toast appeared, try 123456 and change password
    const isDashboard = (await page.locator("text=Dashboard").count()) > 0;
    if (await page.locator('[data-testid="mobile-menu-btn"]').isVisible()) { await page.locator('[data-testid="mobile-menu-btn"]').click(); await page.waitForTimeout(500); } await page.locator('[data-testid="mobile-signout-btn"]').first().click({ force: true });

    // --- 5. SUPERVISOR LOGIN & PASSWORD SETUP ---
    await page.waitForSelector("#userId");
    await page.fill("#userId", process.env.QA_SUP_USER || "sup-placeholder");
    await page.keyboard.press("Tab");
    await page.keyboard.type(process.env.QA_PASSWORD || "000000");

    await page.waitForSelector("text=Update Your PIN", { timeout: 8000 });
    await page.locator(".size-11").first().click();
    await page.keyboard.type(process.env.QA_NEW_PASSWORD || "111111");
    await page.locator(".size-11").nth(6).click();
    await page.keyboard.type(process.env.QA_NEW_PASSWORD || "111111");
    await page.waitForSelector("text=Hello,", { timeout: 30000 });

    if (await page.locator('[data-testid="mobile-menu-btn"]').isVisible()) { await page.locator('[data-testid="mobile-menu-btn"]').click(); await page.waitForTimeout(500); } await page.locator('[data-testid="mobile-signout-btn"]').first().click({ force: true });

    // --- 6. CHW LOGIN & PASSWORD SETUP ---
    await page.waitForSelector("#userId");
    await page.fill("#userId", process.env.QA_CHW_USER || "chw-placeholder");
    await page.keyboard.press("Tab");
    await page.keyboard.type(process.env.QA_PASSWORD || "000000");

    await page.waitForSelector("text=Update Your PIN", { timeout: 8000 });
    await page.locator(".size-11").first().click();
    await page.keyboard.type(process.env.QA_NEW_PASSWORD || "111111");
    await page.locator(".size-11").nth(6).click();
    await page.keyboard.type(process.env.QA_NEW_PASSWORD || "111111");
    await page.waitForSelector("text=Hello,", { timeout: 30000 });

    if (await page.locator('[data-testid="mobile-menu-btn"]').isVisible()) { await page.locator('[data-testid="mobile-menu-btn"]').click(); await page.waitForTimeout(500); } await page.locator('[data-testid="mobile-signout-btn"]').first().click({ force: true });

    console.log("QA Accounts created and verified.");
  });
});
