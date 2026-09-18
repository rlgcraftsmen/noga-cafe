import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    // 4322, not 4321: tests build + preview on their own port so they never
    // hit a running dev server (dev image transforms are slow/flaky under
    // parallel load and would poison visual baselines).
    baseURL: "http://localhost:4322",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4322",
    url: "http://localhost:4322",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Astro 7.2 daemonizes `astro preview` automatically whenever it detects an
    // AI coding agent, so the foreground process exits instantly and Playwright
    // reports "webServer exited early". Force foreground — the test harness owns
    // this server's lifecycle. Docs: astro.build/en/guides/build-with-ai/#background-mode
    env: { ASTRO_PREVIEW_BACKGROUND: "0" },
  },
});
