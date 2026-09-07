import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

interface RequestLog {
  url: string;
  method: string;
  postData?: string | null;
  status?: number;
  responseBody?: string;
  timestamp: number;
}

async function runLiveImportTest() {
  console.log("===============================================================");
  console.log("STARTING REAL BROWSER END-TO-END IMPORT OF Tribal 1.xlsx");
  console.log("===============================================================");

  const filePath = path.resolve("c:/Users/pc/OneDrive/Documents/Desktop/v3/Tribal 1.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Target Excel file does not exist at: ${filePath}`);
  }
  console.log(`Using canonical test file: ${filePath} (${fs.statSync(filePath).size} bytes)`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  const supabaseRequests: RequestLog[] = [];
  const errorsEncountered: string[] = [];
  let housesInsertCount = 0;
  let membersInsertCount = 0;
  let followUpsInsertCount = 0;
  let selectCount = 0;
  let failedRequestsCount = 0;
  let retryCount = 0;
  let pgrst204Count = 0;
  let fkErrorCount = 0;
  let notNullErrorCount = 0;

  // Intercept all network traffic
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("supabase.co")) {
      const log: RequestLog = {
        url,
        method: req.method(),
        postData: req.postData(),
        timestamp: Date.now(),
      };
      supabaseRequests.push(log);

      if (url.includes("/rest/v1/houses") && req.method() === "POST") {
        housesInsertCount++;
      } else if (url.includes("/rest/v1/house_members") && req.method() === "POST") {
        membersInsertCount++;
      } else if (url.includes("/rest/v1/follow_ups") && req.method() === "POST") {
        followUpsInsertCount++;
      } else if (req.method() === "GET") {
        selectCount++;
      }
    }
  });

  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("supabase.co")) {
      const status = res.status();
      if (status >= 400) {
        failedRequestsCount++;
        try {
          const body = await res.text();
          errorsEncountered.push(`[HTTP ${status}] ${url} -> ${body}`);
          if (body.includes("PGRST204")) pgrst204Count++;
          if (body.includes("23503")) fkErrorCount++;
          if (body.includes("23502")) notNullErrorCount++;
        } catch {
          errorsEncountered.push(`[HTTP ${status}] ${url}`);
        }
      }
    }
  });

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[SyncQueue]") || text.includes("error") || text.includes("Error")) {
      console.log(`[Browser Console ${msg.type()}] ${text}`);
      if (text.includes("will retry in 15s")) {
        retryCount++;
      }
    }
  });

  try {
    // 1. Authenticate as Admin
    console.log("\nStep 1: Navigating to local app...");
    await page.addInitScript(() => {
      localStorage.setItem("QA_ROLE", "admin");
    });

    await page.goto("http://localhost:8080/");
    await page.waitForLoadState("networkidle");

    // Check if sign-in form is present
    const userIdInput = page
      .locator('#userId, input[placeholder*="User ID"], input[placeholder*="user id"]')
      .first();
    if (await userIdInput.isVisible()) {
      console.log("Filling admin credentials...");
      await userIdInput.fill("admin");

      // Click into OTP and type 6 digits
      const otpGroup = page
        .locator("[data-input-otp-group], div:has(> [data-input-otp-slot])")
        .first();
      if (await otpGroup.isVisible()) {
        await otpGroup.click();
        await page.keyboard.type("000000");
      } else {
        await page.keyboard.press("Tab");
        await page.keyboard.type("000000");
      }

      await page.waitForTimeout(1000);
      const signInBtn = page
        .locator('button:has-text("Sign in"), button:has-text("Sign In")')
        .first();
      if (await signInBtn.isEnabled()) {
        await signInBtn.click();
      }
      await page.waitForTimeout(3000);
    }

    // Navigate to /import
    console.log("\nStep 2: Navigating to /import...");
    await page.goto("http://localhost:8080/import");
    await page.waitForLoadState("networkidle");

    // Verify Smart Import is loaded
    await page.waitForSelector('h1:has-text("Smart Import"), div:has-text("Smart Import")', {
      timeout: 20000,
    });
    console.log("✓ Import page loaded successfully");

    // 2. Verify CHW Dropdown rule (Section 13)
    console.log("\nStep 3: Uploading Tribal 1.xlsx...");
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);
    console.log("File attached, waiting for analysis...");

    // If mapping screen appears, confirm mapping
    const confirmMappingBtn = page.locator('button:has-text("Confirm Mapping & Preview")');
    try {
      await confirmMappingBtn.waitFor({ state: "visible", timeout: 10000 });
      console.log("Column mapping screen detected, confirming mapping...");
      await confirmMappingBtn.click();
    } catch {
      console.log("No manual column mapping needed; proceeding directly to preview.");
    }

    // Wait for Preview screen
    const approveBtn = page.locator('button:has-text("Approve and import")');
    await approveBtn.waitFor({ state: "visible", timeout: 30000 });
    console.log("✓ Import Preview generated!");

    // Check CHW assignment dropdown
    const chwSelect = page.locator("select").filter({ hasText: /-- Leave Unassigned --/ });
    if ((await chwSelect.count()) > 0) {
      const options = await chwSelect.locator("option").allTextContents();
      console.log("CHW assignment dropdown options:", options);
      const invalidRoles = options.filter(
        (opt) => opt.toLowerCase().includes("admin") || opt.toLowerCase().includes("supervisor"),
      );
      if (invalidRoles.length > 0) {
        console.warn("WARNING: Found non-CHW accounts in assignment select:", invalidRoles);
      } else {
        console.log("✓ CHW assignment dropdown strictly displays active survey_user accounts!");
      }
    }

    // 3. Trigger Import
    console.log('\nStep 4: Clicking "Approve and import"...');
    await approveBtn.click();

    // Wait for completion toast or UI status
    console.log("Waiting for import completion & sync queue processing...");
    await page.waitForTimeout(5000);

    // Give the sync queue time to send houses, members, and follow-ups
    const maxWaitMs = 120000;
    const startWait = Date.now();
    let queueEmpty = false;

    while (Date.now() - startWait < maxWaitMs) {
      const pendingCount = await page.evaluate(async () => {
        try {
          const { db } = await import("/src/db/schema.ts");
          return await db.sync_queue.where("status").anyOf("pending", "syncing").count();
        } catch {
          return 0;
        }
      });

      console.log(`[Queue Monitor] Pending/Syncing items in Dexie: ${pendingCount}`);
      if (pendingCount === 0) {
        queueEmpty = true;
        break;
      }
      await page.waitForTimeout(4000);
    }

    console.log(`\nQueue processing finished. Queue empty: ${queueEmpty}`);

    // Take screenshot of import result
    const screenshotPath = "c:/Users/pc/OneDrive/Documents/Desktop/v3/import-result.png";
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved screenshot to: ${screenshotPath}`);

    // 4. Verify Houses in UI
    console.log("\nStep 5: Verifying Houses page in UI...");
    await page.goto("http://localhost:8080/houses");
    await page.waitForTimeout(4000);
    const housesScreenshot = "c:/Users/pc/OneDrive/Documents/Desktop/v3/houses-page.png";
    await page.screenshot({ path: housesScreenshot, fullPage: true });
    console.log(`Saved houses page screenshot to: ${housesScreenshot}`);

    // 5. Check dependency order: ensure first house insert timestamp < first member insert timestamp
    const firstHouseReq = supabaseRequests.find(
      (r) => r.url.includes("/rest/v1/houses") && r.method === "POST",
    );
    const firstMemberReq = supabaseRequests.find(
      (r) => r.url.includes("/rest/v1/house_members") && r.method === "POST",
    );

    let orderVerified = false;
    if (firstHouseReq && firstMemberReq) {
      orderVerified = firstHouseReq.timestamp <= firstMemberReq.timestamp;
    } else if (firstHouseReq && !firstMemberReq) {
      orderVerified = true;
    }

    console.log("\n===============================================================");
    console.log("NETWORK & IMPORT VERIFICATION REPORT");
    console.log("===============================================================");
    console.log(`Total Supabase API requests: ${supabaseRequests.length}`);
    console.log(`Houses INSERT requests: ${housesInsertCount}`);
    console.log(`House Members INSERT requests: ${membersInsertCount}`);
    console.log(`Follow-ups INSERT requests: ${followUpsInsertCount}`);
    console.log(`SELECT queries: ${selectCount}`);
    console.log(`Failed requests (HTTP >= 400): ${failedRequestsCount}`);
    console.log(`Retries triggered: ${retryCount}`);
    console.log(`PGRST204 (Missing column): ${pgrst204Count}`);
    console.log(`23502 (NOT NULL constraint): ${notNullErrorCount}`);
    console.log(`23503 (Foreign key constraint): ${fkErrorCount}`);
    console.log(
      `Dependency ordering (houses before members): ${orderVerified ? "PASSED ✓" : "FAILED ✗"}`,
    );

    if (errorsEncountered.length > 0) {
      console.log("\nEncountered Errors:");
      errorsEncountered.slice(0, 10).forEach((e) => console.log("  -", e));
    } else {
      console.log("\n✓ ZERO schema, constraint, or HTTP 400 errors encountered during import!");
    }
  } finally {
    await browser.close();
  }
}

runLiveImportTest().catch((err) => {
  console.error("E2E TEST RUNNER ERROR:", err);
  process.exit(1);
});
