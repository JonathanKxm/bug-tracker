import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8788",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile-iphone",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["iPhone 13"], viewport: { width: 375, height: 667 } },
    },
    {
      name: "tablet-ipad",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["iPad (gen 7)"], viewport: { width: 768, height: 1024 } },
    },
  ],
  webServer: process.env.NO_WEB_SERVER
    ? undefined
    : {
        command: "npm run pages:dev",
        port: 8788,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
          DEV_FAKE_USER: "admin@example.com",
          ACCESS_TEAM_DOMAIN: "test.cloudflareaccess.com",
          ACCESS_AUD: "local-dev-aud",
        },
      },
});
