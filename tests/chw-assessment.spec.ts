import { test, expect } from "@playwright/test";

test.describe("CHW Assessment Flow", () => {
  const CHW_EMAIL = "e2echw@ibbulabs.app"; // assuming this exists or I will create it. Let's use the admin to create it if needed, or just test with admin who has survey_user role? No, admin doesn't have it.
  const CHW_PIN = "123456";

  test("Complete Assessment Flow", async ({ page }) => {
    // 1. Login
    await page.goto("/");
    
    // We will login as e2eadmin for now since admin can probably navigate if we force it? 
    // Actually, let's login as admin, then go to Users, create a CHW, and logout/login as CHW.
    
    await expect(page.getByRole("heading", { name: /Management App/i })).toBeVisible();
    await page.getByPlaceholder("e.g. admin").fill("e2eadmin");
    await page.locator('input[inputmode="numeric"]').fill("123456");
    await expect(page.getByText(/Hello, E2E/i)).toBeVisible({ timeout: 10000 });

    // Create a CHW user
    await page.getByRole("link", { name: "Users", exact: true }).first().click();
    await page.getByRole("button", { name: "New User" }).click();
    
    const testUserId = `testchw_${Date.now()}`;
    await page.getByLabel("User ID / Phone").fill(testUserId);
    await page.getByLabel("Full Name").fill("Test CHW");
    await page.getByLabel("6-Digit PIN").fill("123456");
    await page.getByRole("radio", { name: "Community Health Worker" }).click();
    await page.getByRole("button", { name: "Create User" }).click();
    
    await expect(page.getByText("User created successfully")).toBeVisible();

    // Logout
    await page.getByRole("link", { name: "More" }).click();
    await page.getByRole("button", { name: "Log out" }).click();

    // Login as CHW
    await page.getByPlaceholder("e.g. admin").fill(testUserId);
    await page.locator('input[inputmode="numeric"]').fill("123456");
    
    // CHW Dashboard
    await expect(page.getByText("Hello, Test CHW")).toBeVisible({ timeout: 10000 });
    
    // 3. More -> Assessment
    await page.getByRole("link", { name: "More" }).click();
    await page.getByRole("link", { name: "Assessments" }).click();
    
    // 4. Add Assessment -> goes to /survey/new
    await page.getByRole("button", { name: /New Assessment/i }).click();

    // Step 1: House ID
    await expect(page.getByText("House ID")).toBeVisible();
    await page.getByLabel("Block").fill("T1");
    await page.getByLabel("Serial No").fill("999");
    
    // Verify Next is visible and not covered (Playwright clicks will fail if it's covered by AppShell)
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2: Location
    await expect(page.getByText("Location & Pin")).toBeVisible();
    await page.getByRole("button", { name: "Use Current Location (GPS)" }).click();
    await page.waitForTimeout(2000); // wait for GPS
    await page.getByRole("button", { name: "Next" }).click();

    // Step 3: Availability
    await expect(page.getByText("Availability")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    // Step 4: Household
    await expect(page.getByText("Household")).toBeVisible();
    await page.getByLabel("Total Members").fill("1");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 5: Members
    await expect(page.getByText("Members")).toBeVisible();
    // Fill member 1
    const memberNameInput = page.locator('input[placeholder="Full Name"]').first();
    await memberNameInput.fill("Test Member");
    const memberAgeInput = page.locator('input[type="number"]').first();
    await memberAgeInput.fill("35"); // 30+ to trigger assessment
    
    await page.getByRole("button", { name: "Save Household" }).click();

    // Step 6: 30+ Health Hub
    await expect(page.getByText("30+ Health Hub")).toBeVisible({ timeout: 10000 });
    
    // Do assessment
    await page.getByRole("button", { name: "Start Screening" }).first().click();
    
    // Step 7: Member Assessment Form
    await expect(page.getByText("Start Screening")).toBeVisible();
    // Fill CBAC score
    await page.getByLabel("Age (Score)").fill("2");
    await page.getByRole("button", { name: "Save Screening" }).click();

    // Wait for it to go back to 30+ Health Hub
    await expect(page.getByText("30+ Health Hub")).toBeVisible({ timeout: 10000 });
    
    // Finish
    await page.getByRole("link", { name: "Finish & Open House Details" }).click();
    
    // Verify we are on House Details
    await expect(page.getByText("Test Member")).toBeVisible();
  });
});
