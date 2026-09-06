import { test, expect } from "@playwright/test";
import { ctx } from "./ctx";
import { provisionWorkspace } from "./helpers";

/**
 * Subscription gate (AccessGate):
 *  - a signed-in workspace without an active license is locked;
 *  - redeeming a valid access code (Coupon) unlocks it;
 *  - the gate header carries the real Ukuu brand logo (not a generic icon).
 */

test.describe("AccessGate", () => {
  test("locked workspace shows the activation screen with the real brand logo", async ({ page }) => {
    const tag = `lk${Date.now().toString(36).slice(-5)}`;
    const { org, token } = await provisionWorkspace(tag, { licensed: false });

    await page.context().addCookies([
      { name: "ukuu_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/dashboard");

    // Gate UI
    await expect(page.getByText("Subscription required")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Activate your workspace")).toBeVisible();

    // Brand correctness: the Ukuu logo asset — not a generic key icon
    await expect(page.locator('img[src*="ukuu-brand"]')).toBeVisible();

    await expect(page.getByText(org.name)).toHaveCount(0); // no workspace content leaks
  });

  test("redeeming a valid access code unlocks the workspace", async ({ page, request }) => {
    const tag = `rd${Date.now().toString(36).slice(-5)}`;
    const { token } = await provisionWorkspace(tag, { licensed: false });
    const couponCode = await ctx.createCoupon(tag);

    await page.context().addCookies([
      { name: "ukuu_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/dashboard");
    await expect(page.getByText("Activate your workspace")).toBeVisible({ timeout: 60_000 });

    await page.locator("#access-code").fill(couponCode);
    await page.getByRole("button", { name: /activate workspace/i }).click();

    // Success state, then the console appears
    await expect(page.getByText("Workspace activated")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("body")).toContainText("E2E Org", { timeout: 60_000 });

    // License row now exists and coupon is marked redeemed
    const rows = await ctx.q(
      `SELECT l.status, c."redeemedAt" IS NOT NULL AS redeemed
         FROM "LicenseCode" l JOIN "Coupon" c ON c.code ILIKE $1
        WHERE l."organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $2)`,
      [`${ctx.prefix}${tag.toUpperCase()}%`, `${ctx.prefix}%`]
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].status).toBe("Active");
    expect(rows[0].redeemed).toBe(true);
  });

  test("invalid and already-used codes are rejected with readable errors", async ({ page }) => {
    const tag = `bad${Date.now().toString(36).slice(-6)}`;
    const { token } = await provisionWorkspace(tag, { licensed: false });

    await page.context().addCookies([
      { name: "ukuu_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/dashboard");
    await expect(page.locator("#access-code")).toBeVisible({ timeout: 60_000 });

    // Unknown code
    await page.locator("#access-code").fill("E2E-NOT-A-REAL-CODE");
    await page.getByRole("button", { name: /activate workspace/i }).click();
    await expect(page.getByText(/isn't valid/i)).toBeVisible();

    // Already-redeemed code
    const code = await ctx.createCoupon("used", { status: "Active" });
    await ctx.q(`UPDATE "Coupon" SET "redeemedAt" = now() WHERE code = $1`, [code]);
    await page.locator("#access-code").fill(code);
    await page.getByRole("button", { name: /activate workspace/i }).click();
    await expect(page.getByText(/already been used/i)).toBeVisible();
  });

  test("anonymous visitors are never gated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Activate your workspace")).toHaveCount(0);
  });
});
