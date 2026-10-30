import { defineConfig } from "@playwright/test";

// Browser tests: the real app, in the Chrome already on this machine, on seeded demo data.
// e2e/fixtures.ts starts a server per test file. `pnpm e2e` builds the frontend first.
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false, // tests in a file share its server; files run side by side
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    channel: "chrome",
    viewport: { width: 1400, height: 1000 },
    contextOptions: { reducedMotion: "reduce" },
    locale: "en-GB",
    timezoneId: "Europe/London",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
