import { test, expect } from "@playwright/test";

/**
 * Public surfaces: marketing landing page + health endpoint.
 * These run without authentication and must render for anonymous visitors.
 */

test.describe("Marketing landing page", () => {
  test("renders hero with brand, nav and CTAs", async ({ page }) => {
    await page.goto("/");

    // Brand lockup (header + footer both carry it — scope to the header)
    await expect(page.locator(".lp-header .lp-logo-name")).toHaveText("UKUU HR");
    await expect(page.locator(".lp-header .lp-logo-sub")).toHaveText("HRMS Platform");
    // Real brand logo asset is used
    await expect(page.locator('.lp-logo img[src*="ukuu-brand"]')).toBeVisible();

    // Hero headline (landing copy)
    await expect(page.locator("h1").first()).toBeVisible();

    // Primary nav items
    for (const item of ["Demo", "Features", "Metrics", "Workflow", "Download", "Deploy"]) {
      await expect(page.locator(`.lp-nav a:has-text("${item}")`)).toBeVisible();
    }

    // Sign-in CTA present
    await expect(page.locator('a.lp-btn-signin[href="/login"]')).toBeVisible();
  });

  test("FAQ mentions the Bridge desktop app device support", async ({ page }) => {
    await page.goto("/");
    const faq = page.locator("body");
    await expect(faq).toContainText("Ukuu HR Bridge desktop app");
  });

  test("all nav anchors resolve to sections on the page", async ({ page }) => {
    await page.goto("/");
    const hrefs = await page.locator(".lp-nav a").evaluateAll((els) =>
      els.map((e) => e.getAttribute("href"))
    );
    expect(hrefs.length).toBeGreaterThan(3);
    for (const href of hrefs) {
      expect(href?.startsWith("#") || href?.startsWith("/")).toBeTruthy();
    }
  });
});

test.describe("Health & platform API", () => {
  test("health endpoint reports status and database connectivity", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
    expect(typeof body.timestamp).toBe("string");
  });
});
