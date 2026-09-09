import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDemoOrg } from "@/lib/org";
import { apiErrorMessage } from "@/lib/apikey";
import {
  authErrorMessage,
  FirebaseAuthError,
  verifyCredentials,
} from "@/lib/firebase-auth";
import {
  generateBridgeToken,
  hashBridgeToken,
  subscriptionInfo,
  BRIDGE_SESSION_DAYS,
} from "@/lib/bridge";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/*
 * POST /api/v1/bridge/login
 * Sign the Bridge desktop app into the cloud with the account credentials.
 * Body: { email, password }
 *
 * Auth rules are intentionally IDENTICAL to the cloud sign-in (/api/auth/login):
 * Firebase Auth validates the typed password — unknown emails and wrong
 * passwords are rejected with the same generic error (no auto-provisioning,
 * no write-through). Legacy plaintext accounts are migrated into Firebase
 * transparently on their next successful sign-in.
 *
 * Returns the (one-time) Bridge session token + account / organization /
 * subscription state so the desktop app can show the dashboard when the
 * subscription is valid.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    provider?: unknown;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (typeof body?.provider === "string" && body.provider !== "password") {
    return NextResponse.json(
      { ok: false, error: "Google sign-in is not available yet — sign in with your email and password." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  try {
    const demo = await ensureDemoOrg();

    // Real verification, identical to the cloud: Firebase Auth validates the
    // credentials. Same generic error for unknown email and wrong password;
    // no auto-provisioning and no write-through here.
    let identity;
    try {
      identity = await verifyCredentials(email, password);
    } catch (e) {
      if (e instanceof FirebaseAuthError) {
        const status =
          e.code === "USER_DISABLED"
            ? 403
            : e.code === "TOO_MANY_ATTEMPTS_TRY_LATER"
              ? 429
              : e.code === "MISSING_CONFIG" || e.code === "OPERATION_NOT_ALLOWED"
                ? 503
                : 401;
        return NextResponse.json(
          { ok: false, error: authErrorMessage(e, "Incorrect email or password.") },
          { status }
        );
      }
      // Not an auth failure (e.g. database unreachable) — the outer catch
      // logs it and degrades as a database failure.
      throw e;
    }

    const account = await db.userAccount.findUnique({ where: { email } });
    if (!account) {
      return NextResponse.json(
        { ok: false, error: "Incorrect email or password." },
        { status: 401 }
      );
    }
    // Keep the stored verification status fresh (Firebase is the source of truth).
    await db.userAccount
      .update({ where: { email }, data: { emailVerified: identity?.emailVerified === true } })
      .catch(() => {});

    if (!account.isActive) {
      return NextResponse.json({ ok: false, error: "This account has been disabled." }, { status: 403 });
    }

    // Tenant resolution mirrors the cloud: the account's own organization, else
    // one linked by email, else the demo tenant.
    let org = account.organizationId
      ? await db.organization.findUnique({ where: { id: account.organizationId } })
      : null;
    if (!org) org = await db.organization.findFirst({ where: { email: account.email } });
    if (!org) org = demo;
    if (!org) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No workspace could be found for this account. Sign in to the web app first to create or join a workspace.",
        },
        { status: 503 }
      );
    }

    const license = await db.licenseCode.findFirst({ where: { organizationId: org.id } });
    const subscription = subscriptionInfo(org, license);

    const token = generateBridgeToken();
    const expiresAt = new Date(Date.now() + BRIDGE_SESSION_DAYS * 24 * 60 * 60 * 1000);
    await db.bridgeSession.create({
      data: {
        organizationId: org.id,
        userId: account.id,
        tokenHash: hashBridgeToken(token),
        expiresAt,
      },
    });

    // Best-effort audit trail — never fails the login.
    await db.auditLog
      .create({
        data: {
          organizationId: org.id,
          userId: account.id,
          userName: account.name,
          action: "BRIDGE_LOGIN",
          entityType: "UserAccount",
          details: "Signed in from the Bridge desktop app",
        },
      })
      .catch(() => {});

    return NextResponse.json({
      ok: true,
      token,
      expiresAt: expiresAt.toISOString(),
      account: { name: account.name, email: account.email, role: account.role },
      organization: { id: org.id, name: org.name, slug: org.slug, plan: org.plan },
      subscription,
      dashboard: { allowed: subscription.valid },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: apiErrorMessage(e, "Unable to sign in right now. Please try again.", "bridge.login") },
      { status: 503 }
    );
  }
}
