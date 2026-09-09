import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { ctx } from "./ctx";

/**
 * "Continue with Google" — server-side Google OAuth (start → consent → callback).
 *
 * Everything up to Google's consent screen is exercised here without needing a
 * human Google account:
 *   - the login page button contract (href → /api/auth/google/start),
 *   - the start route's redirect contract: correct client_id, redirect_uri
 *     (WITH the :3000 port — `hostname` would drop it and Google rejects the
 *     URI character-for-character), OAuth scope, CSRF state + httpOnly cookie,
 *   - the callback's pre-token error paths (cancelled / missing params /
 *     forged state) — these run before any Google network call, so they are
 *     fully hermetic,
 *   - the live Google handshake: following the start redirect must NOT land on
 *     Google's OAuth error page. This is the test that proves the console
 *     client registration — it currently FAILS (with Google's exact error:
 *     `redirect_uri_mismatch` / `deleted_client`) because GOOGLE_CLIENT_ID in
 *     .env.local belongs to a different GCP project with no matching callback
 *     URI. The moment a valid client is configured, it turns green.
 *
 * The final sign-in (consent → callback → session cookie) needs real Google
 * credentials and is opt-in via E2E_GOOGLE_EMAIL / E2E_GOOGLE_PASSWORD.
 */

/* Minimal .env.local loader (Playwright doesn't load dotfiles). */
function envValue(key: string): string {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*$`));
      if (!m) continue;
      const v = m[1];
      return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
        ? v.slice(1, -1)
        : v;
    }
  } catch {
    /* missing file */
  }
  return "";
}

const GOOGLE_CLIENT_ID = envValue("GOOGLE_CLIENT_ID");
const START_PATH = "/api/auth/google/start?mode=signin";
const CALLBACK_PATH = "/api/auth/google/callback";

test.describe("Continue with Google", () => {
  test("login page shows the Google button pointing at the start endpoint", async ({ page }) => {
    await page.goto("/login");
    const button = page.getByRole("link", { name: /continue with google/i });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("href", /\/api\/auth\/google\/start\?mode=signin/);
  });

  test("start route redirects to Google with the full OAuth contract", async ({ request }) => {
    const res = await request.get(START_PATH, { maxRedirects: 0 });
    expect(res.status()).toBe(307);

    const location = new URL(res.headers()["location"] ?? "");
    expect(`${location.origin}${location.pathname}`).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );

    const params = location.searchParams;
    expect(params.get("response_type")).toBe("code");
    expect(params.get("scope")).toBe("openid email profile");
    expect(params.get("prompt")).toBe("select_account");
    expect(params.get("state")).toBeTruthy();

    // The client and callback URI must match what's configured in .env.local.
    expect(params.get("client_id")).toBe(GOOGLE_CLIENT_ID);
    expect(params.get("redirect_uri")).toBe("http://localhost:3000/api/auth/google/callback");

    // CSRF state cookie is planted on the redirect (httpOnly).
    const setCookie = res.headers()["set-cookie"] ?? "";
    expect(setCookie).toContain("ukuu_google_oauth_state=");
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  test("the callback URI is actually registered — Google shows consent, not an error", async ({
    page,
    request,
  }) => {
    test.skip(
      !GOOGLE_CLIENT_ID,
      "GOOGLE_CLIENT_ID is not configured in .env.local — the start route cannot run."
    );

    const res = await request.get(START_PATH, { maxRedirects: 0 });
    const location = res.headers()["location"]!;

    // Follow the redirect in a real browser. A valid client + registered
    // callback URI lands on Google's sign-in/consent page; a misconfigured
    // client lands on accounts.google.com/signin/oauth/error (and this test
    // fails, showing Google's exact reason in the URL).
    await page.goto(location, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2_000);

    const finalUrl = page.url();
    expect(finalUrl).toContain("accounts.google.com");
    expect(finalUrl).not.toContain("signin/oauth/error");
    expect(finalUrl).not.toContain("redirect_uri_mismatch");
  });
});

test.describe("Google callback error paths (no Google call made)", () => {
  test("?error=access_denied redirects back with a friendly banner", async ({ request }) => {
    const res = await request.get(`${CALLBACK_PATH}?error=access_denied`, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const loc = new URL(res.headers()["location"] ?? "");
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("oauth_error")).toContain("cancelled");
  });

  test("missing code/state is rejected", async ({ request }) => {
    const res = await request.get(CALLBACK_PATH, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const loc = new URL(res.headers()["location"] ?? "");
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("oauth_error")).toContain("could not be verified");
  });

  test("a forged state is rejected even with a cookie planted", async ({ request }) => {
    // Plant the real CSRF cookie, then present a different (forged) state.
    await request.get(START_PATH, { maxRedirects: 0 });
    const res = await request.get(`${CALLBACK_PATH}?code=fake-code&state=forged-state`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(307);
    const loc = new URL(res.headers()["location"] ?? "");
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("oauth_error")).toContain("could not be verified");
  });

  test("the oauth_error banner renders on the login page", async ({ page }) => {
    await page.goto("/login?oauth_error=Google%20sign-in%20was%20cancelled.");
    await expect(page.getByText("Google sign-in was cancelled.")).toBeVisible();
  });
});

test.describe("Full Google sign-in (opt-in)", () => {
  test("consent → callback → session cookie → dashboard", async ({ page, request }) => {
    const email = process.env.E2E_GOOGLE_EMAIL?.trim();
    const password = process.env.E2E_GOOGLE_PASSWORD?.trim();
    test.skip(
      !email || !password,
      "Set E2E_GOOGLE_EMAIL / E2E_GOOGLE_PASSWORD to run the full Google login. " +
        "The consent step needs the OAuth client configured (see the 'consent' test above)."
    );
    const googleEmail = email!;
    const googlePassword = password!;

    // Provision a workspace whose admin account matches the Google email.
    const tag = `gg${Date.now().toString(36).slice(-5)}`;
    const org = await ctx.createOrg(tag);
    await ctx.createLicense(org.id);
    const userId = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    await ctx.firestore.collection("UserAccount").doc(userId).set({
      id: userId,
      organizationId: org.id,
      name: "Google E2E Admin",
      email,
      role: "Admin",
      passwordHash: null,
      isActive: true,
      emailVerified: true,
      createdAt: new Date(),
    });

    await page.goto("/login");
    await page.getByRole("link", { name: /continue with google/i }).click();

    // Google consent — fill real credentials (may need 2FA/captcha in the UI).
    await page.getByRole("textbox", { name: /email or phone/i }).fill(googleEmail);
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("textbox", { name: /password/i }).fill(googlePassword);
    await page.getByRole("button", { name: /next/i }).click();

    // Lands back on /api/auth/google/callback → session cookie → dashboard.
    await page.waitForURL(/\/(dashboard|api\/auth\/google\/callback)/, { timeout: 120_000 });
    await expect(page.locator("body")).toContainText(org.name, { timeout: 60_000 });
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name === "ukuu_session" && c.httpOnly)).toBe(true);
  });
});