import { test, expect } from "@playwright/test";
import { ctx } from "./ctx";
import { provisionWorkspace, signInAs } from "./helpers";

/**
 * Cross-cutting UX/quality invariants:
 *  - landmarks and form labels exist on the public auth pages;
 *  - data tables expose headers (screen-reader / test anchor);
 *  - audit log captures what the app claims it captures.
 */

test.describe("Accessibility basics", () => {
  test("login form inputs are labeled", async ({ page }) => {
    await page.goto("/login");
    for (const id of ["au-email", "au-password"]) {
      const label = page.locator(`label[for="${id}"]`);
      await expect(label).toBeVisible();
      const forAttr = await label.getAttribute("for");
      expect(forAttr).toBe(id);
    }
    // Theme toggle exposes an accessible name
    await expect(page.locator(".au-theme-btn")).toHaveAttribute("aria-label", /mode/i);
  });

  test("signup form critical inputs are labeled", async ({ page }) => {
    await page.goto("/signup");
    for (const id of ["sg-first", "sg-email", "sg-org", "sg-country", "sg-password"]) {
      await expect(page.locator(`label[for="${id}"]`)).toBeVisible();
    }
  });

  test("access-code input is labeled and has autocomplete off", async ({ page }) => {
    const { token } = await provisionWorkspace(`a11y${Date.now().toString(36).slice(-5)}`, { licensed: false });
    await page.context().addCookies([
      { name: "ukuu_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/dashboard");
    const input = page.locator("#access-code");
    await expect(input).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('label[for="access-code"]')).toBeVisible();
    await expect(input).toHaveAttribute("autocomplete", "off");
  });
});

test.describe("Console data quality", () => {
  test("employees table exposes column headers", async ({ page }) => {
    const tag = `hdr${Date.now().toString(36).slice(-5)}`;
    const ws = await provisionWorkspace(tag);
    await ctx.createEmployee(tag, ws.org.id);
    await signInAs(page, ws.token);
    await page.goto("/employees");
    for (const col of ["Employee", "Code", "Department", "Position", "Status"]) {
      await expect(page.locator("th", { hasText: col })).toBeVisible({ timeout: 60_000 });
    }
  });

  test("security page lists audit entries after an employee is created via API", async ({ page, request }) => {
    const tag = `aud${Date.now().toString(36).slice(-5)}`;
    const ws = await provisionWorkspace(tag);
    await signInAs(page, ws.token);

    const res = await request.post("/api/employees", {
      data: {
        firstName: "Audited",
        lastName: "User",
        email: `${ctx.prefix}audited@e2e.test`,
        position: "Auditor",
      },
      headers: { Cookie: `ukuu_session=${ws.token}`, "Content-Type": "application/json" },
    });
    expect(res.ok()).toBeTruthy();

    await page.goto("/security");
    await expect(page.locator("body")).not.toContainText("Activate your workspace", { timeout: 60_000 });
    await expect(page.getByText("Employee.Create").first()).toBeVisible({ timeout: 60_000 });
  });
});
