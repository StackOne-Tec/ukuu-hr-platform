import { test, expect } from "@playwright/test";
import { ctx } from "./ctx";
import { signInViaUi, signupViaUi } from "./helpers";

/**
 * Authentication flows through the real UI:
 * signup provisions an isolated tenant, login sets the server session cookie,
 * logout destroys it. Validation errors surface in the form.
 */

test.describe("Signup → isolated workspace", () => {
  test("creating an account provisions a new organization and lands on login", async ({ page }) => {
    const tag = `su${Date.now().toString(36).slice(-5)}`;
    const { email } = await signupViaUi(page, tag);

    // Success banner appears, then redirect to /login?welcome=1
    await expect(page.locator(".sg-banner--success")).toBeVisible({ timeout: 30_000 });
    await page.waitForURL(/\/login\?welcome=1/, { timeout: 30_000 });

    // Workspace banner after redirect
    await expect(page.locator(".au-banner--success")).toContainText("Workspace created successfully");

    // The organization really exists, isolated, with its admin account.
    // (Firestore-native assertion — the org is found via the admin user's
    // organizationId, since the signup UI sends an org name, not a slug.)
    const users = await ctx.firestore.collection("UserAccount").where("email", "==", email).get();
    expect(users.size).toBe(1);
    const orgId = users.docs[0].data().organizationId as string;
    expect(orgId).toBeTruthy();
    const org = await ctx.firestore.collection("Organization").doc(orgId).get();
    expect(org.exists).toBe(true);
    expect(org.data()?.name).toBe(`E2E Signup Org ${tag}`);
  });

  test("signup validation blocks bad input client-side", async ({ page }) => {
    await page.goto("/signup");
    await page.locator("#sg-email").fill("not-an-email");
    await page.locator("button.sg-submit").click();
    await expect(page.locator(".sg-err").first()).toBeVisible();
    // Still on /signup
    expect(new URL(page.url()).pathname).toBe("/signup");
  });
});

test.describe("Sign in", () => {
  test("valid credentials set the httpOnly session cookie and reach the dashboard", async ({ page }) => {
    const tag = `li${Date.now().toString(36).slice(-5)}`;
    const org = await ctx.createOrg(tag);
    const user = await ctx.createUser(tag, org.id);
    await ctx.createLicense(org.id);

    await signInViaUi(page, user.email, user.password);

    // Redirects into the console
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });

    // The cookie is httpOnly and set by the server (not readable from JS)
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "ukuu_session");
    expect(session).toBeTruthy();
    expect(session!.httpOnly).toBe(true);

    // Dashboard shell renders with the org name
    await expect(page.locator("body")).toContainText(org.name, { timeout: 60_000 });
  });

  test("a wrong password for an existing account is rejected", async ({ page }) => {
    const tag = `wp${Date.now().toString(36).slice(-5)}`;
    const org = await ctx.createOrg(tag);
    const user = await ctx.createUser(tag, org.id);
    await ctx.createLicense(org.id);

    await page.goto("/login");
    await page.locator("#au-email").fill(user.email);
    await page.locator("#au-password").fill("WrongPassw0rd!"); // valid length, wrong value
    await page.getByRole("button", { name: /sign in to dashboard/i }).click();

    // Server rejects the mismatch with a readable error and stays on login.
    await expect(page.getByText("Incorrect email or password.")).toBeVisible({ timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe("/login");

    // The same email with its real password still signs in.
    await page.locator("#au-password").fill(user.password);
    await page.getByRole("button", { name: /sign in to dashboard/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
    await expect(page.locator("body")).toContainText(org.name, { timeout: 60_000 });
  });

  test("an unknown email is rejected — accounts are created via signup only", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#au-email").fill(`${ctx.prefix}nobody-${Date.now().toString(36).slice(-5)}@e2e.test`);
    await page.locator("#au-password").fill("SomePassw0rd!");
    await page.getByRole("button", { name: /sign in to dashboard/i }).click();

    await expect(page.getByText("Incorrect email or password.")).toBeVisible({ timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe("/login");
  });

  test("forgot-password flow shows the confirmation state", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot?" }).click();
    await page.locator("#au-email").fill(`${ctx.prefix}forgot@e2e.test`);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText("Check your inbox")).toBeVisible();
  });
});

test.describe("Sign out", () => {
  test("signing out clears the session and returns to login", async ({ page }) => {
    const tag = `so${Date.now().toString(36).slice(-5)}`;
    const org = await ctx.createOrg(tag);
    const user = await ctx.createUser(tag, org.id);
    await ctx.createLicense(org.id);
    const token = await ctx.createSession(user.id, org.id);

    await page.context().addCookies([
      { name: "ukuu_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/dashboard");
    await expect(page.locator("body")).toContainText(org.name, { timeout: 60_000 });

    // Sign out via the sidebar footer button
    const signOut = page.getByRole("button", { name: /sign out/i }).first();
    await signOut.click();

    await page.waitForURL(/\/login/, { timeout: 30_000 });

    // The server-side session must be gone: reusing the old cookie lands on login again.
    await page.context().addCookies([
      { name: "ukuu_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/dashboard");
    // No license/session → app degrades to login/demo. Either way, no org content.
    await expect(page.locator("body")).not.toContainText(`E2E Org ${tag}`, { timeout: 20_000 });
  });
});
