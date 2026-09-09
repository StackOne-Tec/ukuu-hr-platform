import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logDbError } from "@/lib/db-error"
import { ensureDemoOrg } from "@/lib/org"
import { createWebSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session"
import { signInWithGoogleIdToken } from "@/lib/firebase-auth"
import {
  decodeOAuthState,
  googleClientId,
  googleClientSecret,
  googleCookieOptions,
  GOOGLE_STATE_COOKIE,
  isSafeReturnPath,
} from "@/lib/google-oauth"

export const dynamic = "force-dynamic"

function redirectWithError(req: NextRequest, message: string) {
  const url = new URL("/login", req.nextUrl.origin)
  url.searchParams.set("oauth_error", message)
  const res = NextResponse.redirect(url)
  res.cookies.delete(GOOGLE_STATE_COOKIE)
  return res
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const encodedState = req.nextUrl.searchParams.get("state")
  const oauthError = req.nextUrl.searchParams.get("error")
  const cookieState = req.cookies.get(GOOGLE_STATE_COOKIE)?.value

  if (oauthError) return redirectWithError(req, "Google sign-in was cancelled.")
  if (!code || !encodedState || !cookieState) {
    return redirectWithError(req, "Google sign-in could not be verified. Please try again.")
  }

  const state = decodeOAuthState(encodedState)
  if (!state || state.state !== cookieState) {
    return redirectWithError(req, "Google sign-in could not be verified. Please try again.")
  }

  const clientId = googleClientId()
  const clientSecret = googleClientSecret()
  if (!clientId || !clientSecret) {
    return redirectWithError(req, "Google sign-in is not configured on this deployment.")
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: state.redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
      // Never let a stalled Google token exchange hang the callback.
      signal: AbortSignal.timeout(20_000),
    })
    const token = (await tokenResponse.json().catch(() => null)) as {
      access_token?: string
      id_token?: string
    } | null
    if (!tokenResponse.ok || !token?.access_token) {
      return redirectWithError(req, "Google sign-in could not be completed. Please try again.")
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    const profile = (await profileResponse.json().catch(() => null)) as {
      sub?: string
      email?: string
      email_verified?: boolean
      name?: string
    } | null
    const email = profile?.email?.trim().toLowerCase() ?? ""
    if (!profileResponse.ok || !profile?.sub || !email || profile.email_verified !== true) {
      return redirectWithError(req, "Google did not return a verified email address.")
    }

    const user = await db.userAccount.findUnique({ where: { email } })
    if (!user) {
      return redirectWithError(req, "No Ukuu HR account exists for that Google email. Create an account first.")
    }

    // Mint the Google identity into Firebase Auth so the account also exists
    // there (best-effort — Google's own token verification above is the trust
    // anchor, so a failure here never blocks sign-in).
    if (token.id_token) {
      try {
        const fb = await signInWithGoogleIdToken(token.id_token)
        if (fb.uid && fb.uid !== user.firebaseUid) {
          await db.userAccount
            .update({ where: { id: user.id }, data: { firebaseUid: fb.uid } })
            .catch(() => {})
        }
      } catch (e) {
        logDbError(e, "auth.google.callback.mint")
      }
    }

    let organizationId = user.organizationId ?? null
    if (!organizationId) {
      const demo = await ensureDemoOrg()
      organizationId = demo?.id ?? null
    }
    if (!organizationId) return redirectWithError(req, "No workspace is associated with this account.")

    const sessionToken = await createWebSession({
      userId: user.id,
      organizationId,
      remember: true,
    })
    const destination = isSafeReturnPath(state.returnPath) ? state.returnPath : "/dashboard"
    const res = NextResponse.redirect(new URL(destination, req.nextUrl.origin))
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      ...googleCookieOptions(),
      maxAge: SESSION_DAYS * 86400,
    })
    res.cookies.delete(GOOGLE_STATE_COOKIE)
    return res
  } catch (e) {
    logDbError(e, "auth.google.callback")
    return redirectWithError(req, "Google sign-in is temporarily unavailable. Please try again.")
  }
}
