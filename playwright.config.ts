import { defineConfig, devices } from "@playwright/test";

const CHROME = process.env.PW_CHROME;  // CI installs chromium; sandbox sets PW_CHROME

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: { baseURL: "http://127.0.0.1:4174", trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [{
    name: "chromium",
    use: { ...devices["Desktop Chrome"], launchOptions: { ...(CHROME ? { executablePath: CHROME } : {}), args: ["--no-sandbox"] } },
  }],
  webServer: {
    command: "npm run preview -- --port 4174 --host 127.0.0.1",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
