import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { ctx } from "./ctx";

/**
 * Shared E2E helpers: authenticated page sessions via the real httpOnly
 * session cookie, and API-side session helpers that mirror what the app sets.
 */

/** Create org + admin user + session cookie value in one call. */
export async function provisionWorkspace(tag: string, opts: { licensed?: boolean } = {}) {
  const org = await ctx.createOrg(tag);
  const user = await ctx.createUser(tag, org.id);
  if (opts.licensed !== false) await ctx.createLicense(org.id);
  const token = await ctx.createSession(user.id, org.id);
  return { org, user, token };
}
/** Inject the session cookie into a browser context and verify the console loads. */
export async function signInAs(page: Page, token: string, opts: { licensed?: boolean } = {}) {
  await page.context().addCookies([
    {
      name: "ukuu_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/dashboard");
  if (opts.licensed !== false) {
    // AdminShell fetches /api/license/status on mount; wait until the gate resolves
    // and the workspace overview renders (the console heading, not a "Welcome").
    await expect(page.locator('h1:has-text("Workspace Overview")').first()).toBeVisible({ timeout: 60_000 });
  }
}

/** Register a brand-new workspace through the real UI signup form. */
export async function signupViaUi(page: Page, tag: string) {
  const email = `${ctx.prefix}${tag}@e2e.test`;
  await page.goto("/signup");
  await page.locator("#sg-email").fill(email);
  await page.locator("#sg-org").fill(`E2E Signup Org ${tag}`);
  await page.locator("#sg-country").selectOption("Zambia");
  await page.locator("#sg-password").fill("Sup3rSecret!");
  await page.locator("#sg-confirm").fill("Sup3rSecret!");
  await page.locator(".sg-terms input[type=checkbox]").check();
  await page.locator("button.sg-submit").click();
  return { email, password: "Sup3rSecret!" };
}

/** Sign in through the real UI form (which also sets the httpOnly cookie). */
export async function signInViaUi(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#au-email").fill(email);
  await page.locator("#au-password").fill(password);
  await page.getByRole("button", { name: /sign in to dashboard/i }).click();
}

/** Create an API key directly in Firestore (returns the plaintext the API would return once). */
export async function createApiKeyDirect(orgId: string, name: string, scopes: string) {
  const { createHash, randomBytes } = await import("node:crypto");
  const key = `ukuu_live_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(key, "utf8").digest("hex");
  const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  await ctx.firestore.collection("ApiKey").doc(id).set({
    id,
    organizationId: orgId,
    name,
    prefix: key.slice(0, 12),
    keyHash,
    lastFour: key.slice(-4),
    scopes,
    isActive: true,
    createdAt: new Date(),
  });
  return { id, key };
}

/** Convenience: unauthenticated API request helpers against the running app. */
export function api(request: APIRequestContext) {
  return {
    get: (path: string, headers: Record<string, string> = {}) => request.get(path, { headers }),
    post: (path: string, data: unknown, headers: Record<string, string> = {}) =>
      request.post(path, { data, headers }),
  };
}
