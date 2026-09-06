import { test, expect } from "@playwright/test";
import { ctx } from "./ctx";
import { provisionWorkspace } from "./helpers";

/**
 * Bridge companion-app surface (web UI at /bridge/login):
 * shares identity with the cloud app and authenticates against the same
 * credentials.
 */

test.describe("Bridge login UI", () => {
  test("renders the branded gateway sign-in", async ({ page }) => {
    await page.goto("/bridge/login");

    await expect(page.locator(".au-logo-name")).toHaveText("UKUU HR");
    // Uses the real brand logo asset
    await expect(page.locator('img[src*="ukuu-brand"]')).toBeVisible();
    await expect(page.getByText("Sign in to the Bridge")).toBeVisible();
    await expect(page.getByText(/All systems operational/i)).toBeVisible();
  });

  test("sign-in with cloud credentials reaches the bridge dashboard", async ({ page }) => {
    const tag = `br${Date.now().toString(36).slice(-5)}`;
    const ws = await provisionWorkspace(tag);

    await page.goto("/bridge/login");
    await page.locator("#br-email").fill(ws.user.email);
    await page.locator("#br-password").fill(ws.user.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Bridge app authenticates via /api/v1/bridge/login, stores its token and
    // moves to the device dashboard.
    await page.waitForURL(/\/bridge\/dashboard/, { timeout: 60_000 });
    await expect(page.locator("body")).toContainText(ws.org.name, { timeout: 60_000 });
  });

  test("dashboard sidebar pages are deep-linkable routes", async ({ page }) => {
    const tag = `br${Date.now().toString(36).slice(-5)}`;
    const ws = await provisionWorkspace(tag);

    await page.goto("/bridge/login");
    await page.locator("#br-email").fill(ws.user.email);
    await page.locator("#br-password").fill(ws.user.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/bridge\/dashboard/, { timeout: 60_000 });

    // The dashboard is organized as sidebar pages: Devices (default),
    // Sync Activity, Attendance and Import — each with its own route.
    const sidebar = page.locator(".br-sidebar");
    await expect(sidebar).toBeVisible();
    for (const item of ["Devices", "Sync Activity", "Attendance", "Import"]) {
      await expect(sidebar.locator(".br-sidebar-item", { hasText: item })).toBeVisible();
    }

    // Default page: the device registration surface is shown.
    await expect(page.locator(".br-panel", { hasText: "Already Added Devices" })).toBeVisible();

    // Switching to Sync Activity navigates to its route and swaps the content.
    await sidebar.locator(".br-sidebar-item", { hasText: "Sync Activity" }).click();
    await page.waitForURL(/\/bridge\/dashboard\/sync$/);
    await expect(page.locator(".br-panel", { hasText: "Sync Activity" })).toBeVisible();
    await expect(page.locator(".br-panel", { hasText: "Already Added Devices" })).toHaveCount(0);

    // The page survives a refresh (deep-linkable).
    await page.reload();
    await expect(page.locator(".br-panel", { hasText: "Sync Activity" })).toBeVisible();

    // Attendance page shows the synced attendance table.
    await sidebar.locator(".br-sidebar-item", { hasText: "Attendance" }).click();
    await page.waitForURL(/\/bridge\/dashboard\/attendance$/);
    await expect(page.locator(".br-panel", { hasText: "Attendance · Synced from Devices" })).toBeVisible();

    // Import page exposes the API-key import card.
    await sidebar.locator(".br-sidebar-item", { hasText: "Import" }).click();
    await page.waitForURL(/\/bridge\/dashboard\/import$/);
    await expect(page.locator(".br-panel", { hasText: "Import Attendance via API Key" })).toBeVisible();

    // Sign Out lives in the sidebar footer and returns to the gateway login.
    await sidebar.locator(".br-sidebar-signout").click();
    await page.waitForURL(/\/bridge\/login/, { timeout: 60_000 });
  });

  test("an unlicensed workspace is stopped at the subscription gate", async ({ page }) => {
    const tag = `bl${Date.now().toString(36).slice(-5)}`;
    const ws = await provisionWorkspace(tag, { licensed: false });

    await page.goto("/bridge/login");
    await page.locator("#br-email").fill(ws.user.email);
    await page.locator("#br-password").fill(ws.user.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/bridge\/dashboard/, { timeout: 60_000 });

    // The web app reports no active license for this workspace, so the desktop
    // must not proceed: the locked screen replaces the workspace entirely — no
    // sidebar, no panels, no device/sync/import actions.
    await expect(page.getByText("Workspace locked")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(ws.org.name)).toBeVisible();
    await expect(page.locator(".br-sidebar")).toHaveCount(0);
    await expect(page.locator(".br-panel")).toHaveCount(0);
    await expect(page.locator("button", { hasText: /sync now/i })).toHaveCount(0);

    // The gate survives a refresh — status is confirmed against the cloud.
    await page.reload();
    await expect(page.getByText("Workspace locked")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".br-sidebar")).toHaveCount(0);

    // Signing out from the gate returns to the gateway login.
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/bridge\/login/, { timeout: 60_000 });
  });
});
