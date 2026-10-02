import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
const port = process.env.REBUILD_E2E_PORT ?? "3000";
const baseURL = `http://localhost:${port}`;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "docs/evidence/browser-results.json" }],
  ],
  use: {
    baseURL,
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ??
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command:
      process.env.REBUILD_E2E_PRODUCTION === "1" ? "npm start" : "npm run dev",
    url: `${baseURL}/api/health`,
    env: { PORT: port, APP_ORIGIN: baseURL },
    reuseExistingServer:
      !process.env.CI && process.env.REBUILD_E2E_PRODUCTION !== "1",
    timeout: 45000,
  },
});
