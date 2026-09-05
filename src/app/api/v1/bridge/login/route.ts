import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDemoOrg } from "@/lib/org";
import { apiErrorMessage } from "@/lib/apikey";
import {
  generateBridgeToken,
  hashBridgeToken,
  subscriptionInfo,
  BRIDGE_SESSION_DAYS,
} from "@/lib/bridge";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  if (parts.length === 0) return "Ukuu User";
  if (parts.length === 1) return `${parts[0]} User`;
  return parts.slice(0, 2).join(" ");
}

/*
 * POST /api/v1/bridge/login
 * Sign the Bridge desktop app into the cloud with the account credentials.
 * Body: { email, password }
 *
 * Auth rules are intentionally IDENTICAL to the cloud sign-in (/api/auth/login):
 * any syntactically valid email + password of at least 6 characters is accepted
 * (demo/mock auth), so the credentials that work on the cloud always work here.
 * The password is stored on the account on every sign-in, and an unknown email
 * is provisioned onto the demo tenant exactly like the cloud does — no account
 * can be left behind with credentials that work in one place but not the other.
 * Swap both endpoints over to a real identity provider together when one lands.
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

    // Mirror the cloud: an unknown email with a valid password provisions an
    // account on the shared demo tenant, so any credentials that would sign in
    // on the cloud sign in here too.
    let account = await db.userAccount.findUnique({ where: { email } });
    if (!account) {
      account = await db.userAccount.create({
        data: {
          email,
          name: nameFromEmail(email),
          organizationId: demo?.id ?? null,
          role: "Admin",
          passwordHash: password,
        },
      });
    } else if (password) {
      // Write-through, same as /api/auth/login: keep the stored password in
      // sync with the credentials the user signs in with (plaintext mock auth —
      // the whole platform uses this convention until a real IdP lands).
      await db.userAccount.update({
        where: { id: account.id },
        data: { passwordHash: password },
      });
    }

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
        { ok: false, error: "The database is temporarily unreachable. Please try again in a moment." },
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
      { ok: false, error: apiErrorMessage(e, "Unable to sign in right now. Please try again.") },
      { status: 503 }
    );
  }
}
