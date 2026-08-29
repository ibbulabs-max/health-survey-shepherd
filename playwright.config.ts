import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "iPhone SE",
      use: { ...devices["iPhone SE"] },
    },
    {
      name: "iPhone 8",
      use: { ...devices["iPhone 8"] },
    },
    {
      name: "iPhone 12 Pro",
      use: { ...devices["iPhone 12 Pro"] },
    },
    {
      name: "iPhone 11 Pro Max",
      use: { ...devices["iPhone 11 Pro Max"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
