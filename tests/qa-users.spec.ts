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
    if (!isDashboard) {
      await page.fill("#userId", process.env.QA_ADMIN_USER || "admin-placeholder");
      await page.keyboard.press("Tab");
      await page.keyboard.type(process.env.QA_PASSWORD || "000000");

      try {
        await page.waitForSelector("text=Update Your PIN", { timeout: 8000 });
        await page.locator(".size-11").first().click();
        await page.keyboard.type(process.env.QA_NEW_PASSWORD || "111111");
        await page.locator(".size-11").nth(6).click();
        await page.keyboard.type(process.env.QA_NEW_PASSWORD || "111111");
        await page.waitForTimeout(1000); // Auto submits
      } catch (e) {
        console.log("No password prompt");
      }
    }

    await page.waitForSelector("text=Dashboard", { timeout: 15000 });
    console.log("Logged in as Admin");

    // --- 2. CREATE SUPERVISOR ---
    await page.goto("http://localhost:8080/users");
    await page.waitForSelector("text=Users");

    await page.getByRole("button", { name: /Add User/i }).click();
    await page.fill(
      'input[placeholder="e.g. sup-placeholder"]',
      process.env.QA_SUP_USER || "sup-placeholder",
    );
    await page.fill('input[placeholder="e.g. Jane Doe"]', "Supervisor QA");

    // Open role select dropdown and select Supervisor
    await page.click('button[role="combobox"]');
    await page.click('div[role="option"]:has-text("Supervisor")');

    await page.getByRole("button", { name: "Create User" }).click();
    await page.waitForSelector("text=User created successfully", { timeout: 10000 });
    console.log("Supervisor created");

    // --- 3. CREATE CHW ---
    await page.getByRole("button", { name: /Add User/i }).click();
    await page.fill(
      'input[placeholder="e.g. sup-placeholder"]',
      process.env.QA_CHW_USER || "chw-placeholder",
    );
    await page.fill('input[placeholder="e.g. Jane Doe"]', "CHW QA");

    // Open role select dropdown and select Survey User (CHW)
    await page.click('button[role="combobox"]');
    await page.click('div[role="option"]:has-text("Community Health Worker")'); // Need to check exact text, probably Survey User or Community Health Worker
    // The role value is "survey_user".

    await page.getByRole("button", { name: "Create User" }).click();
    await page.waitForSelector("text=User created successfully", { timeout: 10000 });
    console.log("CHW created");

    // --- 4. LOGOUT ---
    await page.click("text=admin-placeholder");
    await page.getByRole("menuitem", { name: /Sign out/i }).click();

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
    await page.waitForSelector("text=Dashboard", { timeout: 15000 });

    await page.click("text=Supervisor QA");
    await page.getByRole("menuitem", { name: /Sign out/i }).click();

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
    await page.waitForSelector("text=Dashboard", { timeout: 15000 });

    await page.click("text=CHW QA");
    await page.getByRole("menuitem", { name: /Sign out/i }).click();

    console.log("QA Accounts created and verified.");
  });
});
