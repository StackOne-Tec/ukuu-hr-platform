import { test, expect } from "@playwright/test";

/**
 * src/proxy.ts behavior (middleware) on the standard deployment
 * (NEXT_PUBLIC_PLATFORM !== "admin" — the default for `bun run dev`):
 *  - marketing landing lives at "/";
 *  - /super-admin and /access-codes redirect to /dashboard;
 *  - HTML responses are no-store and carry the build header.
 */

test.describe("Platform routing (standard deployment)", () => {
  test("landing page is public at /", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page.locator(".lp-header .lp-logo-name")).toHaveText("UKUU HR");
  });

  test("/super-admin redirects to /dashboard on the standard platform", async ({ page }) => {
    await page.goto("/super-admin");
    expect(new URL(page.url()).pathname).toBe("/dashboard");
  });

  test("/access-codes redirects to /dashboard on the standard platform", async ({ page }) => {
    await page.goto("/access-codes");
    expect(new URL(page.url()).pathname).toBe("/dashboard");
  });

  test("HTML responses are no-store with a build header; static assets are cacheable", async ({ page }) => {
    const res = await page.goto("/");
    const headers = res?.headers() ?? {};
    expect(headers["cache-control"]).toContain("no-store");
    // X-Ukuu-Build: "dev" locally, a commit SHA in production.
    expect(headers["x-ukuu-build"]).toBeTruthy();
  });

  test("/signup is reachable on the standard platform", async ({ page }) => {
    await page.goto("/signup");
    expect(new URL(page.url()).pathname).toBe("/signup");
    await expect(page.locator("#sg-email")).toBeVisible();
  });
});
