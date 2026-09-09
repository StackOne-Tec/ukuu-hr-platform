import { test, expect } from "@playwright/test";
import { provisionWorkspace } from "./helpers";

test("cached locked verdict does not cause a hydration mismatch", async ({ page }) => {
  const tag = `hy${Date.now().toString(36).slice(-5)}`;
  const ws = await provisionWorkspace(tag);

  const hydrationErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Hydration failed|did not match/i.test(msg.text())) {
      hydrationErrors.push(msg.text());
    }
  });

  // Reproduce the bug: a previous visit cached the locked verdict, so the
  // client's first render used to differ from the server's.
  await page.addInitScript(() => {
    sessionStorage.setItem("ukuu_license_locked", "1");
  });
  await page.context().addCookies([
    { name: "ukuu_session", value: ws.token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);

  await page.goto("/dashboard");
  await expect(page.locator('h1:has-text("Workspace Overview")').first()).toBeVisible({ timeout: 60_000 });

  expect(hydrationErrors, `hydration errors: ${hydrationErrors.join(" | ")}`).toEqual([]);
});

test("unlicensed workspace still swaps in the activation gate after load", async ({ page }) => {
  const tag = `hy${Date.now().toString(36).slice(-5)}x`;
  const ws = await provisionWorkspace(tag, { licensed: false });

  await page.context().addCookies([
    { name: "ukuu_session", value: ws.token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  await page.goto("/dashboard");

  // The gate appears once /api/license/status confirms the lock.
  await expect(page.getByText("Activate your workspace")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("body")).toContainText("Subscription required");
});