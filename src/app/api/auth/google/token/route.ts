import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ensureDemoOrg } from "@/lib/org"
import { createWebSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session"
import { logDbError } from "@/lib/db-error"
import { FirebaseAuthError, signInWithGoogleIdToken } from "@/lib/firebase-auth"
import { isSafeReturnPath } from "@/lib/google-oauth"

export const dynamic = "force-dynamic"

function makeToken(): string {
  return `ukuu_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

/**
 * Google sign-in, Firebase-native flow.
 *
 * The client runs `signInWithPopup` with the Firebase web SDK (using the
 * OAuth client Firebase auto-creates for the project) and POSTs the Google
 * id_token here. This endpoint:
 *   1. mints the Google identity into Firebase Auth (accounts:signInWithIdp),
 *   2. resolves the matching Ukuu account by email,
 *   3. creates the httpOnly session cookie (same shape as email sign-in).
 *
 * An account must already exist for the Google email — Google never
 * auto-provisions a Ukuu workspace (same rule as the OAuth redirect flow).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    idToken?: unknown
    returnUrl?: unknown
  } | null

  const idToken = typeof body?.idToken === "string" ? body.idToken.trim() : ""
  const returnUrl =
    typeof body?.returnUrl === "string" && isSafeReturnPath(body.returnUrl)
      ? body.returnUrl
      : "/dashboard"

  if (!idToken) {
    return NextResponse.json(
      { ok: false, error: "Google sign-in could not be verified. Please try again." },
      { status: 400 }
    )
  }

  try {
    const identity = await signInWithGoogleIdToken(idToken)
    const email = identity.email.toLowerCase()
    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Google did not return a verified email address." },
        { status: 400 }
      )
    }

    const user = await db.userAccount.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "No Ukuu HR account exists for that Google email. Create an account first.",
        },
        { status: 404 }
      )
    }

    // The account's Firebase uid can drift when the same email signs in through
    // different providers — keep it pointed at the latest Firebase identity.
    if (user.firebaseUid && user.firebaseUid !== identity.uid) {
      await db.userAccount
        .update({ where: { id: user.id }, data: { firebaseUid: identity.uid } })
        .catch(() => {})
    }

    let organizationId = user.organizationId ?? null
    if (!organizationId) {
      const demo = await ensureDemoOrg()
      organizationId = demo?.id ?? null
    }
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: "No workspace is associated with this account." },
        { status: 404 }
      )
    }

    const sessionToken = await createWebSession({
      userId: user.id,
      organizationId,
      remember: true,
    })

    const res = NextResponse.json({
      ok: true,
      user: { email, name: user.name ?? "" },
      token: makeToken(),
      organizationId,
      returnUrl,
    })
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_DAYS * 86400,
    })
    return res
  } catch (e) {
    // A Google token the IdP rejected is a bad request, not an outage.
    if (
      e instanceof FirebaseAuthError &&
      (e.code.startsWith("INVALID_IDP_RESPONSE") || e.code === "INVALID_ID_TOKEN")
    ) {
      return NextResponse.json(
        { ok: false, error: "Google sign-in could not be verified. Please try again." },
        { status: 400 }
      )
    }
    logDbError(e, "auth.google.token")
    return NextResponse.json(
      { ok: false, error: "Google sign-in is temporarily unavailable. Please try again." },
      { status: 503 }
    )
  }
}