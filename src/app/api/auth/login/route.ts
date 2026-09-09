import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ensureDemoOrg } from "@/lib/org"
import { createWebSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session"
import { dbErrorMessage, logDbError } from "@/lib/db-error"
import {
  authErrorMessage,
  FirebaseAuthError,
  verifyCredentials,
} from "@/lib/firebase-auth"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? ""
  const parts = local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
  if (parts.length === 0) return "Ukuu User"
  if (parts.length === 1) return `${parts[0]} User`
  return parts.slice(0, 2).join(" ")
}

function makeToken(): string {
  return `ukuu_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

/**
 * Sign-in. Verifies the typed password against the credential stored on the
 * account — no more accepting any >=6-char password. Unknown emails and wrong
 * passwords get the same generic rejection (no auto-provisioning, no
 * write-through). Tenant resolution: the signed-in user's own organization
 * (company data isolation).
 * A server-side httpOnly session cookie is set so pages and API routes can
 * scope every query to the signed-in user's organization.
 *
 * NOTE: stored credentials are currently plaintext mock-auth; the comparison
 * below is where a real hashed-password check (e.g. bcrypt) slots in when an
 * identity provider lands.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: unknown
    password?: unknown
    remember?: unknown
  } | null

  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    )
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    )
  }

  /* simulate verification latency */
  await new Promise((r) => setTimeout(r, 550))

  const remember = body?.remember === true

  try {
    const demo = await ensureDemoOrg()
    // Credentials are verified by Firebase Auth (never by comparing stored
    // plaintext). Legacy plaintext accounts are migrated transparently on
    // their next successful sign-in. Same generic error for unknown email and
    // wrong password (no account enumeration).
    const identity = await verifyCredentials(email, password)
    const user = await db.userAccount.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Incorrect email or password." },
        { status: 401 }
      )
    }
    // Keep the stored verification status fresh so sensitive actions can be
    // gated on it (Firebase is the source of truth).
    await db.userAccount
      .update({ where: { email }, data: { emailVerified: identity.emailVerified === true } })
      .catch(() => {})
    const organizationId = user.organizationId ?? demo?.id ?? null
    const sessionToken = organizationId
      ? await createWebSession({ userId: user.id, organizationId, remember })
      : null

    const res = NextResponse.json({
      ok: true,
      user: { email, name: user.name || nameFromEmail(email) },
      token: makeToken(),
      session: remember ? "persistent" : "ephemeral",
      organizationId,
    })
    if (sessionToken) {
      res.cookies.set(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: remember ? SESSION_DAYS * 86400 : undefined,
      })
    }
    return res
  } catch (e) {
    // Firebase credential failures get a friendly message and a real status
    // code; everything else (e.g. the database being unreachable) is logged
    // and degraded as a database failure.
    if (e instanceof FirebaseAuthError) {
      const status =
        e.code === "USER_DISABLED"
          ? 403
          : e.code === "TOO_MANY_ATTEMPTS_TRY_LATER"
            ? 429
            : e.code === "MISSING_CONFIG" || e.code === "OPERATION_NOT_ALLOWED"
              ? 503
              : 401
      return NextResponse.json(
        { ok: false, error: authErrorMessage(e, "Incorrect email or password.") },
        { status }
      )
    }
    logDbError(e, "auth.login")
    return NextResponse.json(
      { ok: false, error: dbErrorMessage(e) },
      { status: 503 }
    )
  }
}