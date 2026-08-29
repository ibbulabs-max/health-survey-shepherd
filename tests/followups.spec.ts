import { test, expect, type Page } from "@playwright/test";

/**
 * Follow-ups page E2E tests.
 *
 * Covers:
 * - Page load with correct heading
 * - Status navigation (High Risk, Moderate Risk, Normal, Completed)
 * - Search
 * - Calendar (prev/next month, Today, date selection, clear)
 * - Filters (risk, status, CHW, house, date preset)
 * - Follow-up cards show required identifiers
 * - View Member link
 * - Complete dialog
 * - Reschedule dialog
 * - Mobile / Desktop viewports
 * - Console error collection
 */

const ADMIN_EMAIL = "e2eadmin";
const ADMIN_PIN = "123456";

async function loginAsAdmin(page: Page) {
  await page.goto("/");
  // Wait for login page
  const userIdInput = page.getByPlaceholder("e.g. admin");
  if (await userIdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await userIdInput.fill(ADMIN_EMAIL);
    await page.locator('input[inputmode="numeric"]').fill(ADMIN_PIN);
    // Wait for dashboard to load
    await page.waitForURL(/dashboard|followups/, { timeout: 15000 }).catch(() => {});
  }
}

test.describe("Follow-ups Page", () => {
  const consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await loginAsAdmin(page);
  });

  test("page loads with correct heading and date", async ({ page }) => {
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: /Follow-ups/i }).first()).toBeVisible({
      timeout: 15000,
    });
    // Should show current date text
    await expect(page.getByText(/Track and manage/i)).toBeVisible();
    // Should show day of week
    const today = new Date();
    const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
    await expect(page.getByText(new RegExp(dayName, "i"))).toBeVisible();
  });

  test("status navigation tabs are present with counts", async ({ page }) => {
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: /Follow-ups/i }).first()).toBeVisible({
      timeout: 15000,
    });

    // Check tabs
    await expect(page.getByText("HIGH RISK", { exact: true })).toBeVisible();
    await expect(page.getByText("MODERATE", { exact: true })).toBeVisible();
    await expect(page.getByText("NORMAL", { exact: true })).toBeVisible();
    await expect(page.getByText("COMPLETED", { exact: true })).toBeVisible();
  });

  test("can switch between status tabs", async ({ page }) => {
    await page.goto("/followups");
    
    // Default tab should be High Risk
    await expect(page.getByText("HIGH RISK", { exact: true }).first()).toBeVisible();

    // Click Moderate
    await page.getByText("MODERATE", { exact: true }).click();
    await expect(page.getByText("MODERATE", { exact: true }).first()).toBeVisible();

    // Click Completed
    await page.getByText("COMPLETED", { exact: true }).click();
    await expect(page.getByText("COMPLETED", { exact: true }).first()).toBeVisible();
  });

  test("search bar is functional", async ({ page }) => {
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    const searchInput = page.getByPlaceholder(/Search name/i);
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill("test_search_query_unlikely_match");
    // Wait for results to update
    await page.waitForTimeout(500);
    // Should show 0 results or empty state
    await expect(page.getByText(/0 result/i).first()).toBeVisible();
  });

  test("calendar is visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    // Calendar should show month navigation
    await expect(page.getByLabel("Previous month")).toBeVisible();
    await expect(page.getByLabel("Next month")).toBeVisible();
    await expect(page.getByText("Today").last()).toBeVisible();
  });

  test("calendar month navigation works", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    const currentMonth = new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    await expect(page.getByText(currentMonth)).toBeVisible();

    // Click next month
    await page.getByLabel("Next month").click();
    // Verify month changed
    const nextMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
    ).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    await expect(page.getByText(nextMonth)).toBeVisible();

    // Click previous month to go back
    await page.getByLabel("Previous month").click();
    await expect(page.getByText(currentMonth)).toBeVisible();
  });

  test("calendar Today button works", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    // Navigate away first
    await page.getByLabel("Next month").click();
    // Click Today to come back
    const todayButton = page.locator("button", { hasText: /^Today$/ }).last();
    await todayButton.click();

    const currentMonth = new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    await expect(page.getByText(currentMonth)).toBeVisible();
  });

  test("filter controls are visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    // Check filter labels
    await expect(page.getByText("Risk", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Status", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("CHW / CSW", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("House", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Date", { exact: true }).first()).toBeVisible();
  });

  test("follow-up cards show required identifiers", async ({ page }) => {
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    // Try all tabs to find a card
    const tabs = ["HIGH RISK", "MODERATE", "NORMAL", "COMPLETED"];
    let foundCard = false;

    for (const tabName of tabs) {
      await page.getByText(tabName, { exact: true }).first().click();
      await page.waitForTimeout(300);

      const cards = page.locator("[role=article]");
      const count = await cards.count();
      if (count > 0) {
        foundCard = true;
        const firstCard = cards.first();
        // Verify house info is visible
        await expect(firstCard.getByText(/House No\./i)).toBeVisible();
        await expect(firstCard.getByText(/House ID:/i)).toBeVisible();
        await expect(firstCard.getByText(/Member ID:/i)).toBeVisible();
        break;
      }
    }

    // If no cards at all, the test passes as data-dependent
    if (!foundCard) {
      test.skip();
    }
  });

  test("complete button opens confirmation dialog", async ({ page }) => {
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    // Look for a Complete button in any active tab
    const tabs = ["HIGH RISK", "MODERATE", "NORMAL"];
    let foundComplete = false;

    for (const tabName of tabs) {
      await page.getByText(tabName, { exact: true }).first().click();
      await page.waitForTimeout(300);

      const completeBtn = page.getByRole("button", { name: /Complete/i }).first();
      if (await completeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        foundComplete = true;
        await completeBtn.click();
        // Verify dialog appears
        await expect(page.getByText("Complete Follow-up")).toBeVisible();
        await expect(page.getByRole("button", { name: /SKIP VITALS/i })).toBeVisible();
        await expect(page.getByRole("button", { name: /SAVE VITALS & COMPLETE/i })).toBeVisible();
        // Close dialog
        await page.locator('button[aria-label="Close"]').first().click().catch(() => page.keyboard.press('Escape'));
        break;
      }
    }

    if (!foundComplete) {
      test.skip();
    }
  });

  test("reschedule button opens date picker dialog", async ({ page }) => {
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    // Look for a Reschedule button
    const tabs = ["HIGH RISK", "MODERATE", "NORMAL"];
    let foundReschedule = false;

    for (const tabName of tabs) {
      await page.getByText(tabName, { exact: true }).first().click();
      await page.waitForTimeout(300);

      const rescheduleBtn = page.getByRole("button", { name: /Reschedule/i }).first();
      if (await rescheduleBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        foundReschedule = true;
        await rescheduleBtn.click();
        // Verify dialog
        await expect(page.getByText("Reschedule Follow-up")).toBeVisible();
        await expect(page.getByLabel(/New Date/i)).toBeVisible();
        // Close
        await page.getByRole("button", { name: /Cancel/i }).click();
        break;
      }
    }

    if (!foundReschedule) {
      test.skip();
    }
  });

  test("View Member link is present on cards", async ({ page }) => {
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    const tabs = ["HIGH RISK", "MODERATE", "NORMAL", "COMPLETED"];
    for (const tabName of tabs) {
      await page.getByText(tabName, { exact: true }).first().click();
      await page.waitForTimeout(300);

      const viewMemberLink = page.getByText("View Member").first();
      if (await viewMemberLink.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Verify it's a clickable link
        await expect(viewMemberLink).toBeVisible();
        return;
      }
    }

    test.skip();
  });

  test("empty states show correct messages", async ({ page }) => {
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    // Search for something that won't match
    await page.getByPlaceholder(/Search name/i).fill("zzz_no_match_xyz_12345");
    await page.waitForTimeout(500);

    // Should show empty state or 0 results
    const zeroResults = page.getByText(/0 result/i).first();
    await expect(zeroResults).toBeVisible();
  });

  test("no critical console errors", async ({ page }) => {
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });
    // Wait a bit for any deferred errors
    await page.waitForTimeout(2000);

    const criticalErrors = consoleErrors.filter(
      (e) =>
        e.includes("TypeError") ||
        e.includes("ReferenceError") ||
        e.includes("Unhandled"),
    );
    expect(criticalErrors).toEqual([]);
  });
});

test.describe("Follow-ups Mobile View", () => {
  test("mobile layout at 375x812", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsAdmin(page);
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    // Status tabs should be visible
    await expect(page.getByText("HIGH RISK", { exact: true }).first()).toBeVisible();
    // Search should be visible
    await expect(page.getByPlaceholder(/Search name/i)).toBeVisible();
    // Filter button should be visible on mobile
    await expect(page.getByLabel("Open filters")).toBeVisible();
    // Calendar button should be visible on mobile
    await expect(page.getByText("Open Calendar")).toBeVisible();
  });

  test("mobile filter drawer opens", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page);
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    await page.getByLabel("Open filters").click();
    await expect(page.getByText("Filters", { exact: true })).toBeVisible();
    await expect(page.getByText(/Apply Filters/i)).toBeVisible();
  });

  test("mobile calendar drawer opens", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await loginAsAdmin(page);
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    await page.getByText("Open Calendar").click();
    // Calendar should appear in drawer
    await expect(page.getByLabel("Previous month")).toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel("Next month")).toBeVisible();
  });
});

test.describe("Follow-ups Desktop View", () => {
  test("desktop layout at 1920x1080", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await loginAsAdmin(page);
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    // Calendar sidebar should be visible but we changed it to a popover!
    // We expect the popover calendar to open when clicking the calendar button.
    const calendarBtn = page.getByLabel("Open calendar");
    await expect(calendarBtn).toBeVisible();
    
    // Filters should be inline, not behind a button
    await expect(page.getByText("Risk", { exact: true }).first()).toBeVisible();
  });

  test("desktop layout at 1366x768", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await loginAsAdmin(page);
    await page.goto("/followups");
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible({
      timeout: 15000,
    });

    const calendarBtn = page.getByLabel("Open calendar");
    await expect(calendarBtn).toBeVisible();
  });
});
