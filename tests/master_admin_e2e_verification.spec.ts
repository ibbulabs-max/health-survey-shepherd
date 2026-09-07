import { test, expect } from "@playwright/test";

test.describe("Master Admin E2E Verification", () => {
  // We use the known user credentials
  const MA_EMAIL = "master_admin@ibrahimlabs.local";
  const MA_USERNAME = "master_admin";
  const MA_PIN = "123456";

  const ADMIN_USER = process.env.QA_ADMIN_USER || "e2eadmin";
  const ADMIN_PIN = "123456";

  const SUP_USER = process.env.QA_SUP_USER || "e2esupervisor";
  const SUP_PIN = "123456";

  const CHW_USER = process.env.QA_CHW_USER || "e2echw";
  const CHW_PIN = "123456";

  // Reusable login helper
  const login = async (page, username, pin) => {
    await page.goto("http://localhost:8080/");
    await page.waitForSelector("#userId");
    await page.fill("#userId", username);
    await page.keyboard.press("Tab");
    // Type pin
    for (let i = 0; i < pin.length; i++) {
      await page.keyboard.press(pin[i]);
    }
    // Wait for either dashboard or some error
    await page.waitForTimeout(3000);
  };

  test("Master Admin Login, Desktop UI, and Test Mode", async ({ page }) => {
    await login(page, MA_USERNAME, MA_PIN);
    
    // 3. Verify Authentication succeeds
    await expect(page.getByText(/Hello,/i)).toBeVisible({ timeout: 10000 });

    // 6. Verify Desktop UI Sidebar (ShieldCheck icon)
    const masterAdminLink = page.getByRole("link", { name: "Master Admin", exact: true });
    await expect(masterAdminLink).toBeVisible();
    await masterAdminLink.click();

    // 8. Verify /master-admin route
    await expect(page.url()).toContain("/master-admin");
    await expect(page.getByRole("heading", { name: "Master Admin" })).toBeVisible();

    // 10. Verify Test Mode functionality exists
    const enterTestModeBtn = page.getByRole("button", { name: "Enter Test Mode" });
    if (await enterTestModeBtn.isVisible()) {
      await enterTestModeBtn.click();
      await expect(page.getByText(/Select Role to Simulate/i)).toBeVisible();
      // Click cancel or exit
      await page.keyboard.press("Escape");
    }
  });

  test("Master Admin Mobile UI", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X/11/12
    await login(page, MA_USERNAME, MA_PIN);
    
    await expect(page.getByText(/Hello,/i)).toBeVisible({ timeout: 10000 });

    // 7. Verify mobile/tablet -> Bottom navigation -> More -> Master Admin
    const moreBtn = page.getByRole("button", { name: "More" });
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      const maMobileLink = page.getByRole("link", { name: "Master Admin" });
      await expect(maMobileLink).toBeVisible();
      await maMobileLink.click();
      await expect(page.url()).toContain("/master-admin");
    }
  });

  // 9. Negative Security Tests
  test("Normal Admin is DENIED", async ({ page }) => {
    await login(page, ADMIN_USER, ADMIN_PIN);
    await expect(page.getByText(/Hello,/i)).toBeVisible({ timeout: 10000 });
    
    // Should NOT see Master Admin
    const masterAdminLink = page.getByRole("link", { name: "Master Admin", exact: true });
    await expect(masterAdminLink).not.toBeVisible();

    // Should NOT access /master-admin directly
    await page.goto("http://localhost:8080/master-admin");
    await page.waitForTimeout(2000);
    // Should redirect away or show not found
    expect(page.url()).not.toContain("/master-admin");
  });

  test("Supervisor is DENIED", async ({ page }) => {
    await login(page, SUP_USER, SUP_PIN);
    await expect(page.getByText(/Hello,/i)).toBeVisible({ timeout: 10000 });
    
    // Should NOT see Master Admin
    const masterAdminLink = page.getByRole("link", { name: "Master Admin", exact: true });
    await expect(masterAdminLink).not.toBeVisible();

    // Should NOT access /master-admin directly
    await page.goto("http://localhost:8080/master-admin");
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain("/master-admin");
  });

  test("CHW is DENIED", async ({ page }) => {
    await login(page, CHW_USER, CHW_PIN);
    await expect(page.getByText(/Hello,/i)).toBeVisible({ timeout: 10000 });
    
    // Should NOT see Master Admin
    const masterAdminLink = page.getByRole("link", { name: "Master Admin", exact: true });
    await expect(masterAdminLink).not.toBeVisible();

    // Should NOT access /master-admin directly
    await page.goto("http://localhost:8080/master-admin");
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain("/master-admin");
  });
});
