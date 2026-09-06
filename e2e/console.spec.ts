import { test, expect, type Page } from "@playwright/test";
import { ctx } from "./ctx";
import { provisionWorkspace, signInAs } from "./helpers";

/**
 * Authenticated console: every module page renders inside the AdminShell with
 * org-scoped data for a licensed workspace.
 */

let tag: string;
let token: string;
let orgName: string;

test.beforeAll(async () => {
  tag = `console${Date.now().toString(36).slice(-5)}`;
  const ws = await provisionWorkspace(tag);
  token = ws.token;
  orgName = ws.org.name;
});

async function gotoConsole(page: Page, path: string) {
  await page.goto(path);
  // Every page renders the shell; wait for the license check to clear.
  await expect(page.locator("body")).not.toContainText("Activate your workspace", { timeout: 60_000 });
}

test.describe("Console overview", () => {
  test("dashboard renders org KPIs for the signed-in workspace", async ({ page }) => {
    await signInAs(page, token);
    await expect(page.locator("body")).toContainText(orgName, { timeout: 60_000 });
  });

  test("dashboard shows zero-state KPIs for a fresh workspace", async ({ page }) => {
    await signInAs(page, token);
    await expect(page.getByText("Total Employees").first()).toBeVisible({ timeout: 60_000 });
  });
});

test.describe("Employees module", () => {
  test("directory lists seeded org employees with stats", async ({ page }) => {
    const t = `dir${Date.now().toString(36).slice(-5)}`;
    const org = await ctx.createOrg(t);
    const user = await ctx.createUser(t, org.id);
    await ctx.createLicense(org.id);
    const dept = await ctx.createDepartment(t, org.id);
    const emp = await ctx.createEmployee(t, org.id, dept);
    const tok = await ctx.createSession(user.id, org.id);

    await signInAs(page, tok);
    await gotoConsole(page, "/employees");

    await expect(page.getByText("1 on record")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(emp.fullName).first()).toBeVisible();
    await expect(page.getByText(emp.code)).toBeVisible();
  });

  test("add-employee page renders the form", async ({ page }) => {
    await signInAs(page, token);
    await gotoConsole(page, "/employees/add");
    await expect(page.locator("h1")).toContainText("Add Employee");
  });
});

const MODULE_PAGES: Array<[string, string | RegExp]> = [
  ["/attendance", /Attendance/i],
  ["/attendance/logs", /Attendance/i],
  ["/leave", /Leave/i],
  ["/payroll", /Payroll/i],
  ["/shifts", /Shift/i],
  ["/overtime", /Overtime/i],
  ["/devices", /Device/i],
  ["/reports", /Report/i],
  ["/documents", /Document/i],
  ["/timecards", /Time/i],
  ["/messages", /Message/i],
  ["/settings", /Settings|Workspace/i],
  ["/security", /Security|Audit/i],
  ["/billing", /Billing|Plan/i],
];

test.describe("Console module pages", () => {
  for (const [path, heading] of MODULE_PAGES) {
    test(`${path} renders for a licensed workspace`, async ({ page }) => {
      await signInAs(page, token);
      await gotoConsole(page, path);
      await expect(page.locator("h1").first()).toContainText(heading, { timeout: 60_000 });
    });
  }
});

test.describe("User Management (Settings invites)", () => {
  test("invites a teammate who then appears in the user list", async ({ page }) => {
    await signInAs(page, token);
    await gotoConsole(page, "/settings");

    await page.getByRole("button", { name: "User Management" }).click();
    await expect(page.locator(".bk-admin-card", { hasText: "User accounts" })).toBeVisible();

    // Open the invite form and send an invitation.
    await page.getByRole("button", { name: "Invite user" }).click();
    const email = `${ctx.prefix}inv${Date.now().toString(36).slice(-5)}@e2e.test`;
    await page.locator("#inv-name").fill("Ina Invitee");
    await page.locator("#inv-email").fill(email);
    await page.locator("#inv-role").selectOption("Manager");
    await page.getByRole("button", { name: /send invite/i }).click();

    // Success: the one-time temporary password is shown and the invitee is listed.
    await expect(page.getByText(`Invite sent to ${email}`)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("input.bk-mono").first()).toHaveValue(/^Uk[0-9a-f]+$/);
    await expect(page.locator(".bk-admin-card", { hasText: "User accounts" })).toContainText("Ina Invitee");
    await expect(page.locator(".bk-admin-card", { hasText: "User accounts" })).toContainText("Manager");

    // The invited member is persisted — visible after a reload too.
    await page.reload();
    await page.getByRole("button", { name: "User Management" }).click();
    await expect(page.locator(".bk-admin-card", { hasText: "User accounts" })).toContainText("Ina Invitee", { timeout: 60_000 });

    // Inviting the same email again is rejected with a readable error.
    await page.getByRole("button", { name: "Invite user" }).click();
    await page.locator("#inv-name").fill("Duplicate");
    await page.locator("#inv-email").fill(email);
    await page.getByRole("button", { name: /send invite/i }).click();
    await expect(page.getByText(/is already a member of this workspace/i)).toBeVisible({ timeout: 60_000 });
  });
});
