import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure we have a unique identifier for safety if needed, though we rely on real interactions here.
const runId = `E2E_TEST_${Date.now()}`;

test.describe("Management App E2E Flow", () => {
  // Use the e2eadmin user we seeded earlier
  const ADMIN_EMAIL = "e2eadmin@ibbulabs.app";
  const ADMIN_PIN = "123456";

  test("Complete flow: Login, User Creation, Import, Analytics, Dashboards", async ({ page }) => {
    // 1. Login
    await page.goto("/");
    await page.locator("#userId").fill("e2eadmin");
    await page.locator('input[inputmode="numeric"]').fill(ADMIN_PIN);

    // Verify dashboard loads
    await expect(page.getByText(/Hello,/i)).toBeVisible({ timeout: 10000 });

    // 2. Navigation works
    await page.getByRole("link", { name: "Users", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Users & Roles" })).toBeVisible({
      timeout: 15000,
    });

    // 3. Smart Import
    if (await page.getByRole("button", { name: "More" }).isVisible()) {
      await page.getByRole("button", { name: "More" }).click();
    }
    await page.getByRole("link", { name: "Smart Import", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Smart Import" })).toBeVisible();

    const fileInput = await page.$('input[type="file"]');
    // Using the previously created test_import.csv
    await fileInput?.setInputFiles(path.join(__dirname, "../test_import.csv"));

    await expect(page.getByText("rows").first()).toBeVisible({ timeout: 10000 });
    // Approve and import
    await page.getByRole("button", { name: "Approve and import" }).click();

    await expect(page.getByText(/Imported/i).first()).toBeVisible({ timeout: 10000 });

    // 4. Verification (Analytics, Dashboard, Follow-ups, Map)
    // Analytics
    if (await page.getByRole("button", { name: "More" }).isVisible()) {
      await page.getByRole("button", { name: "More" }).click();
    }
    await page.getByRole("link", { name: "Analytics" }).first().click();
    await expect(page.getByText("Exact Age Analytics")).toBeVisible();
    await expect(page.getByText("No Condition Recorded")).toBeVisible();

    // Follow-ups
    if (await page.locator('[data-testid="mobile-menu-btn"]').isVisible()) {
      await page.locator('[data-testid="mobile-menu-btn"]').click();
    }
    await page.getByRole("link", { name: "Users", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({
      timeout: 10000,
    });if (await page.getByRole("button", { name: "More" }).isVisible()) {
      await page.getByRole("button", { name: "More" }).click();
    }
    await page.getByRole("link", { name: "Map" }).first().click();
    await expect(page.getByText("RUN MODE")).toBeVisible();
    await page.getByRole("button", { name: "RUN MODE" }).click();
    await expect(page.getByText("Run Mode Active")).toBeVisible();
    await page.getByRole("button", { name: "EXIT RUN MODE" }).click();

    // Data Quality
    if (await page.getByRole("button", { name: "More" }).isVisible()) {
      await page.getByRole("button", { name: "More" }).click();
    }
    await page.getByRole("link", { name: "Home" }).first().click();
    await page.getByRole("link", { name: "Review alerts" }).first().click();
    await expect(page.getByRole("heading", { name: "Data Quality" })).toBeVisible();
  });
});
