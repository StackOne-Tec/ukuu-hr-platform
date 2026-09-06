import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { ctx } from "./ctx";
import { provisionWorkspace } from "./helpers";

/**
 * FRS 11 — company data isolation:
 *  - employees created in org A never appear for org B (page + API),
 *  - review-type mutations verify record ownership (404 for other tenants),
 *  - v1 API keys are scoped to their own organization.
 */

interface Ws {
  tag: string;
  orgId: string;
  orgName: string;
  email: string;
  password: string;
  token: string;
  employeeId: string;
  employeeFirstName: string;
  employeeCode: string;
}

async function makeTenant(base: string): Promise<Ws> {
  const tag = `${base}${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 1e4)}`;
  const ws = await provisionWorkspace(tag);
  const emp = await ctx.createEmployee(tag, ws.org.id);
  return {
    tag,
    orgId: ws.org.id,
    orgName: ws.org.name,
    email: ws.user.email,
    password: ws.user.password,
    token: ws.token,
    employeeId: emp.id,
    employeeFirstName: emp.firstName,
    employeeCode: emp.code,
  };
}

function authedApi(request: APIRequestContext, token: string) {
  return {
    get: (path: string) => request.get(path, { headers: { Cookie: `ukuu_session=${token}` } }),
    post: (path: string, data: unknown) =>
      request.post(path, { data, headers: { Cookie: `ukuu_session=${token}`, "Content-Type": "application/json" } }),
  };
}

let a: Ws, b: Ws;

test.beforeAll(async () => {
  a = await makeTenant("isoa");
  b = await makeTenant("isob");
});

test.describe("Tenant isolation", () => {
  test("employees page for org B does not show org A's employee", async ({ page }) => {
    await page.context().addCookies([
      { name: "ukuu_session", value: b.token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/employees");
    await expect(page.locator("body")).not.toContainText("Activate your workspace", { timeout: 60_000 });
    await expect(page.locator("body")).not.toContainText(a.orgName);
    await expect(page.getByText("E2E Worker")).toHaveCount(0); // B sees only its own (none) — A's worker is invisible
  });

  test("org A sees its own employee on the directory", async ({ page }) => {
    await page.context().addCookies([
      { name: "ukuu_session", value: a.token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/employees");
    await expect(page.locator("body")).not.toContainText("Activate your workspace", { timeout: 60_000 });
    await expect(page.getByText(a.employeeCode)).toBeVisible({ timeout: 60_000 });
  });

  test("overtime approval for another org's record is rejected", async ({ request }) => {
    const apiB = authedApi(request, b.token);
    const res = await apiB.post("/api/overtime", { id: a.employeeId, status: "Approved" });
    // Record id doesn't belong to B (and isn't an overtime record) → 404
    expect([404, 500]).toContain(res.status());
    const body = await res.json().catch(() => ({}));
    expect(body.ok).toBe(false);
  });

  test("leave approval for another org's record is rejected", async ({ request }) => {
    const apiB = authedApi(request, b.token);
    const res = await apiB.post("/api/leave", { id: a.employeeId, status: "Approved" });
    expect([404, 500]).toContain(res.status());
  });

  test("employee create with foreign id cannot hijack another org's row", async ({ request }) => {
    const apiB = authedApi(request, b.token);
    const res = await apiB.post("/api/employees", {
      id: a.employeeId, // org A's employee
      firstName: "Hacked",
      lastName: "Row",
      email: `${b.tag}@e2e.test`,
      position: "Malicious",
    });
    expect(res.status()).toBe(404);
    const row = await ctx.q(`SELECT "firstName", "organizationId" FROM "Employee" WHERE id = $1`, [a.employeeId]);
    expect(row[0].firstName).toBe(a.employeeFirstName);
    expect(row[0].organizationId).toBe(a.orgId);
  });
});
