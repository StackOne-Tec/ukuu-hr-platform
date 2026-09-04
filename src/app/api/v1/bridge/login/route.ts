import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiErrorMessage } from "@/lib/apikey";
import {
  generateBridgeToken,
  hashBridgeToken,
  subscriptionInfo,
  verifyPassword,
  BRIDGE_SESSION_DAYS,
} from "@/lib/bridge";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/*
 * POST /api/v1/bridge/login
 * Sign the Bridge desktop app into the cloud with the account credentials.
 * Body: { email, password }
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
  if (!password) {
    return NextResponse.json({ ok: false, error: "Enter your password." }, { status: 400 });
  }

  try {
    const account = await db.userAccount.findUnique({ where: { email } });
    // Same message whether the account is missing or the password is wrong,
    // so the endpoint doesn't leak which emails are registered.
    if (!account || !verifyPassword(password, account.passwordHash)) {
      return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
    }
    if (!account.isActive) {
      return NextResponse.json({ ok: false, error: "This account has been disabled." }, { status: 403 });
    }

    const org = account.organizationId
      ? await db.organization.findUnique({ where: { id: account.organizationId } })
      : await db.organization.findFirst({ where: { email: account.email } });
    if (!org) {
      return NextResponse.json(
        { ok: false, error: "Your account is not linked to an organization yet. Contact your administrator." },
        { status: 403 }
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
      { ok: false, error: apiErrorMessage(e, "Unable to sign in right now. Please try again.") },
      { status: 503 }
    );
  }
}
