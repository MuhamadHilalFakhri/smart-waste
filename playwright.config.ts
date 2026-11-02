import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "apps/web/e2e",
  timeout: 60000,
  fullyParallel: false,
  use: {
    actionTimeout: 10000,
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
