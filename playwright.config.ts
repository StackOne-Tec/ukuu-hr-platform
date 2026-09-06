import { defineConfig } from "@playwright/test";

/**
 * End-to-end suite for Ukuu HR.
 *
 * - Boots the real Next.js dev server (standard platform, port 3000) so every
 *   route, server component and API route runs exactly as deployed.
 * - Talks to the same PostgreSQL instance the app uses (DATABASE_URL from
 *   .env). Tests NEVER delete or mutate shared/demo data: every signup,
 *   employee, coupon, device and session is namespaced under a unique
 *   `e2e-<run>` prefix and global-teardown removes exactly that namespace.
 * - Workers are pinned to 1 so flows that touch the database stay
 *   deterministic and dev-server compile time is paid once per route.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
